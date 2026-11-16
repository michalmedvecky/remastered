import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TappyEngine, INITIAL_LIVES, INITIAL_TIME, UNDO_LIMIT} from '../dist/tappy-engine.js';

const original = JSON.parse(readFileSync(new URL('../dist/levels.json', import.meta.url), 'utf8'));
const at = (x, y) => ({halfX: x, halfY: y});
function level(overrides = {}) {
  return {
    number: 1,
    brickMasks: Array.from({length: 10}, () => `1${'0'.repeat(38)}1`),
    player: at(1, 18), egg: at(20, 18), goalPlate: at(33, 20),
    rocks: [], ghosts: [], frogs: [], mushrooms: [], ...overrides,
  };
}
const game = overrides => new TappyEngine([level(overrides)]);
function state(engine) {
  const {events, ...world} = engine.serialize();
  return {...world, randomSeed: engine.randomSeed, fireCooldown: engine.fireCooldown,
    deathTicks: engine.deathTicks, retryCause: engine.retryCause};
}

test('Tappy starts at room 1 and retains all 200 original rooms and object coordinates', () => {
  const engine = new TappyEngine(original);
  assert.equal(engine.stage, 1);
  assert.equal(engine.levels.length, 200);
  assert.equal(engine.canUndo, false);
  engine.reset(9);
  assert.deepEqual([engine.player.x, engine.player.y], [1, 0]);
  assert.deepEqual([engine.objects[0].x, engine.objects[0].y], [23, 0]);
  assert.deepEqual(engine.goal, {x: 33, y: 20});
  assert.equal(engine.objects.length, 7);
  assert.equal(engine.enemies.length, 4);
  assert.equal(engine.mushrooms.length, 6);
});

test('more than 1500 world ticks cannot expire the timer or spend a life', () => {
  const engine = game();
  for (let i = 0; i < INITIAL_TIME + 501; i++) engine.step({}, {record: false});
  assert.equal(engine.ticks, INITIAL_TIME + 501);
  assert.equal(engine.status, 'playing');
  assert.equal(engine.time, INITIAL_TIME);
  assert.equal(engine.lives, INITIAL_LIVES);
  assert.equal(engine.canUndo, false);
  engine.time = 0;
  engine.step({}, {record: false});
  assert.equal(engine.status, 'playing');
  assert.equal(engine.time, INITIAL_TIME);
});

test('a falling egg causes a gentle frozen bump; undo restores the whole prior decision', () => {
  const engine = game({player: at(10, 10), egg: at(10, 8)});
  const before = state(engine);
  engine.step({dy: -1});
  assert.equal(engine.status, 'bumped');
  assert.equal(engine.retryCause, 'crush');
  assert.equal(engine.lives, INITIAL_LIVES);
  assert.equal(engine.time, INITIAL_TIME);
  assert.equal(engine.deathTicks, 0);
  assert.ok(engine.events.some(event => event.type === 'bump' && event.cause === 'crush'));
  assert.ok(!engine.events.some(event => event.type === 'death'));
  const frozen = state(engine);
  for (let i = 0; i < 30; i++) engine.step({dx: 1, fire: true});
  assert.deepEqual(state(engine), frozen);
  assert.equal(engine.undo(), true);
  assert.deepEqual(state(engine), before);
  assert.equal(engine.retryCause, null);
  assert.equal(engine.canUndo, false);
  assert.deepEqual(engine.events, [{type: 'undo', stage: 1}]);
  engine.step({dy: -1});
  assert.equal(engine.status, 'bumped');
  assert.equal(engine.lives, INITIAL_LIVES);
});

test('an idle hazard before any input can be undone, without idle history spam', () => {
  const engine = game({player: at(10, 10), egg: at(10, 8)});
  engine.step();
  assert.equal(engine.status, 'bumped');
  assert.equal(engine.undo(), true);
  assert.equal(engine.status, 'playing');
  assert.equal(engine.ticks, 0);
  assert.equal(engine.undo(), false);

  const safe = game();
  for (let i = 0; i < 100; i++) safe.step();
  assert.equal(safe.undo(), true);
  assert.equal(safe.ticks, 0);
  assert.equal(safe.undo(), false);
});

