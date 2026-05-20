"""Crop ~10% padding from apple-touch-icon.png + resize to 180x180."""
import sys
try:
    from PIL import Image
except ImportError:
    print("PIL not installed · skip", file=sys.stderr)
    sys.exit(1)

src = Image.open("public/icon-512.png")
w, h = src.size
# crop center · keep 80% (remove 10% each side)
crop_pct = 0.10
left = int(w * crop_pct)
top = int(h * crop_pct)
right = w - left
bottom = h - top
cropped = src.crop((left, top, right, bottom))
# resize for iOS 180x180
resized = cropped.resize((180, 180), Image.LANCZOS)
resized.save("public/apple-touch-icon.png", "PNG")
print(f"cropped {w}x{h} → {right-left}x{bottom-top} → 180x180 saved")
