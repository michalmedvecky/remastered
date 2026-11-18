/* Dune II reconstruction core. All state is serializable; no wall clock or DOM.
 * Exact recovered helpers are identified in ENGINE.md. Terrain, routing, combat,
 * production conversion and native object behavior are explicit reconstructions.
 */
export const SIZE = 64;
export const FIXED = 256;
export const VERSION = 1;
const CELLS = SIZE * SIZE;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const integer = (v, fallback = 0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;
const signed16 = v => (v << 16) >> 16;
const houseNames = ['Harkonnen', 'Atreides', 'Ordos', 'Fremen', 'Sardaukar', 'Mercenary'];
const dimensions = [[1,1],[2,2],[3,3],[2,2],[3,2],[2,2],[2,2],[2,2],[2,2],[2,2],[2,2],[3,3],[3,2],[3,2],[1,1],[1,1],[1,1],[2,2],[2,2]];
const unitSpeeds = [48,56,8,8,9,9,14,12,14,14,11,9,13,27,31,24,11,10,48,48,48,48,48,48,48,8,40];
const unitDamage = [0,12,5,10,3,6,120,26,7,18,28,42,24,6,7,10,0,0,80,20,20,20,12,5,22,250,0];
const unitRanges = [0,5,2,4,2,4,1,7,5,4,5,4,5,3,3,3,0,0,8,6,6,6,5,3,5,1,0];
const dirs = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];

export function tileId(x, y) { return (integer(x) & 63) | ((integer(y) & 63) << 6); }
export function tilePoint(id) { return { x: id & 63, y: (id >> 6) & 63 }; }
export const entityTile = e => tileId(e.x >> 8, e.y >> 8);
export function speedAdjust(base, lower, upper, direction, setting = 2) {
  base = signed16(base); lower = signed16(lower); upper = signed16(upper);
  if (setting === 2) return base;
  upper = Math.min(upper, signed16(base * 2));
  lower = Math.max(lower, base >> 1);
  const down = signed16(base - lower) >> 1, up = signed16(upper - base) >> 1;
  const selector = direction ? setting : 4 - setting;
  const adjustments = [-2 * down, -down, 0, up, 2 * up];
  const result = selector >= 0 && selector < 5 ? signed16(base + adjustments[selector]) : base;
  return Math.max(lower, Math.min(upper, result));
}

export function random15(state) {
  state.rng.lcg = (Math.imul(state.rng.lcg, 0x015a4e35) + 1) >>> 0;
  return (state.rng.lcg >>> 16) & 0x7fff;
}
export function randomRange(state, low, high) {
  if (low > high) [low, high] = [high, low];
  let value;
  do value = low + Math.floor(random15(state) * (high - low + 1) / 32768); while (value > high);
  return value;
}
export function randomByte(state) {
  let [a, b, c] = state.rng.bytes;
  let al = a >>> 2, carry = (a >>> 1) & 1;
  const oldC = c; c = ((c << 1) | carry) & 255; carry = oldC >>> 7;
  const oldB = b; b = ((b << 1) | carry) & 255; carry = 1 - (oldB >>> 7);
  al = (al - a - carry) & 255;
  a = (a >>> 1) | ((al & 1) << 7);
  state.rng.bytes = [a, b, c];
  return a ^ b;
}

// Source-bound rate decomposition at 0x2a3ab and carry gate at 0x2a493.
// The caller's chosen terrain/rate scale remains a reconstructed value here.
export function movementRate(rawSpeed,cargo,setting,harvester=false,requested=255) {
  const multiply=(a,b)=>Math.min(65535,(a*b+128)>>8);
  let scale=clamp(integer(requested),0,255);
  if(harvester)scale=multiply(scale,255-clamp(integer(cargo),0,100));
  let value=speedAdjust(multiply(rawSpeed,scale),1,255,1,setting);
  const magnitude=Math.max(1,value>>4),fraction=value>>4?255:(value<<4)&255;
  return {magnitude:magnitude<<4,fraction:speedAdjust(fraction,1,255,1,setting)};
}

function typeDef(content, kind, type) {
  return (kind === 'unit' ? content.units : content.structures)?.find(d => (d.id ?? d.index) === type) ?? {};
}
function typeNumber(content, kind, value) {
  let wanted = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  // Three shipped Harkonnen reinforcement records use this spelling. Preserve
  // their source text and resolve it explicitly, rather than dropping the wave.
  if(wanted==='devistator')wanted='devastator';
  const list = kind === 'unit' ? content.units : content.structures;
  const match = list?.find(d => String(d.name).toLowerCase().replace(/[^a-z0-9]/g, '') === wanted);
  return match ? (match.id ?? match.index) : -1;
}
function houseNumber(value, content) {
  const name = String(value).toLowerCase();
  return content.houses?.find(h => String(h.name).toLowerCase() === name)?.id ?? houseNames.findIndex(n => n.toLowerCase() === name);
}
function defHP(def) { return integer(def.hp ?? def.hitpoints, 100); }
function defCost(def) { return integer(def.cost ?? def.build_cost, 100); }
function defBuild(def) { return integer(def.buildTimeRaw ?? def.build_time_raw, 64); }
export function getDefinition(content, kind, type) { return typeDef(content, kind, type); }
function footprint(content, type) {
  const def = typeDef(content, 'structure', type), fallback = dimensions[type] ?? [2,2];
  return [clamp(integer(def.width, fallback[0]), 1, 4), clamp(integer(def.height, fallback[1]), 1, 4)];
}
function post(state, type, message, extra = {}) {
  state.events.push({ id: state.nextEvent++, tick: state.tick, type, message, ...extra });
  if (state.events.length > 80) state.events.splice(0, state.events.length - 80);
}
function scriptMetadata(content, kind, type) {
  const program = kind === 'unit' ? 'UNIT' : 'BUILD';
  const data = content.scripts?.[program] ?? content.scripts?.[program.toLowerCase()];
  return { program, entry: type, ip: data?.orders?.[type] ?? 0, delay: 0, mode: 'native-reconstruction' };
}
function spawn(state, content, kind, type, house, tile, scale = 256, order = 'Guard') {
  const def = typeDef(content, kind, type), maxHp = defHP(def), point = tilePoint(tile);
  const [w,h] = kind === 'structure' ? footprint(content, type) : [1,1];
  const hp = Math.min(65535, Math.floor((maxHp * clamp(integer(scale, 256), 0, 65535) + 128) / 256));
  const e = {
    id: state.nextId++, kind, type, house,
    x: point.x * FIXED + 128, y: point.y * FIXED + 128,
    w, h, hp, maxHp, cargo: 0, facing: 0,
    order: { type: order === 'Hunt' ? 'hunt' : 'guard', mode: order, tile },
    path: [], destination: null, moveRemainder: 0, nextMove: 0, nextAction: 0,
    nextFire: 0, cooldown: 0, target: null, born: state.tick,
    script: scriptMetadata(content, kind, type)
  };
  state.entities.push(e);
  return e;
}
function alive(e) { return e && e.hp > 0; }
function allied(a, b) { return a === b || (a === 1 && b === 3) || (a === 3 && b === 1); }
function hostile(a, b) { return a.type === 25 || b.type === 25 ? a.id !== b.id : !allied(a.house, b.house); }
function home(state, house) { return state.entities.find(e => alive(e) && e.house === house && e.kind === 'structure' && e.type === 8) ?? state.entities.find(e => alive(e) && e.house === house); }
function posTileDistance(a, b) { return Math.max(Math.abs((a.x >> 8) - (b.x >> 8)), Math.abs((a.y >> 8) - (b.y >> 8))); }
function center(e) { return { x: e.x + (e.w - 1) * 128, y: e.y + (e.h - 1) * 128 }; }
function distance(a, b) { const aa = center(a), bb = center(b); return Math.hypot(aa.x - bb.x, aa.y - bb.y); }
function liveEntities(state) { return state.entities.filter(alive); }

