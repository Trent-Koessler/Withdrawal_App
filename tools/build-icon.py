"""Rebuild the SUD Toolkit icon as clean vector geometry.

The brain outline is traced from the original PNG (so the silhouette stays
faithful), simplified, and fitted with Catmull-Rom -> cubic Bezier. Everything
inside it - the capsule, three bottles and five tablets - is authored from
scratch as parametric shapes at the positions measured from the original.
"""
import json, math, sys
from collections import deque

sys.setrecursionlimit(20000)
SIZE = 512
STROKE = 13.0            # measured stroke width of the brain outline
SCALE = 1.20             # headroom before leaving the maskable safe zone is 1.246

BG = '#0c1015'
STROKE_TOP = '#d7e9ef'
STROKE_BOT = '#b3c4d0'

# ---------------------------------------------------------------- brain path
solid = json.load(open('/tmp/solid.json'))
H, W = len(solid), len(solid[0])


def erode(mask, r):
    """Erode by a disc of radius r, via two 1-D passes (separable, r=chebyshev)."""
    out = [[False] * W for _ in range(H)]
    # horizontal min
    tmp = [[False] * W for _ in range(H)]
    for y in range(H):
        row = mask[y]
        for x in range(W):
            lo, hi = max(0, x - r), min(W - 1, x + r)
            tmp[y][x] = all(row[i] for i in range(lo, hi + 1))
    for y in range(H):
        for x in range(W):
            lo, hi = max(0, y - r), min(H - 1, y + r)
            out[y][x] = all(tmp[i][x] for i in range(lo, hi + 1))
    return out


def trace(mask):
    start = None
    for y in range(H):
        for x in range(W):
            if mask[y][x]:
                start = (x, y)
                break
        if start:
            break
    nbr = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
    g = lambda x, y: 0 <= x < W and 0 <= y < H and mask[y][x]
    pts = [start]
    cur, b = start, 4
    for _ in range(300000):
        hit = False
        for k in range(8):
            d = (b + 1 + k) % 8
            nx, ny = cur[0] + nbr[d][0], cur[1] + nbr[d][1]
            if g(nx, ny):
                b = (d + 5) % 8
                cur = (nx, ny)
                pts.append(cur)
                hit = True
                break
        if not hit or (len(pts) > 10 and cur == start):
            break
    if pts[-1] == pts[0]:
        pts.pop()
    return pts


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    x1, y1 = pts[0]
    x2, y2 = pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy)
    dmax, idx = -1, 0
    for i in range(1, len(pts) - 1):
        x0, y0 = pts[i]
        d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / n if n > 1e-9 \
            else math.hypot(x0 - x1, y0 - y1)
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def smooth_closed(pts, passes=3, win=7):
    """Moving average around a closed polyline - removes pixel stair-stepping."""
    n = len(pts)
    half = win // 2
    for _ in range(passes):
        out = []
        for i in range(n):
            sx = sy = 0.0
            for k in range(-half, half + 1):
                q = pts[(i + k) % n]
                sx += q[0]
                sy += q[1]
            out.append((sx / win, sy / win))
        pts = out
    return pts


def resample_closed(pts, count):
    """Evenly spaced points along the closed curve, so curvature is uniform."""
    n = len(pts)
    seg = [math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1])
           for i in range(n)]
    total = sum(seg)
    step = total / count
    out, acc, i, t = [], 0.0, 0, 0.0
    target = 0.0
    dist = 0.0
    for i in range(n):
        while target <= dist + seg[i] and len(out) < count:
            f = (target - dist) / seg[i] if seg[i] > 1e-9 else 0.0
            a, b = pts[i], pts[(i + 1) % n]
            out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
            target += step
        dist += seg[i]
    return out


