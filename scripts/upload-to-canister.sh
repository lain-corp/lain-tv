#!/bin/bash
#
# Upload fetched videos to the lain-tv-backend canister
#
# Usage: ./scripts/upload-to-canister.sh [--network ic]
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
NETWORK="local"
if [[ "$1" == "--network" && "$2" == "ic" ]]; then
  NETWORK="ic"
  echo "Uploading to IC mainnet..."
else
  echo "Uploading to local replica..."
fi

# Find all featured candid files
CANDID_FILES=$(ls "$SCRIPT_DIR"/videos-featured-candid*.txt 2>/dev/null | sort)

if [[ -z "$CANDID_FILES" ]]; then
  # Fallback to old single file
  if [[ -f "$SCRIPT_DIR/videos-candid.txt" ]]; then
    CANDID_FILES="$SCRIPT_DIR/videos-candid.txt"
  fi
fi

# Check if any files exist
FIRST_FILE=$(echo "$CANDID_FILES" | head -1)
if [[ -z "$FIRST_FILE" ]] || [[ ! -f "$FIRST_FILE" ]]; then
  echo "Error: No candid files found!"
  echo "Run 'node scripts/fetch-odysee.js' first to fetch videos."
  exit 1
fi

TOTAL_UPLOADED=0
FAILED=0

for CANDID_FILE in $CANDID_FILES; do
  echo ""
  echo "Processing $(basename $CANDID_FILE)..."
  
  # Read the Candid-formatted videos
  VIDEOS=$(cat "$CANDID_FILE")
  
  # Call the canister
  if [[ "$NETWORK" == "ic" ]]; then
    RESULT=$(dfx canister call lain-tv-backend batch_add_videos "($VIDEOS)" --network ic 2>&1)
  else
    RESULT=$(dfx canister call lain-tv-backend batch_add_videos "($VIDEOS)" 2>&1)
  fi
  
  if echo "$RESULT" | grep -q "Ok"; then
    echo "  ✓ $(basename $CANDID_FILE) uploaded"
    ((TOTAL_UPLOADED++))
  else
    echo "  ✗ Failed: $RESULT"
    ((FAILED++))
  fi
done

echo ""
if [[ $FAILED -eq 0 ]]; then
  echo "✅ Upload complete! ($TOTAL_UPLOADED batch files)"
else
  echo "⚠️  Upload completed with errors ($TOTAL_UPLOADED success, $FAILED failed)"
fi

# Get stats
echo ""
echo "Verifying upload..."
if [[ "$NETWORK" == "ic" ]]; then
  dfx canister call lain-tv-backend get_stats --network ic
else
  dfx canister call lain-tv-backend get_stats
fi