function makeTerrain(state, seed) {
  let rnd = seed >>> 0;
  const next = () => { rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0; return rnd; };
  const terrain = Array(CELLS).fill(0), spice = Array(CELLS).fill(0);
  const coarse = Array.from({length: 81}, () => next() >>> 24);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const gx = x >> 3, gy = y >> 3, fx = x & 7, fy = y & 7;
    const a = coarse[gy * 9 + gx] * (8 - fx) + coarse[gy * 9 + gx + 1] * fx;
    const b = coarse[(gy + 1) * 9 + gx] * (8 - fx) + coarse[(gy + 1) * 9 + gx + 1] * fx;
    const n = (a * (8 - fy) + b * fy) >> 6;
    terrain[tileId(x,y)] = n > 179 ? 3 : n > 137 ? 2 : n > 96 ? 1 : 0;
  }
  state.map = { terrain, spice, seen: Array(CELLS).fill(0), visible: Array(CELLS).fill(0), concrete: Array(CELLS).fill(-1), blooms: Array(CELLS).fill(0) };
  for (let i = 0; i < 20; i++) addSpice(state, tileId(3 + next() % 58, 3 + next() % 58), 2 + next() % 4, next);
}
function addSpice(state, tile, radius = 3, rng = null) {
  const p = tilePoint(tile);
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || dx*dx + dy*dy > radius*radius) continue;
    const id = tileId(x,y);
    if (state.map.concrete[id] >= 0) continue;
    const amount = 60 + Math.max(0, radius - Math.max(Math.abs(dx), Math.abs(dy))) * 70 + (rng ? rng() % 90 : (id * 31) % 90);
    state.map.spice[id] = Math.max(state.map.spice[id], amount);
    state.map.terrain[id] = amount > 240 ? 9 : 8;
  }
}
function rockAround(state, tile, radius = 5) {
  const p = tilePoint(tile);
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (dx*dx + dy*dy > radius*radius || p.x + dx < 0 || p.x + dx >= SIZE || p.y + dy < 0 || p.y + dy >= SIZE) continue;
    const id = tileId(p.x + dx, p.y + dy);
    state.map.terrain[id] = 2; state.map.spice[id] = 0;
  }
}
function markFootprint(state, content, type, house, tile, concrete = false) {
  const p = tilePoint(tile), [w,h] = footprint(content,type);
  for (let y = p.y; y < Math.min(SIZE,p.y+h); y++) for (let x = p.x; x < Math.min(SIZE,p.x+w); x++) {
    const id = tileId(x,y); state.map.terrain[id] = concrete ? 10 : 2; state.map.spice[id] = 0;
    if (concrete) state.map.concrete[id] = house;
  }
}

export function createGame(content, options = {}) {
  const scenarioId = options.scenarioId ?? content.scenarios?.find(s => s.house === (options.house ?? 1))?.id ?? content.scenarios?.[0]?.id;
  const scenario = content.scenarios?.find(s => s.id === scenarioId);
  if (!scenario) throw new Error('Unknown original scenario: ' + scenarioId);
  const sections = scenario.sections ?? scenario.ini ?? {};
  const human = Object.entries(sections).find(([,v]) => v?.Brain === 'Human')?.[0];
  const house = options.house ?? scenario.house ?? houseNumber(human,content);
  const number = scenario.number ?? integer(scenarioId.match(/(\d+)/)?.[1],1);
  const seed = integer(sections.MAP?.Seed, 353) >>> 0;
  const state = {
    version: VERSION, scenarioId, scenarioNumber: number, stage: number === 1 ? 1 : Math.min(9, 2 + Math.floor((number - 2)/3)),
    house, tick: 0, uiTick: 0, speed: clamp(integer(options.speed,2),0,4), paused: false, outcome: null,
    nextId: 1, nextEvent: 1, nextProjectile: 1, nextProduction: 1,
    rng: { lcg: seed || 1, bytes: [seed & 255, (seed >>> 8) & 255, (seed >>> 16) & 255] },
    map: null, houses: [], entities: [], events: [], projectiles: [], effects: [], production: [],
    scenario: { seed, endMask: integer(sections.BASIC?.WinFlags,3), winMask: integer(sections.BASIC?.LoseFlags,1), timeout: integer(sections.BASIC?.TimeOut,0),
      grace: 7200, poll: 300, nextPoll: 0, deadline: 0, mapScale: integer(sections.BASIC?.MapScale,0) },
    reinforcements: [], teams: [], score: 0, delivered: 0, kills: 0, losses: 0, commandLog: [],
    fidelity: { terrain: 'reconstructed', routing: 'deterministic-a-star', combat: 'reconstructed', scripts: 'native-reconstruction' }
  };
  for (let id = 0; id < houseNames.length; id++) {
    const name = content.houses?.find(h => h.id === id)?.name ?? houseNames[id], data = sections[name] ?? {};
    state.houses.push({ id, name, active: !!data.Brain, brain: id === house ? 'Human' : (data.Brain ?? 'None'),
      credits: integer(data.Credits,0), displayCredits: integer(data.Credits,0), quota: integer(data.Quota,0),
      maxUnits: integer(data.MaxUnit,40), power: 0, powerProduced: 0, powerUsed: 0, storage: 1000, delivered: 0 });
  }
  makeTerrain(state,seed);
  for (const tile of String(sections.MAP?.Field ?? '').split(',').filter(Boolean).map(Number)) addSpice(state,tile,4);
  for (const tile of String(sections.MAP?.Bloom ?? '').split(',').filter(Boolean).map(Number)) if (tile >= 0 && tile < CELLS) state.map.blooms[tile] = 1;
  // Original scenario placements are authoritative; approximate terrain is cleared
  // under those footprints and around the yards so every supplied scenario is playable.
  for (const [key,value] of Object.entries(sections.STRUCTURES ?? {})) {
    const fields = String(value).split(',').map(s => s.trim()), owner = houseNumber(fields[0],content), type = typeNumber(content,'structure',fields[1]);
    const tile = key.startsWith('GEN') ? integer(key.slice(3),-1) : integer(fields[3],-1);
    if (type < 0 || owner < 0 || tile < 0 || tile >= CELLS) continue;
    if (type === 8) rockAround(state,tile,7);
    markFootprint(state,content,type,owner,tile,type <= 1);
    if (type > 1) spawn(state,content,'structure',type,owner,tile,key.startsWith('GEN') ? 256 : integer(fields[2],256));
  }
  for (const value of Object.values(sections.UNITS ?? {})) {
    const fields = String(value).split(',').map(s => s.trim()), owner = houseNumber(fields[0],content), type = typeNumber(content,'unit',fields[1]);
    const tile = integer(fields[3],-1);
    if (type < 0 || owner < 0 || tile < 0 || tile >= CELLS) continue;
    const unit = spawn(state,content,'unit',type,owner,tile,integer(fields[2],256),fields[5] ?? 'Guard');
    unit.facing = integer(fields[4],0) & 255;
    if (state.map.terrain[tile] === 3) state.map.terrain[tile] = 0;
  }
  for (const h of state.houses.filter(h => h.active)) {
    const base = home(state,h.id);
    if (base) {
      const bp = tilePoint(entityTile(base));
      // A nearby spice deposit substitutes only for unported procedural field placement.
      const nearby = nearestSpice(state,entityTile(base),12);
      if (nearby === null) addSpice(state,tileId(clamp(bp.x+7,3,60),clamp(bp.y-6,3,60)),3);
    }
    if (state.entities.some(e => e.kind === 'structure' && e.type === 12 && e.house === h.id) && !state.entities.some(e => e.kind === 'unit' && e.type === 16 && e.house === h.id)) grantHarvester(state,content,h.id);
  }
  for (const value of Object.values(sections.REINFORCEMENTS ?? {})) {
    const [owner,name,where,when] = String(value).split(',').map(s => s.trim());
    const repeat = when?.endsWith('+') ?? false, minute = integer(when?.replace('+',''),1);
    state.reinforcements.push({ house: houseNumber(owner,content), type: typeNumber(content,'unit',name), where, tick: minute*3600, repeat, interval: minute*3600 });
  }
  state.teams = Object.values(sections.TEAMS ?? {}).map((value,index) => ({ id:index+1, fields:String(value).split(',').map(s=>s.trim()), nextTick:5+(randomByte(state)&7), script:{program:'TEAM',entry:index%6,mode:'native-reconstruction'} }));
  const tactical = tilePoint(integer(sections.BASIC?.TacticalPos, entityTile(home(state,house) ?? {x:8192,y:8192})));
  state.cameraStart = { x:clamp(tactical.x,0,49), y:clamp(tactical.y,0,54) };
  state.cursorStart = integer(sections.BASIC?.CursorPos,0);
  state.scenario.deadline = state.scenario.timeout > 0 ? state.scenario.timeout * 3600 : 0;
  refreshHouseResources(state,content); updateVisibility(state,content);
  post(state,'mission',`${state.houses[house]?.name ?? 'House'} command established.`,{house});
  return state;
}

