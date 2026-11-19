#!/usr/bin/env python3
"""Package the frozen NEW8P Canvas contours as a self-contained WOFF1 webfont.

Python standard library only. No font service, installed font, or font toolchain.
Primary format references:
https://learn.microsoft.com/en-us/typography/opentype/spec/glyf
https://learn.microsoft.com/en-us/typography/opentype/spec/cmap
https://learn.microsoft.com/en-us/typography/opentype/spec/head
https://www.w3.org/TR/WOFF/
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import zlib

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'dist/painted-font-data.mjs'
OUTPUT=ROOT/'dist/fonts/arrakis-console.woff'
MANIFEST=ROOT/'dist/fonts/arrakis-console.json'
FAMILY='Arrakis Console'
SCALE=100
EM=1000


def pack(fmt,*values):
    return struct.pack('>'+fmt,*values)


def padded(data):
    return data+b'\0'*((-len(data))%4)


def checksum(data):
    data=padded(data)
    return sum(struct.unpack('>'+str(len(data)//4)+'I',data))&0xffffffff


def read_source():
    raw=SOURCE.read_bytes()
    text=raw.decode()
    data=json.loads(text.split('export default ',1)[1].rsplit(';',1)[0])
    return data['faces']['NEW8P.FNT'],hashlib.sha256(raw).hexdigest()


def glyph_data(glyph,baseline):
    # Flipping source y-down to TrueType y-up also gives the correct clockwise
    # outer and counter-clockwise hole winding of the merged source contours.
    paths=[[(round(x*SCALE),round((baseline-y)*SCALE)) for x,y in path] for path in glyph['contours']]
    points=[p for path in paths for p in path]
    if not points:
        return b'',(0,0,0,0),paths
    xs,ys=zip(*points)
    box=(min(xs),min(ys),max(xs),max(ys))
    ends=[];total=0
    for path in paths:
        total+=len(path);ends.append(total-1)
    data=pack('h4h',len(paths),*box)+pack(str(len(ends))+'H',*ends)+pack('H',0)
    # Every point is on-curve. Uncompressed signed delta arrays are simple and
    # independently auditable; WOFF applies lossless per-table compression.
    data+=b'\x01'*len(points)
    for dimension in [0,1]:
        previous=0;deltas=[]
        for point in points:
            deltas.append(point[dimension]-previous);previous=point[dimension]
        data+=pack(str(len(deltas))+'h',*deltas)
    return data,box,paths


def cmap_table(characters):
    pairs=[(ord(char),i+1) for i,char in enumerate(characters)]
    assert all(c<0xffff for c,_ in pairs)
    pairs.append((0xffff,0))
    count=len(pairs);power=2**int(math.log2(count))
    table=pack('7H',4,16+8*count,0,2*count,2*power,int(math.log2(power)),2*(count-power))
    table+=pack(str(count)+'H',*(c for c,_ in pairs))+pack('H',0)
    table+=pack(str(count)+'H',*(c for c,_ in pairs))
    table+=pack(str(count)+'H',*((gid-c)&0xffff for c,gid in pairs))
    table+=b'\0\0'*count
    return pack('HHHHIHHI',0,2,0,3,20,3,1,20)+table


def name_table(source_hash):
    names={0:'Vector contours derived from the supplied Dune II NEW8P.FNT; Czech extensions.',
           1:FAMILY,2:'Regular',3:'ArrakisConsole-1.000-'+source_hash[:16],
           4:FAMILY+' Regular',5:'Version 1.000',6:'ArrakisConsole-Regular',
           16:FAMILY,17:'Regular'}
    records=[];strings=b''
    for ident,text in sorted(names.items()):
        encoded=text.encode('utf-16-be')
        records.append(pack('6H',3,1,0x0409,ident,len(encoded),len(strings)))
        strings+=encoded
    return pack('3H',0,len(records),6+12*len(records))+b''.join(records)+strings


def build():
    face,source_hash=read_source()
    characters=sorted(face['glyphs'],key=ord)
    glyphs=[face['glyphs']['?']]+[face['glyphs'][c] for c in characters]
    encoded=[glyph_data(g,face['baseline']) for g in glyphs]
    boxes=[box for data,box,_ in encoded if data]
    box=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
    advances=[round(g['advance']*SCALE) for g in glyphs]
    ascender=max(900,box[3]);descender=min(-220,box[1]);line_gap=120
    glyf=b'';locations=[]
    for data,_,_ in encoded:
        locations.append(len(glyf));glyf+=padded(data)
    locations.append(len(glyf))
    n=len(glyphs)
    max_points=max(sum(map(len,paths)) for _,_,paths in encoded)
    max_contours=max(len(paths) for _,_,paths in encoded)
    actual=[(adv,box) for adv,(data,box,_) in zip(advances,encoded) if data]
    tables={
      'head':pack('IIIIHHQQ4hHH3h',0x10000,0x10000,0,0x5f0f3cf5,3,EM,0,0,*box,0,10,2,1,0),
      'hhea':pack('I3hH11hH',0x10000,ascender,descender,line_gap,max(advances),
                  min(b[0] for _,b in actual),min(adv-b[2] for adv,b in actual),max(b[2] for _,b in actual),
                  1,0,0,0,0,0,0,0,n),
      'maxp':pack('I14H',0x10000,n,max_points,max_contours,0,0,1,0,0,0,0,0,0,0,0),
      'hmtx':b''.join(pack('Hh',adv,box[0] if data else 0) for adv,(data,box,_) in zip(advances,encoded)),
      'cmap':cmap_table(characters),
      'loca':pack(str(len(locations))+'I',*locations),
      'glyf':glyf,
      'name':name_table(source_hash),
      'post':pack('IIhh5I',0x30000,0,-100,70,0,0,0,0,0),
      'gasp':pack('4H',1,1,0xffff,0x000a),
    }
    avg=round(sum(face['glyphs'][c]['advance']*SCALE for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')/52)
    # OS/2 v4, regular, USE_TYPO_METRICS; identical hhea/OS2 line metrics.
    os2=pack('Hh3H11h',4,avg,400,5,0,650,600,0,75,650,600,0,350,70,300,0)
    os2+=bytes([2,11,5,3,2,2,2,2,2,4])+pack('4I',0x8000000f,0x00000802,0,0)+b'ARRK'
    os2+=pack('3H3h2H2I2h3H',0x0140,ord(characters[0]),ord(characters[-1]),ascender,descender,line_gap,
              max(0,box[3]),max(0,-box[1]),3,0,500,700,0,32,1)
    assert len(os2)==96
    tables['OS/2']=os2
    tags=sorted(tables);count=len(tags);power=2**int(math.log2(count))
    header=pack('I4H',0x10000,count,16*power,int(math.log2(power)),16*(count-power))
    directory=[];body=b'';offset=12+16*count
    sums={tag:checksum(tables[tag]) for tag in tags}
    for tag in tags:
        data=tables[tag]
        directory.append(pack('4s3I',tag.encode(),sums[tag],offset,len(data)))
        body+=padded(data);offset+=len(padded(data))
    sfnt=header+b''.join(directory)+body
    adjustment=(0xb1b0afba-checksum(sfnt))&0xffffffff
    tables['head']=tables['head'][:8]+pack('I',adjustment)+tables['head'][12:]
    head_offset=12+16*count+sum(len(padded(tables[tag])) for tag in tags if tag<'head')
    sfnt=sfnt[:head_offset+8]+pack('I',adjustment)+sfnt[head_offset+12:]
    assert checksum(sfnt)==0xb1b0afba
    # WOFF directory checksums are the sfnt directory values; head's checksum
    # is computed with checksumAdjustment zero, while its data retains it.
    directory=[];body=b'';offset=44+20*count
    for tag in tags:
        raw=tables[tag];compressed=zlib.compress(raw,9)
        data=compressed if len(compressed)<len(raw) else raw
        directory.append(pack('4s4I',tag.encode(),offset,len(data),len(raw),sums[tag]))
        body+=padded(data);offset+=len(padded(data))
    woff=pack('4sIIHHIHH5I',b'wOFF',0x10000,offset,count,0,len(sfnt),1,0,0,0,0,0,0)+b''.join(directory)+body
    assert len(woff)==offset
    manifest={'schema':1,'family':FAMILY,'style':'Regular','weight':400,'sourceFace':'NEW8P.FNT',
              'source':'dist/painted-font-data.mjs','sourceSHA256':source_hash,'nativeFontSHA256':face['sourceSHA256'],
              'sha256':hashlib.sha256(woff).hexdigest(),'bytes':len(woff),'glyphs':n,'codepoints':[ord(c) for c in characters],
              'unitsPerEm':EM,'sourcePixelUnits':SCALE,'capHeight':700,'ascender':ascender,'descender':descender,'lineGap':line_gap,
              'sfntBytes':len(sfnt),'sfntSHA256':hashlib.sha256(sfnt).hexdigest(),
              'tables':{tag:{'bytes':len(tables[tag]),'checksum':sums[tag]} for tag in tags},
              'externalDependencies':[],'build':'python3 tools/build-painted-webfont.py'}
    return woff,json.dumps(manifest,ensure_ascii=False,indent=2)+'\n'


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    woff,manifest=build()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes()!=woff or not MANIFEST.is_file() or MANIFEST.read_text()!=manifest:
            raise SystemExit('Arrakis Console webfont is not reproducible')
    else:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_bytes(woff);MANIFEST.write_text(manifest)
    print(json.dumps({'output':str(OUTPUT),'bytes':len(woff),'family':FAMILY,'verified':args.check}))


if __name__=='__main__':
    main()
