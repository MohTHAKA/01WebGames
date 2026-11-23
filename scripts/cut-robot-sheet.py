"""Cuts the 8 direction views out of art/robot-sheet.png into public/robot-<deg>.png.

Every view keeps the sheet's scale and is anchored by its bottom centre onto one shared
canvas, so the robot's size and ground contact point do not change between directions.
Requires Pillow. Run from the repo root: python scripts/cut-robot-sheet.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "art" / "robot-sheet.png"
OUT = ROOT / "public"

# (heading degrees clockwise from facing away, x0, x1, y0, y1) in sheet pixels.
VIEWS = [
    (0, 30, 290, 58, 358),
    (45, 300, 600, 58, 358),
    (90, 605, 850, 58, 358),
    (135, 850, 1160, 58, 358),
    (180, 1165, 1430, 58, 358),
    (225, 10, 285, 451, 757),
    (270, 285, 540, 451, 757),
    (315, 545, 810, 451, 757),
]
PAD = 8
# Windows are widened by this much so arms reaching toward a neighbour are not clipped; the
# connected-component filter then drops whatever belongs to the neighbouring figure.
MARGIN = 30
SOLID = 60


def largest_component(alpha: Image.Image) -> Image.Image:
    """Mask of the biggest connected blob of solid pixels (8-connected), slightly grown."""
    w, h = alpha.size
    solid = [v > SOLID for v in alpha.getdata()]
    seen = [False] * (w * h)
    best: list[int] = []
    for start in range(w * h):
        if not solid[start] or seen[start]:
            continue
        stack = [start]
        seen[start] = True
        comp: list[int] = []
        while stack:
            i = stack.pop()
            comp.append(i)
            x, y = i % w, i // w
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if solid[j] and not seen[j]:
                            seen[j] = True
                            stack.append(j)
        if len(comp) > len(best):
            best = comp
    mask = Image.new("L", (w, h), 0)
    px = mask.load()
    for i in best:
        px[i % w, i // w] = 255
    for _ in range(3):
        mask = mask.filter(ImageFilter.MaxFilter(3))
    return mask


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    crops = []
    for deg, x0, x1, y0, y1 in VIEWS:
        crop = sheet.crop((max(0, x0 - MARGIN), y0, min(sheet.width, x1 + MARGIN), y1))
        keep = largest_component(crop.getchannel("A"))
        crop.putalpha(ImageChops.multiply(crop.getchannel("A"), keep))
        bbox = crop.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
        if bbox is None:
            raise SystemExit(f"view {deg} is empty")
        crops.append((deg, crop.crop(bbox)))

    width = max(c.width for _, c in crops) + PAD * 2
    height = max(c.height for _, c in crops) + PAD * 2
    print(f"canvas {width}x{height}")
    for deg, c in crops:
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        canvas.alpha_composite(c, ((width - c.width) // 2, height - PAD - c.height))
        canvas.save(OUT / f"robot-{deg}.png")
        print(f"robot-{deg}.png from {c.width}x{c.height}")


if __name__ == "__main__":
    main()
