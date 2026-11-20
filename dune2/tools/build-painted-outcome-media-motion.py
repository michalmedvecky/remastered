"""Decode ordinary mission outcome WSA references and audit ordinary coverage.

Only bounded resource codecs are evaluated. No native game code is executed.
The original 36- and six-resource audits are read without alteration.
"""
from pathlib import Path
import ast, base64, collections, configparser, hashlib, json, math, re, struct, sys, zlib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from preload_data import read_pak, verify_preload

ART = ROOT / 'art/hd-v3/media'
OUT = ART / 'outcome-motion'
sha = lambda body: hashlib.sha256(body).hexdigest()
codec_path = ART / 'motion/build-motion.py'
tree = ast.parse(codec_path.read_text())
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in
             {'png', 'format80', 'format40', 'wsa', 'bounds', 'components', 'contact'}]
assert len(functions) == 7
exec(compile(ast.Module(body=functions, type_ignores=[]), str(codec_path), 'exec'), globals())

preload = verify_preload()
members = {}
for archive in preload['files']:
    if archive['name'].upper().endswith('.PAK'):
        for name, row in read_pak(archive['name']).items():
            members.setdefault(name, dict(**row, archive=archive['name']))
pal_source = members['IBM.PAL']
pal = bytes((v * 65) >> 4 for v in pal_source['bytes'])
names = ['WIN1.WSA', 'WIN2.WSA', 'LOSTBILD.WSA', 'LOSTVEHC.WSA']
observations = {
    'WIN1.WSA': 'Victorious olive-uniformed, rust/tan-armoured troops run right across sand; large foreground soldier at right, smaller cheering troops at left; smoke columns under cyan sky.',
    'WIN2.WSA': 'Victory celebration: cropped armed soldier at foreground left, two standing soldiers at centre, one with arms raised overhead; troops and armoured vehicles at right in a sandy battlefield under cyan sky.',
    'LOSTBILD.WSA': 'Destroyed base: diagonal foreground rubble slabs and shattered industrial structures fill a grey/olive wasteland; large twisted beams and multiple dark smoke columns under cyan/yellow sky. No live characters.',
    'LOSTVEHC.WSA': 'Vehicle defeat: a fallen helmeted olive-armoured soldier lies across foreground, wrecked tracked tank at right middle distance, white wreckage at left, scattered debris and multiple smoke columns across sand under cyan sky.'
}
resources = []
new_flat = []
for name in names:
    source = members[name]
    meta, decoded = wsa(source['bytes'])
    assert meta['frame_count'] == 1 and (meta['width'], meta['height']) == (184, 112)
    assert not meta['continuation'] and meta['loop_matches_first']
    stem = name[:-4].lower()
    folder = OUT / 'native' / stem
    folder.mkdir(parents=True, exist_ok=True)
    pixels = decoded[0][0]
    (folder / 'frame-000.idx').write_bytes(pixels)
    png(folder / 'frame-000.png', pixels, 184, 112, pal)
    png(folder / 'loop-record.png', decoded[1][0], 184, 112, pal)
    record = dict(frame=0, pixelSha256=sha(pixels), indexFile=f'native/{stem}/frame-000.idx',
                  png=f'native/{stem}/frame-000.png', changedFromFirst=0, changedBounds=None,
                  changedFromPrevious=0, previousDeltaBounds=None, components=[])
    header = dict(rawCount=meta['raw_frame_count'], width=184, height=112,
                  bufferHint=meta['buffer_hint'], flags=meta['flags'],
                  littleEndianHex=source['bytes'][:10].hex(), sourceBytes=source['size'])
    resources.append(dict(resource=name, archive=source['archive'], resourceSha256=source['sha256'],
                          paletteResource='IBM.PAL', paletteSha256=pal_source['sha256'],
                          nativeWidth=184, nativeHeight=112, frameCount=1, loopRecordFrame=1,
                          loopMatchesFirst=True, rawHeader=header, decoderEvidence=meta,
                          changedPixelUnion=0, changedBounds=None, motionComponents=[], frames=[record],
                          visualPhaseSequence=[0], distinctVisualPhases=1, classification='static-mission-outcome',
                          semanticParts=[], visualObservation=observations[name],
                          owners=[dict(kind='scenario-win' if name.startswith('WIN') else 'scenario-loss', name=name[:-4])]))
    new_flat.append((name, 0, pixels))
