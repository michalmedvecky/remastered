/* GPL-2.0-or-later. Original ADL data, Westwood interpreter and Nuked OPL. */
export async function createMusic({ onError = console.error, context: suppliedContext } = {}) {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context && !suppliedContext) throw new Error('Web Audio is unavailable');
  const context = suppliedContext || new Context({ latencyHint: 'interactive' });
  const [module, , loadedBanks] = await Promise.all([
    fetch(new URL('./adl.wasm', import.meta.url)).then(async response => {
      if (!response.ok) throw new Error(`Could not load ADL renderer (${response.status})`);
      return WebAssembly.compile(await response.arrayBuffer());
    }),
    context.audioWorklet.addModule(new URL('./worklet.mjs', import.meta.url)),
    // Native callbacks load banks synchronously and may fire an effect or fade
    // in the same call stack. Preload all ~245 KB before entering that core.
    Promise.all(Array.from({ length: 21 }, async (_, index) => {
      const name = `DUNE${index}`;
      const response = await fetch(new URL(`./banks/${name}.ADL`, import.meta.url));
      if (!response.ok) throw new Error(`Could not load ${name}.ADL (${response.status})`);
      return [name, await response.arrayBuffer()];
    }))
  ]);
  const node = new AudioWorkletNode(context, 'dune-adl', {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { module }
  });
  const gain = context.createGain();
  let volume = 0.6;
  gain.gain.value = volume;
  node.connect(gain).connect(context.destination);
  const banks = new Map(loadedBanks);
  let playing = false, currentBank = null, generation = 0, fadeTimer, currentTrack = null;
  let lastError = null, loaded = false, lastStatus = {};

  const report = error => {
    lastError = error instanceof Error ? error.message : String(error);
    onError?.(error instanceof Error ? error : new Error(String(error)));
  };
  node.port.onmessage = ({ data }) => {
    if (data.generation !== undefined && data.generation !== generation) return;
    if (data.type === 'status') { playing = data.playing; lastStatus = { ...data }; }
    if (data.type === 'loaded') loaded = true;
    if (data.type === 'error') { playing = false; report(data.message); }
  };
  node.onprocessorerror = () => { playing = false; report('The ADL audio processor stopped'); };

  function bankName(base) {
    const name = String(base).toUpperCase().replace(/\.(?:ADL|C55|XMI)$/, '');
    if (!/^DUNE(?:[0-9]|1[0-9]|20)$/.test(name)) throw new Error(`Unknown ADL bank ${base}`);
    return name;
  }
  function resetGain() {
    clearTimeout(fadeTimer);
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setValueAtTime(volume, context.currentTime);
  }
  function stop() {
    generation++;
    playing = false;
    resetGain();
    node.port.postMessage({ type: 'stop', generation });
  }
  async function resume() {
    if (context.state === 'suspended') await context.resume();
  }
  function play(base, index, trackVolume = 255) {
    // Music ID zero has a NULL bank in the original table and means stop.
    if (!base) { stop(); return true; }
    const command = ++generation;
    try {
      const name = bankName(base);
      if (!Number.isInteger(index) || index < 0 || index >= 120) throw new Error(`Invalid ADL track ${index}`);
      resetGain();
      playing = true;
      loaded = false;
      lastError = null;
      const source = banks.get(name);
      if (!source) throw new Error(`ADL bank ${name} was not prefetched`);
      currentBank = name;
      currentTrack = index;
      const bank = source.slice(0);
      node.port.postMessage({ type: 'load', bank, track: index,
        volume: Math.max(0, Math.min(255, Math.round(trackVolume))), generation }, [bank]);
      // The game calls resume from user gestures too; a blocked automatic
      // resume leaves this queued track ready for that first gesture.
      resume().catch(() => {});
      return true;
    } catch (error) {
      if (command === generation) playing = false;
      report(error);
      return false;
    }
  }
  function fade(milliseconds = 1000) {
    clearTimeout(fadeTimer);
    if (!playing) return;
    node.port.postMessage({ type: 'fade' });
    // The original ADL program controls its envelope and completion. The
    // caller's timeout is retained only as a bounded recovery fallback.
    const command = generation;
    fadeTimer = setTimeout(() => { if (command === generation) stop(); }, Math.max(4000, Number(milliseconds) || 0));
  }
  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    resetGain();
  }
  function effect(base, index, effectVolume = 255) {
    try {
      if (!base) return false;
      if (bankName(base) !== currentBank) return false;
      node.port.postMessage({ type: 'effect', track: index,
        volume: Math.max(0, Math.min(255, Math.round(effectVolume))) });
      return true;
    } catch (error) { report(error); return false; }
  }
  return { play, stop, fade, isPlaying: () => playing, setVolume, resume, effect,
    diagnostics: () => ({ context: context.state, sampleRate: context.sampleRate, playing,
      bank: currentBank, track: currentTrack, loaded, generation, volume, lastError,
      ticks: lastStatus.ticks || 0, registerWrites: lastStatus.writes || 0, prefetchedBanks: banks.size }),
    context, dispose() { stop(); node.disconnect(); gain.disconnect(); if (!suppliedContext) context.close(); } };
}
