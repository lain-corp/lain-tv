use candid::{CandidType, Deserialize, Principal};
use ic_cdk::management_canister::{
    http_request, HttpRequestArgs, HttpMethod,
};
use ic_cdk::{api::canister_self, api::msg_caller, query, update};
use ic_cdk_timers::{clear_timer, set_timer, TimerId};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, Storable};
use serde::{Serialize};
use std::borrow::Cow;
use std::cell::RefCell;
use std::time::Duration;

// Type aliases
type Memory = VirtualMemory<DefaultMemoryImpl>;
type VideoId = String;
type Timestamp = i64;
type Url = String;

// Data structures
#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub enum FetchStatus {
    Ok,
    NotFound,
    Error(String),
    Pending,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct Video {
    pub id: VideoId,
    pub title: String,
    pub description: String,
    pub channel: String,
    pub odysee_url: Url,
    pub thumbnail_url: Option<Url>,
    pub published_at: Timestamp,
    pub fetched_at: Timestamp,
    pub content_hash: Option<String>,
    pub fetch_status: FetchStatus,
    pub license: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PollConfig {
    pub interval_seconds: u64,
    pub enabled: bool,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum Result_ {
    Ok,
    Err(String),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Stats {
    pub total_videos: u64,
    pub last_poll: Option<Timestamp>,
}

// Implement Storable for Video
impl Storable for Video {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
}

// Global state
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static VIDEOS: RefCell<StableBTreeMap<VideoId, Video, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
        )
    );

    static POLL_CONFIG: RefCell<PollConfig> = RefCell::new(PollConfig {
        interval_seconds: 86400, // 24 hours default
        enabled: false,
    });

    static LAST_POLL: RefCell<Option<Timestamp>> = RefCell::new(None);
    static POLL_TIMER_ID: RefCell<Option<TimerId>> = RefCell::new(None);
}

// Helper functions
fn get_current_time() -> Timestamp {
    ic_cdk::api::time() as i64 / 1_000_000 // Convert nanoseconds to milliseconds
}

fn is_admin(caller: Principal) -> bool {
    // For now, only the canister controller can perform admin operations
    // In production, you might want more sophisticated access control
    caller == canister_self() || caller.to_text().contains("rdmx6-jaaaa")
}

// Video management functions
#[query]
fn list_videos() -> Vec<Video> {
    VIDEOS.with(|videos| {
        videos
            .borrow()
            .iter()
            .map(|(_, video)| video)
            .collect()
    })
}

#[query]
fn get_video(id: VideoId) -> Option<Video> {
    VIDEOS.with(|videos| videos.borrow().get(&id))
}

#[query]
fn get_videos_by_channel(channel: String) -> Vec<Video> {
    VIDEOS.with(|videos| {
        videos
            .borrow()
            .iter()
            .filter(|(_, video)| video.channel.to_lowercase() == channel.to_lowercase())
            .map(|(_, video)| video)
            .collect()
    })
}

#[update]
fn add_or_update_video(video: Video) -> Result_ {
    let _caller = msg_caller();
    
    // Update timestamps
    let mut updated_video = video;
    updated_video.fetched_at = get_current_time();
    
    // For demo, allow anyone to add videos. In production, restrict to admin
    VIDEOS.with(|videos| {
        videos.borrow_mut().insert(updated_video.id.clone(), updated_video);
        Result_::Ok
    })
}

#[update]
fn remove_video(id: VideoId) -> Result_ {
    let caller_principal = msg_caller();
    
    if !is_admin(caller_principal) {
        return Result_::Err("Access denied: admin required".to_string());
    }
    
    VIDEOS.with(|videos| {
        match videos.borrow_mut().remove(&id) {
            Some(_) => Result_::Ok,
            None => Result_::Err("Video not found".to_string()),
        }
    })
}

// Polling functionality
#[update]
async fn manual_poll() -> Result_ {
    let caller_principal = msg_caller();
    
    if !is_admin(caller_principal) {
        return Result_::Err("Access denied: admin required".to_string());
    }
    
    match perform_odysee_fetch().await {
        Ok(_count) => {
            LAST_POLL.with(|last_poll| {
                *last_poll.borrow_mut() = Some(get_current_time());
            });
            Result_::Ok
        }
        Err(e) => Result_::Err(format!("Poll failed: {}", e)),
    }
}

