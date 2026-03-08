#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../src-tauri/icons" && pwd)"
SOURCE_SVG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/assets/app-icon-macos.svg"
cd "$ROOT_DIR"

rm -rf system-bridge.iconset
mkdir -p system-bridge.iconset

rsvg-convert -w 1024 -h 1024 "$SOURCE_SVG" > icon.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha PNG32:icon.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 32x32 PNG32:32x32.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 128x128 PNG32:128x128.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 256x256 PNG32:128x128@2x.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 30x30 PNG32:Square30x30Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 44x44 PNG32:Square44x44Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 71x71 PNG32:Square71x71Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 89x89 PNG32:Square89x89Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 107x107 PNG32:Square107x107Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 142x142 PNG32:Square142x142Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 150x150 PNG32:Square150x150Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 284x284 PNG32:Square284x284Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 310x310 PNG32:Square310x310Logo.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 50x50 PNG32:StoreLogo.png

magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 16x16 PNG32:system-bridge.iconset/icon_16x16.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 32x32 PNG32:system-bridge.iconset/icon_16x16@2x.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 32x32 PNG32:system-bridge.iconset/icon_32x32.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 64x64 PNG32:system-bridge.iconset/icon_32x32@2x.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 128x128 PNG32:system-bridge.iconset/icon_128x128.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 256x256 PNG32:system-bridge.iconset/icon_128x128@2x.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 256x256 PNG32:system-bridge.iconset/icon_256x256.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 512x512 PNG32:system-bridge.iconset/icon_256x256@2x.png
magick icon.png -alpha on -colorspace sRGB -type TrueColorAlpha -resize 512x512 PNG32:system-bridge.iconset/icon_512x512.png
cp icon.png system-bridge.iconset/icon_512x512@2x.png

iconutil -c icns system-bridge.iconset -o icon.icns
magick icon.png -define icon:auto-resize=256,128,96,64,48,32,24,16 icon.ico
rm -rf system-bridge.iconset
