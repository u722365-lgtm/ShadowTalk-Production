#!/bin/bash
# Scripts to download the MLC LLM weights for offline bundling

MODEL_NAME="Llama-3.1-8B-Instruct-q4f32_1-MLC"
REPO_URL="https://huggingface.co/mlc-ai/$MODEL_NAME"
TARGET_DIR="public/models/$MODEL_NAME"

echo "Downloading $MODEL_NAME..."
echo "This will take a while (4GB+). Please ensure you have Git LFS installed."

mkdir -p public/models

if [ -d "$TARGET_DIR" ]; then
    echo "Directory $TARGET_DIR already exists. Pulling latest..."
    cd "$TARGET_DIR"
    git pull
else
    echo "Cloning $MODEL_NAME into $TARGET_DIR..."
    git clone "$REPO_URL" "$TARGET_DIR"
fi

echo "Done! The model is now available at $TARGET_DIR"
echo "It will be bundled into the Electron/Capacitor app when you build."
