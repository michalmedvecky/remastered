import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClock} from '../dist/native-clock.mjs';
test('browser clock excludes hidden time and remains monotonic',()=>{let time=100;const clock=createClock(()=>time);time=200;assert.equal(clock.now(),100);clock.visibility(true);time=30000;assert.equal(clock.now(),100);clock.visibility(true);clock.visibility(false);time=30025;assert.equal(clock.now(),125);time=30020;assert.equal(clock.now(),125);clock.visibility(false);time=30030;assert.equal(clock.now(),130);});
