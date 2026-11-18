"""Reproducible browser build of the recovered native C engine; no DOS execution."""
from pathlib import Path
import argparse, hashlib, json, os, re, shutil, subprocess, sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'native/opendune'
BROWSER=ROOT/'native/browser'
OUT=ROOT/'dist/native'
DATA=ROOT/'native/data'
INPUT=Path(os.environ.get('DUNE2_DATA_DIR',str(DATA)))

def replace_once(path, old, new, marker):
    text=path.read_text()
    if marker in text:return
    if old not in text:raise RuntimeError(f'Unsupported source layout: {path} {old[:60]}')
    path.write_text(text.replace(old,new,1))

def platform_patches():
    path=SOURCE/'src/timer.c'
    replace_once(path,'#include <stdlib.h>', '#include <stdlib.h>\n#ifdef __EMSCRIPTEN__\n#include <emscripten.h>\n#endif', '#include <emscripten.h>')
    replace_once(path,'#if defined(TOS) || defined(DOS)\nvoid SleepAndProcessBackgroundTasks(void)', '''#if defined(__EMSCRIPTEN__)
/* Cooperative browser yield. Callback intervals remain the original 120/60 Hz. */
void SleepAndProcessBackgroundTasks(void)
{
    emscripten_sleep(4);
    Timer_InterruptRun(0);
}
#elif defined(TOS) || defined(DOS)
void SleepAndProcessBackgroundTasks(void)''', 'Cooperative browser yield')
    replace_once(path,'uint32 Timer_GetTime(void)\n{', '#ifdef __EMSCRIPTEN__\nEM_JS(double, browser_game_clock, (), { return Module["duneClock"] ? Module["duneClock"]() : performance.now(); });\n#endif\nuint32 Timer_GetTime(void)\n{', 'browser_game_clock')
    replace_once(path,'#if defined(_MSC_VER)\n\tDWORD t;', '#if defined(__EMSCRIPTEN__)\n\treturn (uint32)browser_game_clock();\n#elif defined(_MSC_VER)\n\tDWORD t;', '(uint32)browser_game_clock()')
    text=path.read_text().replace('#if !defined(TOS) && !defined(DOS) && !defined(__HAIKU__)', '#if !defined(TOS) && !defined(DOS) && !defined(__HAIKU__) && !defined(__EMSCRIPTEN__)')
    text=text.replace('#elif defined(DOS) || defined(__HAIKU__)', '#elif defined(DOS) || defined(__HAIKU__) || defined(__EMSCRIPTEN__)')
    text=re.sub(r'( && !defined\(__EMSCRIPTEN__\))+', ' && !defined(__EMSCRIPTEN__)', text)
    text=re.sub(r'( \|\| defined\(__EMSCRIPTEN__\))+', ' || defined(__EMSCRIPTEN__)', text)
    path.write_text(text)
    strings=SOURCE/'src/os/strings.h'
    strings.write_text(strings.read_text().replace('&& !defined(__HAIKU__)\n', '&& !defined(__HAIKU__) && !defined(__EMSCRIPTEN__)\n'))
    video=SOURCE/'src/video/video_sdl2.c'
    replace_once(video,'\terr = SDL_Init(SDL_INIT_VIDEO);', '#ifdef __EMSCRIPTEN__\n\tSDL_SetHint(SDL_HINT_EMSCRIPTEN_KEYBOARD_ELEMENT, "#canvas");\n#endif\n\terr = SDL_Init(SDL_INIT_VIDEO);', 'SDL_HINT_EMSCRIPTEN_KEYBOARD_ELEMENT')
    replace_once(video,'\tif (!GFX_Screen_IsDirty(SCREEN_0) && !s_screen_needrepaint) return;', '\tif (!GFX_Screen_IsDirty(SCREEN_0) && !s_screen_needrepaint) return;\n#ifdef __EMSCRIPTEN__\n\t/* Browser WebGL backbuffers and locked textures do not retain dirty regions. */\n\ts_screen_needrepaint = true;\n#endif', 'Browser WebGL backbuffers')
    game=SOURCE/'src/opendune.c'
    replace_once(game,'#include "opendune.h"', '#include "opendune.h"\n#ifdef __EMSCRIPTEN__\n#include "browser_control.h"\n#endif', '#include "browser_control.h"')
    replace_once(game,'\t\t\tGameLoop_GameIntroAnimation();', '#ifdef __EMSCRIPTEN__\n\t\t\tif (!browser_skip_intro()) GameLoop_GameIntroAnimation();\n#else\n\t\t\tGameLoop_GameIntroAnimation();\n#endif', 'if (!browser_skip_intro())')
    rev=SOURCE/'src/rev.c'
    if not rev.exists():
        rev.write_text((SOURCE/'src/rev.c.in').read_text().replace('!!VERSION!!','v1.07-browser').replace('!!MODIFIED!!','2'))