function structureAt(state,x,y,ignore = null) {
  return state.entities.find(e => alive(e) && e.kind === 'structure' && e.id !== ignore && x >= (e.x>>8) && y >= (e.y>>8) && x < (e.x>>8)+e.w && y < (e.y>>8)+e.h);
}
export function entityAt(state,tile) {
  const {x,y}=tilePoint(tile);
  return state.entities.find(e=>alive(e)&&e.kind==='unit'&&(e.x>>8)===x&&(e.y>>8)===y) ?? structureAt(state,x,y) ?? null;
}
function passable(state,x,y,entity,goal = false) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return false;
  if ([0,1,26].includes(entity.type)) return true;
  const tile=tileId(x,y), obstacle=structureAt(state,x,y);
  if (obstacle && obstacle.id !== entity.id) return false;
  if (state.map.terrain[tile] === 3) return [2,3,4,5,6].includes(entity.type);
  return true;
}

// Stable A* with octile costs. This deliberately documented substitute does not
// claim the original route tie-breaking; the retained route queue is <=14 steps.
export function findPath(state,entity,goalTile,adjacent = false) {
  const start=entityTile(entity), goal=tilePoint(goalTile), startPoint=tilePoint(start);
  const accept = (x,y) => adjacent ? Math.max(Math.abs(x-goal.x),Math.abs(y-goal.y)) <= 1 : x===goal.x&&y===goal.y;
  if (accept(startPoint.x,startPoint.y)) return [];
  const scores=new Int32Array(CELLS).fill(0x3fffffff), came=new Int32Array(CELLS).fill(-1), closed=new Uint8Array(CELLS);
  const open=[]; let serial=0;
  const heuristic=(x,y)=>{const dx=Math.abs(x-goal.x),dy=Math.abs(y-goal.y);return 10*Math.max(dx,dy)+4*Math.min(dx,dy);};
  const less=(a,b)=>a.f<b.f||(a.f===b.f&&(a.h<b.h||(a.h===b.h&&a.serial<b.serial)));
  function push(v){open.push(v);let i=open.length-1;while(i){const p=(i-1)>>1;if(!less(open[i],open[p]))break;[open[i],open[p]]=[open[p],open[i]];i=p;}}
  function pop(){const first=open[0],last=open.pop();if(open.length){open[0]=last;let i=0;while(true){let c=i*2+1;if(c>=open.length)break;if(c+1<open.length&&less(open[c+1],open[c]))c++;if(!less(open[c],open[i]))break;[open[c],open[i]]=[open[i],open[c]];i=c;}}return first;}
  scores[start]=0;const h=heuristic(startPoint.x,startPoint.y);push({id:start,f:h,h,serial:serial++});
  let found=-1,iterations=0;
  while(open.length&&iterations++<CELLS){const current=pop();if(closed[current.id])continue;closed[current.id]=1;const p=tilePoint(current.id);
    if(accept(p.x,p.y)){found=current.id;break;}
    for(let d=0;d<dirs.length;d++){const [dx,dy]=dirs[d],x=p.x+dx,y=p.y+dy;
      if(!passable(state,x,y,entity))continue;
      if(dx&&dy&&(!passable(state,p.x+dx,p.y,entity)||!passable(state,p.x,p.y+dy,entity)))continue;
      const id=tileId(x,y),cost=scores[current.id]+(dx&&dy?14:10)+(state.map.terrain[id]===1?2:0);
      if(cost>=scores[id])continue;scores[id]=cost;came[id]=current.id;const h=heuristic(x,y);push({id,f:cost+h,h,serial:serial++});
    }
  }
  if(found<0)return [];
  const route=[];for(let at=found;at!==start&&at>=0;at=came[at])route.push(at);
  return route.reverse().slice(0,14);
}
function moveToward(state,content,e,tile,adjacent = false) {
  const goal=tilePoint(tile), point=tilePoint(entityTile(e));
  if(adjacent?Math.max(Math.abs(point.x-goal.x),Math.abs(point.y-goal.y))<=1:entityTile(e)===tile&&Math.abs(e.x-(goal.x*256+128))<5&&Math.abs(e.y-(goal.y*256+128))<5){e.path=[];return true;}
  if(e.destination!==tile||!e.path.length){e.destination=tile;e.path=findPath(state,e,tile,adjacent);}
  if(!e.path.length){e.blocked=(e.blocked??0)+1;return false;}
  const next=tilePoint(e.path[0]);
  if(!passable(state,next.x,next.y,e)){e.path=[];return false;}
  const def=typeDef(content,'unit',e.type),base=integer(def.speed,unitSpeeds[e.type]??12);
  const rate=movementRate(base,e.cargo,state.speed,e.type===16);
  const setup=`${e.type}:${base}:${e.type===16?e.cargo:0}:${state.speed}`;
  if(e.moveSetup!==setup){e.moveSetup=setup;e.moveRemainder=0;}
  const accumulated=e.moveRemainder+rate.fraction;
  e.moveRemainder=accumulated&255;e.moveFraction=rate.fraction;e.moveInteger=rate.magnitude;
  if(accumulated<256)return false;
  const magnitude=rate.magnitude;
  const tx=next.x*256+128,ty=next.y*256+128,dx=tx-e.x,dy=ty-e.y,length=Math.hypot(dx,dy);
  e.facing=(Math.round(Math.atan2(dx,-dy)/(Math.PI*2)*256)+256)&255;
  if(length<=magnitude){e.x=tx;e.y=ty;e.path.shift();e.blocked=0;}else{
    const qx=dx*magnitude/length,qy=dy*magnitude/length;
    e.x+=qx<0?Math.floor(qx):Math.ceil(qx);e.y+=qy<0?Math.floor(qy):Math.ceil(qy);
  }
  const pos=entityTile(e);if(state.map.blooms[pos]&&e.type!==25){state.map.blooms[pos]=0;addSpice(state,pos,4);post(state,'bloom','Spice bloom discovered.',{x:e.x,y:e.y,house:e.house});}
  return false;
}
function nearestSpice(state,tile,limit = 64) {
  const p=tilePoint(tile);let best=null,score=Infinity;
  for(let i=0;i<CELLS;i++)if(state.map.spice[i]>0){const q=tilePoint(i),d=Math.max(Math.abs(p.x-q.x),Math.abs(p.y-q.y));if(d<=limit&&d<score){best=i;score=d;}}
  return best;
}
function refineryFor(state,e) {
  return state.entities.filter(s=>alive(s)&&s.kind==='structure'&&s.type===12&&s.house===e.house).sort((a,b)=>distance(e,a)-distance(e,b)||a.id-b.id)[0];
}
function adjacentOpen(state,building,e = {type:16,id:0}) {
  const x=building.x>>8,y=building.y>>8;
  const candidates=[];for(let dy=-1;dy<=building.h;dy++)for(let dx=-1;dx<=building.w;dx++)if(dx===-1||dy===-1||dx===building.w||dy===building.h)candidates.push([x+dx,y+dy]);
  return candidates.find(([x,y])=>passable(state,x,y,e))?.reduce((v,c,i)=>i?tileId(v,c):c) ?? entityTile(building);
}
function grantHarvester(state,content,house) {
  const ref=state.entities.find(e=>alive(e)&&e.house===house&&e.kind==='structure'&&e.type===12);
  if(!ref)return;
  const unit=spawn(state,content,'unit',16,house,adjacentOpen(state,ref));
  const tile=nearestSpice(state,entityTile(unit));
  if(tile!==null)unit.order={type:'harvest',tile,phase:'outbound',refinery:ref.id};
  post(state,'arrival','Harvester delivered to the refinery.',{entity:unit.id,house});
}
function harvest(state,content,e) {
  const order=e.order,ref=refineryFor(state,e);
  if(!ref){e.order={type:'guard',mode:'Guard',tile:entityTile(e)};if(e.house===state.house)post(state,'warning','A refinery is required to unload spice.');return;}
  order.refinery=ref.id;
  if(order.type==='return')order.phase=e.cargo?'return':'outbound';
  if(order.phase==='return'||order.phase==='unload'||e.cargo>=100){
    order.phase='return';const unloadTile=adjacentOpen(state,ref,e);
    if(!moveToward(state,content,e,unloadTile))return;
    order.phase='unload';if(state.tick<e.nextAction)return;
    const ratio=Math.floor(ref.hp*256/ref.maxHp),amount=Math.min(e.cargo,Math.max(1,Math.floor((3*ratio+128)/256)));
    if(amount>0){const credits=amount*(e.house===state.house?7:6+(randomByte(state)&3)),house=state.houses[e.house];
      house.credits=Math.min(65535,house.credits+credits);house.delivered+=credits;if(e.house===state.house)state.delivered+=credits;e.cargo-=amount;e.nextAction=state.tick+6;
      if(e.cargo===0){post(state,'delivery',`Spice delivered: ${house.credits} credits.`,{house:e.house,entity:e.id});order.type='harvest';order.phase='outbound';e.destination=null;}
    } else {order.type='harvest';order.phase='outbound';}
    return;
  }
  if(!Number.isInteger(order.tile)||state.map.spice[order.tile]<=0){order.tile=nearestSpice(state,entityTile(e));e.path=[];e.destination=null;}
  if(order.tile===null){e.order={type:'guard',tile:entityTile(e)};post(state,'warning','No spice remains in sensor range.',{house:e.house});return;}
  if(!moveToward(state,content,e,order.tile))return;
  order.phase='gather';if(state.tick<e.nextAction)return;
  const amount=randomByte(state)&1;e.cargo=Math.min(100,e.cargo+amount);
  if((randomByte(state)&31)===0){state.map.spice[order.tile]=Math.max(0,state.map.spice[order.tile]-1);if(state.map.spice[order.tile]===0)state.map.terrain[order.tile]=0;}
  e.nextAction=state.tick+6;
  if(e.cargo>=100){order.phase='return';e.path=[];e.destination=null;}
}

