#!/bin/bash
STORE="/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/LinkLoopLiteApp/store-assets/screenshots"
SRC="$STORE/NEW Screenshots"

# Back up old iPad folder
mv "$STORE/ipad-12.9" "$STORE/ipad-12.9-old" 2>/dev/null

# Create new iPad 13" folder
mkdir -p "$STORE/ipad-13"

# All 9 unique source screenshots
FILES=(
  "$SRC/regoogleplay/IMG_0002.png"
  "$SRC/regoogleplay/IMG_0003.png"
  "$SRC/regoogleplay/IMG_0004.png"
  "$SRC/regoogleplay (1)/IMG_6612.png"
  "$SRC/regoogleplay (1)/IMG_6613.png"
  "$SRC/regoogleplay (2)/IMG_6608.png"
  "$SRC/regoogleplay (2)/IMG_6609.png"
  "$SRC/regoogleplay (2)/IMG_6610.png"
  "$SRC/regoogleplay (2)/IMG_6611.png"
)

i=1
for f in "${FILES[@]}"; do
  name="screenshot-$(printf '%02d' $i).png"
  cp "$f" "$STORE/ipad-13/$name"
  sips -z 2752 2064 "$STORE/ipad-13/$name" --out "$STORE/ipad-13/$name" > /dev/null 2>&1
  pw=$(sips -g pixelWidth "$STORE/ipad-13/$name" 2>/dev/null | grep pixelWidth | awk '{print $2}')
  ph=$(sips -g pixelHeight "$STORE/ipad-13/$name" 2>/dev/null | grep pixelHeight | awk '{print $2}')
  echo "ipad-13/$name → ${pw}x${ph} ✓"
  ((i++))
done

echo ""
echo "Done! Cleaning up..."
rm -rf "$STORE/ipad-12.9-old"
echo "Old ipad-12.9 folder removed."
echo ""
echo "Final folder layout:"
ls -d "$STORE"/*/