inventory = dict(schema=1, resourceCount=4, frameCount=4, sourcePreloadSha256=preload['packageSha256'],
                 sourcePaletteSha256=pal_source['sha256'], resources=resources,
                 limits=['No DOS execution; checked Format80/40 static extraction.',
                         'The stored loop record repeats frame0 and is not an extra animation phase.'])
(OUT / 'inventory.json').write_text(json.dumps(inventory, indent=2) + '\n')
contact(OUT / 'review/all-first-frames-native.png', [r[2] for r in new_flat], 184, 112, pal, 4, 2)

# Preserve all 33 previous coordinates and each original phase/hash. Only add a
# coordinate if needed to distinguish the newly added exact native images.
old = json.loads((ART / 'extra-motion/global-frame-witnesses.json').read_text())
flat = []
for folder in ['motion', 'extra-motion']:
    source = ART / folder
    for resource in json.loads((source / 'inventory.json').read_text())['resources']:
        for frame in resource['frames']:
            raw = (source / frame['indexFile']).read_bytes()
            assert sha(raw) == frame['pixelSha256']
            flat.append((resource['resource'], frame['frame'], raw))
assert len(flat) == 264
flat += new_flat
unique = {}; equivalent = {}
for name, index, frame in flat:
    digest = sha(frame); unique.setdefault(digest, frame)
    equivalent.setdefault(digest, []).append(dict(resource=name, frame=index))
values = list(unique.values())
coordinates = [y * 184 + x for x, y in old['coordinates']]
def regroup():
    groups = {}
    for i, frame in enumerate(values):
        groups.setdefault(bytes(frame[p] for p in coordinates), []).append(i)
    return list(groups.values())
groups = regroup()
while any(len(group) > 1 for group in groups):
    best = -1; best_score = -1
    for p in range(184 * 112):
        score = 0
        for group in groups:
            if len(group) < 2: continue
            bins = collections.Counter(values[i][p] for i in group)
            score += len(group) ** 2 - sum(n * n for n in bins.values())
        if score > best_score: best_score = score; best = p
    assert best_score > 0
    coordinates.append(best); groups = regroup()
rows = [dict(resource=name, frame=index, pixelSha256=sha(frame),
             signatureBase64=base64.b64encode(bytes(frame[p] for p in coordinates)).decode(),
             equivalentFrames=equivalent[sha(frame)]) for name, index, frame in flat]
