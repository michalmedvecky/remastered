/* GPL-2.0-or-later. Native ADL bytecode and Nuked OPL run on the audio thread. */
class DuneADLProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const instance = new WebAssembly.Instance(options.processorOptions.module, {
      env: { emscripten_notify_memory_growth() {} }
    });
    this.native = instance.exports;
    this.native._initialize();
    this.native.adl_init(sampleRate);
    this.frames = 0;
    this.lastPlaying = false;
    this.generation = 0;
    this.port.onmessage = ({ data }) => {
      try {
        if (data.type === 'load') {
          const bytes = new Uint8Array(data.bank);
          const pointer = this.native.malloc(bytes.length);
          if (!pointer) throw new Error('ADL bank allocation failed');
          new Uint8Array(this.native.memory.buffer, pointer, bytes.length).set(bytes);
          let ok;
          try { ok = this.native.adl_load(pointer, bytes.length, data.track, data.volume); }
          finally { this.native.free(pointer); }
          this.generation = data.generation;
          if (!ok) throw new Error(`Invalid ADL track ${data.track}`);
          this.port.postMessage({ type: 'loaded', generation: this.generation });
        } else if (data.type === 'stop') {
          this.native.adl_stop();
          this.generation = data.generation;
        } else if (data.type === 'effect') {
          this.native.adl_effect(data.track, data.volume);
        } else if (data.type === 'fade') {
          // Westwood version-3 bank entry 1 is the original fade program.
          this.native.adl_effect(1, 255);
        }
      } catch (error) {
        this.port.postMessage({ type: 'error', message: error.message, generation: data.generation });
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output?.length) return true;
    const count = output[0].length;
    this.native.adl_render(count);
    const samples = new Int16Array(this.native.memory.buffer, this.native.adl_output(), count * 2);
    for (let channel = 0; channel < output.length; channel++) {
      const target = output[channel];
      for (let i = 0; i < count; i++) target[i] = samples[i * 2 + Math.min(channel, 1)] / 32768;
    }
    this.frames += count;
    if (this.frames >= sampleRate / 20) {
      this.frames = 0;
      const playing = !!this.native.adl_playing();
      this.lastPlaying = playing;
      this.port.postMessage({ type: 'status', playing, generation: this.generation,
        ticks: this.native.adl_ticks(), writes: this.native.adl_writes(), sampleRate });
    }
    return true;
  }
}
registerProcessor('dune-adl', DuneADLProcessor);