test('undo restores enemy RNG and motion, making replay of a decision deterministic', () => {
  const engine = game({frogs: [at(30, 4)]});
  engine.step({dy: -1});
  const before = state(engine);
  engine.step({dy: -1});
  const after = state(engine);
  assert.notEqual(after.randomSeed, before.randomSeed);
  assert.notDeepEqual(after.enemies, before.enemies);
  assert.equal(engine.undo(), true);
  assert.deepEqual(state(engine), before);
  engine.step({dy: -1});
  assert.deepEqual(state(engine), after);
});

test('undo restores collected mushrooms, ammunition, active projectiles and cooldowns', () => {
  const engine = game({player: at(5, 18), egg: at(30, 18), mushrooms: [at(5, 18)]});
  engine.step();
  assert.equal(engine.ammo, 1);
  const collected = state(engine);
  engine.step({dx: 1, fire: true});
  assert.equal(engine.ammo, 0);
  assert.equal(engine.shots.length, 1);
  assert.equal(engine.fireCooldown, 4);
  const fired = state(engine);
  engine.step({dx: 1});
  assert.equal(engine.fireCooldown, 3);
  assert.notEqual(engine.shots[0].x, fired.shots[0].x);
  assert.equal(engine.undo(), true);
  assert.deepEqual(state(engine), fired);
  assert.equal(engine.undo(), true);
  assert.deepEqual(state(engine), collected);
  assert.equal(engine.undo(), true);
  assert.equal(engine.ammo, 0);
  assert.equal(engine.mushrooms[0].alive, true);
});

test('undo can leave a completed room and resume the exact state before winning', () => {
  const engine = game({egg: at(33, 18)});
  const before = state(engine);
  engine.step({dx: 1});
  assert.equal(engine.status, 'won');
  assert.ok(engine.events.some(event => event.type === 'win'));
  assert.equal(engine.undo(), true);
  assert.deepEqual(state(engine), before);
  assert.equal(engine.status, 'playing');
});

test('restart and stage advance clear undo history and retry cause', () => {
  const engine = new TappyEngine([level({egg: at(33, 18)}), level({number: 2})]);
  engine.step({dx: 1});
  assert.equal(engine.status, 'won');
  assert.equal(engine.canUndo, true);
  assert.equal(engine.advance(), true);
  assert.equal(engine.stage, 2);
  assert.equal(engine.canUndo, false);
  assert.equal(engine.undo(), false);
  engine.step({dx: 1});
  engine.die('enemy');
  assert.equal(engine.retryCause, 'enemy');
  engine.reset(2, {lives: 0});
  assert.equal(engine.status, 'playing');
  assert.equal(engine.retryCause, null);
  assert.equal(engine.lives, INITIAL_LIVES);
  assert.equal(engine.time, INITIAL_TIME);
  assert.equal(engine.ticks, 0);
  assert.equal(engine.canUndo, false);
});

test('history keeps the last 80 decisions and a non-recorded tick adds none', () => {
  const engine = game({player: at(1, 0)});
  for (let i = 0; i < UNDO_LIMIT + 10; i++) engine.step({dx: i % 2 ? -1 : 1});
  let restored = 0;
  while (engine.undo()) restored++;
  assert.equal(restored, UNDO_LIMIT);
  assert.equal(engine.ticks, 10);
  assert.equal(engine.canUndo, false);
  engine.step({dx: 1}, {record: false});
  assert.equal(engine.canUndo, false);
});

test('the original stage 9 physics solution still works with Tappy', () => {
  const engine = new TappyEngine(original, 9);
  engine.reset(9, {enemies: false});
  const route = 'RRRRRRRRURRRRRRRRRRRRDDDDRRDDRRRRRRRRUURRUUUULLLLRRRRDDDDRRDDDDDDDDDLLLLLLLLUUUULLLLUULLUUUURRRRUUUUUUURRDDDDDDDDLLDRRDDDDDRRDDUDDDRRDDR';
  const directions = {R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1]};
  for (const action of route) {
    const [dx, dy] = directions[action];
    engine.step({dx, dy});
    assert.notEqual(engine.status, 'bumped');
  }
  assert.equal(engine.status, 'won');
  assert.deepEqual([engine.objects[0].x, engine.objects[0].y], [33, 18]);
  assert.deepEqual(engine.brickMasks, original.levels[8].brickMasks);
  assert.equal(engine.lives, INITIAL_LIVES);
  assert.equal(engine.time, INITIAL_TIME);
});
