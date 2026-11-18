"""Import source-bound Dune II data as browser PNG/JSON/WAV, never execute DOS code.

Uses only the Python standard library. Asset inputs remain read-only.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import math
import struct
import wave
import zlib

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
ANALYSIS = WORKSPACE / 'analysis/dune-2'
AUDIT = ANALYSIS / 'revalidation-2026-11-18/resources'
DEST = ROOT / 'dist/assets'

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def u16(raw, at=0):
    return struct.unpack_from('<H', raw, at)[0]

def png(path, rgba, width, height):
    assert len(rgba) == width * height * 4
    def chunk(tag, body):
        return struct.pack('>I', len(body)) + tag + body + struct.pack('>I', zlib.crc32(tag + body) & 0xffffffff)
    rows = b''.join(b'\0' + rgba[y*width*4:(y+1)*width*4] for y in range(height))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>2I5B', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))

def rgba(pixels, palette, mask=None, house=0):
    result = bytearray(len(pixels)*4)
    for i, v in enumerate(pixels):
        if 144 <= v <= 150:
            v += house*16
        result[4*i:4*i+3] = palette[3*v:3*v+3]
        result[4*i+3] = 255 if mask is None or mask[i] else 0
    return bytes(result)

def atlas(path, frames, palette, house=0, max_width=1024):
    x = y = row_height = 0
    placed = []
    metadata = {}
    for key, frame in frames.items():
        pixels, w, h, mask = frame
        if x+w > max_width:
            x = 0; y += row_height+1; row_height = 0
        metadata[str(key)] = dict(x=x, y=y, w=w, h=h)
        placed.append((x, y, frame)); x += w+1; row_height=max(row_height,h)
    width=max((x+w for x,y,(_,w,h,_) in placed), default=1)
    height=y+row_height if placed else 1
    output=bytearray(width*height*4)
    for x,y,(pixels,w,h,mask) in placed:
        image=rgba(pixels,palette,mask,house)
        for row in range(h):
            start=((y+row)*width+x)*4
            output[start:start+w*4]=image[row*w*4:(row+1)*w*4]
    png(path,bytes(output),width,height)
    return metadata

def shape_frames(raw, decoder):
    offsets,_,_=decoder.shape_table(raw)
    result={}
    for index,(start,end) in enumerate(zip(offsets,offsets[1:])):
        if start==end: continue
        body=raw[start:end]
        flags,height,width,original_height,stored,expanded=struct.unpack_from('<HBHBHH',body)
        assert stored==len(body)
        pos=10+(16 if flags&1 else 0)
        remap=body[10:26] if flags&1 else None
        stream=body[pos:] if flags&2 else decoder.format80(body[pos:],expanded)[0]
        assert len(stream)==expanded
        pixels=bytearray(); mask=bytearray(); at=0
        while at<len(stream):
            value=stream[at]; at+=1
            if value:
                pixels.append(remap[value] if remap is not None else value); mask.append(1)
            else:
                count=stream[at]; at+=1; pixels.extend(bytes(count)); mask.extend(bytes(count))
        assert len(pixels)==width*height
        result[index]=(bytes(pixels),width,height,bytes(mask))
    return result

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    original=json.loads((AUDIT/'resource-audit.json').read_text())
    sources={}; members={}; all_members={}
    for row in original['originals']:
        raw=(ANALYSIS/'inputs'/row['name']).read_bytes()
        assert digest(raw)==row['extracted_sha256']
        sources[row['name']]=digest(raw)
    for pak in original['paks']:
        raw=(ANALYSIS/'inputs'/pak['name']).read_bytes()
        assert digest(raw)==pak['sha256']
        for row in pak['members']:
            payload=raw[row['offset']:row['offset']+row['size']]
            assert digest(payload)==row['sha256']
            all_members[pak['name'],row['name']]=payload
            members.setdefault(row['name'],payload)
    spec=importlib.util.spec_from_file_location('verified_static_decoder',AUDIT/'audit_resources.py')
    decoder=importlib.util.module_from_spec(spec);spec.loader.exec_module(decoder)
    palettes={name:bytes((v<<2)|(v>>4)for v in raw)for name,raw in members.items()if name.endswith('.PAL')and len(raw)==768}
    palette=palettes['IBM.PAL']
    graphics=dict(atlases={},frames={},houseAtlases={},images={},animations={},terrain={},audio={})
    image_rows={row['name']:row for row in original['image_resources']}
    # Real loaded shape ordering: 7 mouse + 5 button + 99 SHAPES precede units.
    unit_frames={}; global_id=111
    for name in ['UNITS2.SHP','UNITS1.SHP','UNITS.SHP']:
        shapes=shape_frames(members[name],decoder)
        for index,frame in shapes.items():unit_frames[global_id+index]=frame
        global_id+=u16(members[name])
    assert global_id==355
    graphics['houseAtlases']['units']={}
    for house in range(6):
        path=f'units-h{house}.png'
        frames=atlas(DEST/path,unit_frames,palette,house)
        graphics['houseAtlases']['units'][str(house)]='assets/'+path
    graphics['atlases']['units']=graphics['houseAtlases']['units']['0'];graphics['frames']['units']=frames
    # INDEX/ICON tiles preserve all 389 original remapped 16x16 pixel tiles.
    pak_index=next(p for p in json.loads((ANALYSIS/'evidence/resources.json').read_text())if p['name']=='DUNE.PAK')
    iconrow=next(m for m in pak_index['members']if m['name']=='ICON.ICN')
    icon=members['ICON.ICN'];chunks={r['tag']:icon[r['offset']:r['offset']+r['size']]for r in iconrow['iff']['chunks']}
    tiles={}
    for index,remap_index in enumerate(chunks['RTBL']):
        packed=chunks['SSET'][8+index*128:8+(index+1)*128]; pixels=bytearray()
        for v in packed:
            pixels.extend((chunks['RPAL'][remap_index*16+(v>>4)],chunks['RPAL'][remap_index*16+(v&15)]))
        tiles[index]=(bytes(pixels),16,16,None)
    graphics['frames']['tiles']=atlas(DEST/'tiles.png',tiles,palette,max_width=512)
    graphics['atlases']['tiles']='assets/tiles.png'
    iconmap=list(struct.unpack('<'+'H'*(len(members['ICON.MAP'])//2),members['ICON.MAP']))
    groups=[iconmap[iconmap[i]:iconmap[i+1] if i+1<27 else len(iconmap)]for i in range(27)]
    assert len(tiles)==389 and len(groups[9])==81
    graphics['iconMap']=iconmap;graphics['iconGroups']=groups
    graphics['terrain']={
        'sand':[groups[9][0]],'rock':[groups[9][16]],'dune':[groups[9][32]],
        'mountain':[groups[9][48]],'spice':[groups[9][64]],'thickSpice':[groups[9][80]],
        'concrete':[groups[8][1]],
        'classes':{'0':groups[9][0],'1':groups[9][32],'2':groups[9][16],'3':groups[9][48],'8':groups[9][64],'9':groups[9][80],'10':groups[8][1]},
        'variants':{'rock':groups[9][1:17],'dune':groups[9][17:33],'mountain':groups[9][33:49],'spice':groups[9][49:65],'thickSpice':groups[9][65:81]},
        'neighborBits':{'north':1,'east':2,'south':4,'west':8},
        'neighborVariantBases':{'1':17,'2':1,'3':33,'8':49,'9':65},
        'neighborConnects':{'1':[1],'2':[2,3],'3':[3],'8':[8,9],'9':[9]},
        'edgeNeighbor':'same-as-center',
        'mappingEvidence':'Original generator assembly0x7652e–0x766aa; original native classes2/4/6 map to browser1/2/3.',
        'mappingStatus':'Recovered ICON.MAP group9 and original neighbor-bit/offset assembly; generator layout/RNG fidelity is separate.'
    }
    # Common catalog fields remain direct observations of original tables.
    tables=json.loads((ANALYSIS/'evidence/decoded/embedded-tables.json').read_text())
    exe=(ANALYSIS/'inputs/DUNE2.EXE').read_bytes(); units=[]; structures=[]
    for table in tables['object_tables']:
        for entry in table['entries']:
            raw=exe[entry['file_offset']:entry['file_offset']+table['stride']]
            item=dict(id=entry['index'],name=entry['name'],hp=entry['hitpoints'],cost=entry['build_cost'],buildTimeRaw=entry['build_time_raw'],portrait=entry['portrait_name'].upper()if entry['portrait_name']else None,
                      sight=u16(raw,0x12),houseMask=raw[0x31],sourceFileOffset=entry['file_offset'],rawHex=raw.hex())
            if table['kind']=='unit':
                base=u16(raw,0x44); turret=u16(raw,0x46); mode=u16(raw,0x42)
                item.update(width=1,height=1,speed=u16(raw,0x40),movement=u16(raw,0x3c),range=u16(raw,0x50),damage=u16(raw,0x52),fireDelay=u16(raw,0x4e),
                            sprite=dict(atlas='units',frame=base),spriteMode=mode,animationFrames=u16(raw,0x4a))
                if base in unit_frames:
                    item['spriteWidth']=unit_frames[base][1];item['spriteHeight']=unit_frames[base][2]
                if turret!=0xffff:item['turretSprite']=dict(atlas='units',frame=turret)
                # Five stored facings N,NE,E,SE,S with E/W mirrored by the painter.
                if mode in (1,2):
                    item['spriteFacings']=[base,base+1,base+2,base+3,base+4,base+3,base+2,base+1]
                    item['spriteMirrors']=[False]*5+[True]*3
                    if turret!=0xffff:item['turretFacings']=[turret,turret+1,turret+2,turret+3,turret+4,turret+3,turret+2,turret+1]
                units.append(item)
            else:
                layout=u16(raw,0x3a);w,h=[(1,1),(2,1),(1,2),(2,2),(2,3),(3,2),(3,3)][layout]
                item.update(width=w,height=h,layout=layout,iconGroup=u16(raw,0x3c),power=struct.unpack_from('<h',raw,0x38)[0],storage=u16(raw,0x36),
                            produces=[v for v in struct.unpack_from('<8H',raw,0x4a)if v!=0xffff],sprite=dict(atlas='structures',frame=entry['index']))
                structures.append(item)
    building_frames={}
    for item in structures:
        w,h=item['width'],item['height'];area=w*h;group=groups[item['iconGroup']]
        if item['id']in(0,1): used=[groups[8][1]]*area
        elif item['id']==14:used=[groups[6][0]]
        else:
            at=min(2*area,max(0,len(group)-area));used=group[at:at+area]
        assert len(used)==area
        out=bytearray(w*h*256)
        for i,tile in enumerate(used):
            pixels=tiles[tile][0]
            for y in range(16):
                pos=((i//w*16+y)*w*16+i%w*16)
                out[pos:pos+16]=pixels[y*16:(y+1)*16]
        building_frames[item['id']]=(bytes(out),w*16,h*16,None)
    graphics['houseAtlases']['structures']={}
    for house in range(6):
        path=f'structures-h{house}.png';frames=atlas(DEST/path,building_frames,palette,house,max_width=512)
        graphics['houseAtlases']['structures'][str(house)]='assets/'+path
    graphics['atlases']['structures']=graphics['houseAtlases']['structures']['0'];graphics['frames']['structures']=frames
    ui={}
    for name in ['SHAPES.SHP','MOUSE.SHP','BTTN.ENG','MENTAT.ENG','CHOAM.ENG','PIECES.SHP','MENSHPA.SHP','MENSHPH.SHP','MENSHPO.SHP']:
        for i,frame in shape_frames(members[name],decoder).items():ui[f'{name}:{i}']=frame
    graphics['frames']['ui']=atlas(DEST/'ui.png',ui,palette);graphics['atlases']['ui']='assets/ui.png'
    images={'TITLE.ENG':'title','PLANET.CPS':'planet','HERALD.ENG':'herald','SCREEN.CPS':'screen','DUNEMAP.CPS':'map','DUNERGN.CPS':'region','MAPMACH.CPS':'mapMachine','MENTATA.CPS':'mentatA','MENTATH.CPS':'mentatH','MENTATO.CPS':'mentatO','FAME.CPS':'fame','CHOAM.CPS':'choam','MISC.ENG':'misc','VIRGIN.CPS':'virgin','MAPPLAN.CPS':'mapPlanet','BIGPLAN.CPS':'bigPlanet'}
    for name,key in images.items():
        row=image_rows[name];path=AUDIT/row['pixel_directory']/'0000.idx'; pixels=path.read_bytes()
        assert digest(pixels)==row['pixel_sha256']
        raw=members[name];pal=raw[10:778] if row.get('palette_bytes')==768 else palette
        if row.get('palette_bytes')==768:pal=bytes((v<<2)|(v>>4)for v in pal)
        png(DEST/f'{key}.png',rgba(pixels,pal),320,200)
        graphics['images'][key]=f'assets/{key}.png'
    # All WSA stored records are packaged, including explicitly flagged relative continuations.
    portrait_frames={}
    for row in original['image_resources']:
        if row['kind']!='WSA':continue
        name=row['name'];frames={}
        for frame in row['frames']:
            if 'pixel_sha256'not in frame:continue
            pixels=(AUDIT/row['pixel_directory']/f"{frame['index']:04d}.idx").read_bytes()
            assert digest(pixels)==frame['pixel_sha256']
            frames[frame['index']]=(pixels,row['width'],row['height'],None)
        pal=palettes['WESTWOOD.PAL']if name=='WESTWOOD.WSA'else palettes['INTRO.PAL']if row['archive']in('INTRO.PAK','FINALE.PAK')else palette
        filename='animations/'+name.lower()+'.png'
        meta=atlas(DEST/filename,frames,pal)
        graphics['animations'][name]=dict(src='assets/'+filename,frames=meta,frameCount=row['frame_count'],width=row['width'],height=row['height'],continuation=row['continuation'],loopMatchesFirst=row['loop_matches_first'])
        if row['archive']=='MENTAT.PAK'and frames:
            portrait_frames[name]=frames[min(frames)]
    graphics['frames']['portraits']=atlas(DEST/'portraits.png',portrait_frames,palette)
    graphics['atlases']['portraits']='assets/portraits.png'
    # Original Creative VOC PCM blocks become ordinary browser WAV files.
    audio={};audio_failures=[]
    for (archive,name),raw in all_members.items():
        if not name.endswith('.VOC')or name in audio:continue
        try:
            assert raw.startswith(b'Creative Voice File\x1a')
            pos=u16(raw,20);data=bytearray();rate=None
            while pos<len(raw):
                kind=raw[pos];pos+=1
                if not kind:break
                size=int.from_bytes(raw[pos:pos+3],'little');pos+=3;body=raw[pos:pos+size];pos+=size
                assert len(body)==size
                if kind==1:
                    this_rate=round(1000000/(256-body[0]));assert body[1]==0
                    if rate is None:rate=this_rate
                    assert rate==this_rate;data.extend(body[2:])
                elif kind==2:data.extend(body)
                elif kind==3:
                    this_rate=round(1000000/(256-body[2]));rate=rate or this_rate
                    # A silence block has its own time constant; convert duration to WAV rate.
                    data.extend(b'\x80'*round((u16(body)+1)*rate/this_rate))
                elif kind in(4,5,6,7):pass
                else:raise ValueError('unsupported VOC block '+str(kind))
                assert len(data)<10000000
            assert rate and data
            filename='audio/'+name.lower()+'.wav';target=DEST/filename;target.parent.mkdir(exist_ok=True)
            with wave.open(str(target),'wb')as out:
                out.setnchannels(1);out.setsampwidth(1);out.setframerate(rate);out.writeframes(data)
            audio[name]=dict(src='assets/'+filename,rate=rate,samples=len(data),sourceArchive=archive,sourceSha256=digest(raw))
        except (ValueError,AssertionError,IndexError)as e:audio_failures.append(dict(name=name,reason=str(e)or type(e).__name__))
    graphics['audio']={k:v['src']for k,v in audio.items()}
    text={}
    for row in original['text_resources']:
        if row['name']=='CREDITS.ENG':text[row['name']]=(AUDIT/row['output']).read_text()
        else:text[row['name']]=json.loads((AUDIT/row['output']).read_text())
    resources=json.loads((ANALYSIS/'evidence/resources.json').read_text())
    scenarios=[];regions={}
    for row in next(x for x in resources if x['name']=='SCENARIO.PAK')['members']:
        name=row['name']
        if name.startswith('REGION'):regions[name[6]]=row['ini']
        elif name.startswith('SCEN'):
            letter=name[4];scenarios.append(dict(id=name,house={'H':0,'A':1,'O':2}[letter],number=int(name[5:8]),sections=row['ini']))
    scripts={}
    for name in ['BUILD','UNIT','TEAM']:
        raw=members[name+'.EMC']
        # Supplied EMC length fields include the eight-byte FORM header.
        assert raw[:4]==b'FORM' and raw[8:12]==b'EMC2' and int.from_bytes(raw[4:8],'big')==len(raw)
        pos=12;chunks={}
        while pos+8<=len(raw):
            size=int.from_bytes(raw[pos+4:pos+8],'big');assert pos+8+size<=len(raw)
            chunks[raw[pos:pos+4].decode('ascii')]=raw[pos+8:pos+8+size];pos+=8+size+(size&1)
        assert pos==len(raw)
        scripts[name]=dict(orders=list(struct.unpack('>'+'H'*(len(chunks['ORDR'])//2),chunks['ORDR'])),words=list(struct.unpack('>'+'H'*(len(chunks['DATA'])//2),chunks['DATA'])))
    houses=[dict(id=i,name=name,letter=letter,color=color,remapBase=144+i*16)for i,(name,letter,color)in enumerate([
        ('Harkonnen','H','#e35239'),('Atreides','A','#4c86dc'),('Ordos','O','#61bd4d'),('Fremen','F','#b7752c'),('Sardaukar','S','#b65dc8'),('Mercenary','M','#d4ae3f')])]
    content=dict(version=1,build='V1.07',houses=houses,units=units,structures=structures,scenarios=sorted(scenarios,key=lambda x:x['id']),regions=regions,text=text,scripts=scripts,graphics=graphics,audio=audio,
                 provenance=dict(archiveSha256=original['archive_sha256'],sources=sources,unitShapeOrder=['MOUSE.SHP','BTTN.ENG','SHAPES.SHP','UNITS2.SHP','UNITS1.SHP','UNITS.SHP'],unitShapeOrderEvidence='0x7691e',catalogOffsets={'structure':'0x2f58a/96','unit':'0x2fcb0/90'},sourceFacts=['Original names, HP, cost, raw build time, catalog words, scenario INIs, pixel/coverage bytes, language and EMC words.','Terrain north/east/south/west bits1/2/4/8 and per-class neighbor connection rules.'],inferences=['Sprite compass orientation must be compared with original painter for all modes.','WSA palette context uses named INTRO/WESTWOOD/IBM families; sequence composition and continuation initial backgrounds remain unresolved.','VOC repeat/control blocks are preserved in source but ignored by one-shot WAV conversion.']))
    content['textIndexing']=dict(campaignCounter='DS:3316, starts0',displayedStageStarts=1,
        formula='4*displayedStage+kindOffset',offsets=dict(briefing=0,win=1,loss=2,advice=3),
        houseIntroduction=0,testPlaceholders=[1,2,3],independentOfScenarioBranch=True,
        evidence={'counterStart':'0x14633','briefing':'0x83486','win':'0x834b5','loss':'0x834e4','advice':'MENTAT NAME Advice record starts3;0x7d1db computes4*counter+ASCII3-0x2c','winBeforeIncrement':'0x224d8'})
    native_slots=json.loads((ANALYSIS/'evidence/decoded/emc-native-slots.json').read_text())
    for name,script in scripts.items():
        script['nativeSlots']={str(row['slot']):row['analysis_linear']for row in native_slots if row['script']==name+'.EMC'}
    assert len(scenarios)==66 and all(sum(x['house']==house for x in scenarios)==22 for house in range(3))
    assert len(units)==27 and len(structures)==19 and len(audio)==223 and not audio_failures
    for unit in units:
        assert str(unit['sprite']['frame'])in graphics['frames']['units']
        if 'turretSprite'in unit:assert str(unit['turretSprite']['frame'])in graphics['frames']['units']
    png_checks=0
    for path in DEST.rglob('*.png'):
        raw=path.read_bytes();assert raw.startswith(b'\x89PNG\r\n\x1a\n')
        width,height=struct.unpack_from('>II',raw,16);assert 0<width<=8192 and 0<height<=8192
        pos=8
        while pos<len(raw):
            size=struct.unpack_from('>I',raw,pos)[0];tag=raw[pos+4:pos+8];payload=raw[pos+8:pos+8+size]
            assert zlib.crc32(tag+payload)&0xffffffff==struct.unpack_from('>I',raw,pos+8+size)[0]
            if tag==b'IDAT':assert len(zlib.decompress(payload))==(width*4+1)*height
            pos+=12+size
        assert pos==len(raw);png_checks+=1
    validation=dict(originalFilesVerified=len(sources),pakMembersVerified=sum(len(p['members'])for p in original['paks']),unitFrames=len(unit_frames),tiles=len(tiles),structures=len(structures),units=len(units),scenarios=len(scenarios),scenariosPerHouse=22,animations=len(graphics['animations']),pngFilesCrcAndPixelLengthChecked=png_checks,convertedVocFiles=len(audio),audioFailures=audio_failures,sourceExecuted=False)
    (DEST/'validation.json').write_text(json.dumps(validation,indent=2))
    (DEST/'README.md').write_text('''# Imported original Dune II content

Generated by `tools/import-assets.py` using Python's standard library and the saved static decoder helpers. No DOS executable or driver is run. All 19 input hashes and 558 PAK member hashes are checked before conversion. `asset-hashes.json` records original and derived file identities; `validation.json` records conversion coverage.

`content.json` contains original 27 unit and 19 structure type IDs, names, HP, costs, raw build values, catalog words, 66 mission INIs, three region INIs, decoded language, and BUILD/UNIT/TEAM EMC words/orders/native slot addresses. House IDs are 0 Harkonnen, 1 Atreides, 2 Ordos, 3 Fremen, 4 Sardaukar, 5 Mercenary. Fields derived from table words retain complete raw records and source file offsets.

## Graphics contract

`graphics.atlases[name]` is an image URL. `graphics.frames[name][key]` is `{x,y,w,h}` in source pixels. `graphics.houseAtlases.units/structures[houseID]` supplies the same layout with faction colors. Only original indexes 144–150 are remapped to the selected house band. SHP transparency is reconstructed from zero-run coverage, so a skipped pixel is transparent while a literal remapped to palette index zero remains opaque black.

Unit frames use the original loaded shape IDs: 111–150 UNITS2.SHP, 151–237 UNITS1.SHP, 238–354 UNITS.SHP. The preceding mouse/button/SHAPES counts are established by loader 0x7691e. Type +0x44 is its base and +0x46 its optional turret. Direction arrays/mirroring describe the five stored compass facings and still need original-painter comparison for all draw modes.

Structure frames are original ICON.MAP tile composites keyed by type ID, using the recorded layout footprint and normal completed construction stage. ICON tiles retain all 389 original pixel blocks. `graphics.iconGroups` and `iconMap` retain the original directory, including terrain group 9; `graphics.terrain` gives center tiles and neighbor variants. Pixel bytes are observed; final neighbor-mask application and damaged/animated stage selection belong to renderer fidelity work.

Terrain neighbor bits are recovered from original generator assembly 0x7652e–0x766aa: north=1, east=2, south=4, west=8. Out-of-map neighbors match the center class. Rock connects with rock or mountain, spice connects with spice or thick spice; dune, mountain and thick spice connect only with their own class. Index into ICON.MAP group 9 using bases 1/17/33/49/65 for rock/dune/mountain/spice/thick spice plus the mask. Sand always uses group index zero. Generator terrain classification and draw order remain separate fidelity questions.

`content.textIndexing` preserves original campaign text selection. Displayed stage 1–9 uses text index `4*stage+kindOffset`, where briefing/win/loss/advice offsets are 0/1/2/3. The underlying campaign counter starts zero; branch scenario number is not used. Brief/win/loss wrappers are 0x83486/0x834b5/0x834e4; advice comes from the Mentat Advice record's first character `3` and formula in 0x7d1db. The win text is selected before campaign counter increment. Text index zero introduces the house; indices 1–3 are test placeholders.

`graphics.images` includes actual 320×200 title, planet, house heralds, tactical screen, map and advisor backgrounds. `graphics.animations[NAME.WSA]` has a sheet URL, indexed frame rectangles, dimensions and continuation/wrap flags for all 74 resources. Six continuation files retain relative pixels with unknown preceding imagery. FREMEN.WSA's anomalous wrap is retained. INTRO/WESTWOOD/IBM palette families are selected by context; exact per-caller compositing and timing remain partial. `graphics.frames.portraits` selects the first original Mentat picture for each filename.

## Sound contract

`content.audio[NAME.VOC]` contains `{src,rate,samples,sourceArchive,sourceSha256}`; `graphics.audio` maps names directly to WAV URLs. All 223 supplied VOC resources convert to mono 8-bit PCM. Silence blocks have their own time constant and are converted by duration to the containing WAV's sample rate. Repeat/control markers are not expanded in these one-shot files. Sequenced music and original channel priorities remain separate implementation work.

This bundle establishes asset and table availability. It does not establish bit-exact simulation, complete callback contracts, original save compatibility, or complete animation/audio presentation fidelity.
''')
    (DEST/'content.json').write_text(json.dumps(content,separators=(',',':'),ensure_ascii=False))
    output_hashes={p.relative_to(DEST).as_posix():digest(p.read_bytes())for p in DEST.rglob('*')if p.is_file()and p.name!='asset-hashes.json'}
    (DEST/'asset-hashes.json').write_text(json.dumps(dict(sources=sources,outputs=output_hashes,audioFailures=audio_failures),indent=2))
    print(json.dumps(dict(scenarios=len(scenarios),units=len(units),structures=len(structures),tiles=len(tiles),unitFrames=len(unit_frames),animations=len(graphics['animations']),audio=len(audio),audioFailures=audio_failures,files=len(output_hashes),bytes=sum(p.stat().st_size for p in DEST.rglob('*')if p.is_file())),indent=2))

if __name__=='__main__':main()
