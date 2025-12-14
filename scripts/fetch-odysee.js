#!/usr/bin/env node
/**
 * Odysee Video Fetcher
 * 
 * Fetches videos from Odysee by category:
 * - 100 featured videos per category (shown in channel guide)
 * - 10,000 searchable videos per category (only found via search)
 * 
 * Usage: 
 *   node scripts/fetch-odysee.js              # Fetch featured only (quick)
 *   node scripts/fetch-odysee.js --full       # Fetch featured + searchable (takes time)
 *   node scripts/fetch-odysee.js --category tech --full  # Fetch specific category
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Odysee Official Categories mapped to their discover page tags
const CATEGORY_TAGS = {
  discover: [], // General trending - no tag filter
  artists: ['art', 'artists', 'artwork', 'digital art', 'drawing', 'painting', 'illustration'],
  tech: ['technology', 'tech', 'programming', 'software', 'coding', 'computer', 'linux', 'open source'],
  gaming: ['gaming', 'games', 'video games', 'gameplay', 'game', 'lets play', 'walkthrough'],
  music: ['music', 'song', 'songs', 'musician', 'cover', 'original music', 'remix'],
  sports: ['sports', 'fitness', 'workout', 'exercise', 'football', 'basketball', 'soccer'],
  news: ['news', 'politics', 'current events', 'political', 'journalism', 'commentary'],
  movies: ['movies', 'film', 'cinema', 'movie', 'documentary', 'short film'],
  education: ['education', 'educational', 'tutorial', 'how to', 'learn', 'science'],
  comedy: ['comedy', 'funny', 'humor', 'memes', 'meme', 'satire', 'parody'],
  lifestyle: ['lifestyle', 'vlog', 'daily', 'life', 'travel', 'food', 'cooking'],
};

const CATEGORIES = Object.keys(CATEGORY_TAGS);

// Configuration
const FEATURED_PER_CATEGORY = 100;
const SEARCHABLE_PER_CATEGORY = 10000;
const PAGE_SIZE = 50; // Odysee API max per request
const OUTPUT_DIR = __dirname;
const ODYSEE_API = 'https://api.na-backend.odysee.com/api/v1/proxy';

// Parse CLI arguments
const args = process.argv.slice(2);
const FULL_MODE = args.includes('--full');
const CATEGORY_ARG = args.includes('--category') ? args[args.indexOf('--category') + 1] : null;
const CATEGORIES_TO_FETCH = CATEGORY_ARG ? [CATEGORY_ARG] : CATEGORIES;

/**
 * Fetch a page of videos from Odysee API
 */