function combatDefinition(content,e) {
  const def=typeDef(content,e.kind,e.type);
  const sourceRange=integer(def.range,e.kind==='structure'?(e.type===15?5:e.type===16?7:0):unitRanges[e.type]??0);
  return {range:sourceRange>15?(unitRanges[e.type]??5):sourceRange,
    damage:integer(def.damage,e.kind==='structure'?(e.type===15?16:e.type===16?28:0):unitDamage[e.type]??0),
    sight:integer(def.sight,e.kind==='structure'?5:e.type===13||e.type===14?7:5)};
}
function closestEnemy(state,content,e,range,requireVisible = false) {
  return state.entities.filter(target=>alive(target)&&hostile(e,target)&&target.type!==0&&target.type!==1&&(!requireVisible||state.map.visible[entityTile(target)])&&distance(e,target)<=range*FIXED)
    .sort((a,b)=>distance(e,a)-distance(e,b)||a.id-b.id)[0];
}
export function applyDamage(state,content,target,amount,attacker = null) {
  if(!alive(target)||amount<=0)return;
  target.hp=Math.max(0,target.hp-integer(amount));
  if(target.hp===0){
    state.effects.push({type:'explosion',x:target.x,y:target.y,tick:state.tick,life:36,size:target.kind==='structure'?24:12});
    if(target.house===state.house)state.losses++;
    if(attacker?.house===state.house){state.kills++;state.score+=Math.max(1,Math.floor(defCost(typeDef(content,target.kind,target.type))/100));}
    post(state,'destroyed',`${typeDef(content,target.kind,target.type).name??'Object'} destroyed.`,{house:target.house,entity:target.id,x:target.x,y:target.y});
    for(const p of state.production)if(p.producer===target.id)p.cancelled=true;
    if(target.type===16&&target.cargo>0)addSpice(state,entityTile(target),1);
    return;
  }
  if(target.kind==='unit'&&target.hp*2<target.maxHp&&[2,3].includes(target.type)){
    target.type+=2;target.maxHp=defHP(typeDef(content,'unit',target.type));target.hp=target.maxHp;target.script=scriptMetadata(content,'unit',target.type);
  }
}
function fireAt(state,content,e,target) {
  const weapon=combatDefinition(content,e);if(weapon.damage<=0||state.tick<e.nextFire)return false;
  const at=center(e),to=center(target),d=Math.hypot(at.x-to.x,at.y-to.y);
  if(d>weapon.range*FIXED)return false;
  e.target=target.id;e.facing=(Math.round(Math.atan2(to.x-at.x,at.y-to.y)/(Math.PI*2)*256)+256)&255;
  const cooldown=e.type===25?180:e.kind==='structure'?90:e.type===10?110:[2,3,4,5].includes(e.type)?65:75;
  e.nextFire=state.tick+Math.max(12,speedAdjust(cooldown,Math.floor(cooldown/2),cooldown*2,0,state.speed));
  state.projectiles.push({id:state.nextProjectile++,source:e.id,house:e.house,target:target.id,x:at.x,y:at.y,tx:to.x,ty:to.y,
    damage:weapon.damage,life:Math.max(2,Math.ceil(d/(e.type===12?180:100))),total:Math.max(2,Math.ceil(d/100)),type:e.type===12?'sonic':e.type===7||e.type===16?'rocket':'bullet'});
  post(state,'fire','',{house:e.house,entity:e.id,x:e.x,y:e.y});return true;
}
function unitService(state,content,e) {
  if(!alive(e))return;
  const order=e.order??{type:'guard'};
  e.script.delay=Math.max(0,e.nextAction-state.tick);
  if(e.type===16&&(order.type==='harvest'||order.type==='return')){harvest(state,content,e);return;}
  if(order.type==='move'){
    if(moveToward(state,content,e,order.tile)){e.order={type:'guard',tile:order.tile,mode:'Guard'};e.target=null;}
    return;
  }
  if(order.type==='attack'){
    const target=state.entities.find(t=>t.id===order.target&&alive(t));
    if(!target){if(Number.isInteger(order.tile)&&!moveToward(state,content,e,order.tile))return;e.order={type:'guard',tile:entityTile(e)};return;}
    if(!fireAt(state,content,e,target)&&distance(e,target)>combatDefinition(content,e).range*256){
      const dest=entityTile(target);if(e.destination!==dest)e.path=[];moveToward(state,content,e,dest,true);
    }
    return;
  }
  const weapon=combatDefinition(content,e);
  if(weapon.damage===0)return;
  const aggro=order.type==='hunt'?64:order.mode==='Ambush'?weapon.range+1:weapon.sight+1;
  let target=closestEnemy(state,content,e,aggro,e.house===state.house);
  if(e.type===25)target=state.entities.filter(t=>alive(t)&&t.kind==='unit'&&t.type!==25&&![0,1,26].includes(t.type)&&state.map.terrain[entityTile(t)]!==2&&state.map.terrain[entityTile(t)]!==10).sort((a,b)=>distance(e,a)-distance(e,b)||a.id-b.id)[0];
  if(target){
    if(!fireAt(state,content,e,target)&&distance(e,target)>weapon.range*256&&(order.type==='hunt'||order.mode==='Area Guard'||e.type===25))moveToward(state,content,e,entityTile(target),true);
    else e.target=target.id;
  }else if(order.type==='hunt'&&e.house!==state.house&&state.tick>600){const base=home(state,state.house);if(base)moveToward(state,content,e,entityTile(base),true);}
}