combined = dict(schema=1, sourcePreloadSha256=old['sourcePreloadSha256'], nativeRect=[128, 48, 184, 112],
                indexDomain=old['indexDomain'], coordinates=[[p % 184, p // 184] for p in coordinates],
                distinctFrameCount=len(unique), totalFrames=len(flat), frames=rows, matching=old['matching'],
                sourceInventories=['motion/inventory.json', 'extra-motion/inventory.json', 'outcome-motion/inventory.json'],
                preserved42=dict(resources=42, phases=264, coordinates=len(old['coordinates']),
                                 witnessBankSHA256=sha((ART / 'extra-motion/global-frame-witnesses.json').read_bytes())))
(OUT / 'global-frame-witnesses.json').write_text(json.dumps(combined, indent=2) + '\n')

# Audit original scenario BASIC fields including native defaults, and every
# NAME entry's compressed help picture. Raw .WSA searches miss compressed names.
couples = (' etainosrlhcdupm' 'tasio wb' ' rnsdalm' 'h ieoras' 'nrtlc sy' 'nstcloer'
           ' dtgesio' 'nr ufmsw' ' tep.ica' 'e oiadur' ' laeiyod' 'eia otru' 'etoakhlr'
           ' eiu,.oa' 'nsrctlai' 'leoiratp' 'eaoip bm').encode('ascii')
def decompress(data):
    out = bytearray(); i = 0
    while i < len(data) and data[i]:
        c = data[i]; i += 1
        if c & 0x80:
            c &= 0x7f; out.append(couples[c >> 3]); c = couples[c + 16]
        elif c == 0x1b:
            assert i < len(data); c = 0x7f + data[i]; i += 1
        out.append(c)
        assert len(out) <= 65536
    assert i < len(data) and data[i] == 0
    return out.decode('latin1')
scenario_rows = []
defaults = {'BriefPicture': 'HARVEST.WSA', 'WinPicture': 'WIN1.WSA', 'LosePicture': 'LOSTBILD.WSA'}
for name, source in read_pak('SCENARIO.PAK').items():
    if not re.fullmatch(r'SCEN[AHO]\d{3}\.INI', name): continue
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    # Scenarios may append a binary terrain payload. Only the textual BASIC
    # section is relevant; do not feed arbitrary following bytes to an INI parser.
    section = re.search(rb'(?im)^\[BASIC\][^\r\n]*[\r\n]+(.*?)(?=^\[|\x1a|\Z)', source['bytes'], re.S)
    assert section is not None
    parser.read_string('[BASIC]\n' + section.group(1).decode('latin1'))
    pictures = {field: parser.get('BASIC', field, fallback=fallback).upper() for field, fallback in defaults.items()}
    scenario_rows.append(dict(resource=name, sourceSHA256=source['sha256'], pictures=pictures,
                              defaultsUsed=[field for field in defaults if not parser.has_option('BASIC', field)]))
help_rows = []
for name in ['MENTATA.ENG', 'MENTATH.ENG', 'MENTATO.ENG']:
    source = members[name]; raw = source['bytes']; assert raw[:4] == b'FORM' and raw[8:12] == b'MENT'
    chunks = {}; p = 12
    while p + 8 <= len(raw):
        size = int.from_bytes(raw[p+4:p+8], 'big'); assert p + 8 + size <= len(raw)
        chunks[raw[p:p+4].decode('ascii')] = raw[p+8:p+8+size]; p += 8 + size + (size & 1)
    assert p == len(raw)
    data = chunks['NAME']; subjects = []; p = 0
    while p < len(data):
        size = data[p]; assert size >= 8 and p + size <= len(data)
        record = data[p:p+size]; offset = int.from_bytes(record[1:5], 'big'); assert offset < len(raw)
        text = decompress(raw[offset:]); picture = re.split(r'[?*]', text, maxsplit=1)[0].upper()
        subjects.append(dict(name=record[7:-1].rstrip(b'\0').decode('latin1'), offset=offset,
                             recordHex=record.hex(), picture=picture if picture.endswith('.WSA') else None,
                             scenarioPicture=record[5] == ord('0')))
        p += size
    help_rows.append(dict(resource=name, sourceSHA256=source['sha256'], archive=source['archive'], subjects=subjects))
prior36 = [r['resource'] for r in json.loads((ART / 'motion/inventory.json').read_text())['resources']]
prior6 = [r['resource'] for r in json.loads((ART / 'extra-motion/inventory.json').read_text())['resources']]
ordinary = set(prior36 + prior6 + names)
scenario_names = sorted({p for row in scenario_rows for p in row['pictures'].values()})
help_names = sorted({subject['picture'] for row in help_rows for subject in row['subjects'] if subject['picture']})
referenced = set(scenario_names + help_names + prior36)
assert len(scenario_rows) == 66 and len(help_names) == 40
assert not referenced - ordinary and len(ordinary) == 46
assert set(names) == set(scenario_names) - set(prior36 + prior6)
audit = dict(schema=1, sourcePreloadSHA256=preload['packageSha256'],
             nativeEvidence=['native/opendune/src/scenario.c:Scenario_Load_General',
                             'native/opendune/src/gui/mentat.c:GUI_Mentat_ShowBriefing',
                             'native/opendune/src/gui/mentat.c:GUI_Mentat_ShowWin',
                             'native/opendune/src/gui/mentat.c:GUI_Mentat_ShowLose',
                             'native/opendune/src/gui/mentat.c:GUI_Mentat_ShowHelp',
                             'native/opendune/src/string.c:String_DecompressAndTranslate'],
             scenarioCount=len(scenario_rows), scenarios=sorted(scenario_rows, key=lambda r:r['resource']),
             nativeDefaults=defaults, helpFiles=help_rows, scenarioResources=scenario_names, helpResources=help_names,
             original36Resources=prior36, extra6Resources=prior6, outcome4Resources=names,
             ordinaryResources=sorted(ordinary), coveredResources=sorted(ordinary), missingResources=[],
             useCounts={field:dict(sorted(collections.Counter(row['pictures'][field] for row in scenario_rows).items())) for field in defaults},
             scope='Unit/structure portraits, ordinary Mentat/help/homeworld previews, and all scenario briefing/win/loss pictures.',
             excluded=[dict(resource='STATIC.WSA', reason='64x64 noise image; no scenario/help picture references; not an ordinary184x112 illustration.'),
                       dict(resource='intro/finale cinematics', reason='Separate full-screen sequence ownership; not GUI_Mentat ordinary preview inventory.')])
(OUT / 'ordinary-coverage-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps(dict(outcomeResources=4, outcomeFrames=4, resources=46, phases=len(rows), distinct=len(unique),
                      coordinates=len(coordinates), scenarios=66, helpResources=len(help_names))))
