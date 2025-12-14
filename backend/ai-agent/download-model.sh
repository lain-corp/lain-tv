#!/bin/bash
set -e

MODEL_PATH="/models/lain-model.gguf"
MODEL_URL="https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"

# Check if model already exists
if [ -f "$MODEL_PATH" ]; then
    echo "Model already exists at $MODEL_PATH"
    exit 0
fi

echo "Downloading model from $MODEL_URL..."
wget -q --show-progress "$MODEL_URL" -O "$MODEL_PATH"
echo "Model download complete!"
