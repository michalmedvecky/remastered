import createDuneNative from './native/dune-native.mjs';
import {validateNativeSave,nextSaveName} from './native-saves.mjs';
import {createClock} from './native-clock.mjs';
const gameClock=createClock();
const $=id=>document.getElementById(id);
function focusGame(){$('canvas').focus({preventScroll:true});}
let core,music,started=false,syncing=false,saveTimer,overlayPaused=false;
let painter,graphicsMode='painted';
try{if(localStorage.getItem('dune2-graphics')==='original')graphicsMode='original';}catch{}
$('graphics').value=graphicsMode;document.documentElement.dataset.graphics=graphicsMode;
function updatePause(){const paused=document.hidden||overlayPaused;gameClock.visibility(paused);if(started)core?._dune_audio_visibility(paused?1:0);if(paused)music?.context.suspend().catch(()=>{});else music?.resume();}
function showDialog(id){overlayPaused=true;updatePause();$(id).showModal();}
for(const id of ['help-dialog','save-dialog'])$(id).addEventListener('close',()=>{overlayPaused=false;updatePause();if(started)focusGame();});
const errors=[];
function status(message,error=false){for(const id of ['status','runtime-status']){$(id).textContent=message;$(id).classList.toggle('error-status',error);}}
function report(error){errors.push(String(error));console.error(error);status(String(error),true);}
async function sync(){if(!core||syncing)return;syncing=true;try{await new Promise((resolve,reject)=>core.FS.syncfs(false,e=>e?reject(e):resolve()));}catch(e){report('Save storage: '+e.message);}finally{syncing=false;}}
function files(){return core?core.FS.readdir('/save').filter(x=>x!=='.'&&x!=='..'&&!core.FS.isDir(core.FS.stat('/save/'+x).mode)):[];}
function download(name,bytes){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function prepare(){
  status('Loading the original campaign data…');
  const paintedPromise=import('./painted-renderer.mjs').then(({createPaintedRenderer})=>createPaintedRenderer($('painted-canvas'),{mode:graphicsMode,onError:error=>console.warn('Painted graphics:',error)})).catch(error=>{console.warn('Painted artwork unavailable; using original graphics.',error);return null;});
  core=await createDuneNative({duneClock:gameClock.now,duneHdEnabled:graphicsMode==='painted',duneHdPresent:frame=>painter?.present(frame),canvas:$('canvas'),locateFile:name=>new URL('./native/'+name,import.meta.url).href,print:line=>console.info('[Dune]',line),printErr:line=>console.warn('[Dune]',line),onAbort:message=>report('Engine stopped: '+message),duneMidi:()=>{},duneMusicPlay:(file,index,volume)=>music?.play(file,index,volume),duneAdlibEffect:(file,index,volume)=>music?.effect?.(file,index,volume),duneMusicStop:()=>music?.stop(),duneMusicFade:ms=>music?.fade(ms),duneMusicIsPlaying:()=>music?.isPlaying()??false});
  core.FS.mkdir('/save');
  core.FS.mount(core.IDBFS,{autoPersist:true},'/save');
  try{await new Promise((resolve,reject)=>core.FS.syncfs(true,e=>e?reject(e):resolve()));}catch(e){report('Persistent saves are unavailable in this browser. Export your saves before leaving.');}
  core.FS.chdir('/data');
  // The native writer opens uppercase first; avoid duplicate case variants.
  for(const name of files())if(/^_save\d{3}\.dat$/i.test(name)&&name!==name.toUpperCase()&&!files().includes(name.toUpperCase()))core.FS.rename('/save/'+name,'/save/'+name.toUpperCase());
  for(const name of ['DUNE.CFG','OPTIONS.CFG'])if(!files().some(file=>file.toUpperCase()===name))core.FS.writeFile('/save/'+name,core.FS.readFile('/data/'+name));
  painter=await paintedPromise;
  if(!painter){graphicsMode='original';$('graphics').value=graphicsMode;document.documentElement.dataset.graphics=graphicsMode;core.duneHdEnabled=false;}
  painter?.setMode(graphicsMode);core.duneHdEnabled=graphicsMode==='painted';
  $('launch').disabled=false;$('saves').disabled=false;status('Campaign data ready.');
}
async function launch(){
  if(started)return;started=true;$('launch').disabled=true;
  try{
    try{const {createMusic}=await import('./music/player.mjs');music=await createMusic({onError:report});await music.resume();music.setVolume(Number($('volume').value));}catch(e){console.warn('Music unavailable',e);}
    if(!$('play-intro').checked)core.FS.writeFile('/save/ONETIME.DAT',new Uint8Array());
    core.duneSkipIntro = !$('play-intro').checked;
    $('arrival').hidden=true;$('game-frame').hidden=false;document.body.classList.add('game-active');focusGame();
    status('Arrakis command link active.');
    core.callMain([]);
    document.title='Dune II — The Battle for Arrakis';
    saveTimer=setInterval(()=>{sync();$('canvas').dataset.engineState=JSON.stringify(globalThis.duneDiagnostics());},2500);
  }catch(e){report(e.message);}
}
$('launch').addEventListener('click',launch);
$('volume').addEventListener('input',e=>music?.setVolume(Number(e.target.value)));
$('graphics').addEventListener('change',e=>{graphicsMode=e.target.value;document.documentElement.dataset.graphics=graphicsMode;painter?.setMode(graphicsMode);if(core)core.duneHdEnabled=graphicsMode==='painted';try{localStorage.setItem('dune2-graphics',graphicsMode);}catch{}if(started)focusGame();});
$('canvas').addEventListener('contextmenu',e=>e.preventDefault());
$('fullscreen').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():$('game-frame').requestFullscreen());
$('help').addEventListener('click',()=>showDialog('help-dialog'));
$('close-help').addEventListener('click',()=>{$('help-dialog').close();if(started)focusGame();});
$('saves').addEventListener('click',async()=>{await sync();$('save-list').replaceChildren();for(const name of files().filter(n=>/\.DAT$/i.test(n)&&n.toUpperCase()!=='ONETIME.DAT')){const b=document.createElement('button');b.textContent='↓ '+name;b.onclick=()=>download(name,core.FS.readFile('/save/'+name));$('save-list').append(b);}if(!$('save-list').children.length)$('save-list').textContent='No saved missions yet. Use the in-game Options menu to save.';showDialog('save-dialog');});
$('close-saves').addEventListener('click',()=>{$('save-dialog').close();if(started)focusGame();});
$('import-save').addEventListener('change',async e=>{const imported=[];for(const file of e.target.files){try{const bytes=new Uint8Array(await file.arrayBuffer());validateNativeSave(file.name,bytes);const name=nextSaveName(files());core.FS.writeFile('/save/'+name,bytes);imported.push(name);}catch(error){report(error.message);}}await sync();$('save-dialog').close();e.target.value='';if(started)focusGame();if(imported.length)status('Imported '+imported.join(', ')+'. Open Load Game in the original menu.');});
addEventListener('pagehide',()=>{sync();music?.stop();});
document.addEventListener('visibilitychange',updatePause);
// Read-only diagnostics for QA; game input continues through the original SDL path.
globalThis.duneDiagnostics=()=>({started,hidden:document.hidden,overlayPaused,clock:gameClock.now(),status:core?Array.from({length:8},(_,i)=>core._dune_status(i)):null,files:files(),errors:[...errors],music:music?.diagnostics?.()??null,graphics:painter?.diagnostics()??{mode:'original',ready:false}});
prepare().catch(report);