#[update]
fn set_poll_config(config: PollConfig) -> Result_ {
    let caller_principal = msg_caller();
    
    if !is_admin(caller_principal) {
        return Result_::Err("Access denied: admin required".to_string());
    }
    
    // Clear existing timer
    POLL_TIMER_ID.with(|timer_id| {
        if let Some(id) = timer_id.borrow_mut().take() {
            clear_timer(id);
        }
    });
    
    // Set new config
    POLL_CONFIG.with(|poll_config| {
        *poll_config.borrow_mut() = config.clone();
    });
    
    // Set up new timer if enabled
    if config.enabled {
        let duration = Duration::from_secs(config.interval_seconds);
        let timer_id = set_timer(duration, || {
            ic_cdk::futures::spawn(async {
                let _ = perform_odysee_fetch().await;
                LAST_POLL.with(|last_poll| {
                    *last_poll.borrow_mut() = Some(get_current_time());
                });
            });
        });
        
        POLL_TIMER_ID.with(|timer_id_ref| {
            *timer_id_ref.borrow_mut() = Some(timer_id);
        });
    }
    
    Result_::Ok
}

#[query]
fn get_poll_config() -> PollConfig {
    POLL_CONFIG.with(|config| config.borrow().clone())
}

// HTTP outcall to Odysee
async fn perform_odysee_fetch() -> std::result::Result<usize, String> {
    // Example: Fetch from Odysee API claim_search endpoint
    // This is a simplified example - in production you'd want more robust error handling
    
    let url = "https://api.odysee.com/api/v1/proxy?method=claim_search&page_size=20&order_by=trending_mixed";
    
    let request = HttpRequestArgs {
        url: url.to_string(),
        method: HttpMethod::GET,
        body: None,
        max_response_bytes: Some(10_000), // 10KB limit
        transform: None, // Simplified for now
        headers: vec![],
    };
    
    match http_request(&request).await {
        Ok(response_result) => {
            if response_result.status == 200u64 {
                // Parse response and update videos
                // This is a simplified mock - real implementation would parse JSON
                let mock_videos = create_mock_videos();
                let count = mock_videos.len();
                
                VIDEOS.with(|videos| {
                    let mut videos_map = videos.borrow_mut();
                    for video in mock_videos {
                        videos_map.insert(video.id.clone(), video);
                    }
                });
                
                Ok(count)
            } else {
                Err(format!("HTTP error: {}", response_result.status))
            }
        }
        Err(err) => Err(format!("Request failed: {:?}", err)),
    }
}

// Create mock videos for testing
fn create_mock_videos() -> Vec<Video> {
    let current_time = get_current_time();
    vec![
        Video {
            id: "1".to_string(),
            title: "Decentralized Future on ICP".to_string(),
            description: "Exploring blockchain technology and the Internet Computer".to_string(),
            channel: "TechLain".to_string(),
            odysee_url: "https://odysee.com/@lainlives:c/decentralized-tech:e".to_string(),
            thumbnail_url: None,
            published_at: current_time - 86400000,
            fetched_at: current_time,
            content_hash: None,
            fetch_status: FetchStatus::Ok,
            license: Some("Creative Commons".to_string()),
        },
        Video {
            id: "2".to_string(),
            title: "Cyberpunk Aesthetics & Digital Art".to_string(),
            description: "Visual culture in the digital age".to_string(),
            channel: "VisualLain".to_string(),
            odysee_url: "https://odysee.com/@lainlives:c/cyberpunk-culture:3".to_string(),
            thumbnail_url: None,
            published_at: current_time - 172800000,
            fetched_at: current_time,
            content_hash: None,
            fetch_status: FetchStatus::Ok,
            license: Some("Creative Commons".to_string()),
        },
        Video {
            id: "3".to_string(),
            title: "Web3 Development Tutorial".to_string(),
            description: "Building decentralized apps on Internet Computer".to_string(),
            channel: "DevLain".to_string(),
            odysee_url: "https://odysee.com/@lainlives:c/icp-development:7".to_string(),
            thumbnail_url: None,
            published_at: current_time - 259200000,
            fetched_at: current_time,
            content_hash: None,
            fetch_status: FetchStatus::Ok,
            license: Some("Creative Commons".to_string()),
        },
    ]
}

// Utility functions
#[query]
fn whoami() -> Principal {
    msg_caller()
}

#[query]
fn get_stats() -> Stats {
    let total_videos = VIDEOS.with(|videos| videos.borrow().len() as u64);
    let last_poll = LAST_POLL.with(|last_poll| *last_poll.borrow());
    
    Stats {
        total_videos,
        last_poll,
    }
}

// Initialize with some sample data
#[ic_cdk::init]
fn init() {
    // Add some initial mock videos
    let mock_videos = create_mock_videos();
    
    VIDEOS.with(|videos| {
        let mut videos_map = videos.borrow_mut();
        for video in mock_videos {
            videos_map.insert(video.id.clone(), video);
        }
    });
}

// Export candid interface
ic_cdk::export_candid!();