def catmull_rom_path(pts, tension=6.0):
    """Closed smooth path through every point."""
    n = len(pts)
    d = [f'M {pts[0][0]:.1f} {pts[0][1]:.1f}']
    for i in range(n):
        p0 = pts[(i - 1) % n]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / tension, p1[1] + (p2[1] - p0[1]) / tension)
        c2 = (p2[0] - (p3[0] - p1[0]) / tension, p2[1] - (p3[1] - p1[1]) / tension)
        d.append(f'C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    d.append('Z')
    return ' '.join(d)


centre_mask = erode(solid, int(round(STROKE / 2)))
brain_pts = resample_closed(smooth_closed(trace(centre_mask)), 76)
BRAIN_D = catmull_rom_path(brain_pts)

# ---------------------------------------------------------------- inner marks
def bottle(cx, y_top, y_base, w):
    """Body with curved shoulders, a neck and a cap - one closed path."""
    h = y_base - y_top
    nw = w * 0.38                       # neck width
    lip_h = max(3.5, h * 0.055)         # the lip / cap at the very top
    y_neck_top = y_top + lip_h
    y_sh_top = y_top + h * 0.26         # neck meets shoulder
    y_sh_bot = y_top + h * 0.42         # shoulder meets body
    k = (y_sh_bot - y_sh_top) * 0.6     # S-curve control reach
    r = w * 0.17                        # rounded base corners
    L, R = cx - w / 2, cx + w / 2
    nl, nr = cx - nw / 2, cx + nw / 2
    return (
        f'M {L:.1f} {y_base - r:.1f} '
        f'L {L:.1f} {y_sh_bot:.1f} '
        f'C {L:.1f} {y_sh_bot - k:.1f} {nl:.1f} {y_sh_top + k:.1f} {nl:.1f} {y_sh_top:.1f} '
        f'L {nl:.1f} {y_neck_top:.1f} L {nr:.1f} {y_neck_top:.1f} '
        f'L {nr:.1f} {y_sh_top:.1f} '
        f'C {nr:.1f} {y_sh_top + k:.1f} {R:.1f} {y_sh_bot - k:.1f} {R:.1f} {y_sh_bot:.1f} '
        f'L {R:.1f} {y_base - r:.1f} '
        f'Q {R:.1f} {y_base:.1f} {R - r:.1f} {y_base:.1f} '
        f'L {L + r:.1f} {y_base:.1f} '
        f'Q {L:.1f} {y_base:.1f} {L:.1f} {y_base - r:.1f} Z'
    ), (nl - w * 0.045, y_top, nw + w * 0.09, lip_h)


def stadium(cx, y0, y1, w):
    """Rounded tablet: stadium when tall, ellipse-like when nearly square."""
    h = y1 - y0
    r = min(w, h) / 2
    L, R = cx - w / 2, cx + w / 2
    return (f'M {L:.1f} {y0 + r:.1f} '
            f'Q {L:.1f} {y0:.1f} {cx - w / 2 + r:.1f} {y0:.1f} '
            f'L {R - r:.1f} {y0:.1f} Q {R:.1f} {y0:.1f} {R:.1f} {y0 + r:.1f} '
            f'L {R:.1f} {y1 - r:.1f} Q {R:.1f} {y1:.1f} {R - r:.1f} {y1:.1f} '
            f'L {L + r:.1f} {y1:.1f} Q {L:.1f} {y1:.1f} {L:.1f} {y1 - r:.1f} Z')


# Measured from the original, left to right.
CAPSULE = dict(cx=144.5, y0=224, y1=273, w=18, colour='#b81c2a')
BOTTLES = [
    dict(cx=173.0, y_top=171, y_base=293, w=27, colour='#b71c2a'),
    dict(cx=206.0, y_top=147, y_base=299, w=27, colour='#cf372a'),
    dict(cx=239.0, y_top=201, y_base=299, w=27, colour='#f0a622'),
]
TABLETS = [
    dict(cx=268.5, y0=238, y1=300, w=20, colour='#eda626'),
    dict(cx=293.5, y0=251, y1=300, w=18, colour='#8ac141'),
    dict(cx=318.0, y0=262, y1=300, w=19, colour='#55b147'),
    dict(cx=346.0, y0=273, y1=299, w=25, colour='#3ca649'),
    dict(cx=372.0, y0=281, y1=298, w=17, colour='#2f9f49'),
]

marks = []
# capsule: outlined upper half, solid lower half (matches the original)
cap_d = stadium(CAPSULE['cx'], CAPSULE['y0'], CAPSULE['y1'], CAPSULE['w'])
seam_y = CAPSULE['y0'] + (CAPSULE['y1'] - CAPSULE['y0']) * 0.5
marks.append(f'''  <clipPath id="capLower">
    <rect x="{CAPSULE['cx'] - CAPSULE['w']:.1f}" y="{seam_y:.1f}" width="{CAPSULE['w'] * 2:.1f}" height="{CAPSULE['y1'] - seam_y + 2:.1f}"/>
  </clipPath>
  <path d="{cap_d}" fill="none" stroke="{CAPSULE['colour']}" stroke-width="3.4"/>
  <path d="{cap_d}" fill="{CAPSULE['colour']}" clip-path="url(#capLower)"/>''')

for b in BOTTLES:
    d, cap = bottle(b['cx'], b['y_top'], b['y_base'], b['w'])
    marks.append(f'  <path d="{d}" fill="{b["colour"]}"/>')
    marks.append(f'  <rect x="{cap[0]:.1f}" y="{cap[1]:.1f}" width="{cap[2]:.1f}" '
                 f'height="{cap[3]:.1f}" rx="1.3" fill="{b["colour"]}"/>')

for t in TABLETS:
    mid = (t['y0'] + t['y1']) / 2
    marks.append(f'  <path d="{stadium(t["cx"], t["y0"], t["y1"], t["w"])}" fill="{t["colour"]}"/>')
    marks.append(f'  <rect x="{t["cx"] - t["w"] / 2 - 1:.1f}" y="{mid - 1.4:.1f}" '
                 f'width="{t["w"] + 2:.1f}" height="2.8" fill="{BG}"/>')

MARKS = '\n'.join(marks)

# The artwork is centred on (261,256) in the source; scale about that point.
ART_CX, ART_CY = 261.0, 256.0

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}" role="img" aria-label="SUD Toolkit">
  <title>SUD Toolkit</title>
  <defs>
    <linearGradient id="stroke" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="{STROKE_TOP}"/>
      <stop offset="1" stop-color="{STROKE_BOT}"/>
    </linearGradient>
  </defs>
  <rect width="{SIZE}" height="{SIZE}" fill="{BG}"/>
  <g transform="translate({ART_CX} {ART_CY}) scale({SCALE}) translate({-ART_CX} {-ART_CY})">
    <path d="{BRAIN_D}" fill="none" stroke="url(#stroke)" stroke-width="{STROKE}"
          stroke-linejoin="round" stroke-linecap="round"/>
{MARKS}
  </g>
</svg>
'''

open('/tmp/icon_vector.svg', 'w').write(svg)
print('brain path points:', len(brain_pts))
print('svg bytes:', len(svg))
