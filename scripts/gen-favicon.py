"""Generate a proper favicon.ico (32x32 + 16x16 multi-size) from icon source."""
from PIL import Image

src = Image.open("public/icon-512.png")
# crop ~10% padding first to make icon tighter for small sizes
w, h = src.size
crop_pct = 0.08
left = int(w * crop_pct)
top = int(h * crop_pct)
cropped = src.crop((left, top, w - left, h - top))

# multi-size favicon
sizes = [(16, 16), (32, 32), (48, 48)]
images = [cropped.resize(s, Image.LANCZOS) for s in sizes]
images[0].save(
    "public/favicon.ico",
    format="ICO",
    sizes=sizes,
    append_images=images[1:],
)
print(f"saved favicon.ico · {sizes}")
