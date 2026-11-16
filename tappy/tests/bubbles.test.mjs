import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TappyEngine} from '../dist/tappy-engine.js';

const original=JSON.parse(readFileSync(new URL('../dist/levels.json',import.meta.url),'utf8'));
const directions={R:{dx:1},L:{dx:-1},U:{dy:-1},D:{dy:1}};
const at=(x,y)=>({halfX:x,halfY:y});
const rightGhostRoute='R'.repeat(24)+'URRDDDDRRDDDDDDLLR';

function level(overrides={}) {
  return {
    number:1,
    brickMasks:Array.from({length:10},()=>`1${'0'.repeat(38)}1`),
    player:at(1,18),egg:at(20,18),goalPlate:at(33,20),
    rocks:[],ghosts:[],frogs:[],mushrooms:[],...overrides,
  };
}

function game(overrides={}) {
  return new TappyEngine([level(overrides)]);
}

function reachRightGhost() {
  const engine=new TappyEngine(original,1);
  for(const direction of rightGhostRoute) {
    engine.step(directions[direction]);
    assert.equal(engine.status,'playing','the original route must be playable without changing map or enemies');
  }
  assert.deepEqual([engine.player.x,engine.player.y,engine.player.dir],[28,10,'right']);
  assert.equal(engine.ammo,3);
  const ghost=engine.enemies.find(enemy=>enemy.id==='ghost-1');
  assert.deepEqual([ghost.x,ghost.y,ghost.sleep],[32,10,0]);
  return engine;
}

// Bubble flight may stun an enemy and move its pickup. Everything else remains
// at the result of the player's one decision, including interpolation positions.
function nonBubbleWorld(engine,stunnableIds=[]) {
  const {shots,mushrooms,enemies,...world}=engine.checkpoint();
  return {...world,enemies:enemies.map(enemy=>{
    if(!stunnableIds.includes(enemy.id))return enemy;
    const {sleep,...unchangedEnemy}=enemy;
    return unchangedEnemy;
  })};
}

function finishBubbles(engine,check=()=>{}) {
  let frames=0;
  while(engine.hasBubbleMotion && frames<64) {
    engine.advanceBubbles();
    frames++;
    check(frames);
  }
  assert.equal(engine.hasBubbleMotion,false,'flight and pickup gravity must settle within64 frames');
  return frames;
}

test('one bubble reaches the actual right-hand ghost in original room1 without extra world turns',()=>{
  const engine=reachRightGhost();
  const before=engine.checkpoint();
  assert.equal(engine.canFire,true);
  engine.step({fire:true});
  assert.equal(engine.ticks,before.ticks+1);
  assert.equal(engine.ammo,before.ammo-1);
  assert.ok(engine.events.some(event=>event.type==='shoot'));
  const world=nonBubbleWorld(engine,['ghost-1']);
  const originalPickups=structuredClone(engine.mushrooms);
  finishBubbles(engine,()=>{
    assert.deepEqual(nonBubbleWorld(engine,['ghost-1']),world,'bubble animation cannot advance rocks, movement, enemies or random state');
    assert.deepEqual(engine.mushrooms,originalPickups,'a hit cannot move unrelated room pickups');
  });
  assert.equal(engine.enemies.find(enemy=>enemy.id==='ghost-1').sleep>0,true);
  assert.equal(engine.shots.length,0);
  assert.equal(engine.ticks,before.ticks+1);
  assert.equal(engine.canFire,true);
  assert.equal(engine.undo(),true);
  assert.deepEqual(engine.checkpoint(),before,'one undo restores the entire decision before firing');
});

test('the last bubble keeps moving with zero ammo; an empty fire action spends no turn or undo entry',()=>{
  const engine=new TappyEngine(original,1);
  for(let i=0;i<8;i++)engine.step({dx:1});
  assert.equal(engine.ammo,1,'the first original blue pickup supplies the last shot');
  const beforeFire=engine.checkpoint();
  engine.step({fire:true});
  assert.equal(engine.ammo,0);
  assert.equal(engine.canFire,false);
  assert.equal(engine.hasBubbleMotion,true,'zero ammo must not stop an already launched bubble');
  const world=nonBubbleWorld(engine);
  finishBubbles(engine,()=>assert.deepEqual(nonBubbleWorld(engine),world));
  assert.equal(engine.shots.length,0);
  assert.equal(engine.ammo,0);
  const beforeEmpty=engine.checkpoint();
  engine.step({fire:true});
  assert.deepEqual(engine.checkpoint(),beforeEmpty);
  assert.ok(engine.events.some(event=>event.type==='bubble-unavailable'&&event.reason==='empty'));
  assert.equal(engine.undo(),true);
  assert.deepEqual(engine.checkpoint(),beforeFire,'empty firing and flight frames must not add checkpoints');
});

test('an empty first shot is harmless even before the first undo checkpoint exists',()=>{
  const engine=game();
  const before=engine.checkpoint();
  assert.equal(engine.canUndo,false);
  engine.step({fire:true});
  assert.deepEqual(engine.checkpoint(),before);
  assert.equal(engine.canUndo,false);
  assert.ok(engine.events.some(event=>event.type==='bubble-unavailable'&&event.reason==='empty'));
});

