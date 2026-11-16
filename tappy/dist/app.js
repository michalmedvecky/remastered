import { TappyEngine } from './tappy-engine.js';
import { renderGame, VIEW_WIDTH, VIEW_HEIGHT } from './art.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const context = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = VIEW_WIDTH * DPR;
canvas.height = VIEW_HEIGHT * DPR;
context.setTransform(DPR, 0, 0, DPR, 0, 0);

const STORAGE_KEY = 'tappy.progress.v1';
const TAP_INTERVAL = 190;
const FLOW_INTERVAL = 230;
const vectors = {up:{dx:0,dy:-1}, down:{dx:0,dy:1}, left:{dx:-1,dy:0}, right:{dx:1,dy:0}};
const keyDirections = {ArrowUp:'up',KeyW:'up',KeyE:'up',ArrowDown:'down',KeyS:'down',KeyY:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
const held = new Map();
const progress = readProgress();
const completed = new Set(progress.completed);
let mode = progress.mode;
let sound = progress.sound;
let engine, started = false, paused = false, overlayKind = '', audio;
let lastFrame = 0, lastStep = 0, budget = 0, repeatBudget = 0, fireHeld = false;
let particles = [], overlayPrimary = () => {}, overlaySecondary = () => {}, currentTip = '';

function readProgress() {
  const defaults = {stage:1, completed:[], mode:'steps', sound:true};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      stage:Number.isInteger(saved.stage) && saved.stage>=1 && saved.stage<=200 ? saved.stage : 1,
      completed:Array.isArray(saved.completed) ? saved.completed.filter(n=>Number.isInteger(n)&&n>=1&&n<=200) : [],
      mode:saved.mode==='flow'?'flow':'steps',
      sound:typeof saved.sound==='boolean'?saved.sound:true,
    };
  } catch { return defaults; }
}
function saveProgress() {
  if (!engine) return;
  try {localStorage.setItem(STORAGE_KEY, JSON.stringify({stage:engine.stage,completed:[...completed],mode,sound}));} catch {}
}
function say(message) { $('status').textContent = message; }
function setTip(message) {
  currentTip=message;
  $('game-tip').textContent=message;
}
function defaultTip() {
  return mode==='steps' ? 'Po krocích: svět se hýbe jen s tebou. Klidně si to rozmysli.' : 'Plynule: svět se hýbe sám. Tlačítkem pauzy ho kdykoli zastavíš.';
}
function clearHeld() {
  held.clear();fireHeld=false;repeatBudget=0;budget=0;
  document.querySelectorAll('[data-direction]').forEach(button=>button.classList.remove('is-pressed'));
  $('bubble-button').classList.remove('is-pressed');
}
function currentInput() {
  const direction=[...held.values()].at(-1);
  return {...(vectors[direction] || {dx:0,dy:0}),fire:fireHeld};
}
function focusGame() { canvas.focus({preventScroll:true}); }
function sync() {
  if (!engine) return;
  $('level-number').textContent=String(engine.stage);
  $('steps-count').textContent=String(engine.moves);
  $('ammo-count').textContent=String(engine.ammo);
  $('undo-button').disabled=!engine.canUndo;
  $('bubble-button').disabled=engine.ammo===0 || engine.status!=='playing';
  $('bubble-button').setAttribute('aria-label',engine.ammo>0?`Poslat uspávací bublinu. Zbývá ${engine.ammo}.`:'Nejdřív seber modrou bublinku v bludišti.');
  $('mode-toggle').setAttribute('aria-pressed',String(mode==='steps'));
  $('mode-label').textContent=mode==='steps'?'Po krocích':'Plynule';
  $('mode-toggle').title=mode==='steps'?'Přepnout na plynulé hraní':'Přepnout na klidné hraní po krocích';
  $('sound-button').setAttribute('aria-pressed',String(sound));
  $('sound-button').setAttribute('aria-label',sound?'Vypnout zvuk':'Zapnout zvuk');
  $('pause-button').setAttribute('aria-pressed',String(paused));
  $('pause-label').textContent=paused?'Pokračovat':'Pauza';
  $('pause-button').setAttribute('aria-label',paused?'Pokračovat':'Pauza');
  canvas.setAttribute('aria-label',`Tappy, úroveň ${engine.stage}. Vajíčko přesuň do svítícího hnízda. ${engine.moves} kroků, ${engine.ammo} bublinek. Pohyb šipkami, mezerník bublina, Z vrátí krok.`);
}
function tone(frequency,duration=.1,type='sine',volume=.045,end=frequency) {
  if (!sound) return;
  try {
    audio??=new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume();
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,end),audio.currentTime+duration);
    gain.gain.setValueAtTime(volume,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+duration);
  } catch {}
}
function confetti(x,y,color,count=16) {
  if(reducedMotion)return;
  for(let i=0;i<count;i++) particles.push({x:40+(x+1)*24,y:68+(y+1)*24,vx:(Math.random()-.5)*170,vy:-Math.random()*150-35,life:1,color,size:3+Math.random()*4});
}
function overlay(kind,title,text,primaryLabel,primary,secondaryLabel='',secondary=()=>{}) {
  overlayKind=kind;clearHeld();
  $('overlay-title').textContent=title;
  $('overlay-text').textContent=text;
  $('overlay-primary').textContent=primaryLabel;
  $('overlay-secondary').textContent=secondaryLabel;
  $('overlay-secondary').hidden=!secondaryLabel;
  overlayPrimary=primary;overlaySecondary=secondary;
  $('game-overlay').hidden=false;
  $('tappy-app').inert=true;
  queueMicrotask(()=>$('overlay-primary').focus({preventScroll:true}));
  say(title+' '+text);
}
function hideOverlay() {overlayKind='';$('game-overlay').hidden=true;$('tappy-app').inert=false;}
function handleEvents() {
  for(const event of engine.events || []) {
    switch(event.type) {
      case 'pickup':
        tone(660,.16,'sine',.06,1080);confetti(event.x,event.y,'#75c6e4',8);
        setTip('Máš bublinku! Pošli ji na žabku nebo obláček, aby si zdřímly.');
        break;
      case 'shoot':tone(420,.15,'sine',.035,740);break;
      case 'sleep':tone(540,.25,'sine',.035,330);break;
      case 'break':confetti(event.x,event.y,'#d4b586',10);tone(175,.12,'triangle',.025,105);break;
      case 'crush':confetti(event.x,event.y,'#bdb5df',9);tone(260,.08,'sine',.025,390);break;
      case 'bump':
        tone(340,.25,'triangle',.035,190);
        overlay('bump','Hopla, zkusíme to jinak.',
          event.cause==='crush'?'Pozor na padající vajíčko a kameny. Můžeš svůj krok vrátit.':'Cesta se zaplnila. Vrať krok a zkus jiný směr.',
          engine.canUndo?'Vrátit krok':'Zkusit znovu',engine.canUndo?undo:restart,
          engine.canUndo?'Znovu od začátku':'Vybrat úroveň',engine.canUndo?restart:openLevels);
        break;
      case 'win':
        completed.add(engine.stage);saveProgress();renderLevels();
        confetti(engine.goal.x,engine.goal.y-2,'#efbb50',38);
        [523,659,784,1047].forEach((frequency,index)=>setTimeout(()=>tone(frequency,.21,'sine',.06),index*105));
        overlay('win','Vajíčko je doma!',
          engine.stage<200?'Skvěle! Hnízdo je v bezpečí. Vydáme se dál?':'Všech 200 hnízd je v bezpečí. To bylo velké dobrodružství!',
          engine.stage<200?'Další úroveň':'Znovu od jedničky',()=>setStage(engine.stage<200?engine.stage+1:1),
          'Ještě jednou',restart);
        break;
    }
  }
}
function advance(input) {
  if(!engine || engine.status!=='playing' || paused || modalOpen())return;
  started=true;
  engine.step(input);
  lastStep=performance.now();
  handleEvents();sync();
}
function action(input) {
  if(!engine || engine.status!=='playing' || paused || modalOpen())return;
  repeatBudget=0;budget=0;
  advance(input);
}
function undo() {
  if(!engine?.undo())return;
  clearHeld();started=false;paused=false;hideOverlay();lastStep=0;particles=[];
  tone(480,.13,'sine',.035,340);
  setTip('Krok je zpátky. Teď můžeš zkusit jinou cestu.');
  say('Krok vrácen.');sync();focusGame();
}
function setStage(stage) {
  if(!engine)return;
  engine.reset(stage);started=false;paused=false;clearHeld();hideOverlay();particles=[];lastStep=0;
  setTip(defaultTip());sync();saveProgress();renderLevels();
  const url=new URL(location.href);
  if(stage===1)url.searchParams.delete('stage');else url.searchParams.set('stage',String(stage));
  history.replaceState({},'',url);
  say(`Úroveň ${stage} je připravená. Dostaň vajíčko do hnízda.`);
  focusGame();
}
function restart() {if(engine)setStage(engine.stage);}
function togglePause() {
  if(!engine || engine.status!=='playing' || modalOpen())return;
  if(paused){paused=false;hideOverlay();lastFrame=performance.now();budget=0;say('Pokračujeme.');}
  else {paused=true;overlay('pause','Chvilka na rozmyšlenou.','Tappy na tebe počká.','Pokračovat',togglePause,'Vybrat úroveň',openLevels);}
  clearHeld();sync();focusGame();
}
function modalOpen(){return $('help-dialog').open||$('levels-dialog').open;}
function openHelp() {clearHeld();$('help-dialog').showModal();}
function openLevels() {clearHeld();renderLevels();$('levels-dialog').showModal();}
function renderLevels() {
  if(!engine)return;
  const fragment=document.createDocumentFragment();
  for(let number=1;number<=200;number++) {
    const button=document.createElement('button');button.type='button';button.className='level-choice';
    if(completed.has(number))button.classList.add('is-complete');
    if(number===engine.stage)button.setAttribute('aria-current','true');
    button.textContent=String(number);
    button.setAttribute('aria-label',`Úroveň ${number}${completed.has(number)?', hotovo':''}`);
    button.addEventListener('click',()=>{$('levels-dialog').close();setStage(number);});
    fragment.append(button);
  }
  $('levels-grid').replaceChildren(fragment);
}

