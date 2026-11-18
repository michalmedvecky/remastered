import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../..');
const bytes = fs.readFileSync(path.join(web, 'dist/music/adl.wasm'));
const module = await WebAssembly.compile(bytes);
const tracks = JSON.parse(fs.readFileSync(path.join(here, 'tracks.json')));
const banks = JSON.parse(fs.readFileSync(path.join(here, 'banks.json')));
for (const bank of banks) {
  const payload = fs.readFileSync(path.join(web, 'dist/music/banks', bank.name));
  assert.equal(crypto.createHash('sha256').update(payload).digest('hex'), bank.sha256);
}

function renderer(rate = 44100) {
  const native = new WebAssembly.Instance(module, { env: { emscripten_notify_memory_growth() {} } }).exports;
  native._initialize();
  assert.equal(native.adl_init(rate), 1);
  return native;
}

function load(native, bank, track) {
  const data = fs.readFileSync(path.join(web, 'dist/music/banks', `${bank}.ADL`));
  const pointer = native.malloc(data.length);
  new Uint8Array(native.memory.buffer, pointer, data.length).set(data);
  const status = native.adl_load(pointer, data.length, track, 255);
  native.free(pointer);
  return status;
}

function render(native, samples, chunks = [1024]) {
  const hash = crypto.createHash('sha256');
  let total = 0, energy = 0, peak = 0, nonzero = 0, chunk = 0;
  while (total < samples) {
    const count = Math.min(chunks[chunk++ % chunks.length], samples - total);
    assert.equal(native.adl_render(count), count);
    const pcm = new Int16Array(native.memory.buffer, native.adl_output(), count * 2);
    hash.update(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
    for (const sample of pcm) {
      energy += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      if (sample) nonzero++;
    }
    total += count;
  }
  return { pcmSha256: hash.digest('hex'), rms: Math.sqrt(energy / samples / 2), peak,
    nonzero, ticks: native.adl_ticks(), registerWrites: native.adl_writes(), playing: !!native.adl_playing() };
}

const results = [];
for (const track of tracks.filter(track => track.bank)) {
  const native = renderer();
  const loaded = load(native, track.bank, track.track);
  assert.ok(loaded === 1 || loaded === 2);
  const result = render(native, 44100 * 8);
  assert.equal(result.ticks, 576);
  if (loaded === 1) assert.ok(result.nonzero > 0, `Music ${track.music_id} unexpectedly silent`);
  else assert.equal(result.nonzero, 0);
  native.adl_stop();
  assert.equal(native.adl_playing(), 0);
  results.push({ ...track, presentInADL: loaded === 1, ...result });
}

// The rational 72 Hz clock must be independent of audio callback block size.
const one = renderer(48000), two = renderer(48000);
assert.equal(load(one, 'DUNE1', 2), 1);
assert.equal(load(two, 'DUNE1', 2), 1);
const first = render(one, 48000 * 5, [128]);
const second = render(two, 48000 * 5, [1, 333, 4096, 127, 256]);
assert.equal(first.pcmSha256, second.pcmSha256);
assert.equal(first.ticks, 360);
assert.equal(first.registerWrites, second.registerWrites);

// Original SFX programs share the driver and OPL channels with music.
assert.equal(one.adl_effect(57, 255), 1);
const effect = render(one, 48000);
assert.ok(effect.registerWrites > first.registerWrites);

// Bank entry 1 contains Westwood's original fade program, not a host gain ramp.
const fading = renderer();
assert.equal(load(fading, 'DUNE1', 2), 1);
render(fading, 44100);
assert.equal(fading.adl_effect(1, 255), 1);
const fadeResult = render(fading, 44100 * 4);
assert.equal(fading.adl_playing(), 0);

const report = { status: 'passed', originalBanksHashVerified: banks.length,
  musicTableEntries: tracks.length, renderedTracks: results.length,
  presentTracks: results.filter(x => x.presentInADL).length,
  absentTracks: results.filter(x => !x.presentInADL).map(x => x.music_id),
  renderedSecondsPerTrack: 8, clockHz: 72, blockSizeInvariantAt48000: true,
  sameDriverSoundEffectTest: true, originalFadeProgramTest: true,
  limits: 'Executes newly compiled ADL reconstruction and resource scores; no original DOS executable or original driver machine code. Audio output has not been compared to captured original hardware.',
  tracks: results };
fs.writeFileSync(path.join(here, 'test-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, tracks: undefined }, null, 2));
