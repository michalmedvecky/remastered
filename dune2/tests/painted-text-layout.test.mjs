import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {remapTextRunClips,factoryCaptionRect} from '../dist/painted-text-layout.mjs';
import {fitTextBox} from '../dist/painted-ui-core.mjs';
import {measurePeriodText} from '../dist/painted-typography.mjs';

const inside=(x,y,clips)=>clips.some(([cx,cy,cw,ch])=>x>=cx&&y>=cy&&x<cx+cw&&y<cy+ch);
const near=(a,b)=>{assert.equal(a.length,b.length);for(let i=0;i<a.length;i++){if(Array.isArray(a[i]))near(a[i],b[i]);else assert(Math.abs(a[i]-b[i])<1e-8,`${a[i]} ≈ ${b[i]}`);}};

test('factory caption lanes are stable across native price widths, partial copies and absent neighbouring fields',()=>{
  const name={x:128,y:23,text:'Větrná elektrárna'},quantity={x:232,y:23,text:'Ks: 2'},cost={x:264,y:23,text:'Cena: 300'};
  assert.deepEqual(factoryCaptionRect(name),[132,14,94,16]);
  assert.deepEqual(factoryCaptionRect(quantity),[230,14,31,16]);
  assert.deepEqual(factoryCaptionRect(cost),[264,14,44,16]);
  assert.deepEqual(factoryCaptionRect({...quantity,x:228}),factoryCaptionRect(quantity));
  assert.deepEqual(factoryCaptionRect({...cost,x:268}),factoryCaptionRect(cost));
  for(const neighbours of [[],[quantity],[cost],[quantity,cost]])assert.deepEqual(factoryCaptionRect({...name,neighbours,clips:[[128,23,10,3]]}),factoryCaptionRect(name));
  assert.equal(factoryCaptionRect(null),null);
});

test('native full-run coverage follows the complete painted box, retaining Czech action initial letters',()=>{
  const locale=JSON.parse(readFileSync(new URL('../dist/locales/cs.json',import.meta.url))),font=locale.fonts['NEW6P.FNT'];
  const decoder=new TextDecoder('windows-1250'),reverse=new Map();for(let c=0;c<254;c++)reverse.set(decoder.decode(Uint8Array.of(c)),c);
  let oldClipFailures=0;
  for(const text of ['Zrušit','Opravit','Ústup']){
    // Actual TextButton2 uses NEW6P, charOffset−1, centered around native x288.
    const advance=[...text].reduce((sum,c)=>sum+font.chars[reverse.get(c)].width-1,0);
    const run={x:288-Math.floor(advance/2),y:77,width:advance+1,fontHeight:8};run.clips=[[run.x,run.y,run.width,run.fontHeight]];
    const target=[258,76,60,10],clips=remapTextRunClips(run,target);
    assert.deepEqual(clips,[target],text+' complete destination coverage');
    const layout=fitTextBox(size=>measurePeriodText(text,size,{face:'NEW6P.FNT'}),target.map(n=>n*4),{maxSize:8*4*.97,padding:[8,4,8,4],align:'center'});
    assert(layout);const[x,y,w,h]=layout.ink.map(n=>n/4);
    assert(inside(x+.001,y+.001,clips),text+' leading ink survives');
    assert(inside(x+w-.001,y+h-.001,clips),text+' final ink survives');
    if(!inside(x+.001,y+.001,run.clips))oldClipFailures++;
  }
  assert(oldClipFailures>0,'unchanged original clips reproduce cropped painted text');
});

test('partial copies, true erasures and disconnected coverage remain absent after remapping',()=>{
  const run={x:10,y:80,width:46,fontHeight:8,clips:[[10,80,12,8],[28,80,18,4],[28,85,18,3]]},target=[100,40,92,16];
  const mapped=remapTextRunClips(run,target);
  assert.deepEqual(mapped,[[100,40,24,16],[136,40,36,8],[136,50,36,6]]);
  for(let y=80.25;y<88;y+=.5)for(let x=10.25;x<56;x+=.5){
    assert.equal(inside(100+(x-10)*2,40+(y-80)*2,mapped),inside(x,y,run.clips),'no missing region resurrected');
  }
  assert(!inside(130,45,mapped),'erased middle remains absent');
  assert(!inside(140,49,mapped),'one-row horizontal erase remains absent');
});

test('source clips are clamped to the full native font rectangle and identity retains exact valid values',()=>{
  const clips=[[.2,.3,.1,.4],[-2,-2,4,4],[8,8,5,5],[20,20,2,2]],run={x:0,y:0,width:10,height:2,fontHeight:10,clips};
  const before=JSON.stringify(run),mapped=remapTextRunClips(run,[0,0,10,10]);
  assert.deepEqual(mapped,[[.2,.3,.1,.4],[0,0,2,2],[8,8,2,2]]);
  assert.notEqual(mapped[0],clips[0]);assert.equal(JSON.stringify(run),before,'source descriptor untouched');
  assert.deepEqual(remapTextRunClips({x:0,y:0,width:10,height:10,clips:[[0,0,10,10]]},[2,3,20,30]),[[2,3,20,30]],'legacy height fallback');
});

test('full immutable geometry makes clipping stable through translated copies and repeated affine transforms',()=>{
  const run={x:10,y:20,width:40,fontHeight:10,clips:[[15,22,20,3],[35,27,10,2]]},target=[101,51,70,13];
  const expected=remapTextRunClips(run,target),translated={...run,x:75,y:100,clips:run.clips.map(([x,y,w,h])=>[x+65,y+80,w,h])};
  near(remapTextRunClips(translated,target),expected);
  const final=[2,3,79,19],intermediate={x:target[0],y:target[1],width:target[2],fontHeight:target[3],clips:expected};
  near(remapTextRunClips(intermediate,final),remapTextRunClips(run,final));
  const movedCursor={...run,cursor:{x:17,y:23},visibleInk:1,totalInk:99,ink:[[5,2,15]]};
  assert.deepEqual(remapTextRunClips(movedCursor,target),expected,'visibility cannot refit the mapping');
});

test('unavailable or degenerate coverage never expands into a visible painted label',()=>{
  const run={x:1,y:2,width:30,fontHeight:8,clips:[[1,2,30,8]]},target=[10,20,60,10];
  for(const invalid of [null,{},[],[0,0,0,10],[0,0,10,-1],[NaN,0,10,10],[0,Infinity,10,10]])assert.deepEqual(remapTextRunClips(run,invalid),[]);
  for(const invalid of [null,{}, {...run,width:0},{...run,fontHeight:NaN},{...run,clips:null},{...run,clips:[]},{...run,clips:[[0,0,-1,1],[0,0,1,0],[Infinity,0,1,1]]}])assert.deepEqual(remapTextRunClips(invalid,target),[]);
});
