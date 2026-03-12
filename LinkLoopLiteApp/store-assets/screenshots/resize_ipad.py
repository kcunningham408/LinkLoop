import os
import subprocess
import shutil

base = "/Users/kevin/Desktop/KC Stuff/App Ideas/LinkLoopLite/LinkLoopLiteApp/store-assets/screenshots"
src_dir = os.path.join(base, "NEW Screenshots")

# 9 unique source files
sources = [
    os.path.join(src_dir, "regoogleplay", "IMG_0002.png"),
    os.path.join(src_dir, "regoogleplay", "IMG_0003.png"),
    os.path.join(src_dir, "regoogleplay", "IMG_0004.png"),
    os.path.join(src_dir, "regoogleplay (1)", "IMG_6612.png"),
    os.path.join(src_dir, "regoogleplay (1)", "IMG_6613.png"),
    os.path.join(src_dir, "regoogleplay (2)", "IMG_6608.png"),
    os.path.join(src_dir, "regoogleplay (2)", "IMG_6609.png"),
    os.path.join(src_dir, "regoogleplay (2)", "IMG_6610.png"),
    os.path.join(src_dir, "regoogleplay (2)", "IMG_6611.png"),
]

# iPad 13" (M4 iPad Pro) = 2064x2752
ipad_dir = os.path.join(base, "ipad-13")
os.makedirs(ipad_dir, exist_ok=True)

# Remove old ipad-12.9 contents
old_ipad = os.path.join(base, "ipad-12.9")
if os.path.exists(old_ipad):
    shutil.rmtree(old_ipad)
    print(f"Removed old ipad-12.9 folder")

for i, src in enumerate(sources, 1):
    name = f"screenshot-{i:02d}.png"
    dest = os.path.join(ipad_dir, name)
    shutil.copy2(src, dest)
    # Resize to 2064x2752 using sips
    result = subprocess.run(
        ["sips", "-z", "2752", "2064", dest, "--out", dest],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"  {name} -> 2064x2752 ✓")
    else:
        print(f"  {name} FAILED: {result.stderr}")

# Verify
print("\nVerification:")
for f in sorted(os.listdir(ipad_dir)):
    path = os.path.join(ipad_dir, f)
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
        capture_output=True, text=True
    )
    lines = result.stdout.strip().split("\n")
    w = [l for l in lines if "pixelWidth" in l][0].split()[-1]
    h = [l for l in lines if "pixelHeight" in l][0].split()[-1]
    print(f"  {f}: {w}x{h}")

print("\nDone!")