def source_files():
    flags={'SDL':False,'SDL2':True}
    active=True;stack=[];files=[]
    for line in (SOURCE/'source.list').read_text().splitlines():
        line=line.strip()
        if line.startswith('#if '):
            cond=flags.get(line.split()[1],False);stack.append((active,cond));active=active and cond
        elif line=='#else':
            parent,cond=stack[-1];active=parent and not cond
        elif line=='#endif':active=stack.pop()[0]
        elif active and line.endswith('.c'):
            if line=='audio/midi_none.c':files.append(BROWSER/'midi_browser.c')
            else:files.append(SOURCE/'src'/line)
    files.extend([BROWSER/'probes.c',BROWSER/'music_bridge.c',BROWSER/'hd_bridge.c'])
    return files

def prepare_data(input_dir):
    DATA.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    for p in sorted(input_dir.iterdir()):
        if p.suffix.upper() in ('.PAK','.CFG') or p.name=='ONETIME.DAT':shutil.copyfile(p,DATA/p.name)
    # Browser personal files are a separate IDBFS mount; originals stay immutable.
    (DATA/'opendune.ini').write_text('''[opendune]
dune2_enhanced=0
datadir=/data
savedir=/save
scalefactor=1
scalefilter=nearest
framerate=60
mt32midi=0
language=english
''')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--emcc',default=os.environ.get('EMCC','emcc'));parser.add_argument('--data-dir',type=Path,default=INPUT);parser.add_argument('--debug',action='store_true');args=parser.parse_args()
    if not (args.data_dir/'DUNE.PAK').is_file():parser.error('Supply original game files with --data-dir /path/to/game or DUNE2_DATA_DIR')
    platform_patches();prepare_data(args.data_dir)
    patches=[ROOT/'fidelity/combat/patch-native.py',ROOT/'fidelity/terrain/patch-native.py',ROOT/'fidelity/cutscenes/patch-native.py']
    for patch in patches:
        if patch.exists():subprocess.run([sys.executable,str(patch),str(SOURCE)],check=True)
    dsppatch=ROOT/'tools/patch-native-dsp.py'
    if dsppatch.exists():subprocess.run([sys.executable,str(dsppatch),str(SOURCE),'--write','--report',str(ROOT/'fidelity/cutscenes/applied-dsp-patch.json')],check=True)
    cutpatch=ROOT/'tools/patch-native-cutscenes.py'
    if cutpatch.exists():subprocess.run([sys.executable,str(cutpatch),str(SOURCE),'--write','--report',str(ROOT/'fidelity/cutscenes/applied-patch.json')],check=True)
    subprocess.run([sys.executable,str(ROOT/'tools/patch-native-browser-audio.py'),str(SOURCE)],check=True)
    for patch in ['patch-native-ini.py','patch-native-wsa.py','patch-native-hd.py']:
        subprocess.run([sys.executable,str(ROOT/'tools'/patch),str(SOURCE),'--write'],check=True)
    subprocess.run([sys.executable,str(ROOT/'tools/stamp-native-changes.py'),'--write','--report',str(ROOT/'fidelity/source-change-notices.json')],check=True)
    files=source_files()
    cmd=[args.emcc,*map(str,files),'-I'+str(SOURCE/'include'),'-iquote'+str(SOURCE/'src'),'-iquote'+str(BROWSER),'-DWITH_SDL2','-DWITHOUT_SDLIMAGE','-DDUNE_DATA_DIR="/data"','-Wno-error=implicit-function-declaration','-Wno-error=incompatible-pointer-types','-Wno-error=int-conversion','-O1','-sUSE_SDL=2','-sASYNCIFY=1','-sASYNCIFY_STACK_SIZE=1048576','-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=67108864','-sSTACK_SIZE=2097152','-sMODULARIZE=1','-sEXPORT_ES6=1','-sEXPORT_NAME=createDuneNative','-sINVOKE_RUN=0','-sEXIT_RUNTIME=0','-sENVIRONMENT=web,node','-sEXPORTED_FUNCTIONS=["_main","_dune_status","_dune_audio_visibility"]','-sEXPORTED_RUNTIME_METHODS=["callMain","FS","ccall","UTF8ToString","IDBFS"]','-lidbfs.js','--preload-file',str(DATA)+'@/data','-o',str(OUT/'dune-native.mjs')]
    if args.debug:cmd+=['-sASSERTIONS=2','-g2']
    subprocess.run(cmd,check=True,cwd=SOURCE)
    digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    manifest={'upstream':json.loads((ROOT/'native/upstream.json').read_text()),'compiler':subprocess.check_output([args.emcc,'--version'],text=True).splitlines()[0],'command':[str(x).replace(str(ROOT),'$PROJECT').replace(str(Path(args.emcc).parent),'$EMSCRIPTEN') for x in cmd],'sources':{str(p.relative_to(ROOT)):digest(p) for p in files},'outputs':{p.name:digest(p) for p in OUT.glob('dune-native.*')},'original_data':{p.name:digest(p) for p in args.data_dir.iterdir() if p.is_file()},'executed_dos_binary':False}
    (ROOT/'fidelity/native-build.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'source_files':len(files),'outputs':list(manifest['outputs'])}))

if __name__=='__main__':main()
