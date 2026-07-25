#!/usr/bin/env python3
"""Export the app icon PNGs and favicon from icons/icon.svg.

icons/icon.svg is the source of truth - edit that, then run this to regenerate
the raster sizes the manifest and index.html reference.

    python3 tools/build-icon.py

Needs a headless Chromium to rasterise, and Pillow (pip install pillow). Point
CHROME at a binary if it is not on PATH:

    CHROME=/usr/bin/chromium python3 tools/build-icon.py

Outputs:
    icons/icon-192x192.png     manifest (also used maskable)
    icons/icon-512x512.png     manifest (also used maskable)
    icons/apple-touch-icon.png 180x180, iOS home screen
    favicon.ico                16/32/48, legacy browser requests

The artwork sits at 74% of the frame. Its furthest point is ~195px from
centre against a 205px maskable safe radius, so it survives a circular
launcher mask. If you enlarge the artwork further, re-check that margin or
drop "maskable" from the manifest purpose.
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / 'icons' / 'icon.svg'

PNGS = [
    (512, ROOT / 'icons' / 'icon-512x512.png'),
    (192, ROOT / 'icons' / 'icon-192x192.png'),
    (180, ROOT / 'icons' / 'apple-touch-icon.png'),
]
ICO = ROOT / 'favicon.ico'
ICO_SIZES = [(16, 16), (32, 32), (48, 48)]


def find_chrome():
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    for name in ('chromium', 'chromium-browser', 'google-chrome',
                 'google-chrome-stable', 'chrome'):
        path = shutil.which(name)
        if path:
            return path
    for path in ('/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                 '/Applications/Chromium.app/Contents/MacOS/Chromium'):
        if Path(path).exists():
            return path
    sys.exit('No Chromium found. Set CHROME=/path/to/chromium and retry.')


def rasterise(chrome, size, out):
    """Render the SVG at `size` and crop to exactly size x size.

    Chromium's --window-size is the window, not the viewport, so the captured
    image is shorter than requested and gets white-padded at the bottom. Render
    into a deliberately taller window and crop, which is insensitive to how much
    chrome any given build reserves.
    """
    from PIL import Image

    # Size via CSS rather than rewriting the markup. Editing width/height with a
    # string replace also hits the background <rect width="512" height="512">,
    # which then covers only part of the viewBox.
    svg = SVG.read_text(encoding='utf-8')
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / 'icon.html'
        page.write_text(
            '<!doctype html><meta charset="utf-8">'
            '<style>html,body{margin:0;padding:0;overflow:hidden}'
            f'svg{{display:block;width:{size}px;height:{size}px}}</style>' + svg,
            encoding='utf-8')
        shot = Path(tmp) / 'shot.png'
        cmd = [chrome, '--headless', '--disable-gpu', '--hide-scrollbars',
               f'--screenshot={shot}', f'--window-size={size},{size + 300}']
        # Chromium refuses to run sandboxed as root (e.g. in a container).
        if hasattr(os, 'geteuid') and os.geteuid() == 0:
            cmd.append('--no-sandbox')
        cmd.append(page.as_uri())

        res = subprocess.run(cmd, capture_output=True, text=True)
        if not shot.exists():
            sys.exit(f'chromium failed to render {out.name}\n'
                     f'{res.stderr.strip()[:800]}')

        im = Image.open(shot).convert('RGBA')
        if im.width < size or im.height < size:
            sys.exit(f'rendered {im.size}, too small to crop to {size}x{size}')
        im.crop((0, 0, size, size)).save(out)


def main():
    if not SVG.exists():
        sys.exit(f'missing {SVG}')
    chrome = find_chrome()
    print(f'chromium: {chrome}')

    for size, out in PNGS:
        rasterise(chrome, size, out)
        print(f'  wrote {out.relative_to(ROOT)} ({size}x{size})')

    from PIL import Image
    Image.open(PNGS[0][1]).convert('RGBA').save(ICO, sizes=ICO_SIZES)
    print(f'  wrote {ICO.relative_to(ROOT)} '
          f'({", ".join(f"{w}x{h}" for w, h in ICO_SIZES)})')


if __name__ == '__main__':
    main()