function refreshHouseResources(state,content) {
  for(const h of state.houses){h.powerProduced=0;h.powerUsed=0;h.storage=1000;
    for(const e of state.entities)if(alive(e)&&e.house===h.id&&e.kind==='structure'){
      const def=typeDef(content,'structure',e.type),power=integer(def.power,e.type===9?-100:e.type===12?30:e.type===4?35:[8,14].includes(e.type)?0:10);
      if(power<0)h.powerProduced+=Math.floor(-power*e.hp/e.maxHp);else h.powerUsed+=power;
      h.storage+=integer(def.storage,e.type===12||e.type===17?1000:0);
    }
    h.power=h.powerProduced-h.powerUsed;
  }
}
function updateVisibility(state,content) {
  state.map.visible.fill(0);
  for(const e of state.entities)if(alive(e)&&allied(e.house,state.house)&&e.type!==25){
    const sight=combatDefinition(content,e).sight,px=e.x>>8,py=e.y>>8;
    // Building visibility surrounds its entire footprint, rather than treating
    // the anchor as the only occupied tile. Occlusion remains reconstructed.
    for(let y=py-sight;y<py+e.h+sight;y++)for(let x=px-sight;x<px+e.w+sight;x++){
      const dx=x<px?px-x:x>=px+e.w?x-(px+e.w-1):0,dy=y<py?py-y:y>=py+e.h?y-(py+e.h-1):0;
      if(dx*dx+dy*dy<=sight*sight&&x>=0&&x<64&&y>=0&&y<64){const id=tileId(x,y);state.map.visible[id]=1;state.map.seen[id]=1;}
    }
  }
}

const structureRequirements={2:[6],3:[9,12],4:[3],5:[3],6:[4],7:[9,12],9:[],10:[9,12],11:[4],12:[9],13:[4],14:[],15:[18],16:[6,18],17:[12],18:[9]};
const structureStage={0:1,1:2,2:8,3:2,4:3,5:4,6:5,7:2,8:99,9:1,10:2,11:6,12:1,13:5,14:2,15:4,16:6,17:1,18:2};
function producerTypes(unitType,content){
  const imported=content.structures?.filter(d=>d.produces?.includes(unitType)).map(d=>d.id??d.index)??[];
  return imported.length?imported:[0,1].includes(unitType)?[5]:[2,4].includes(unitType)?[10]:[3,5,6].includes(unitType)?[7]:[13,14,15].includes(unitType)?[3]:[4];
}
function unitStage(type){return [2,4,13,14,15].includes(type)?2:[3,5,9,16].includes(type)?3:[7,10,17].includes(type)?4:[0,1].includes(type)?5:7;}
export function canBuild(state,content,kind,type,house=state.house) {
  const def=typeDef(content,kind,type),h=state.houses[house];
  if(!def.name)return {ok:false,message:'Unknown object.'};
  if(!h)return {ok:false,message:'Unknown house.'};
  if(Number.isInteger(def.houseMask)&&(def.houseMask&(1<<house))===0)return {ok:false,message:'House-specific technology.'};
  if(state.outcome)return {ok:false,message:'Mission has ended.'};
  const buildings=state.entities.filter(e=>alive(e)&&e.kind==='structure'&&e.house===house),has=t=>buildings.some(e=>e.type===t);
  let producer;
  if(kind==='structure'){
    if(!has(8))return {ok:false,message:'Construction yard required.'};
    if(type===8)return {ok:false,message:'Deploy an MCV to establish a construction yard.'};
    if((structureStage[type]??1)>state.stage)return {ok:false,message:'Not available in this campaign stage.'};
    for(const req of structureRequirements[type]??[])if(!has(req))return {ok:false,message:`Requires ${typeDef(content,'structure',req).name}.`};
    if(state.production.some(p=>!p.cancelled&&p.house===house&&p.kind==='structure'))return {ok:false,message:'Complete or cancel the current construction.'};
  }else{
    if(type>17||type===6)return {ok:false,message:'Not available for normal production.'};
    if(type===12&&house!==1||type===8&&house!==2||type===11&&house!==0||type===14&&house!==2||type===13&&house===2)return {ok:false,message:'House-specific technology.'};
    if(unitStage(type)>state.stage)return {ok:false,message:'Not available in this campaign stage.'};
    const types=producerTypes(type,content);
    if(!types.some(has))return {ok:false,message:'Required unit factory is not operational.'};
    const free=buildings.find(e=>types.includes(e.type)&&!state.production.some(p=>!p.cancelled&&p.kind==='unit'&&p.producer===e.id));
    if(!free)return {ok:false,message:'All suitable factories are producing units.'};
    producer=free.id;
    const count=state.entities.filter(e=>alive(e)&&e.kind==='unit'&&e.house===house).length;
    if(count>=h.maxUnits)return {ok:false,message:'Unit limit reached.'};
  }
  if(h.credits<defCost(def))return {ok:false,message:'Insufficient credits.'};
  return {ok:true,message:'Available.',producer};
}
export function getBuildOptions(state,content,kind='structure') {
  return (kind==='unit'?content.units:content.structures).filter(d=>kind!=='unit'||(d.id??d.index)<18).map(d=>{
    const type=d.id??d.index,verdict=canBuild(state,content,kind,type);
    return {kind,type,name:d.name,cost:defCost(d),hp:defHP(d),enabled:verdict.ok,reason:verdict.message,producer:verdict.producer,total:Math.max(90,defBuild(d)*8)};
  });
}
export function canPlace(state,content,type,tile,house=state.house) {
  if(!Number.isInteger(tile)||tile<0||tile>=CELLS)return {ok:false,message:'Choose a tile on the battlefield.'};
  const p=tilePoint(tile),[w,h]=footprint(content,type);
  if(p.x+w>SIZE||p.y+h>SIZE)return {ok:false,message:'The footprint extends beyond the map.'};
  for(let y=p.y;y<p.y+h;y++)for(let x=p.x;x<p.x+w;x++){
    const id=tileId(x,y);
    if(house===state.house&&!state.map.seen[id])return {ok:false,message:'Explore the construction site first.'};
    if(![2,10].includes(state.map.terrain[id]))return {ok:false,message:'Structures require clear rock.'};
    if(structureAt(state,x,y))return {ok:false,message:'The construction site is occupied.'};
    if(state.entities.some(e=>alive(e)&&e.kind==='unit'&&(e.x>>8)===x&&(e.y>>8)===y))return {ok:false,message:'Move units away from the construction site.'};
  }
  const connected=state.entities.some(e=>alive(e)&&e.kind==='structure'&&e.house===house&&p.x<= (e.x>>8)+e.w+2&&p.x+w>= (e.x>>8)-2&&p.y<= (e.y>>8)+e.h+2&&p.y+h>= (e.y>>8)-2)
    || state.map.concrete.some((owner,id)=>{if(owner!==house)return false;const q=tilePoint(id);return q.x>=p.x-2&&q.x<=p.x+w+1&&q.y>=p.y-2&&q.y<=p.y+h+1;});
  if(!connected)return {ok:false,message:'Place next to your base or concrete.'};
  return {ok:true,message:'Construction site clear.'};
}

