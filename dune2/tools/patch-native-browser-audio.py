"""Browser-only routing; leaves native music selection, VOC priority and queues intact."""
from pathlib import Path
import sys
root=Path(sys.argv[1])
sound=root/'src/audio/sound.c'
s=sound.read_text()
marker='#ifdef __EMSCRIPTEN__\n#include <emscripten.h>\n#endif\n'
if marker not in s:s=marker+s
if '#include "music_bridge.h"' not in s:s=s.replace('#include "sound.h"','#include "sound.h"\n#ifdef __EMSCRIPTEN__\n#include "music_bridge.h"\n#endif')
old='\tDriver_Music_Play(g_table_musics[musicID].index, 0xFF);'
if 'browser_music_play(' not in s:s=s.replace(old,old+'\n#ifdef __EMSCRIPTEN__\n\tif (g_gameConfig.music != 0) browser_music_play(g_table_musics[musicID].string, g_table_musics[musicID].index, 0xFF);\n\telse browser_music_stop();\n#endif')
s=s.replace('\tbrowser_music_play(g_table_musics[musicID].string, g_table_musics[musicID].index, 0xFF);','\tif (g_gameConfig.music != 0) browser_music_play(g_table_musics[musicID].string, g_table_musics[musicID].index, 0xFF);\n\telse browser_music_stop();')
sound.write_text(s)
driver=root/'src/audio/driver.c';s=driver.read_text()
if marker not in s:s=marker+s
if '#include "music_bridge.h"' not in s:
    pos=s.index('\n',s.index('#include "driver.h"'))
    s=s[:pos]+'\n#ifdef __EMSCRIPTEN__\n#include "music_bridge.h"\n#endif'+s[pos:]
for function,code in [('bool Driver_Music_IsPlaying(void)','return browser_music_playing() != 0;'),('void Driver_Music_Stop(void)','browser_music_stop();'),('void Driver_Music_FadeOut(void)','browser_music_fade(2000);')]:
    old=function+'\n{';new=old+'\n#ifdef __EMSCRIPTEN__\n\t'+code+'\n#endif'
    if new not in s:s=s.replace(old,new,1)
old='\tif (g_gameConfig.sounds == 0 && index > 1) return;'
if 'browser_adlib_effect(' not in s:s=s.replace(old,old+'\n#ifdef __EMSCRIPTEN__\n\tbrowser_adlib_effect(sound->filename, index, volume);\n#endif')
driver.write_text(s)
