import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveBoardGesture} from '../dist/gestures.js';

const player = {x:19,y:9}; // Logical chick center: (520,308).
const fixtures = [
  {name:'native size',rect:{left:10,top:20,width:1040,height:600},origin:{x:10,y:20},scale:1},
  {name:'half size',rect:{left:5,top:9,width:520,height:300},origin:{x:5,y:9},scale:.5},
  {name:'double size',rect:{left:7,top:11,width:2080,height:1200},origin:{x:7,y:11},scale:2},
  {name:'fractional size and position',rect:{left:13.25,top:22.5,width:780,height:450},origin:{x:13.25,y:22.5},scale:.75},
  {name:'letterbox above and below',rect:{left:20,top:40,width:520,height:500},origin:{x:20,y:140},scale:.5},
  {name:'letterbox left and right',rect:{left:100,top:50,width:900,height:300},origin:{x:290,y:50},scale:.5},
];
const client = (fixture, x, y) => ({x:fixture.origin.x + x*fixture.scale,y:fixture.origin.y + y*fixture.scale});
const tap = (fixture,x,y,at=player) => {
  const point=client(fixture,x,y);
  return resolveBoardGesture(point,point,fixture.rect,at);
};

test('taps choose all four directions at different scales and both letterbox orientations', () => {
  for (const fixture of fixtures) {
    for (const [x,y,expected] of [[800,308,'right'],[200,308,'left'],[520,120,'up'],[520,500,'down']]) {
      assert.equal(tap(fixture,x,y),expected,fixture.name);
    }
  }
});

test('tap direction uses the chick position, not the canvas center', () => {
  const fixture=fixtures[0];
  const cornerPlayer={x:2,y:3}; // Chick center (112,164).
  assert.equal(tap(fixture,200,164,cornerPlayer),'right');
  assert.equal(tap(fixture,112,240,cornerPlayer),'down');
  assert.equal(tap(fixture,50,164,cornerPlayer),'left');
  assert.equal(tap(fixture,112,80,cornerPlayer),'up');
  assert.equal(tap(fixture,180,240,cornerPlayer),'down','larger vertical distance wins');
  assert.equal(tap(fixture,240,210,cornerPlayer),'right','larger horizontal distance wins');
});

test('the entire chick body is a24 logical pixel dead zone on both axes', () => {
  for (const fixture of fixtures) {
    for (const [dx,dy] of [[0,0],[24,0],[-24,0],[0,24],[0,-24],[24,24],[-24,-24]]) {
      assert.equal(tap(fixture,520+dx,308+dy),null,`${fixture.name}: ${dx},${dy}`);
    }
    assert.equal(tap(fixture,545,332),'right',fixture.name);
    assert.equal(tap(fixture,544,333),'down',fixture.name);
    assert.equal(tap(fixture,495,284),'left',fixture.name);
  }
});

test('tap jitter uses the final location and the dominant CSS displacement threshold', () => {
  const fixture=fixtures[0];
  const start=client(fixture,500,110);
  const end={x:start.x+17,y:start.y+17};
  assert.equal(resolveBoardGesture(start,end,fixture.rect,player),'up','17/17 diagonal remains a tap despite its longer Euclidean distance');
  const right=client(fixture,800,308);
  assert.equal(resolveBoardGesture(right,{x:right.x-17.999,y:right.y},fixture.rect,player),'right');
  assert.equal(resolveBoardGesture(right,{x:right.x-18,y:right.y},fixture.rect,player),'left','exactly18 CSS pixels is a swipe');
});

test('swipes follow movement rather than the chick and may use all canvas margins', () => {
  const fixture=fixtures[0];
  for (const [from,to,expected] of [
    [[400,20],[430,20],'right'],
    [[400,590],[370,590],'left'],
    [[10,200],[10,170],'up'],
    [[1030,200],[1030,230],'down'],
    [[800,300],[780,281],'left'],
    [[200,300],[219,320],'down'],
  ]) {
    assert.equal(resolveBoardGesture(client(fixture,...from),client(fixture,...to),fixture.rect,player),expected);
  }
});

