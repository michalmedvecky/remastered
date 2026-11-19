"""Normalize retained indexed preview reference PNGs to RGBA for atlas tooling."""
from pathlib import Path
import importlib.util, json
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('media_reference_png', ROOT / 'tools/build-hd-assets.py')
codec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(codec)
data = json.loads((ROOT / 'dist/assets/content.json').read_text())
names = sorted({r['portrait'] for r in data['units'] + data['structures'] if r.get('portrait')})
dest = ROOT / 'art/hd-v3/media/references/native'
dest.mkdir(parents=True, exist_ok=True)
for name in names:
    stem = Path(name).stem.lower()
    source = ROOT / 'art/hd-v3/media/motion/native' / stem / 'frame-000.png'
    width, height, rgba = codec.read_png(source)
    assert (width, height) == (184, 112)
    codec.write_png(dest / (stem + '.png'), width, height, rgba)
