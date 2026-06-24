#!/bin/bash

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Downloading FFmpeg..."
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz

tar -xf ffmpeg.tar.xz
mv ffmpeg-*-static ffmpeg-bin

echo "FFmpeg ready"
