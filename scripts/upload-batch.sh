#!/bin/bash
#
# Upload a specific batch file to the lain-tv-backend canister
#
# Usage: ./scripts/upload-batch.sh <filename> [--network ic]
#
# Example: ./scripts/upload-batch.sh videos-searchable-candid-1.txt --network ic
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$1" ]]; then
  echo "Usage: $0 <filename> [--network ic]"
  echo "Example: $0 videos-searchable-candid-1.txt --network ic"
  exit 1
fi

CANDID_FILE="$SCRIPT_DIR/$1"

# Parse arguments
NETWORK="local"
if [[ "$2" == "--network" && "$3" == "ic" ]]; then
  NETWORK="ic"
  echo "Uploading to IC mainnet..."
else
  echo "Uploading to local replica..."
fi

# Check if the file exists
if [[ ! -f "$CANDID_FILE" ]]; then
  echo "Error: $CANDID_FILE not found!"
  exit 1
fi

# Count approximate videos
LINE_COUNT=$(wc -l < "$CANDID_FILE")
APPROX_VIDEOS=$((LINE_COUNT / 15))
echo "Uploading ~$APPROX_VIDEOS videos from $1..."

# Read the Candid-formatted videos
VIDEOS=$(cat "$CANDID_FILE")

echo ""
echo "Calling batch_add_videos..."

# Call the canister
if [[ "$NETWORK" == "ic" ]]; then
  dfx canister call lain-tv-backend batch_add_videos "($VIDEOS)" --network ic
else
  dfx canister call lain-tv-backend batch_add_videos "($VIDEOS)"
fi

if [[ $? -eq 0 ]]; then
  echo ""
  echo "✅ Batch upload complete!"
else
  echo ""
  echo "❌ Batch upload failed!"
  exit 1
fi