export function commandGame(state,content,command) {
  if(!command||typeof command.type!=='string')return {ok:false,message:'Invalid command.'};
  if(command.type==='setSpeed'){
    if(!Number.isInteger(command.value)||command.value<0||command.value>4)return {ok:false,message:'Speed must be 0–4.'};
    state.speed=command.value;return {ok:true,message:'Game speed changed.'};
  }
  if(command.type==='pause'){state.paused=command.value!==false;return {ok:true,message:state.paused?'Paused.':'Resumed.'};}
  if(state.outcome)return {ok:false,message:'Mission has ended.'};
  if(command.type==='build'){
    const kind=command.kind==='unit'?'unit':'structure',type=integer(command.objectType,-1),verdict=canBuild(state,content,kind,type);
    if(!verdict.ok)return verdict;
    const factory=state.entities.find(e=>alive(e)&&e.house===state.house&&e.kind==='structure'&&(kind==='structure'?e.type===8:producerTypes(type,content).includes(e.type)&&!state.production.some(p=>!p.cancelled&&p.kind==='unit'&&p.producer===e.id))&&(!command.producer||e.id===command.producer));
    if(!factory)return {ok:false,message:'Select an operational producer.'};
    if(state.production.some(p=>!p.cancelled&&p.kind==='unit'&&p.producer===factory.id))return {ok:false,message:'Factory is already producing a unit.'};
    const def=typeDef(content,kind,type),total=Math.max(90,defBuild(def)*8);
    state.houses[state.house].credits-=defCost(def);
    state.production.push({id:state.nextProduction++,house:state.house,kind,type,producer:factory.id,total,remaining:total,ready:false,cost:defCost(def)});
    post(state,'construction',`Construction started: ${def.name}.`,{house:state.house,entity:factory.id});
    recordCommand(state,command);return {ok:true,message:`Building ${def.name}.`};
  }
  if(command.type==='place'){
    const pending=state.production.find(p=>!p.cancelled&&p.house===state.house&&p.kind==='structure'&&p.ready);
    if(!pending)return {ok:false,message:'No structure is ready for placement.'};
    const verdict=canPlace(state,content,pending.type,command.tile);if(!verdict.ok)return verdict;
    markFootprint(state,content,pending.type,state.house,command.tile,pending.type<=1);
    let building=null;if(pending.type>1)building=spawn(state,content,'structure',pending.type,state.house,command.tile);
    state.production=state.production.filter(p=>p.id!==pending.id);
    if(pending.type===12)grantHarvester(state,content,state.house);
    refreshHouseResources(state,content);updateVisibility(state,content);
    post(state,'placed',`${typeDef(content,'structure',pending.type).name} operational.`,{house:state.house,entity:building?.id});
    recordCommand(state,command);return {ok:true,message:'Structure placed.'};
  }
  if(command.type==='cancelBuild'){
    const p=state.production.find(p=>p.house===state.house&&(!command.id||p.id===command.id));
    if(!p)return {ok:false,message:'No active construction.'};
    state.houses[state.house].credits+=Math.floor(p.cost*(p.ready?0.5:p.remaining/p.total));state.production=state.production.filter(q=>q.id!==p.id);
    recordCommand(state,command);return {ok:true,message:'Construction cancelled.'};
  }
  if(command.type==='repair'||command.type==='sell'){
    const e=state.entities.find(e=>e.id===command.id&&alive(e)&&e.house===state.house&&e.kind==='structure');
    if(!e)return {ok:false,message:'Select one of your structures.'};
    if(command.type==='repair'){
      if(e.hp>=e.maxHp)return {ok:false,message:'Structure is undamaged.'};
      e.repairing=!e.repairing;recordCommand(state,command);return {ok:true,message:e.repairing?'Repairing structure.':'Repair stopped.'};
    }
    state.houses[state.house].credits+=Math.floor(defCost(typeDef(content,e.kind,e.type))*e.hp/e.maxHp/2);e.hp=0;
    recordCommand(state,command);post(state,'sold','Structure sold.',{house:state.house,entity:e.id});return {ok:true,message:'Structure sold.'};
  }
  const ids=Array.isArray(command.ids)?command.ids:[command.id],units=state.entities.filter(e=>alive(e)&&e.kind==='unit'&&e.house===state.house&&ids.includes(e.id));
  if(!units.length)return {ok:false,message:'Select a unit first.'};
  if(!['move','attack','harvest','return','stop','guard','deploy'].includes(command.type))return {ok:false,message:'Unsupported order.'};
  if(['move','harvest'].includes(command.type)&&(!Number.isInteger(command.tile)||command.tile<0||command.tile>=CELLS))return {ok:false,message:'Choose a destination.'};
  if(command.type==='harvest'&&(!units.some(e=>e.type===16)||state.map.spice[command.tile]<=0))return {ok:false,message:'Select a harvester and target spice.'};
  const target=state.entities.find(e=>alive(e)&&e.id===command.target);
  if(command.type==='attack'&&!target&&!Number.isInteger(command.tile))return {ok:false,message:'Choose a hostile target.'};
  if(target&&command.type==='attack'&&allied(target.house,state.house)&&target.type!==25)return {ok:false,message:'That object belongs to an ally.'};
  if(target&&command.type==='attack'&&!state.map.visible[entityTile(target)])return {ok:false,message:'That target is outside your current vision.'};
  let applied=0;
  for(const e of units){
    if(command.type==='deploy'){
      if(e.type!==17)continue;
      const point=tilePoint(entityTile(e));let site=null;
      for(const [dx,dy]of [[0,0],[1,0],[0,1],[-1,0],[0,-1]]){const x=point.x+dx,y=point.y+dy;if(x<0||x>62||y<0||y>62)continue;
        if([[0,0],[1,0],[0,1],[1,1]].every(([xx,yy])=>[2,10].includes(state.map.terrain[tileId(x+xx,y+yy)])&&!structureAt(state,x+xx,y+yy))){site=tileId(x,y);break;}}
      if(site===null)continue;e.hp=0;spawn(state,content,'structure',8,state.house,site);applied++;continue;
    }
    if(command.type==='harvest'&&e.type!==16||command.type==='return'&&e.type!==16)continue;
    e.path=[];e.destination=null;e.target=null;
    if(command.type==='stop'||command.type==='guard')e.order={type:'guard',mode:'Guard',tile:entityTile(e)};
    else if(command.type==='harvest')e.order={type:'harvest',tile:command.tile,phase:'outbound'};
    else if(command.type==='return')e.order={type:'return',tile:e.order?.tile??null,phase:'return'};
    else if(command.type==='attack')e.order={type:'attack',target:target?.id??null,tile:command.tile??entityTile(target)};
    else e.order={type:'move',tile:command.tile};
    applied++;
  }
  if(!applied)return {ok:false,message:command.type==='deploy'?'MCV requires a clear rock footprint.':'No selected unit can perform this order.'};
  recordCommand(state,command);post(state,'order',`${command.type[0].toUpperCase()+command.type.slice(1)} order acknowledged.`,{house:state.house,entity:units[0].id});
  return {ok:true,message:'Order acknowledged.'};
}
function recordCommand(state,command) {
  state.commandLog.push({tick:state.tick,...JSON.parse(JSON.stringify(command))});
  if(state.commandLog.length>2000)state.commandLog.shift();
}