async function fetchPage(tags, page, pageSize = PAGE_SIZE) {
  const params = {
    method: 'claim_search',
    params: {
      page_size: pageSize,
      page: page,
      order_by: ['trending_group', 'trending_mixed'],
      stream_types: ['video'],
      has_source: true,
      claim_type: ['stream'],
      no_totals: true,
    },
  };

  if (tags.length > 0) {
    params.params.any_tags = tags;
  }

  try {
    const response = await fetch(ODYSEE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result?.items || [];
  } catch (error) {
    console.error(`    Error fetching page ${page}:`, error.message);
    return [];
  }
}

/**
 * Fetch multiple pages of videos
 */
async function fetchVideos(category, tags, count, featured) {
  const videos = [];
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const seenIds = new Set();

  console.log(`  Fetching ${count} ${featured ? 'featured' : 'searchable'} videos (${totalPages} pages)...`);

  for (let page = 1; page <= totalPages && videos.length < count; page++) {
    const items = await fetchPage(tags, page);
    
    if (items.length === 0) {
      console.log(`    Page ${page}: No more results`);
      break;
    }

    for (const item of items) {
      if (videos.length >= count) break;
      if (seenIds.has(item.claim_id)) continue;
      
      seenIds.add(item.claim_id);
      videos.push(transformToVideo(item, category, featured));
    }

    if (page % 10 === 0 || page === totalPages) {
      console.log(`    Page ${page}/${totalPages}: ${videos.length} videos collected`);
    }

    // Rate limiting
    await sleep(200);
  }

  return videos;
}

/**
 * Transform Odysee API response item to our Video format
 */
function transformToVideo(item, category, featured) {
  const claimId = item.claim_id || '';
  const name = item.name || '';
  const channel = item.signing_channel?.name?.replace('@', '') || 'Unknown';
  const channelClaimId = item.signing_channel?.claim_id || '';

  // Build Odysee URL
  let odyseeUrl = '';
  if (channelClaimId && claimId) {
    odyseeUrl = `https://odysee.com/@${channel}:${channelClaimId.slice(0, 1)}/${name}:${claimId.slice(0, 1)}`;
  } else if (item.permanent_url) {
    odyseeUrl = item.permanent_url.replace('lbry://', 'https://odysee.com/');
  } else {
    odyseeUrl = `https://odysee.com/${name}:${claimId}`;
  }

  let thumbnailUrl = null;
  if (item.value?.thumbnail?.url) {
    thumbnailUrl = item.value.thumbnail.url;
  }

  return {
    id: claimId,
    title: item.value?.title || item.name || 'Untitled',
    description: item.value?.description || '',
    channel: channel,
    category: category,
    featured: featured,
    odysee_url: odyseeUrl,
    thumbnail_url: thumbnailUrl,
    published_at: (item.timestamp || Math.floor(Date.now() / 1000)) * 1000,
    fetched_at: Date.now(),
    content_hash: item.value?.source?.sd_hash || null,
    fetch_status: { Ok: null },
    license: item.value?.license || null,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format video for Candid syntax
 */
function formatForCandid(video) {
  const escapeString = (str) => {
    if (!str) return '""';
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').substring(0, 1000)}"`;
  };

  const thumbnail = video.thumbnail_url ? `opt ${escapeString(video.thumbnail_url)}` : 'null';
  const contentHash = video.content_hash ? `opt ${escapeString(video.content_hash)}` : 'null';
  const license = video.license ? `opt ${escapeString(video.license)}` : 'null';

  return `  record {
    id = ${escapeString(video.id)};
    title = ${escapeString(video.title)};
    description = ${escapeString(video.description.substring(0, 500))};
    channel = ${escapeString(video.channel)};
    category = ${escapeString(video.category)};
    featured = ${video.featured};
    odysee_url = ${escapeString(video.odysee_url)};
    thumbnail_url = ${thumbnail};
    published_at = ${video.published_at} : int64;
    fetched_at = ${video.fetched_at} : int64;
    content_hash = ${contentHash};
    fetch_status = variant { Ok };
    license = ${license};
  }`;
}

/**
 * Save videos to files in batches (for large uploads)
 */
function saveVideos(videos, prefix) {
  const BATCH_SIZE = 500; // Videos per file for upload
  const batches = [];
  
  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    batches.push(videos.slice(i, i + BATCH_SIZE));
  }

  console.log(`\nSaving ${videos.length} videos in ${batches.length} batch file(s)...`);

  batches.forEach((batch, index) => {
    const candidVideos = batch.map(formatForCandid);
    const candidOutput = `vec {\n${candidVideos.join(';\n')}\n}`;
    const filename = batches.length === 1 
      ? `${prefix}-candid.txt` 
      : `${prefix}-candid-${index + 1}.txt`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), candidOutput);
    console.log(`  Saved ${filename} (${batch.length} videos)`);
  });

  // Save JSON for reference
  const jsonFile = `${prefix}-data.json`;
  fs.writeFileSync(
    path.join(OUTPUT_DIR, jsonFile),
    JSON.stringify({
      fetched_at: new Date().toISOString(),
      total_videos: videos.length,
      videos: videos,
    }, null, 2)
  );
  console.log(`  Saved ${jsonFile}`);

  return batches.length;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Odysee Video Fetcher ===');
  console.log(`Mode: ${FULL_MODE ? 'FULL (featured + searchable)' : 'FEATURED ONLY'}`);
  console.log(`Categories: ${CATEGORIES_TO_FETCH.join(', ')}\n`);

  const allFeatured = [];
  const allSearchable = [];

  for (const category of CATEGORIES_TO_FETCH) {
    console.log(`\n[${category.toUpperCase()}]`);
    const tags = CATEGORY_TAGS[category] || [];

    // Fetch featured videos (100 per category)
    const featured = await fetchVideos(category, tags, FEATURED_PER_CATEGORY, true);
    allFeatured.push(...featured);
    console.log(`  ✓ ${featured.length} featured videos`);

    // Fetch searchable videos (10k per category) - only in full mode
    if (FULL_MODE) {
      const searchable = await fetchVideos(category, tags, SEARCHABLE_PER_CATEGORY, false);
      allSearchable.push(...searchable);
      console.log(`  ✓ ${searchable.length} searchable videos`);
    }

    await sleep(500); // Delay between categories
  }

  console.log('\n=== Summary ===');
  console.log(`Featured videos: ${allFeatured.length}`);
  if (FULL_MODE) {
    console.log(`Searchable videos: ${allSearchable.length}`);
  }

  // Save featured videos
  const featuredBatches = saveVideos(allFeatured, 'videos-featured');

  // Save searchable videos (in batches)
  if (FULL_MODE && allSearchable.length > 0) {
    const searchableBatches = saveVideos(allSearchable, 'videos-searchable');
    console.log(`\n=== Upload Instructions ===`);
    console.log(`1. Upload featured videos first:`);
    console.log(`   ./scripts/upload-to-canister.sh --network ic`);
    console.log(`2. Upload searchable batches:`);
    for (let i = 1; i <= searchableBatches; i++) {
      console.log(`   ./scripts/upload-batch.sh videos-searchable-candid-${i}.txt --network ic`);
    }
  } else {
    console.log(`\n=== Next Steps ===`);
    console.log(`1. Upload featured videos:`);
    console.log(`   ./scripts/upload-to-canister.sh --network ic`);
    if (!FULL_MODE) {
      console.log(`2. To fetch searchable videos too, run:`);
      console.log(`   node scripts/fetch-odysee.js --full`);
    }
  }

  console.log('\n=== Done! ===');
}

main().catch(console.error);