$('undo-button').addEventListener('click',undo);
$('restart-button').addEventListener('click',restart);
$('help-button').addEventListener('click',openHelp);
$('help-close').addEventListener('click',()=>$('help-dialog').close());
$('levels-button').addEventListener('click',openLevels);
$('levels-close').addEventListener('click',()=>$('levels-dialog').close());
for(const dialog of [$('help-dialog'),$('levels-dialog')])dialog.addEventListener('close',()=>{clearHeld();lastFrame=performance.now();focusGame();});
$('overlay-primary').addEventListener('click',()=>overlayPrimary());
$('overlay-secondary').addEventListener('click',()=>overlaySecondary());
$('pause-button').addEventListener('click',togglePause);
$('mode-toggle').addEventListener('click',()=>{
  mode=mode==='steps'?'flow':'steps';clearHeld();started=false;setTip(defaultTip());sync();saveProgress();
  say(mode==='steps'?'Klidné hraní po krocích.':'Plynulé hraní. Svět se rozběhne prvním pohybem.');focusGame();
});
$('sound-button').addEventListener('click',()=>{sound=!sound;sync();saveProgress();if(sound)tone(660,.12);focusGame();});
$('fullscreen-button').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{setTip('Celá obrazovka tady není dostupná. Hra funguje i tak.');}
});