function productionService(state,content) {
  for(const p of state.production){
    const producer=state.entities.find(e=>alive(e)&&e.id===p.producer);if(!producer){p.cancelled=true;continue;}
    if(p.ready||p.cancelled)continue;
    const interval=speedAdjust(30,15,60,0,state.speed),lowPower=state.houses[p.house].power<0;
    if(state.tick%interval!==0)continue;
    p.remaining=Math.max(0,p.remaining-(lowPower?15:30));
    if(p.remaining===0){
      if(p.kind==='structure'){p.ready=true;post(state,'ready','Construction complete. Select a site.',{house:p.house});}
      else {const e=spawn(state,content,'unit',p.type,p.house,adjacentOpen(state,producer,{type:p.type,id:0}));p.cancelled=true;post(state,'arrival',`${typeDef(content,'unit',p.type).name} ready.`,{entity:e.id,house:p.house});}
    }
  }
  state.production=state.production.filter(p=>!p.cancelled);
  for(const e of state.entities)if(alive(e)&&e.kind==='structure'&&e.repairing&&state.tick%15===0){const h=state.houses[e.house];if(e.hp>=e.maxHp){e.repairing=false;continue;}if(h.credits>0){e.hp=Math.min(e.maxHp,e.hp+2);h.credits--;}}
}
function teamService(state,content) {
  for(const team of state.teams)if(state.tick>=team.nextTick){team.nextTick=state.tick+5+(randomByte(state)&7);team.script.delay=team.nextTick-state.tick;}
  if(state.tick%300!==0)return;
  for(const h of state.houses)if(h.id!==state.house&&h.active&&h.brain==='CPU'){
    for(const e of state.entities)if(alive(e)&&e.house===h.id&&e.kind==='unit'&&e.type!==16&&e.type!==25&&state.tick>1800&&e.order.mode!=='Ambush')e.order.type='hunt';
    if(state.tick%1800!==0)continue;
    const factory=state.entities.find(e=>alive(e)&&e.house===h.id&&e.kind==='structure'&&[3,4,7,10].includes(e.type));
    if(factory&&state.entities.filter(e=>alive(e)&&e.house===h.id&&e.kind==='unit').length<h.maxUnits){
      const type=factory.type===4?9:factory.type===3?(h.id===2?14:13):factory.type===7?5:4,def=typeDef(content,'unit',type);
      if(h.credits>=defCost(def)&&!state.production.some(p=>p.producer===factory.id)){h.credits-=defCost(def);const total=defBuild(def)*8;state.production.push({id:state.nextProduction++,house:h.id,kind:'unit',type,producer:factory.id,total,remaining:total,ready:false,cost:defCost(def)});}
    }
  }
  for(const r of state.reinforcements)if(r.type>=0&&r.house>=0&&state.tick>=r.tick){
    const base=home(state,r.house),p=base?tilePoint(entityTile(base)):{x:32,y:2};
    const tile=r.where==='Homebase'||r.where==='Enemybase'?tileId(clamp(p.x+3,1,62),clamp(p.y+3,1,62)):r.where==='Top'?tileId(32,1):r.where==='Bottom'?tileId(32,62):r.where==='Left'?tileId(1,32):r.where==='Right'?tileId(62,32):tileId(p.x,p.y);
    const e=spawn(state,content,'unit',r.type,r.house,tile,256,r.house===state.house?'Guard':'Hunt');
    if(r.house===state.house)post(state,'reinforcement','Reinforcements have arrived.',{entity:e.id,house:r.house});
    r.tick=r.repeat?r.tick+Math.max(300,r.interval):Number.MAX_SAFE_INTEGER;
  }
}
function projectileService(state,content) {
  for(const p of state.projectiles){
    const target=state.entities.find(e=>e.id===p.target&&alive(e));
    if(target){const c=center(target);p.tx=c.x;p.ty=c.y;}
    p.life--;const f=1/Math.max(1,p.life+1);p.x=Math.round(p.x+(p.tx-p.x)*f);p.y=Math.round(p.y+(p.ty-p.y)*f);
    if(p.life<=0&&target){const attacker=state.entities.find(e=>e.id===p.source)??{house:p.house};applyDamage(state,content,target,p.damage,attacker);}
  }
  state.projectiles=state.projectiles.filter(p=>p.life>0);
  state.effects=state.effects.filter(e=>state.tick-e.tick<e.life);
}
export function evaluateObjectives(state) {
  if(state.tick<state.scenario.grace)return null;
  const h=state.houses[state.house],buildings=state.entities.filter(e=>alive(e)&&e.kind==='structure');
  const endPlayer=buildings.filter(e=>e.house===state.house&&![15,16].includes(e.type)).length;
  const endEnemy=buildings.filter(e=>e.house!==state.house&&![15,16].includes(e.type)).length;
  const winPlayer=buildings.filter(e=>e.house===state.house&&![14,15,16].includes(e.type)).length;
  const winEnemy=buildings.filter(e=>e.house!==state.house&&![14,15,16].includes(e.type)).length;
  const quota=h.displayCredits!==65535&&h.quota<=h.displayCredits;
  const before=state.tick<state.scenario.deadline,m=state.scenario.endMask,w=state.scenario.winMask;
  const end=!!((m&1)&&endEnemy===0||(m&2)&&endPlayer===0||(m&4)&&quota||(m&8)&&before);
  if(!end)return null;
  let win=(w&3)!==0;if(w&1)win=win&&winEnemy===0;if(w&2)win=win&&winPlayer!==0;if((w&4)&&!win)win=quota;if(w&8)win=win&&before;
  return win?'victory':'defeat';
}
function finish(state,content,outcome) {
  state.outcome=outcome;
  const retained=state.entities.filter(e=>alive(e)&&e.house===state.house&&e.kind==='structure').reduce((v,e)=>v+Math.floor(defCost(typeDef(content,e.kind,e.type))/100),0);
  state.result={outcome,ticks:state.tick,minutes:Math.floor(state.tick/3600)+1,credits:state.houses[state.house].credits,delivered:state.delivered,kills:state.kills,losses:state.losses,
    score:Math.max(0,state.score)+retained+Math.floor(state.houses[state.house].credits/100)+Math.max(0,45*state.stage-Math.floor(state.tick/3600))};
  post(state,'outcome',outcome==='victory'?'Mission accomplished.':'Mission failed.',{house:state.house});
}
export function tickGame(state,content,count=1) {
  const ticks=clamp(integer(count,1),0,216000);
  for(let i=0;i<ticks;i++){
    state.uiTick++;
    if(state.paused||state.outcome)continue;
    state.tick++;
    // The recovered loop invokes teams, units, structures, houses, viewport.
    teamService(state,content);
    const unitInterval=speedAdjust(4,2,8,0,state.speed);
    if(state.tick%unitInterval===0)for(const e of state.entities)if(e.kind==='unit')unitService(state,content,e);
    productionService(state,content);
    if(state.tick%6===0){
      for(const h of state.houses){const delta=h.credits-h.displayCredits;h.displayCredits+=Math.sign(delta)*Math.min(Math.abs(delta),Math.max(1,Math.floor(Math.abs(delta)/8)));}
    }
    if(state.tick%60===0)refreshHouseResources(state,content);
    if(state.tick%15===0)updateVisibility(state,content);
    if(state.tick%15===0)for(const e of state.entities)if(alive(e)&&e.kind==='structure'&&[15,16].includes(e.type)){const enemy=closestEnemy(state,content,e,combatDefinition(content,e).range,e.house===state.house);if(enemy)fireAt(state,content,e,enemy);}
    projectileService(state,content);
    if(state.tick>state.scenario.nextPoll){state.scenario.nextPoll=state.tick+300;const outcome=evaluateObjectives(state);if(outcome)finish(state,content,outcome);}
  }
  return state;
}

