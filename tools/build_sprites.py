"""Build the pixel-art coach sprites as transparent PNGs.

Source data: tools/coach-sprites.json (32x32 character grids, palettes and per-mood face patches).
Output:      dist/assets/coaches/<coach>-<mood>.png      (256x256, 8x nearest-neighbour, used by the app)
             dist/assets/coaches/32/<coach>-<mood>.png   (32x32 originals, for editing)

Shading is added automatically so the flat grids read as rounded, lit shapes:
  * light comes from the top-left: edges facing it get a warm highlight,
    edges facing away get one or two cool, slightly purple shadow steps;
  * the outer outline takes a darker shade of the colour it borders ("selective outline")
    instead of one flat dark colour, like hand-made sprites.

Run from the repository root:  python tools/build_sprites.py
Standard library only (no Pillow needed).
"""
import json
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'tools', 'coach-sprites.json')
OUT = os.path.join(ROOT, 'dist', 'assets', 'coaches')
MOODS = ('happy', 'neutral', 'upset')
SCALE = 8
N = 32

# Small details that keep their exact colour (eyes, mouths, tears, earrings, marks).
FLAT = {
    'retriever': 'KNWPRTZ',
    'younger': 'KEWFYT',
    'coworker': 'KEWRApv',
    'mum': 'KEWRTApr',
    'sergeant': 'KEWRTA',
}
SHADOW_TINT = (58, 34, 84)
LIGHT_TINT = (255, 246, 205)
OUTLINE_TINT = (24, 14, 22)


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def grid_for(sprite, mood):
    grid = [list(row) for row in sprite['rows']]
    for x, y, chars in sprite.get('detail', []) + sprite['moods'].get(mood, []):
        for i, ch in enumerate(chars):
            if ch != '?' and x + i < N:
                grid[y][x + i] = ch
    return grid


def shade(name, sprite, grid):
    pal = {k: hex_rgb(v) for k, v in sprite['pal'].items()}
    flat = FLAT[name]

    def cell(x, y):
        if x < 0 or x >= N or y < 0:
            return '.'
        if y >= N:  # the body continues past the bottom edge
            return None
        return grid[y][x]

    def is_edge(ch):
        return ch == '.' or ch == 'K'

    def dist(x, y, dx, dy, limit=3):
        for step in range(1, limit + 1):
            ch = cell(x + dx * step, y + dy * step)
            if ch is None:
                return 99
            if is_edge(ch):
                return step
        return 99

    out = [[None] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            ch = grid[y][x]
            if ch == '.':
                continue
            base = pal[ch]
            if ch == 'K':
                l, r, d, u = (cell(x + dx, y + dy) for dx, dy in ((-1, 0), (1, 0), (0, 1), (0, -1)))
                neighbours = [l, r, d, u]
                fills = [c for c in neighbours if c and c not in '.K' and c not in flat and c in pal]
                # A line with the same material on both sides is a facial feature or fold: keep it dark.
                feature = (l and l == r and l not in '.K') or (u and u == d and u not in '.K')
                if '.' in neighbours and fills:
                    out[y][x] = mix(min((pal[c] for c in fills), key=sum), OUTLINE_TINT, 0.62)
                elif fills and not feature and len(set(fills)) > 1:
                    out[y][x] = mix(min((pal[c] for c in fills), key=sum), OUTLINE_TINT, 0.5)
                else:
                    out[y][x] = base
                continue
            if ch in flat:
                out[y][x] = base
                continue
            right, down = dist(x, y, 1, 0), dist(x, y, 0, 1)
            left, up = dist(x, y, -1, 0), dist(x, y, 0, -1)
            score = (1 if right == 1 else 0.5 if right == 2 else 0) + (1 if down == 1 else 0.5 if down == 2 else 0)
            if score >= 1.5:
                out[y][x] = mix(base, SHADOW_TINT, 0.42)
            elif score >= 0.5:
                out[y][x] = mix(base, SHADOW_TINT, 0.22)
            elif up == 1 and left == 1:
                out[y][x] = mix(base, LIGHT_TINT, 0.55)
            elif (up == 1 and left <= 4) or (left == 1 and up <= 3) or (up == 2 and left <= 2):
                out[y][x] = mix(base, LIGHT_TINT, 0.32)
            else:
                out[y][x] = base
    return out


def write_png(path, pixels, scale):
    size = N * scale
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: none
        row = pixels[y // scale]
        for x in range(size):
            c = row[x // scale]
            raw.extend((*c, 255) if c else (0, 0, 0, 0))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def main():
    sprites = json.load(open(DATA, encoding='utf8'))
    os.makedirs(os.path.join(OUT, '32'), exist_ok=True)
    for name, sprite in sprites.items():
        for mood in MOODS:
            pixels = shade(name, sprite, grid_for(sprite, mood))
            write_png(os.path.join(OUT, f'{name}-{mood}.png'), pixels, SCALE)
            write_png(os.path.join(OUT, '32', f'{name}-{mood}.png'), pixels, 1)
            print(f'{name}-{mood}.png')


if __name__ == '__main__':
    main()