for(const button of document.querySelectorAll('[data-direction]')) {
  const direction=button.dataset.direction;
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();if(!engine || paused || engine.status!=='playing'||modalOpen())return;
    button.setPointerCapture(event.pointerId);held.set(event.pointerId,direction);button.classList.add('is-pressed');
    action({...vectors[direction],fire:fireHeld});focusGame();
  });
  for(const eventName of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(eventName,event=>{
    held.delete(event.pointerId);button.classList.remove('is-pressed');repeatBudget=0;
  });
}
$('bubble-button').addEventListener('pointerdown',event=>{
  event.preventDefault();if(!engine || engine.ammo===0 || paused || engine.status!=='playing')return;
  $('bubble-button').setPointerCapture(event.pointerId);fireHeld=true;$('bubble-button').classList.add('is-pressed');
  action({...currentInput(),fire:true});focusGame();
});
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])$('bubble-button').addEventListener(eventName,()=>{fireHeld=false;$('bubble-button').classList.remove('is-pressed');});

window.addEventListener('keydown',event=>{
  if(!engine||event.metaKey||event.ctrlKey||event.altKey||modalOpen())return;
  const interactive=['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
  if(interactive)return;
  if(keyDirections[event.code]) {
    event.preventDefault();if(event.repeat)return;
    const direction=keyDirections[event.code];held.set(event.code,direction);action({...vectors[direction],fire:fireHeld});
  } else if(event.code==='Space') {
    event.preventDefault();if(event.repeat)return;fireHeld=true;action({...currentInput(),fire:true});
  } else if(event.code==='KeyZ'||event.code==='Backspace') {event.preventDefault();if(!event.repeat)undo();}
  else if(event.code==='KeyR') {event.preventDefault();if(!event.repeat)restart();}
  else if(event.code==='KeyP'||event.code==='Escape') {event.preventDefault();if(!event.repeat)togglePause();}
  else if(event.code==='Enter'&&overlayKind) {event.preventDefault();overlayPrimary();}
});
window.addEventListener('keyup',event=>{held.delete(event.code);if(event.code==='Space')fireHeld=false;repeatBudget=0;});
let swipe=null;
canvas.addEventListener('pointerdown',event=>{if(event.isPrimary){swipe={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);focusGame();}});
canvas.addEventListener('pointerup',event=>{
  if(!swipe||swipe.id!==event.pointerId)return;
  const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  const direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
  action({...vectors[direction],fire:false});
});
canvas.addEventListener('pointercancel',()=>swipe=null);
function backgroundPause() {
  clearHeld();
  if(mode==='flow'&&started&&!paused&&engine?.status==='playing'){
    paused=true;overlay('pause','Tappy si dal pauzu.','Pokračuj, až budeš připravený.','Pokračovat',togglePause,'Vybrat úroveň',openLevels);sync();
  }
}
window.addEventListener('blur',backgroundPause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();});