test('a second tap while one bubble flies is a no-op rather than an extra world or undo turn',()=>{
  const engine=game({mushrooms:[at(1,19),at(2,19)]});
  engine.step({});
  assert.equal(engine.ammo,2);
  const beforeFire=engine.checkpoint();
  engine.step({fire:true});
  assert.equal(engine.ammo,1);
  assert.equal(engine.shots.length,1);
  assert.equal(engine.canFire,false);
  const flying=engine.checkpoint();
  engine.step({fire:true});
  assert.deepEqual(engine.checkpoint(),flying);
  assert.ok(engine.events.some(event=>event.type==='bubble-unavailable'&&event.reason==='flying'));
  assert.equal(engine.undo(),true);
  assert.deepEqual(engine.checkpoint(),beforeFire);
});

test('two completed shots are ready on consecutive decisions without four walking steps',()=>{
  const engine=reachRightGhost();
  const before=engine.checkpoint();
  for(let shot=1;shot<=2;shot++) {
    assert.equal(engine.canFire,true);
    engine.step({fire:true});
    assert.ok(engine.events.some(event=>event.type==='shoot'),`shot${shot} must launch immediately`);
    assert.equal(engine.fireCooldown,0);
    finishBubbles(engine);
    assert.equal(engine.ticks,before.ticks+shot);
    assert.equal(engine.moves,before.moves);
    assert.deepEqual([engine.player.x,engine.player.y],[before.player.x,before.player.y]);
    assert.equal(engine.ammo,before.ammo-shot);
  }
});

test('a missed bubble becomes a pickup falling one half-cell per animation frame while the world stays frozen',()=>{
  const engine=game({player:at(1,0),mushrooms:[at(2,1)],rocks:[at(30,0)],ghosts:[at(35,18)]});
  engine.enemies[0].sleep=25; // A prior stun must not count down during visual flight.
  engine.step({});
  assert.equal(engine.ammo,1);
  engine.step({fire:true});
  const world=nonBubbleWorld(engine);
  assert.equal(engine.objects.find(object=>object.kind==='rock').falling,true,'fixture contains a genuinely falling world object');
  let previousDrop=null,firstDrop=null;
  const frames=finishBubbles(engine,()=>{
    assert.deepEqual(nonBubbleWorld(engine),world);
    const drop=engine.mushrooms.find(mushroom=>mushroom.id.startsWith('dropped-')&&mushroom.alive);
    if(drop) {
      firstDrop??=structuredClone(drop);
      if(previousDrop) {
        assert.equal(drop.x,previousDrop.x);
        assert.ok(drop.y-previousDrop.y===0||drop.y-previousDrop.y===1,'pickup gravity advances at most one half-cell');
      }
      previousDrop=structuredClone(drop);
    }
  });
  assert.ok(frames>1);
  assert.ok(firstDrop,'a miss must remain recoverable as a pickup');
  assert.equal(firstDrop.y,1.5,'the newly spent bubble drops exactly one half-cell on its first gravity update');
  assert.ok(previousDrop.y>firstDrop.y);
  assert.equal(previousDrop.falling,false);
  assert.equal(engine.shots.length,0);
  assert.equal(engine.ammo,0);
  assert.equal(engine.enemies[0].sleep,23,'only the two explicit world turns spend sleeping time');
});

test('bubble animation updates projectile interpolation and clears old effects without spending a turn',()=>{
  const engine=game({mushrooms:[at(1,19),at(2,19)]});
  engine.step({});
  engine.step({fire:true});
  const before=structuredClone(engine.shots[0]);
  const world=nonBubbleWorld(engine);
  assert.ok(engine.events.some(event=>event.type==='shoot'));
  engine.advanceBubbles();
  assert.deepEqual(nonBubbleWorld(engine),world);
  assert.equal(engine.shots[0].prevX,before.x);
  assert.equal(engine.shots[0].prevY,before.y);
  assert.equal(engine.shots[0].x,before.x+2);
  assert.equal(engine.shots[0].y,before.y);
  assert.deepEqual(engine.events,[],'launch sound and effects must not replay every animation frame');
  assert.equal(engine.fireCooldown,0);
});

test('a blocked shot keeps its ammo and reports the obstruction',()=>{
  const engine=game({player:at(37,18),mushrooms:[at(37,19)]});
  engine.step({});
  assert.equal(engine.ammo,1);
  assert.equal(engine.canFire,true);
  engine.step({fire:true});
  assert.equal(engine.ammo,1);
  assert.equal(engine.shots.length,0);
  assert.equal(engine.hasBubbleMotion,false);
  assert.equal(engine.canFire,true);
  assert.ok(engine.events.some(event=>event.type==='bubble-blocked'));
  assert.ok(!engine.events.some(event=>event.type==='shoot'));
});

test('unavailable firing does not discard an intentional movement combined with fire',()=>{
  const engine=game();
  engine.step({dx:1,fire:true});
  assert.equal(engine.player.x,2);
  assert.equal(engine.moves,1);
  assert.equal(engine.ticks,1);
  assert.equal(engine.status,'playing');
  assert.equal(engine.ammo,0);
  assert.equal(engine.canUndo,true);
});
