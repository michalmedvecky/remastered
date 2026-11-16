import { FlappyEngine, DEFAULT_STAGE, INITIAL_LIVES, INITIAL_TIME } from './engine.js';

export * from './engine.js';
export const UNDO_LIMIT = 80;

// Keep the shared level data outside checkpoints: only a running room changes.
const CHECKPOINT_FIELDS = [
  'stage', 'brickMasks', 'options', 'lives', 'time', 'moves', 'ammo', 'ticks',
  'status', 'deathTicks', 'fireCooldown', 'randomSeed', 'player', 'goal',
  'objects', 'enemies', 'mushrooms', 'shots', '_retryCause',
];

export class TappyEngine extends FlappyEngine {
  constructor(levels, stage = DEFAULT_STAGE) {
    super(levels, stage);
  }

  // FlappyEngine's constructor calls this override before our constructor returns.
  reset(stage = this.stage ?? DEFAULT_STAGE, options = {}) {
    super.reset(stage, {...options, keepLives: false, lives: INITIAL_LIVES});
    this._history = [];
    this._retryCause = null;
    return this;
  }

  get canUndo() {
    return (this._history?.length ?? 0) > 0;
  }

  get retryCause() {
    return this._retryCause;
  }

  checkpoint() {
    return structuredClone(Object.fromEntries(CHECKPOINT_FIELDS.map(key => [key, this[key]])));
  }

  step(input = {}, {record = true} = {}) {
    if (this.status !== 'playing') {
      this.events = [];
      return this;
    }

    const actionable = Boolean(Number(input.dx) || Number(input.dy) || input.fire);
    // One initial checkpoint also protects a child from a hazard before their
    // first decision in real-time play. Further idle ticks never add history.
    if (record && (actionable || (this.ticks === 0 && !this.canUndo))) {
      this._history.push(this.checkpoint());
      if (this._history.length > UNDO_LIMIT) this._history.shift();
    }

    // The unchanged parent decrements once at the beginning of a tick. Supplying
    // one extra unit prevents its timeout branch, even after unlimited ticks.
    this.time = INITIAL_TIME + 1;
    try {
      super.step(input);
    } finally {
      this.time = INITIAL_TIME;
      this.lives = INITIAL_LIVES;
    }
    return this;
  }

  die(cause) {
    if (this.status !== 'playing') return this;
    this.status = 'bumped';
    this._retryCause = cause;
    this.deathTicks = 0;
    this.events.push({type: 'bump', cause, x: this.player.x, y: this.player.y});
    return this;
  }

  undo() {
    if (!this.canUndo) return false;
    const checkpoint = this._history.pop();
    Object.assign(this, checkpoint);
    this.level = this.levels.find(level => level.number === this.stage);
    // Previous effects should not play again after restoring a decision.
    this.events = [{type: 'undo', stage: this.stage}];
    return true;
  }
}