function frame(now) {
  const delta=Math.min(now-lastFrame,100);lastFrame=now;
  if(engine) {
    if(!paused&&!modalOpen()&&!overlayKind&&engine.status==='playing') {
      if(mode==='flow'&&started) {
        budget+=delta;
        if(budget>=FLOW_INTERVAL){budget%=FLOW_INTERVAL;advance(currentInput());}
      } else if(mode==='steps'&&(held.size||fireHeld)) {
        repeatBudget+=delta;
        if(repeatBudget>=TAP_INTERVAL){repeatBudget%=TAP_INTERVAL;advance(currentInput());}
      }
    }
    if(!reducedMotion){
      for(const particle of particles){particle.x+=particle.vx*delta/1000;particle.y+=particle.vy*delta/1000;particle.vy+=210*delta/1000;particle.life-=delta/1000;}
      particles=particles.filter(particle=>particle.life>0);
    }
    renderGame(context,engine,{now,blend:reducedMotion||!lastStep?1:Math.min((now-lastStep)/130,1),reducedMotion,particles});
  }
  requestAnimationFrame(frame);
}
async function boot() {
  try{
    const response=await fetch('./levels.json');if(!response.ok)throw new Error('Mapy se nenačetly.');
    const levels=await response.json();
    const param=new URL(location.href).searchParams.get('stage');
    const requested=param===null?progress.stage:Number(param);
    const stage=Number.isInteger(requested)&&requested>=1&&requested<=200?requested:1;
    engine=new TappyEngine(levels,stage);setTip(defaultTip());sync();renderLevels();
    say(`Úroveň ${stage} je připravená.`);
    requestAnimationFrame(frame);
  }catch(error){
    console.error(error);
    overlay('error','Tappy se ještě chystá.','Hru se nepodařilo načíst. Zkus stránku obnovit.','Zkusit znovu',()=>location.reload());
  }
}
boot();
