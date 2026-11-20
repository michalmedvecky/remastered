#!/usr/bin/env python3
"""Measure fixed Czech HUD captions from native tables and emitted FNT bytes.

This static audit reads original C data declarations, flags and font tables; it
does not run or reproduce the browser painter or the native gameplay engine.
"""
from pathlib import Path
import base64, hashlib, json, re, struct

ROOT=Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:(ROOT/p).read_text()
native='native/opendune/src/'
symbols={name:int(value)for name,value in re.findall(r'\b(STR_\w+)\s*=\s*(\d+)',read(native+'table/strings.h'))}
corpus=json.loads(read('art/localization/en.json'))
records={r['nativeStringId']:r for r in corpus['records']if r.get('nativeStringId')is not None}
translations=json.loads(read('art/localization/cs-core.json'))['translations']
locale=json.loads(read('dist/locales/cs.json'))

font_bytes=(ROOT/'dist/locales/cs/NEW6P.FNT').read_bytes()
start,data,widths,end,lines=(struct.unpack_from('<H',font_bytes,p)[0]for p in [4,6,8,10,12])
count=end-widths;height=font_bytes[start+4]
assert count==254 and height==8
def footprint(value,offset,centre=None,x=None,y=0):
    codes=value.encode('cp1250');advance=sum(font_bytes[widths+c]+offset for c in codes)
    x=x if x is not None else int(centre)-advance//2
    first=x;ink=[];boxes=[]
    for code in codes:
        width=font_bytes[widths+code];top,used=font_bytes[lines+code*2:lines+code*2+2]
        pointer=struct.unpack_from('<H',font_bytes,data+code*2)[0]
        boxes.append([x,y,width,height])
        if pointer:
            for yy in range(used):
                for xx in range(width):
                    v=font_bytes[pointer+yy*((width+1)//2)+xx//2]>>(4*(xx&1))&15
                    if v==1:ink.append([x+xx,y+top+yy])
        x+=width+offset
    bounds=[min(p[0]for p in ink),min(p[1]for p in ink),max(p[0]for p in ink)+1,max(p[1]for p in ink)+1]if ink else None
    return dict(advance=advance,origin=[first,y],foregroundBounds=bounds,glyphBoxes=boxes)

gui=read(native+'gui/gui.c');widget_draw=read(native+'gui/widget_draw.c')
def settings(flags):
    face={1:'NEW6P.FNT',2:'NEW8P.FNT'}[flags&15]
    label=f'case 0x{flags&240:04X}:'
    style=gui[gui.index(label):];offset=int(re.search(r'g_fontCharOffset\s*=\s*(-?\d+)',style)[1])
    assert face=='NEW6P.FNT'
    return dict(flags=f'0x{flags:X}',font=face,charOffset=offset)
heading_call=re.search(r'GUI_DrawText_Wrapper\(String_Get_ByIndex\(stringID\),\s*(\d+),\s*(\d+),\s*29,\s*0,\s*(0x[0-9A-Fa-f]+)\)',widget_draw)
damage_call=re.search(r'GUI_DrawText_Wrapper\(String_Get_ByIndex\(STR_DMG\),\s*(\d+),\s*(\d+),\s*29,\s*0,\s*(0x[0-9A-Fa-f]+)\)',widget_draw)
assert heading_call and damage_call
heading_settings=settings(int(heading_call[3],16));damage_settings=settings(int(damage_call[3],16))
drawer=widget_draw[widget_draw.index('void GUI_Widget_TextButton2_Draw('):];drawer=drawer[:drawer.index('\n}\n')+2]
action_flags=int(re.search(r'\n\s*(0x[0-9A-Fa-f]+)\s*\n\s*\);',drawer)[1],16)
action_settings=settings(action_flags)
widget_rows=[]
for match in re.finditer(r'/\*\s*clickProc\s*\*/\s*&GUI_Widget_TextButton_Click,[\s\S]*?/\*\s*offsetX\s*\*/\s*(\d+),\s*/\*\s*offsetY\s*\*/\s*(\d+),\s*/\*\s*width\s*\*/\s*(\d+),\s*/\*\s*height\s*\*/\s*(\d+),',read(native+'table/widgetinfo.c')):
    widget_rows.append([int(v)for v in match.groups()])
assert len(widget_rows)==4 and all(r[2]==60 for r in widget_rows)
headers=[]
pattern=r'/\*\s*stringID_abbrev\s*\*/\s*(STR_\w+),\s*/\*\s*name\s*\*/\s*"([^"]+)",\s*/\*\s*stringID_full\s*\*/\s*(STR_\w+)'
for table,kind,expected in [('unitinfo.c','unit',27),('structureinfo.c','structure',19)]:
    rows=re.findall(pattern,read(native+'table/'+table));assert len(rows)==expected
    for index,(symbol,name,full_symbol)in enumerate(rows):
        identifier=symbols[symbol];row=dict(kind=kind,index=index,internalName=name,symbol=symbol,nativeStringId=identifier,fullSymbol=full_symbol,fullNativeStringId=symbols[full_symbol])
        if identifier:
            source=records[identifier];value=translations.get(source['id'],source['text']);row.update(recordId=source['id'],original=source['text'],czech=value,footprint=footprint(value,heading_settings['charOffset'],centre=int(heading_call[1]),y=int(heading_call[2])),nativeBudget=60)
        else:row['displayed']=False
        headers.append(row)
actions=[]
action_rows=re.findall(r'/\*\s*stringID\s*\*/\s*(STR_\w+),\s*/\*\s*name\s*\*/\s*"([^"]+)"',read(native+'table/actioninfo.c'))
assert len(action_rows)==14
for index,(symbol,name)in enumerate(action_rows):
    identifier=symbols[symbol];source=records[identifier];value=translations.get(source['id'],source['text']);x,y,w,h=widget_rows[0]
    actions.append(dict(index=index,internalName=name,symbol=symbol,nativeStringId=identifier,recordId=source['id'],original=source['text'],czech=value,footprint=footprint(value,action_settings['charOffset'],centre=x+w//2,y=y+1),nativeBudget=w))
damage_source=records[symbols['STR_DMG']];damage_value=translations[damage_source['id']]
damage=dict(nativeStringId=symbols['STR_DMG'],recordId=damage_source['id'],original=damage_source['text'],czech=damage_value,sourceSettings=damage_settings,originalFootprint=footprint(damage_source['text'],damage_settings['charOffset'],x=int(damage_call[1]),y=int(damage_call[2])),translatedFootprint=footprint(damage_value,damage_settings['charOffset'],x=int(damage_call[1]),y=int(damage_call[2])))
failures=[]
for row in headers+actions:
    if 'footprint'not in row:continue
    fp=row['footprint']
    if fp['advance']>row['nativeBudget']or any(x<256 or x+w>320 for x,y,w,h in fp['glyphBoxes']):failures.append(dict(symbol=row['symbol'],text=row['czech'],advance=fp['advance'],budget=row['nativeBudget']))
assert damage_value=='ŠKD' and damage['translatedFootprint']['advance']<=damage['originalFootprint']['advance']
inputs=['tools/audit-localization-hud.py','art/localization/en.json','art/localization/cs-core.json','dist/locales/cs.json','dist/locales/cs/NEW6P.FNT']+[native+p for p in ['table/strings.h','table/unitinfo.c','table/structureinfo.c','table/actioninfo.c','table/widgetinfo.c','gui/gui.c','gui/widget_draw.c']]
report=dict(schema=1,pass_=not failures,sourceSHA256={p:sha(ROOT/p)for p in inputs},font=dict(resource='NEW6P.FNT',count=count,height=height),headerSettings=heading_settings,actionSettings=action_settings,actionWidgetRects=widget_rows,damage=damage,headers=headers,actions=actions,coverage=dict(unitRows=27,structureRows=19,actionRows=14,displayedHeadingRows=sum('footprint'in r for r in headers)),failures=failures,runtimeStringBytes=locale['coverage']['runtimeStringBytes'],translationRecords=locale['coverage']['translations'],limitations=['Static font/table footprints, not an execution of the original DOS binary.','Only narrow HUD abbreviation/action roles are shortened; full names, help and campaign prose are retained.'])
destination=ROOT/'fidelity/presentation-fixes/czech-hud-footprint-audit.json';destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(output=str(destination.relative_to(ROOT)),pass_=not failures,coverage=report['coverage'],failures=failures,runtimeStringBytes=report['runtimeStringBytes']),ensure_ascii=False))
if failures:raise SystemExit(1)
