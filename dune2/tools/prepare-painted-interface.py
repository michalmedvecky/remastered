"""Inventory retained native interface resources and hitboxes without execution."""
from pathlib import Path
import base64, hashlib, importlib.util, json, re, struct

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-v3/interface'
SHA = lambda body: hashlib.sha256(body).hexdigest()


def pak_members(raw):
    at = 0
    entries = []
    while True:
        offset = struct.unpack_from('<I', raw, at)[0]
        at += 4
        if not offset:
            break
        end = raw.index(b'\0', at)
        name = raw[at:end].decode('ascii').upper()
        entries.append((name, offset))
        at = end + 1
    for i, (name, start) in enumerate(entries):
        end = entries[i + 1][1] if i + 1 < len(entries) else len(raw)
        assert at <= start <= end <= len(raw)
        yield name, raw[start:end]


def main():
    integrity = json.loads((ROOT / 'fidelity/original-integrity.json').read_text())
    expected = {r['name'].upper(): r['sha256'] for r in integrity['members']}
    members = {}
    archives = {}
    for path in sorted((ROOT / 'native/data').glob('*.PAK')):
        raw = path.read_bytes()
        assert SHA(raw) == expected[path.name.upper()], path
        archives[path.name] = SHA(raw)
        for name, data in pak_members(raw):
            members.setdefault(name, (path.name, data))
    backgrounds = []
    painted = {'SCREEN.CPS': 'hud-shell', 'CHOAM.CPS': 'factory-shell', 'HERALD.ENG': 'house-choice',
               'MISC.ENG': 'house-confirm-question / house-confirm-name', 'TITLE.ENG': 'vector-title',
               **{'MENTAT'+name.upper()+'.CPS': 'advisor-'+name for name in ('h', 'a', 'o', 'm')},
               'DUNEMAP.CPS':'campaign-undivided','DUNERGN.CPS':'campaign-regions','MAPMACH.CPS':'campaign-shell','PLANET.CPS':'campaign-planet','FAME.CPS':'score-shell'}
    for name, (archive, raw) in sorted(members.items()):
        if len(raw) < 10 or not name.endswith(('.CPS', '.ENG')):
            continue
        compression, expanded, palette_size = struct.unpack_from('<HIH', raw, 2)
        if compression not in (0, 4) or expanded != 64000:
            continue
        backgrounds.append(dict(resource=name, archive=archive, sha256=SHA(raw),
                                nativeRect=[0, 0, 320, 200], expandedBytes=expanded,
                                paletteBytes=palette_size, compression=compression,
                                interfaceAsset=painted.get(name),
                                status='vector-title-by-renderer' if name == 'TITLE.ENG' else 'painted-reused-blank-strips' if name == 'MISC.ENG' else 'painted-whole-advisor' if name.startswith('MENTAT') else 'painted-chrome' if name in painted else 'outside-interface-bank',
                                note='House-choice labels baked into CPS; fixed-label replacement supplied as semantic metadata.' if name == 'MISC.ENG' else ''))
    text = (ROOT / 'native/opendune/src/table/widgetinfo.c').read_text()
    game = text.split('WidgetInfo g_table_gameWidgetInfo[19] = {', 1)[1].split('WidgetInfo ', 1)[0]
    widgets = []
    for block in re.split(r'\{ /\* \d+ \*/', game)[1:]:
        values = dict(re.findall(r'/\*\s*(index|spriteID|offsetX|offsetY|width|height)\s*\*/\s*(-?\d+)', block))
        if len(values) != 6:
            continue
        row = {key: int(value) for key, value in values.items()}
        row['nativeRect'] = [row.pop(key) for key in ('offsetX', 'offsetY', 'width', 'height')]
        widgets.append(row)
    result = dict(schema=1, purpose='Static native interface inventory; no game execution',
                  archives=archives, backgrounds=backgrounds, gameWidgets=widgets,
                  ownership=dict(interface=['SCREEN.CPS', 'CHOAM.CPS', 'procedural borders/buttons'],
                                 icons='art/hd-v3/icons: native SHP pointers, labels, portraits, emblems, glyphs',
                                 media='other CPS/WSA scene backgrounds and embedded labels'),
                  evidence=[dict(path='native/opendune/src/gui/gui.c', symbols=['GUI_DrawInterfaceAndRadar', 'GUI_FactoryWindow_Init', 'GUI_DrawBorder', 'GUI_DrawProgressbar']),
                            dict(path='native/opendune/src/gui/widget.c', symbols=['g_widgetProperties']),
                            dict(path='native/opendune/src/table/widgetinfo.c', symbols=['g_table_gameWidgetInfo']),
                            dict(path='native/opendune/src/table/windowdesc.c', symbols=['g_optionsWindowDesc', 'g_saveLoadWindowDesc', 'g_savegameNameWindowDesc']),
                            dict(path='native/opendune/src/gui/widget_draw.c', symbols=['GUI_Widget_TextButton_Draw', 'GUI_Widget_ActionPanel_Draw'])])
    spec = importlib.util.spec_from_file_location('interface_original_codec', ROOT / 'tools/build-hd-assets.py')
    codec = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(codec)
    scenes = {}
    for name in ('SCREEN.CPS', 'CHOAM.CPS', 'HERALD.ENG', 'MISC.ENG', 'TITLE.ENG', 'MENTATH.CPS', 'MENTATA.CPS', 'MENTATO.CPS', 'MENTATM.CPS', 'DUNEMAP.CPS', 'DUNERGN.CPS', 'MAPMACH.CPS','PLANET.CPS','FAME.CPS'):
        archive, raw = members[name]
        compression, expanded, palette_size = struct.unpack_from('<HIH', raw, 2)
        stream = raw[10 + palette_size:]
        pixels = codec.format80(stream, expanded) if compression == 4 else stream[:expanded]
        assert len(pixels) == 64000
        if name.startswith('MENTAT'):
            palette6 = members['BENE.PAL'][1] if name == 'MENTATM.CPS' else raw[10:10+palette_size] if palette_size else members['IBM.PAL'][1]
            palette8 = bytes((v * 65) >> 4 for v in palette6)
            rgba = b''.join(palette8[v*3:v*3+3] + b'\xff' for v in pixels)
            target = ART / 'references' / (name.replace('.CPS', '') + '-native.png')
            target.parent.mkdir(parents=True, exist_ok=True)
            codec.write_png(target, 320, 200, rgba)
        # Sparse immutable witnesses supplement the complete indexed evidence.
        # They compare indices, therefore are unaffected by native palette fades.
        witnesses = []
        for y in range(0, 200, 2):
            for x in range(0, 320, 2):
                value = pixels[y * 320 + x]
                if not value:
                    continue
                stable = True
                if name == 'SCREEN.CPS':
                    stable = (240 <= x < 256 and y >= 40) or (y >= 125 and y < 134 and x >= 254) or (y < 40 and (x < 14 or y >= 18 or 184 <= x < 192))
                elif name == 'CHOAM.CPS':
                    stable = (112 <= x < 128) or (x >= 312 and y >= 20) or (x >= 120 and 32 <= y < 44)
                elif name == 'MISC.ENG':
                    stable = x < 208 and y < 24
                elif name.startswith('MENTAT'):
                    # Right media well, mouth/eyes and book/hand patches vary.
                    stable = x >= 152 and (24 <= y < 48 or y >= 164)
                elif name in ('DUNEMAP.CPS','DUNERGN.CPS','PLANET.CPS'):
                    stable = 8 <= x < 312 and 24 <= y < 144
                elif name == 'MAPMACH.CPS':
                    stable = (x < 8 or x >= 312) or (y >= 192) or (56 <= x < 264 and 152 <= y < 164)
                elif name == 'FAME.CPS':
                    stable = (y >= 74 and (x < 8 or x >= 312)) or y >= 194
                if stable:
                    witnesses.append([x, y, value])
        # Evenly sampled rather than first-in-raster so edges all contribute.
        if len(witnesses) > 320:
            witnesses = [witnesses[i * len(witnesses) // 320] for i in range(320)]
        scenes[name] = dict(resource=name, archive=archive, sourceSHA256=SHA(raw),
                            nativeRect=[0, 0, 320, 200], indicesBase64=base64.b64encode(pixels).decode(),
                            indexedSHA256=SHA(pixels), witnesses=witnesses,
                            houseRemap=dict(first=144, last=150, stride=16) if name in ('SCREEN.CPS', 'CHOAM.CPS','MAPMACH.CPS') else None)
        if name.startswith('MENTAT'):
            palette_name = 'BENE.PAL' if name == 'MENTATM.CPS' else 'IBM.PAL'
            scenes[name].update(paletteResource=palette_name, paletteSHA256=SHA(members[palette_name][1]),
                                palette6Base64=base64.b64encode(members[palette_name][1]).decode())
    result['scenes'] = scenes
    positions = None
    ini_hashes = {}
    for name in ('REGIONA.INI','REGIONH.INI','REGIONO.INI'):
        data = members[name][1]
        section = data.decode('latin1').upper().split('[PIECES]',1)[1].split('[',1)[0]
        current = {int(k):[int(x),int(y)] for k,x,y in re.findall(r'(?m)^\s*(\d+)\s*=\s*(\d+)\s*,\s*(\d+)',section)}
        assert len(current) == 27
        if positions is not None:
            assert current == positions
        positions = current
        ini_hashes[name] = SHA(data)
    raw = members['PIECES.SHP'][1]
    count, bank = codec.shapes(raw)
    assert count == 28
    shapes = {477+i:dict(sourceW=f['width'],sourceH=f['height'],maskBase64=base64.b64encode(f['mask']).decode(),indicesBase64=base64.b64encode(f['indices']).decode(),palette=f['palette'],sourceSHA256=f['sourceSHA256']) for i,f in bank.items()}
    click_raw = members['RGNCLK.CPS'][1]
    compression, expanded, palette_size = struct.unpack_from('<HIH',click_raw,2)
    clicks = codec.format80(click_raw[10+palette_size:],expanded) if compression == 4 else click_raw[10+palette_size:10+palette_size+expanded]
    click_crop = b''.join(clicks[(24+y)*320+8:(24+y)*320+312] for y in range(120))
    result['campaign'] = dict(nativeRect=[8,24,304,120],positions=positions,shapes=shapes,
                              palette=list(bytes((v*65)>>4 for v in members['IBM.PAL'][1])),
                              sourceSHA256={'PIECES.SHP':SHA(raw),**ini_hashes,'RGNCLK.CPS':SHA(click_raw)},
                              semanticClickData=dict(purpose='Original region ID data only, never painted RGB or replacement hitboxes',indicesBase64=base64.b64encode(click_crop).decode(),indexedSHA256=SHA(click_crop)))
    # These CPS files are atlases as well as backgrounds. Retain the exact
    # native copy result so the UI layer can identify each displayed crest.
    # All coordinates here are pixels, after GUI_Screen_Copy's x*8 conversion.
    def crest_copy(resource, source_rect, destination, player_house, painted_house, remapped):
        x,y,w,h=source_rect
        source=base64.b64decode(scenes[resource]['indicesBase64'])
        crop=b''.join(source[(y+yy)*320+x:(y+yy)*320+x+w]for yy in range(h))
        expected=bytes(v+player_house*16 if remapped and 144<=v<=150 else v for v in crop)
        candidates=[(i%w,i//w,v)for i,v in enumerate(expected)if v]
        points=[list(candidates[i*len(candidates)//min(32,len(candidates))])for i in range(min(32,len(candidates)))]
        return dict(sourceResource=resource,sourceSHA256=scenes[resource]['sourceSHA256'],sourceRect=source_rect,destinationNativeRect=destination,
                    sourceIndicesBase64=base64.b64encode(crop).decode(),expectedIndicesBase64=base64.b64encode(expected).decode(),expectedIndexedSHA256=SHA(expected),
                    sourceHouse=painted_house,playerHouse=player_house,remapApplied=remapped,localWitnesses=points,
                    paletteResource='IBM.PAL',paletteSHA256=SHA(members['IBM.PAL'][1]),opaqueCopy=True)
    families={}
    for family,resource in [('factory','CHOAM.CPS'),('campaign','MAPMACH.CPS'),('score','FAME.CPS')]:
        variants=[]
        for house in range(6):
            if family=='factory':
                xy=[(0,8),(0,152),(128,48),(0,0),(0,0),(0,0)][house]
                rect=[*xy,56,40];destinations=[[0,8,56,40],[0,152,56,40]];sources=[rect,rect];owners=[house if house<3 else None]*2;remapped=True
            elif family=='campaign':
                xy=(0,152)if house==0 else(8,24)if house==2 else(264,152)
                rect=[*xy,56,40];destinations=[[0,152,56,40],[264,152,56,40]];sources=[rect,rect];owners=[0 if house==0 else 2 if house==2 else 1]*2;remapped=True
            else:
                first=house*56+8 if house<=2 else 8
                second=first if house<=2 else first+56
                sources=[[first,136,56,56],[second,136,56,56]];destinations=[[0,8,56,56],[264,8,56,56]];owners=[house,house]if house<=2 else[0,1];remapped=False
            variants.append(dict(playerHouse=house,copies=[crest_copy(resource,src,dest,house,owner,remapped)for src,dest,owner in zip(sources,destinations,owners)]))
        families[family]=dict(resource=resource,variants=variants)
    result['crestCompositions']=dict(schema=1,families=families,paletteResource='IBM.PAL',palette6Base64=base64.b64encode(members['IBM.PAL'][1]).decode(),paletteSHA256=SHA(members['IBM.PAL'][1]),evidence=['GUI_FactoryWindow_Init xSrc/ySrc arrays','GUI_StrategicMap_Show source x/y switch','GUI_HallOfFame_DrawBackground xSrc and house>Ordos increment'],notes=['NativeCPS crop data is matching evidence, not painted RGB.','Factory debug/fallback house3..5 source crops do not identify a complete canonical house crest; sourceHouse is null rather than guessed.','Score fallback houses3..5 deliberately show Harkonnen and Atreides sources in different upper corners.'])
    ART.mkdir(parents=True, exist_ok=True)
    target = ART / 'native-inventory.json'
    target.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(path=str(target.relative_to(ROOT)), backgrounds=len(backgrounds), widgets=len(widgets), archivesVerified=len(archives))))


if __name__ == '__main__':
    main()
