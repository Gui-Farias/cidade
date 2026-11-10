"""Prepare browser-sized scenery sprites from the original files in arte/.

Several supplied PNGs have a grey checkerboard painted into their RGB pixels.
The exterior checkerboard is removed with a border-connected colour mask;
the originals remain untouched. Requires ffmpeg and cwebp to regenerate assets.
"""

from collections import deque
from pathlib import Path
import struct
import subprocess
import tempfile
import zlib


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "arte"
OUT = ROOT / "src/lib/assets/scenery"
OUT.mkdir(parents=True, exist_ok=True)


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *map(str, args)], check=True)


def read_rgba(path, width, height):
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
        check=True, capture_output=True,
    )
    assert len(result.stdout) == width * height * 4
    return bytearray(result.stdout)


def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def write_png(path, pixels, width, height):
    stride = width * 4
    rows = b"".join(b"\0" + pixels[y * stride:(y + 1) * stride] for y in range(height))
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(rows, 6))
        + png_chunk(b"IEND", b"")
    )


def remove_painted_checkerboard(pixels, width, height):
    count = width * height
    neutral = bytearray(count)
    for i in range(count):
        r, g, b = pixels[i * 4:i * 4 + 3]
        neutral[i] = min(r, g, b) >= 178 and max(r, g, b) - min(r, g, b) <= 24

    exterior = bytearray(count)
    queue = deque()

    def add(i):
        if neutral[i] and not exterior[i]:
            exterior[i] = 1
            queue.append(i)

    for x in range(width):
        add(x)
        add((height - 1) * width + x)
    for y in range(height):
        add(y * width)
        add(y * width + width - 1)

    while queue:
        i = queue.popleft()
        x = i % width
        if x:
            add(i - 1)
        if x + 1 < width:
            add(i + 1)
        if i >= width:
            add(i - width)
        if i + width < count:
            add(i + width)

    # Gaps enclosed by branches can contain the same printed checkerboard.
    # Keep tiny pale details such as flowers, but clear sizeable grey patches.
    seen = exterior[:]
    for start in range(count):
        if not neutral[start] or seen[start]:
            continue
        patch = [start]
        seen[start] = 1
        for i in patch:
            x = i % width
            for neighbor in (i - width, i + width, i - 1 if x else -1, i + 1 if x + 1 < width else -1):
                if 0 <= neighbor < count and neutral[neighbor] and not seen[neighbor]:
                    seen[neighbor] = 1
                    patch.append(neighbor)
        if len(patch) >= 800:
            for i in patch:
                exterior[i] = 1

    # Clear the printed background; soften only the immediate cut edge.
    for i in range(count):
        if exterior[i]:
            pixels[i * 4 + 3] = 0
        elif (i >= width and exterior[i - width]) or (
            i + width < count and exterior[i + width]
        ) or (i % width and exterior[i - 1]) or (
            i % width != width - 1 and exterior[i + 1]
        ):
            pixels[i * 4 + 3] = 190

    visible = [i for i in range(count) if pixels[i * 4 + 3] > 0]
    left = max(0, min(i % width for i in visible) - 2)
    right = min(width, max(i % width for i in visible) + 3)
    top = max(0, min(i // width for i in visible) - 2)
    bottom = min(height, max(i // width for i in visible) + 3)
    cropped = bytearray().join(
        pixels[(y * width + left) * 4:(y * width + right) * 4]
        for y in range(top, bottom)
    )
    return cropped, right - left, bottom - top


def encode_webp(source, target, width=None):
    args = ["cwebp", "-quiet", "-q", "90", "-alpha_q", "100"]
    if width is not None:
        args += ["-resize", str(width), "0"]
    subprocess.run([*args, str(source), "-o", str(target)], check=True)


def prepared_sprite(source, name, width, height, output_width):
    pixels = read_rgba(ART / source, width, height)
    pixels, crop_width, crop_height = remove_painted_checkerboard(pixels, width, height)
    with tempfile.TemporaryDirectory() as directory:
        png = Path(directory) / "sprite.png"
        write_png(png, pixels, crop_width, crop_height)
        encode_webp(png, OUT / f"{name}.webp", output_width)


encode_webp(ART / "bg-city.png", OUT / "grass.webp")
encode_webp(ART / "arvore01.png", OUT / "tree-1.webp", 420)

for source, name, width, height, output_width in [
    ("praca.png", "plaza", 1536, 1024, 960),
    ("arvore02.png", "tree-2", 1343, 1171, 420),
    ("arvore03.png", "tree-3", 1343, 1171, 420),
]:
    prepared_sprite(source, name, width, height, output_width)

for source, prefix in [("pedra.png", "rocks-1"), ("pedra01.png", "rocks-2")]:
    pixels = read_rgba(ART / source, 1774, 887)
    for side, left in [("a", 0), ("b", 887)]:
        half = bytearray().join(
            pixels[(y * 1774 + left) * 4:(y * 1774 + left + 887) * 4]
            for y in range(887)
        )
        cut, crop_width, crop_height = remove_painted_checkerboard(half, 887, 887)
        with tempfile.TemporaryDirectory() as directory:
            png = Path(directory) / "sprite.png"
            write_png(png, cut, crop_width, crop_height)
            encode_webp(png, OUT / f"{prefix}-{side}.webp", 360)

# This edition of the street sheet already has real alpha. Keep the painted
# stones and their soft edges intact; use three different straight sections so
# every route does not repeat the same stone pattern. The third is rotated from
# the vertical section of the sheet.
for name, crop, rotated in [
    ("road-strip-a", "355:161:44:109", False),
    ("road-strip-b", "358:159:1138:759", False),
    ("road-strip-c", "170:306:489:11", True),
]:
    with tempfile.TemporaryDirectory() as directory:
        png = Path(directory) / "road.png"
        filter_chain = f"crop={crop}" + (",transpose=clock" if rotated else "")
        ffmpeg("-i", ART / "street-tile.png", "-vf", filter_chain, png)
        encode_webp(png, OUT / f"{name}.webp")