test('swipe distance is18 CSS pixels independent of canvas scale or letterboxing', () => {
  for (const fixture of fixtures) {
    const start=client(fixture,800,308);
    assert.equal(resolveBoardGesture(start,{x:start.x-18,y:start.y},fixture.rect,player),'left',fixture.name);
    assert.equal(resolveBoardGesture(start,{x:start.x-17,y:start.y},fixture.rect,player),'right',fixture.name);
  }
});

test('diagonal ties consistently choose the horizontal direction', () => {
  const fixture=fixtures[0];
  assert.equal(tap(fixture,600,388),'right');
  assert.equal(tap(fixture,440,228),'left');
  assert.equal(resolveBoardGesture(client(fixture,400,200),client(fixture,420,220),fixture.rect,player),'right');
});

test('taps outside the board are ignored even when inside canvas content', () => {
  for (const fixture of fixtures) {
    for (const [x,y] of [[39,308],[1001,308],[520,67],[520,549],[0,0],[1040,600]]) {
      assert.equal(tap(fixture,x,y),null,`${fixture.name}: ${x},${y}`);
    }
    assert.equal(tap(fixture,40,308),'left','board boundary belongs to the board');
    assert.equal(tap(fixture,1000,308),'right');
    assert.equal(tap(fixture,520,68),'up');
    assert.equal(tap(fixture,520,548),'down');
  }
});

test('short movement across a board boundary does not turn a margin touch into a tap', () => {
  const fixture=fixtures[0];
  assert.equal(resolveBoardGesture(client(fixture,39,308),client(fixture,41,308),fixture.rect,player),null);
  assert.equal(resolveBoardGesture(client(fixture,41,308),client(fixture,39,308),fixture.rect,player),null);
});

test('both swipe endpoints must remain in the rendered content, excluding CSS letterboxes', () => {
  const vertical=fixtures[4];
  const horizontal=fixtures[5];
  for (const [fixture,from,to] of [
    [vertical,{x:250,y:100},{x:250,y:200}],
    [vertical,{x:250,y:200},{x:250,y:480}],
    [horizontal,{x:200,y:150},{x:500,y:150}],
    [horizontal,{x:500,y:150},{x:900,y:150}],
  ]) {
    assert.equal(resolveBoardGesture(from,to,fixture.rect,player),null,fixture.name);
  }
  assert.equal(resolveBoardGesture({x:250,y:100},{x:250,y:100},vertical.rect,player),null,'tap in the upper letterbox');
  assert.equal(resolveBoardGesture({x:250,y:480},{x:250,y:480},vertical.rect,player),null,'tap in the lower letterbox');
  assert.equal(resolveBoardGesture({x:200,y:150},{x:200,y:150},horizontal.rect,player),null,'tap in the left letterbox');
  assert.equal(resolveBoardGesture({x:900,y:150},{x:900,y:150},horizontal.rect,player),null,'tap in the right letterbox');
  const fixture=fixtures[0];
  assert.equal(resolveBoardGesture(client(fixture,-1,200),client(fixture,100,200),fixture.rect,player),null);
  assert.equal(resolveBoardGesture(client(fixture,100,200),client(fixture,1041,200),fixture.rect,player),null);
});

test('zero or invalid bounds and malformed points return null without throwing', () => {
  const fixture=fixtures[0];
  const point=client(fixture,800,308);
  for (const rect of [null,{}, {...fixture.rect,width:0},{...fixture.rect,height:0},{...fixture.rect,width:-1},{...fixture.rect,height:Infinity},{...fixture.rect,left:NaN},{...fixture.rect,top:'20'}]) {
    assert.equal(resolveBoardGesture(point,point,rect,player),null);
  }
  for (const invalid of [null,undefined,{}, {x:NaN,y:1},{x:1,y:Infinity},{x:'1',y:2}]) {
    assert.equal(resolveBoardGesture(invalid,point,fixture.rect,player),null);
    assert.equal(resolveBoardGesture(point,invalid,fixture.rect,player),null);
    assert.equal(resolveBoardGesture(point,point,fixture.rect,invalid),null);
  }
});
