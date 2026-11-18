#!/usr/bin/env python3
"""Build original-mask constrained 4x HD Dune II assets from retained PAK data.

The source image is generated separately with imagegen. This deterministic
packager decodes original resource geometry/palettes, resolves 4x contours and
maps the generated high-resolution materials inside those exact frame bounds.
No DOS code is executed, original files are not changed, and no SDK is needed.
"""
from __future__ import annotations
import argparse,base64,hashlib,json,math,re,struct,zlib
from pathlib import Path
from preload_data import read_pak,verify_preload

ROOT=Path(__file__).resolve().parents[1]
SCALE=4
MATERIALS=['sand','dune','basalt','spice','dense-spice','concrete','steel','gunmetal','aluminum','red-paint','brass','rubber','glass','blue-emission','fire','green-gas']
SHA=lambda body:hashlib.sha256(body).hexdigest()
B64=lambda body:base64.b64encode(body).decode('ascii')


def read_png(path):
    raw=path.read_bytes();assert raw[:8]==b'\x89PNG\r\n\x1a\n'
    pos=8;compressed=bytearray();palette=None;transparency=b''
    while pos<len(raw):
        size=struct.unpack_from('>I',raw,pos)[0];tag=raw[pos+4:pos+8];body=raw[pos+8:pos+8+size]
        assert zlib.crc32(tag+body)&0xffffffff==struct.unpack_from('>I',raw,pos+8+size)[0]
        if tag==b'IHDR':w,h,depth,colour,compression,filtering,interlace=struct.unpack('>IIBBBBB',body)
        elif tag==b'IDAT':compressed.extend(body)
        elif tag==b'PLTE':palette=body
        elif tag==b'tRNS':transparency=body
        pos+=12+size
    assert depth==8 and interlace==0 and compression==0 and filtering==0,(path,depth,interlace)
    channels={0:1,2:3,3:1,4:2,6:4}[colour];stride=w*channels;data=zlib.decompress(compressed)
    assert len(data)==h*(stride+1)
    prior=bytearray(stride);out=bytearray(w*h*4);at=0;dest=0
    def paeth(a,b,c):
        p=a+b-c;pa,pb,pc=abs(p-a),abs(p-b),abs(p-c)
        return a if pa<=pb and pa<=pc else b if pb<=pc else c
    for y in range(h):
        filt=data[at];at+=1;row=bytearray(data[at:at+stride]);at+=stride
        if filt==1:
            for x in range(channels,stride):row[x]=(row[x]+row[x-channels])&255
        elif filt==2:
            for x in range(stride):row[x]=(row[x]+prior[x])&255
        elif filt==3:
            for x in range(stride):row[x]=(row[x]+((row[x-channels]if x>=channels else 0)+prior[x])//2)&255
        elif filt==4:
            for x in range(stride):row[x]=(row[x]+paeth(row[x-channels]if x>=channels else 0,prior[x],prior[x-channels]if x>=channels else 0))&255
        else:assert filt==0,filt
        for x in range(w):
            i=x*channels
            if colour==6:out[dest:dest+4]=row[i:i+4]
            elif colour==2:out[dest:dest+3]=row[i:i+3];out[dest+3]=255
            elif colour==3:
                value=row[i];out[dest:dest+3]=palette[value*3:value*3+3];out[dest+3]=transparency[value]if value<len(transparency)else 255
            else:out[dest:dest+3]=bytes([row[i]])*3;out[dest+3]=row[i+1]if colour==4 else 255
            dest+=4
        prior=row
    return w,h,bytes(out)


def write_png(path,w,h,rgba):
    assert len(rgba)==w*h*4
    def chunk(tag,body):return struct.pack('>I',len(body))+tag+body+struct.pack('>I',zlib.crc32(tag+body)&0xffffffff)
    raw=b''.join(b'\0'+rgba[y*w*4:(y+1)*w*4]for y in range(h))
    body=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
    path.write_bytes(body);return SHA(body)


def scale2x(values,w,h):
    """Contour-aware nearest-neighbour rule; source tokens include opacity."""
    result=[0]*(w*h*4);ow=w*2
    for y in range(h):
        for x in range(w):
            e=values[y*w+x];b=values[(y-1 if y else y)*w+x];d=values[y*w+(x-1 if x else x)];f=values[y*w+(x+1 if x+1<w else x)];hh=values[(y+1 if y+1<h else y)*w+x]
            i=y*2*ow+x*2
            if b!=hh and d!=f:result[i]=d if d==b else e;result[i+1]=f if b==f else e;result[i+ow]=d if d==hh else e;result[i+ow+1]=f if hh==f else e
            else:result[i]=result[i+1]=result[i+ow]=result[i+ow+1]=e
    return result,w*2,h*2


def scale4x(values,w,h):
    values,w,h=scale2x(values,w,h)
    return scale2x(values,w,h)


def format80(data,expected):
    result=bytearray();at=0
    while at<len(data):
        command=data[at];at+=1
        if command==0x80:break
        if command==0xfe:
            count=struct.unpack_from('<H',data,at)[0];at+=2;value=data[at];at+=1;result.extend(bytes([value])*count)
        elif command==0xff:
            count,source=struct.unpack_from('<HH',data,at);at+=4
            for _ in range(count):result.append(result[source]);source+=1
        elif not command&0x80:
            count=(command>>4)+3;distance=((command&15)<<8)|data[at];at+=1;assert distance>0
            for _ in range(count):result.append(result[-distance])
        elif command&0x40:
            count=(command&63)+3;source=struct.unpack_from('<H',data,at)[0];at+=2
            for _ in range(count):result.append(result[source]);source+=1
        else:
            count=command&63;result.extend(data[at:at+count]);at+=count
        assert len(result)<=expected
    assert len(result)==expected,(len(result),expected)
    return bytes(result)


def shapes(raw):
    count=struct.unpack_from('<H',raw)[0]
    offsets=[v+2 for v in struct.unpack_from('<'+'I'*(count+1),raw,2)]
    if offsets[0]!=6+count*4 or offsets[-1]!=len(raw):offsets=list(struct.unpack_from('<'+'H'*(count+1),raw,2))
    assert offsets[-1]==len(raw) and offsets==sorted(offsets)
    frames={}
    for index,(start,end)in enumerate(zip(offsets,offsets[1:])):
        if start==end:continue
        body=raw[start:end];flags,h,w,original_h,stored,expanded=struct.unpack_from('<HBHBHH',body)
        assert stored==len(body)
        palette=list(body[10:26])if flags&1 else None;offset=26 if palette else 10
        stream=body[offset:]if flags&2 else format80(body[offset:],expanded)
        assert len(stream)==expanded
        pixels=bytearray();mask=bytearray();at=0
        while at<len(stream):
            value=stream[at];at+=1
            if value:
                assert not palette or value<16
                pixels.append(value);mask.append(1)
            else:
                transparent_count=stream[at];at+=1;pixels.extend(bytes(transparent_count));mask.extend(bytes(transparent_count))
        assert len(pixels)==w*h
        frames[index]={'width':w,'height':h,'indices':bytes(pixels),'mask':bytes(mask),'palette':palette,'sourceFlags':flags,'sourceSHA256':SHA(body)}
    return count,frames


def icon_frames(raw):
    assert raw[:4]==b'FORM'and raw[8:12]==b'ICON';at=12;chunks={}
    while at+8<=len(raw):
        size=struct.unpack_from('>I',raw,at+4)[0];chunks[raw[at:at+4]]=raw[at+8:at+8+size];at+=8+size+(size&1)
    frames={}
    for index,remap in enumerate(chunks[b'RTBL']):
        palette=list(chunks[b'RPAL'][remap*16:remap*16+16]);stream=chunks[b'SSET'][8+index*128:8+(index+1)*128]
        pixels=bytes(n for byte in stream for n in (byte>>4,byte&15))
        mask=bytes(int(palette[n]!=0 or palette[0]!=0)for n in pixels)
        frames[index]={'width':16,'height':16,'indices':pixels,'mask':mask,'palette':palette,'sourceFlags':None,'sourceSHA256':SHA(stream+bytes(palette))}
    assert len(frames)==389
    return frames


class MaterialBank:
    def __init__(self,path):
        self.width,self.height,self.pixels=read_png(path);self.maps={}
        for index,name in enumerate(MATERIALS):
            left=index%4*self.width//4;top=index//4*self.height//4;right=(index%4+1)*self.width//4;bottom=(index//4+1)*self.height//4
            dx=(right-left)//24;dy=(bottom-top)//24;left+=dx;top+=dy;right-=dx;bottom-=dy
            values=[]
            for y in range(128):
                sy=top+y*(bottom-top-1)//127
                for x in range(128):
                    sx=left+x*(right-left-1)//127;p=(sy*self.width+sx)*4
                    values.append((self.pixels[p]*54+self.pixels[p+1]*183+self.pixels[p+2]*19)/256)
            mean=sum(values)/len(values);self.maps[name]=[max(-.9,min(.9,v/max(mean,1)-1))for v in values]
    def sample(self,name,x,y):return self.maps[name][(y&127)*128+(x&127)]


def tile_material(index):
    if 127<=index<=207:
        if index==127:return 'sand'
        if index<=143:return 'basalt'
        if index<=159:return 'dune'
        if index<=175:return 'basalt'
        if index<=191:return 'spice'
        return 'dense-spice'
    if index in (124,125,126):return 'concrete'
    if 108<=index<=123:return 'fog'
    if index>=210 or 33<=index<=107:return 'steel'
    return 'sand'


def pixel_material(kind,index,global_colour,r,g,b):
    if kind=='tiles':
        material=tile_material(index)
        # Preserve native sand/rock/spice transition ink: a mixed edge tile
        # must not acquire stone/crystal texture in its sand-coloured background.
        if 127<=index<=207:
            if 84<=global_colour<=91 or global_colour==104:
                return 'dune'if 144<=index<=159 else'sand'
            if 216<=global_colour<=218:return 'spice'
            if 219<=global_colour<=220:return 'dense-spice'
        if material!='steel':return material
    if kind=='ui':return 'aluminum'if max(r,g,b)-min(r,g,b)<35 else 'brass'
    if 144<=global_colour<=159:return 'red-paint'
    if kind=='units'and 175<=index<=237:
        return 'green-gas'if g>r*1.15 else 'fire'if r>b*1.4 else 'blue-emission'
    if r>g*1.4 and r>b*1.4:return 'brass'
    if b>r*1.25 and b>g*1.1:return 'glass'
    if max(r,g,b)<65:return 'gunmetal'
    return 'steel'


def build_frame(kind,index,frame,rgb,materials):
    w,h=frame['width'],frame['height'];indices=frame['indices'];mask=frame['mask'];palette=frame['palette']
    tokens=[value|(256 if alpha else 0)for value,alpha in zip(indices,mask)]
    tokens,ow,oh=scale4x(tokens,w,h);render_indices=bytes(v&255 for v in tokens);out=bytearray(ow*oh*4);changed=0
    # Material texture is shared across related animation frames. No random seed,
    # per-frame hallucination, new silhouettes or baked faction colour are used.
    for y in range(oh):
        for x in range(ow):
            at=y*ow+x;token=tokens[at]
            if not token&256:continue
            code=token&255;colour=palette[code]if palette else code;r,g,b=rgb[colour*3:colour*3+3]
            material=pixel_material(kind,index,colour,r,g,b)
            strength=.58 if kind=='tiles'and material in ('sand','dune','basalt','spice','dense-spice')else .40 if kind=='tiles'else .34 if kind=='units'else .08
            if material=='fog':strength=0
            detail=materials.sample(material,x*2,y*2)if strength else 0
            # Fine directional relief within source regions, not a broad blur.
            def luminance(t):
                if not t&256:return 0
                c=palette[t&255]if palette else t&255
                return (rgb[c*3]*54+rgb[c*3+1]*183+rgb[c*3+2]*19)/256
            current=(r*54+g*183+b*19)/256
            left=tokens[at-1]if x else token;up=tokens[at-ow]if y else token
            edge=((current-luminance(left))+(current-luminance(up)))/255*.11
            # Suppress only added microtexture at tile seams, never original ink.
            seam=min(1,min(x,y,ow-1-x,oh-1-y)/2)if kind=='tiles'else 1
            gain=max(.58,min(1.42,1+strength*detail*seam+edge))
            p=at*4;out[p]=max(0,min(255,round(r*gain)));out[p+1]=max(0,min(255,round(g*gain)));out[p+2]=max(0,min(255,round(b*gain)));out[p+3]=255
            changed+=int(out[p]!=r or out[p+1]!=g or out[p+2]!=b)
    return bytes(out),render_indices,dict(sourceOpaquePixels=sum(mask),renderOpaquePixels=sum(bool(t&256)for t in tokens),renderPixels=ow*oh,opaquePixelsWithAddedMaterialDetail=changed,sourceMaskSha256=SHA(mask),renderAlphaSha256=SHA(bytes(1 if t&256 else 0 for t in tokens)))


def pack_positions(frames,max_width=1024,max_height=1024):
    placements={};page=0;x=y=row=0
    for index,frame in frames.items():
        w,h=frame['width'],frame['height']
        if x+w>max_width:x=0;y+=row+1;row=0
        if y+h>max_height:page+=1;x=y=row=0
        placements[index]={'page':page,'x':x,'y':y,'w':w,'h':h};x+=w+1;row=max(row,h)
    return placements


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--materials',type=Path,default=ROOT/'art/hd-v1/materials-source.png');parser.add_argument('--output',type=Path,default=ROOT/'dist/hd');parser.add_argument('--skip-screens',action='store_true');args=parser.parse_args()
    out=args.output;out.mkdir(parents=True,exist_ok=True);material_source=args.materials.read_bytes()
    generation_path=args.materials.parent/'generation.json'
    if generation_path.is_file():
        generation=json.loads(generation_path.read_text())
        if generation.get('sourceImage')==args.materials.name:
            assert generation['sha256']==SHA(material_source),'Generated material source hash mismatch'
            assert generation['materials']==MATERIALS,'Generated material grid mapping mismatch'
    bank=MaterialBank(args.materials)
    content=json.loads((ROOT/'dist/assets/content.json').read_text());inventory=verify_preload();members={};sources={}
    for file in inventory['files']:
        if file['name'].endswith('.PAK'):
            for name,row in read_pak(file['name']).items():members.setdefault(name,row)
    palette=bytes((value*65)>>4 for value in members['IBM.PAL']['bytes']);assert len(palette)==768
    tiles=icon_frames(members['ICON.ICN']['bytes']);units={};ui={}
    specifications=[('MOUSE.SHP',0,7),('BTTN.ENG',7,5),('SHAPES.SHP',12,99),('UNITS2.SHP',111,40),('UNITS1.SHP',151,87),('UNITS.SHP',238,117),('CHOAM.ENG',355,18),('MENTAT.ENG',373,14),('MENSHPH.SHP',387,15),('MENSHPA.SHP',402,15),('MENSHPO.SHP',417,15),('MENSHPM.SHP',432,15),('MENSHPM.SHP',447,15),('MENSHPM.SHP',462,15),('PIECES.SHP',477,28),('ARROWS.SHP',505,9)]+[(f'CREDIT{i}.SHP',513+i,1)for i in range(1,12)]
    for name,base,expected in specifications:
        raw=members[name]['bytes'];count,frames=shapes(raw);assert count==expected,(name,count,expected);sources[name]=SHA(raw)
        for index,frame in frames.items():(units if 111<=base+index<=354 else ui)[base+index]={**frame,'sourceResource':name,'sourceFrame':index}
    assert len(units)==244 and len(ui)==281 and set(units)|set(ui)==set(range(525))
    sources.update({name:members[name]['sha256']for name in ['IBM.PAL','ICON.ICN','ICON.MAP']})
    result={'schema':1,'version':'hd-v1','scale':SCALE,'presentation':{'width':1280,'height':800,'originalWidth':320,'originalHeight':200,'aspectCorrection':'Original320x200gameplay coordinates shown at4:3 viaCSS'},'palette':list(palette),'paletteConversion':'Native (sixBitComponent * 65) >> 4','atlases':{},'frames':{},'screens':{},'uiMaterials':{},'source':{'preloadSha256':inventory['packageSha256'],'materialsSha256':SHA(material_source),'materials':'art/hd-v1/materials-source.png','resources':sources},'semantics':{'indicesBase64':'Native sourcecodes, local16whenpaletteexists, otherwiseglobal256','maskBase64':'Originalalpha1/0, independentofmappedglobalindex0','renderIndicesBase64':'Scale2x_twice nativecodes atfull4xresolution; useforruntimepalette/detailgain','unitHouseRange':[144,152],'tileHouseRangeOriginalMode':[144,159],'opaqueBounds':'ExactlysourceW*4 bysourceH*4, nooutsidepixels','materialDetail':'Generatedhighresolutionmaterialluminancepluscontourrelief; originalsimulationandcoordinatesunchanged','moviePolicy':'No2GiB eagerWSAatlasexpansion; nativeframesusetherendererboundedHQ4xfallback'},'coverage':{}}
    audits=[]
    for kind,frames in [('tiles',tiles),('units',units),('ui',ui)]:
        if kind in ('tiles','units'):
            positions={int(i):{**v,'page':0}for i,v in content['graphics']['frames'][kind].items()}
        else:positions=pack_positions(frames)
        pages={};result['frames'][kind]={}
        for index,frame in frames.items():
            pos=positions[index];page=pos['page'];page_id='ui'+str(page)if kind=='ui'else kind if page==0 else kind+str(page)
            pages.setdefault(page_id,[]).append((index,frame,pos))
        for page_id,rows in pages.items():
            aw=max(pos['x']+pos['w']for _,_,pos in rows)*SCALE;ah=max(pos['y']+pos['h']for _,_,pos in rows)*SCALE;assert max(aw,ah)<=4096,(page_id,aw,ah)
            output=bytearray(aw*ah*4)
            for index,frame,pos in rows:
                pixels,render_indices,audit=build_frame(kind,index,frame,palette,bank);sw,sh=frame['width'],frame['height'];w,h=sw*SCALE,sh*SCALE;x,y=pos['x']*SCALE,pos['y']*SCALE
                for row in range(h):output[((y+row)*aw+x)*4:((y+row)*aw+x+w)*4]=pixels[row*w*4:(row+1)*w*4]
                descriptor={'atlas':page_id,'x':x,'y':y,'w':w,'h':h,'sourceW':sw,'sourceH':sh,'paletteMode':'local16'if frame['palette']else'global256','indicesBase64':B64(frame['indices']),'maskBase64':B64(frame['mask']),'renderIndicesBase64':B64(render_indices),'sourceSHA256':frame['sourceSHA256'],'material':tile_material(index)if kind=='tiles'else'indexed-materials'}
                if frame['palette']:descriptor['palette']=frame['palette']
                if 'sourceResource'in frame:descriptor.update(sourceResource=frame['sourceResource'],sourceFrame=frame['sourceFrame'])
                result['frames'][kind][str(index)]=descriptor;audits.append({'kind':kind,'id':index,**audit})
            digest=write_png(out/(page_id+'.png'),aw,ah,output);filename=page_id+'-'+digest[:16]+'.png';(out/(page_id+'.png')).replace(out/filename)
            result['atlases'][page_id]={'src':'hd/'+filename,'width':aw,'height':ah,'sha256':digest,'rgbaSha256':SHA(output),'bytes':(out/filename).stat().st_size}
            print(page_id,aw,ah,flush=True)
    if not args.skip_screens:
        for name,path in content['graphics']['images'].items():
            w,h,rgba=read_png(ROOT/'dist'/path);values=[int.from_bytes(rgba[i:i+4],'little')for i in range(0,len(rgba),4)];values,ow,oh=scale4x(values,w,h);output=b''.join(v.to_bytes(4,'little')for v in values)
            digest=write_png(out/(name+'.png'),ow,oh,output);filename='screen-'+name+'-'+digest[:16]+'.png';(out/(name+'.png')).replace(out/filename);result['screens'][name]={'src':'hd/'+filename,'width':ow,'height':oh,'sourceW':w,'sourceH':h,'sha256':digest,'rgbaSha256':SHA(output),'bytes':(out/filename).stat().st_size,'method':'Deterministiccontour-aware4x; nohallucinatedtextorUIpositions'}
    result['coverage']={'tileFrames':len(tiles),'unitFrames':len(units),'uiFrames':len(ui),'nativeSHPFrames':len(units)+len(ui),'nativeSHPIdsComplete':True,'tileIdsComplete':set(tiles)==set(range(389)),'staticScreens':len(result['screens']),'wsasStoredAsHD':0,'materials':MATERIALS,'maxAtlasDimension':max(max(a['width'],a['height'])for a in result['atlases'].values()),'worldFramePixels':sum(a['renderPixels']for a in audits if a['kind']in('tiles','units')),'worldOpaquePixelsWithAddedMaterialDetail':sum(a['opaquePixelsWithAddedMaterialDetail']for a in audits if a['kind']in('tiles','units'))}
    for name,index in [('brass',10),('steel',6)]:
        left=index%4*bank.width//4;top=index//4*bank.height//4;right=(index%4+1)*bank.width//4;bottom=(index//4+1)*bank.height//4
        w,h=right-left,bottom-top;output=b''.join(bank.pixels[((top+y)*bank.width+left)*4:((top+y)*bank.width+right)*4]for y in range(h))
        digest=write_png(out/('ui-'+name+'.png'),w,h,output);filename='ui-'+name+'-'+digest[:16]+'.png';(out/('ui-'+name+'.png')).replace(out/filename)
        result['uiMaterials'][name]={'src':'hd/'+filename,'width':w,'height':h,'sha256':digest,'bytes':(out/filename).stat().st_size,'materialCell':index}
    raw=(json.dumps(result,separators=(',',':'))+'\n').encode();temporary=out/'manifest.json.tmp';temporary.write_bytes(raw);temporary.replace(out/'manifest.json')
    # Remove only stale hashed files generated by this builder, never art sources.
    keep={Path(a['src']).name for a in [*result['atlases'].values(),*result['screens'].values(),*result['uiMaterials'].values()]}
    for p in out.glob('*.png'):
        if p.name not in keep and re.fullmatch(r'(?:tiles|units|ui[0-9]*|ui-brass|ui-steel|screen-[A-Za-z]+)-[0-9a-f]{16}\.png',p.name):p.unlink()
    audit={'version':'hd-v1','scale':SCALE,'manifestSha256':SHA(raw),'materialSourceSha256':SHA(material_source),'coverage':result['coverage'],'frames':audits,'claims':'Geometry/index/maskaudit; thisdoesnotclaimoriginalandHDpixelsareidentical'}
    (ROOT/'art/hd-v1/build-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    print(json.dumps({'manifestBytes':len(raw),'coverage':result['coverage'],'atlases':len(result['atlases'])}))


if __name__=='__main__':main()
