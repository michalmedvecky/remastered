#!/usr/bin/env python3
"""Derive crisp, chamfered UI vector lettering from retained Westwood FNT data.

Only foreground nibble 1 contributes letter shapes. Source shadows are replaced
by the Canvas outline; neither an external font nor bitmap interpolation is used.
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/hd-v3/icons/fonts.json'
OUTPUT = ROOT / 'dist/painted-font-data.mjs'
CHAMFER = .16


def contours(cells):
    edges = set()
    for x, y in cells:
        for neighbor, edge in [((x, y-1), (x,y,x+1,y)), ((x+1,y),(x+1,y,x+1,y+1)),
                               ((x,y+1),(x+1,y+1,x,y+1)), ((x-1,y),(x,y+1,x,y))]:
            if neighbor not in cells:
                edges.add(edge)
    outgoing = {}
    for edge in edges:
        outgoing.setdefault(edge[:2], []).append(edge)
    paths = []
    directions = {(1,0):0, (0,1):1, (-1,0):2, (0,-1):3}
    while edges:
        first = edge = min(edges)
        points = [edge[:2]]
        while True:
            edges.remove(edge)
            end = edge[2:]
            if end == first[:2]:
                break
            points.append(end)
            candidates = [e for e in outgoing[end] if e in edges]
            direction = directions[(edge[2]-edge[0], edge[3]-edge[1])]
            # Keep diagonally touching components separate and preserve holes.
            edge = min(candidates, key=lambda e: {1:0,0:1,3:2,2:3}[(directions[(e[2]-e[0],e[3]-e[1])]-direction)%4])
        simple = []
        for i, v in enumerate(points):
            a, b = points[i-1], points[(i+1)%len(points)]
            if (v[0]-a[0])*(b[1]-v[1]) != (v[1]-a[1])*(b[0]-v[0]):
                simple.append(v)
        path = []
        for i, v in enumerate(simple):
            a, b = simple[i-1], simple[(i+1)%len(simple)]
            incoming, outgoing_edge = (v[0]-a[0],v[1]-a[1]), (b[0]-v[0],b[1]-v[1])
            if incoming[0]*outgoing_edge[1]-incoming[1]*outgoing_edge[0] > 0:
                il, ol = math.hypot(*incoming), math.hypot(*outgoing_edge)
                path.extend([(v[0]-incoming[0]/il*CHAMFER,v[1]-incoming[1]/il*CHAMFER),
                             (v[0]+outgoing_edge[0]/ol*CHAMFER,v[1]+outgoing_edge[1]/ol*CHAMFER)])
            else:
                path.append(v)
        paths.append([[round(x,4),round(y,4)] for x,y in path])
    return paths


def bounds(paths):
    points = [p for path in paths for p in path]
    if not points:
        return None
    xs, ys = zip(*points)
    return [min(xs), min(ys), max(xs), max(ys)]


def glyph(paths, advance, **evidence):
    return {'advance': advance, 'ink': bounds(paths), 'contours': paths, **evidence}


def accent(base, mark, side=False):
    paths = base['contours'].copy()
    x0, y0, x1, _ = base['ink']
    cx, bottom = (x0+x1)/2, y0-.55
    top = bottom-1.35
    if side:
        # Czech lower-case d/t use a raised apostrophe-like side caron.
        x, y = x1+.15, y0-.1
        paths.append([[x,y],[x+.65,y],[x+.4,y+1.35],[x-.1,y+1.65]])
    elif mark == 'acute':
        paths.append([[cx-.65,bottom],[cx+.35,top],[cx+1,top],[cx-.05,bottom]])
    elif mark == 'caron':
        paths.append([[cx-1.25,top],[cx-.6,top],[cx,bottom-.55],
                      [cx+.6,top],[cx+1.25,top],[cx+.3,bottom],[cx-.3,bottom]])
    else:
        cy = bottom-.65
        paths.append([[cx-.4,cy-.85],[cx+.4,cy-.85],[cx+.85,cy-.4],[cx+.85,cy+.4],
                      [cx+.4,cy+.85],[cx-.4,cy+.85],[cx-.85,cy+.4],[cx-.85,cy-.4]])
        # Reverse inner loop; also valid with the renderer's even-odd filling.
        paths.append([[cx-.25,cy-.35],[cx-.35,cy-.25],[cx-.35,cy+.25],[cx-.25,cy+.35],
                      [cx+.25,cy+.35],[cx+.35,cy+.25],[cx+.35,cy-.25],[cx+.25,cy-.35]])
    return glyph(paths, max(base['advance'], math.ceil(bounds(paths)[2]) if side else base['advance']),
                 derivedFrom=base['sourceCode'], accent=mark, sideCaron=side)


def build():
    raw = SOURCE.read_bytes()
    original = json.loads(raw)
    faces = {}
    for name, baseline in [('NEW6P.FNT',6), ('NEW8P.FNT',8)]:
        font = original['fonts'][name]
        chars = {}
        for code, row in font['chars'].items():
            code = int(code)
            if code < 32 or not row['width']:
                continue
            nibbles = base64.b64decode(row['nibblesBase64'])
            cells = {(i%row['width'], i//row['width']+row['unusedLines']) for i,n in enumerate(nibbles) if n == 1}
            chars[bytes([code]).decode('cp437')] = glyph(contours(cells), row['width']-1, sourceCode=code)
        for text, mark in [('áéíóúýÁÉÍÓÚÝ','acute'), ('čďěňřšťžČĎĚŇŘŠŤŽ','caron'), ('ůŮ','ring')]:
            import unicodedata
            for char in text:
                base = unicodedata.normalize('NFD',char)[0]
                chars[char] = accent(chars[base],mark,char in 'ďť')
        # Punctuation is authored from native strokes, never a system font.
        dot = chars['.']; dash = chars['-']; quote = chars["'"]
        chars['…'] = glyph([[[x+i*2.1,y] for x,y in path] for i in range(3) for path in dot['contours']], 7.3, derivedFrom=46)
        for char, width in [('–',6),('—',9)]:
            b = dash['ink']; scale = width/(b[2]-b[0])
            chars[char] = glyph([[[b[0]+(x-b[0])*scale,y] for x,y in path] for path in dash['contours']],width+1,derivedFrom=45)
        for char in '‘’ʼ':
            chars[char] = {**quote,'derivedFrom':39}
        for char in '“”«»':
            chars[char] = {**chars['"'],'derivedFrom':34}
        q = chars['"']; qb=q['ink']; shift=baseline-qb[1]-.7
        chars['„'] = glyph([[[x,y+shift] for x,y in path] for path in q['contours']],q['advance'],derivedFrom=34)
        chars['\u00a0'] = {**chars[' '],'derivedFrom':32}
        faces[name] = {'height':font['height'],'baseline':baseline,'sourceSHA256':font['sha256'],'glyphs':chars}
    output = {'schema':1,'source':'art/hd-v3/icons/fonts.json','sourceSHA256':hashlib.sha256(raw).hexdigest(),
              'style':'Westwood foreground silhouettes; merged contours; convex chamfer 0.16 source pixels; authored Czech accents',
              'chamfer':CHAMFER,'defaultFace':'NEW8P.FNT','faces':faces}
    return '// Generated by tools/build-painted-typography.py; GPL-2.0-only.\nexport default '+json.dumps(output,ensure_ascii=False,separators=(',',':'))+';\n'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    result=build()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text()!=result:
            raise SystemExit('Period typography output is not reproducible')
    else:
        OUTPUT.write_text(result)
    print(json.dumps({'output':str(OUTPUT),'bytes':len(result.encode()),'verified':args.check}))


if __name__=='__main__':
    main()
