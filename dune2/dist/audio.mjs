export class AudioController {
  constructor(content,preferences){this.content=content;this.preferences=preferences;this.ctx=null;this.cache=new Map();this.lastVoice=0;this.lastShot=0;this.playing=new Set();}
  activate(){try{this.ctx??=new (window.AudioContext??window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume();}catch{}}
  tone(freq=380,duration=.05,volume=.07,type='square'){
    if(!this.preferences.sound||!this.ctx)return;
    const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(volume*this.preferences.volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+duration);
  }
  async sample(key,house=1){
    if(!this.preferences.sound||!this.ctx)return false;
    const prefix=house===0?'H':house===2?'O':'A';
    const logical={acknowledge:'AFFIRM.VOC',welcome:`${prefix}NEXT.VOC`,construction:`${prefix}CONST.VOC`,warning:`${prefix}WARNING.VOC`,explosion:'EXSMALL.VOC',victory:`${prefix}WIN.VOC`,defeat:`${prefix}LOSE.VOC`,attack:'GUN.VOC',move:'MOVEOUT.VOC',harvest:`${prefix}HARVEST.VOC`};
    const audio=this.content.audio??this.content.graphics?.audio??{},entry=audio[logical[key]??key],url=entry?.src??entry?.[house]??entry?.file??entry;
    if(typeof url!=='string')return false;
    try{let buffer=this.cache.get(url);if(!buffer){const response=await fetch(url);if(!response.ok)return false;buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.cache.set(url,buffer);}if(this.playing.size>=8)return false;const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;gain.gain.value=this.preferences.volume;source.connect(gain);gain.connect(this.ctx.destination);this.playing.add(source);source.onended=()=>this.playing.delete(source);source.start();return true;}catch{return false;}
  }
  click(){this.tone(720,.025,.055);}
  acknowledge(house=1){const now=performance.now();if(now-this.lastVoice<900)return;this.lastVoice=now;this.sample('acknowledge',house).then(ok=>{if(!ok){this.tone(430,.06,.055);setTimeout(()=>this.tone(650,.04,.035),70);}});}
  event(event,house=1){if(event.house!==undefined&&event.house!==house&&event.type!=='explosion')return;if(/destroy|explos/i.test(event.type)){this.sample('explosion',house).then(ok=>{if(!ok)this.tone(65,.18,.09,'sawtooth');});}else if(/complete|built|ready/i.test(event.type)){this.sample('construction',house).then(ok=>{if(!ok){this.tone(580,.09,.06);setTimeout(()=>this.tone(780,.13,.05),100);}});}else if(/attack|warning/i.test(event.type))this.sample('warning',house);else if(event.type==='fire'&&performance.now()-this.lastShot>90){this.lastShot=performance.now();this.sample('attack',house);}}
}