export function validateSave(candidate,content) {
  try{
    const s=candidate?.state??candidate;
    if(!s||s.version!==VERSION||!content.scenarios?.some(d=>d.id===s.scenarioId))return false;
    const finiteInt=v=>Number.isSafeInteger(v);
    const counter=v=>finiteInt(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
    const validTile=v=>v===null||(finiteInt(v)&&v>=0&&v<CELLS);
    if(!finiteInt(s.tick)||s.tick<0||s.tick>0x7fffffff||!finiteInt(s.uiTick)||s.uiTick<0||!finiteInt(s.house)||s.house<0||s.house>5||!finiteInt(s.speed)||s.speed<0||s.speed>4)return false;
    if(!finiteInt(s.stage)||s.stage<1||s.stage>9||!counter(s.delivered)||!counter(s.kills)||!counter(s.losses)||!Number.isFinite(s.score))return false;
    if(typeof s.paused!=='boolean'||![null,'victory','defeat'].includes(s.outcome))return false;
    for(const field of ['terrain','spice','seen','visible','concrete','blooms']){
      const a=s.map?.[field];if(!Array.isArray(a)||a.length!==CELLS||!a.every(finiteInt))return false;
    }
    if(!s.map.terrain.every(v=>v>=0&&v<=10)||!s.map.spice.every(v=>v>=0&&v<=65535)||!s.map.seen.every(v=>v===0||v===1)||!s.map.visible.every(v=>v===0||v===1)||!s.map.concrete.every(v=>v>=-1&&v<=5)||!s.map.blooms.every(v=>v===0||v===1))return false;
    if(!Array.isArray(s.houses)||s.houses.length!==6||!s.houses.every((h,i)=>h.id===i&&finiteInt(h.credits)&&h.credits>=0&&h.credits<=65535&&finiteInt(h.displayCredits)&&h.displayCredits>=0&&h.displayCredits<=65535&&finiteInt(h.quota)&&h.quota>=0&&h.quota<=65535))return false;
    if(!Array.isArray(s.entities)||s.entities.length>2000||!Array.isArray(s.production)||s.production.length>128||!Array.isArray(s.projectiles)||s.projectiles.length>4096)return false;
    const ids=new Set();for(const e of s.entities){
      if(!finiteInt(e.id)||e.id<=0||ids.has(e.id)||!['unit','structure'].includes(e.kind))return false;ids.add(e.id);
      if(!finiteInt(e.type)||!typeDef(content,e.kind,e.type).name||!finiteInt(e.house)||e.house<0||e.house>5||!finiteInt(e.x)||!finiteInt(e.y)||e.x<0||e.y<0||e.x>=16384||e.y>=16384||!finiteInt(e.hp)||!finiteInt(e.maxHp)||e.hp<0||e.hp>65535||e.maxHp<=0||e.maxHp>65535)return false;
      if(!finiteInt(e.cargo)||e.cargo<0||e.cargo>100||!e.order||typeof e.order.type!=='string'||!Array.isArray(e.path)||e.path.length>14||!e.path.every(v=>finiteInt(v)&&v>=0&&v<CELLS))return false;
      if(!finiteInt(e.w)||!finiteInt(e.h)||e.w<1||e.h<1||e.w>4||e.h>4||!finiteInt(e.facing)||e.facing<0||e.facing>255)return false;
      if(!['move','guard','attack','harvest','return','hunt'].includes(e.order.type)||!validTile(e.order.tile??null)||!validTile(e.destination))return false;
      if(e.order.target!=null&&(!finiteInt(e.order.target)||e.order.target<=0))return false;
      if(!counter(e.nextAction)||!counter(e.nextFire)||!counter(e.nextMove)||!finiteInt(e.moveRemainder)||e.moveRemainder<0||e.moveRemainder>255)return false;
      if(!e.script||!['UNIT','BUILD'].includes(e.script.program)||!counter(e.script.entry)||!counter(e.script.ip)||!counter(e.script.delay)||e.script.mode!=='native-reconstruction')return false;
    }
    if(!finiteInt(s.nextId)||s.nextId<=Math.max(0,...ids)||!finiteInt(s.nextEvent)||!finiteInt(s.nextProjectile)||!finiteInt(s.nextProduction)||!s.scenario||!finiteInt(s.scenario.nextPoll)||!finiteInt(s.scenario.grace)||!finiteInt(s.scenario.endMask)||!finiteInt(s.scenario.winMask))return false;
    if(!s.rng||!finiteInt(s.rng.lcg)||s.rng.lcg<0||s.rng.lcg>0xffffffff||!Array.isArray(s.rng.bytes)||s.rng.bytes.length!==3||!s.rng.bytes.every(v=>finiteInt(v)&&v>=0&&v<=255))return false;
    if(!Array.isArray(s.events)||s.events.length>80||!Array.isArray(s.effects)||s.effects.length>4096||!Array.isArray(s.reinforcements)||s.reinforcements.length>256||!Array.isArray(s.teams)||s.teams.length>100||!Array.isArray(s.commandLog)||s.commandLog.length>2000)return false;
    for(const key of ['grace','poll','nextPoll','deadline','timeout'])if(!counter(s.scenario[key]))return false;
    for(const event of s.events)if(!event||!counter(event.id)||!counter(event.tick)||typeof event.type!=='string'||typeof event.message!=='string'||event.message.length>1024)return false;
    for(const effect of s.effects)if(!effect||!counter(effect.tick)||!counter(effect.life)||!finiteInt(effect.x)||!finiteInt(effect.y)||effect.life>10000)return false;
    for(const r of s.reinforcements)if(!r||!finiteInt(r.house)||r.house<0||r.house>5||!typeDef(content,'unit',r.type).name||typeof r.where!=='string'||r.where.length>40||!counter(r.tick)||!counter(r.interval)||typeof r.repeat!=='boolean')return false;
    for(const team of s.teams)if(!team||!counter(team.id)||!counter(team.nextTick)||!Array.isArray(team.fields)||team.fields.length>10||!team.fields.every(v=>typeof v==='string')||!team.script||team.script.mode!=='native-reconstruction')return false;
    for(const p of s.production)if(!finiteInt(p.id)||!finiteInt(p.house)||p.house<0||p.house>5||!['unit','structure'].includes(p.kind)||!typeDef(content,p.kind,p.type).name||!finiteInt(p.remaining)||!finiteInt(p.total)||p.total<1||p.remaining<0||p.remaining>p.total||typeof p.ready!=='boolean'||!ids.has(p.producer))return false;
    for(const p of s.projectiles)if(!finiteInt(p.id)||!finiteInt(p.life)||p.life<0||p.life>10000||!finiteInt(p.x)||!finiteInt(p.y)||!finiteInt(p.damage)||p.damage<0||p.damage>65535)return false;
    return true;
  }catch{return false;}
}

export function snapshotGame(state) { return JSON.parse(JSON.stringify(state)); }
