import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createMusic } from '../dist/music/player.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('production ADL matches original DOS score, SFX and bounded fade register goldens', () => {
  execFileSync('python3', ['fidelity/music/test-opl.py'], { cwd: root, timeout: 30000 });
  const report = JSON.parse(fs.readFileSync(new URL('../fidelity/music/test-results.json', import.meta.url)));
  assert.equal(report.status, 'passed');
  assert.deepEqual(report.cases.map(c => c.events), [2325, 943, 1380]);
  assert.deepEqual(report.introCases.map(c => c.events), [700, 3237]);
  assert.ok(report.cases.every(c => c.fadePrefixEvents === 60));
});

test('native ADL renders every original music mapping with stable timing, SFX and fade', () => {
  execFileSync(process.execPath, ['native/music/test-render.mjs'], { cwd: root, timeout: 30000 });
  const report = JSON.parse(fs.readFileSync(new URL('../native/music/test-results.json', import.meta.url)));
  assert.equal(report.status, 'passed');
  assert.equal(report.originalBanksHashVerified, 21);
  assert.equal(report.renderedTracks, 37);
  assert.equal(report.presentTracks, 34);
  assert.deepEqual(report.absentTracks, [23, 35, 37]);
  assert.equal(report.blockSizeInvariantAt48000, true);
  assert.equal(report.sameDriverSoundEffectTest, true);
  assert.equal(report.originalFadeProgramTest, true);
});

test('browser music prefetch preserves native same-stack play/effect/fade ordering', async () => {
  const priorFetch = globalThis.fetch;
  const priorNode = globalThis.AudioWorkletNode;
  const fetched = [];
  const nodes = [];
  const errors = [];
  const parameter = { value: 0, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value; } };
  const context = { state: 'running', sampleRate: 48000, currentTime: 0,
    audioWorklet: { async addModule() {} }, destination: {},
    createGain() { return { gain: parameter, connect() { return this; }, disconnect() {} }; },
    async resume() {} };
  globalThis.fetch = async url => {
    fetched.push(String(url));
    return new Response(fs.readFileSync(fileURLToPath(url)));
  };
  globalThis.AudioWorkletNode = class {
    constructor() {
      this.messages = [];
      this.port = { postMessage: message => this.messages.push(message) };
      nodes.push(this);
    }
    connect() { return this; }
    disconnect() {}
  };
  let player;
  try {
    player = await createMusic({ context, onError: error => errors.push(error.message) });
    assert.equal(fetched.filter(url => url.endsWith('.ADL')).length, 21);
    assert.equal(player.diagnostics().prefetchedBanks, 21);
    assert.equal(player.play('DUNE1', 2), true);
    assert.equal(player.effect('DUNE1.C55', 57, 255), true);
    player.fade(2000);
    assert.deepEqual(nodes[0].messages.map(message => message.type), ['load', 'effect', 'fade']);
    assert.equal(player.play('DUNE2', 6), true);
    const oldGeneration = player.diagnostics().generation;
    assert.equal(player.play('', 0), true);
    assert.equal(player.isPlaying(), false);
    nodes[0].port.onmessage({ data: { type: 'status', generation: oldGeneration, playing: true } });
    assert.equal(player.isPlaying(), false);
    assert.equal(player.effect('', 57), false);
    assert.deepEqual(errors, []);
  } finally {
    player?.dispose();
    globalThis.fetch = priorFetch;
    globalThis.AudioWorkletNode = priorNode;
  }
});
