import type {
  CommitOptions, GameDef, GameView, Hint, Rng, SettingsLike, SoundLike, ViewHost,
} from './types';
import { applyScore, breakStreak, newScoreState, stars, winBonus, type ScoreState } from './score';
import { createRng, randomSeed } from './rng';

export type Outcome = 'playing' | 'won' | 'lost';

export interface SessionEvents<S> {
  onRender(state: S, session: Session<S>): void;
  onScore(delta: number, event: 'advanced' | 'broken' | 'unchanged'): void;
  onOutcome(outcome: Exclude<Outcome, 'playing'>, summary: RoundSummary): void;
}

export interface RoundSummary {
  readonly score: number;
  readonly moves: number;
  readonly seconds: number;
  readonly stars: number;
  readonly isBest: boolean;
}

export interface SavedRound {
  readonly gameId: string;
  readonly difficulty: string | undefined;
  readonly seed: number;
  readonly state: unknown;
  readonly score: ScoreState;
  readonly moves: number;
  readonly seconds: number;
}

/**
 * Owns everything a game must not: the undo stack, the derived score, the
 * streak, the clock, the save file and the win/loss decision.
 *
 * A game only ever describes itself. That is what makes `score += n`
 * unrepresentable rather than merely discouraged.
 */
export class Session<S> implements ViewHost<S> {
  readonly def: GameDef<S>;
  readonly difficulty: string | undefined;
  readonly seed: number;

  state: S;
  score: ScoreState;
  moves = 0;
  outcome: Outcome = 'playing';

  /** state and score snapshot together, so undo hands a broken streak back */
  private undoStack: Array<{ state: string; score: ScoreState; moves: number }> = [];
  private elapsed = 0;
  private startedAt = 0;
  private running = false;

  constructor(
    def: GameDef<S>,
    private readonly deps: {
      sound: SoundLike;
      settings: SettingsLike;
      events: SessionEvents<S>;
      toast(message: string): void;
      readBest(key: string): number;
      writeBest(key: string, value: number): void;
      save(round: SavedRound | null): void;
    },
    options: { difficulty?: string; seed?: number; restore?: SavedRound } = {},
  ) {
    this.def = def;
    this.difficulty = options.difficulty;

    if (options.restore) {
      this.seed = options.restore.seed;
      this.state = options.restore.state as S;
      this.score = options.restore.score;
      this.moves = options.restore.moves;
      this.elapsed = options.restore.seconds;
    } else {
      this.seed = options.seed ?? randomSeed();
      const rng: Rng = createRng(this.seed);
      this.state = def.create(rng, options.difficulty);
      this.score = newScoreState(def.score(this.state));
    }
  }

  get sound(): SoundLike { return this.deps.sound; }
  get settings(): SettingsLike { return this.deps.settings; }

  toast(message: string): void { this.deps.toast(message); }

  get seconds(): number {
    return Math.floor(this.elapsed + (this.running ? (Date.now() - this.startedAt) / 1000 : 0));
  }

  get canUndo(): boolean { return this.def.canUndo && this.undoStack.length > 0; }

  get bestKey(): string {
    return this.difficulty ? `${this.def.id}:${this.difficulty}` : this.def.id;
  }

  startClock(): void {
    if (this.running || this.outcome !== 'playing') return;
    this.running = true;
    this.startedAt = Date.now();
  }

  stopClock(): void {
    if (!this.running) return;
    this.elapsed += (Date.now() - this.startedAt) / 1000;
    this.running = false;
  }

  commit(mutate: (draft: S) => void, opts: CommitOptions = {}): void {
    if (this.outcome !== 'playing') return;

    const undoable = opts.undoable ?? true;
    if (undoable && this.def.canUndo) {
      this.undoStack.push({
        state: JSON.stringify(this.state),
        score: { ...this.score },
        moves: this.moves,
      });
      if (this.undoStack.length > 400) this.undoStack.shift();
    }

    mutate(this.state);

    if (!opts.free) {
      this.moves++;
      this.startClock();
    }

    const update = applyScore(this.score, this.def.score(this.state));
    this.score = update.state;

    this.persist();
    this.deps.events.onRender(this.state, this);
    this.deps.events.onScore(update.delta, update.event);

    this.checkOutcome();
  }

  /** Used by the hint button: help costs the streak. */
  penaliseForHint(): Hint | null {
    const hint = this.def.hint(this.state);
    if (!hint) return null;
    const update = breakStreak(this.score);
    if (update.event === 'broken') {
      this.score = update.state;
      this.deps.events.onScore(0, 'broken');
      this.deps.events.onRender(this.state, this);
      this.persist();
    }
    return hint;
  }

  undo(): boolean {
    const snapshot = this.undoStack.pop();
    if (snapshot === undefined) return false;
    this.state = JSON.parse(snapshot.state) as S;
    this.score = snapshot.score;   // restores the streak too: another shot at it
    this.moves = snapshot.moves;
    this.persist();
    this.deps.events.onRender(this.state, this);
    return true;
  }

  private persist(): void {
    this.deps.save({
      gameId: this.def.id,
      difficulty: this.difficulty,
      seed: this.seed,
      state: this.state,
      score: this.score,
      moves: this.moves,
      seconds: this.seconds,
    });
  }

  private checkOutcome(): void {
    if (this.def.isWon(this.state)) return this.finish('won');
    if (this.def.isLost?.(this.state)) return this.finish('lost');
  }

  private finish(outcome: Exclude<Outcome, 'playing'>): void {
    this.stopClock();
    this.outcome = outcome;

    const par = this.def.par(this.difficulty);
    if (outcome === 'won') {
      this.score = {
        ...this.score,
        bonus: this.score.bonus + winBonus(par, this.moves, this.seconds),
      };
      this.score.total = this.def.score(this.state) + this.score.bonus;
    }

    const previousBest = this.deps.readBest(this.bestKey);
    const isBest = this.score.total > previousBest;
    if (isBest) this.deps.writeBest(this.bestKey, this.score.total);

    this.deps.save(null); // a finished round is not resumable

    this.deps.events.onOutcome(outcome, {
      score: this.score.total,
      moves: this.moves,
      seconds: this.seconds,
      stars: outcome === 'won' ? stars(par, this.moves, this.seconds) : 0,
      isBest,
    });
  }
}

export type { GameView };
