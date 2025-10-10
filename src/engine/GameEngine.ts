import type { EngineListener, GameSpec } from "./types";

export class GameEngine<S, E> {
  private state: S;
  private listeners = new Set<EngineListener<S>>();
  private readonly spec: GameSpec<S, E>;

  constructor(spec: GameSpec<S, E>, initial?: S) {
    this.spec = spec;
    this.state = initial ?? spec.initialState();
    this.assertValid(this.state);
  }

  getState(): Readonly<S> {
    return this.state;
  }

  replaceState(next: S): void {
    this.assertValid(next);
    this.state = next;
    this.emit();
  }

  dispatch(event: E): void {
    const next = this.spec.reduce(this.state, event);
    this.assertValid(next);
    this.state = next;
    this.emit();
  }

  subscribe(fn: EngineListener<S>): () => void {
    this.listeners.add(fn);
    try {
      fn(this.state);
    } catch (_err) {
      void 0;
    }
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of Array.from(this.listeners)) {
      try {
        fn(this.state);
      } catch (_err) {
        continue;
      }
    }
  }

  private assertValid(s: S) {
    if (this.spec.validate) this.spec.validate(s);
  }
}

export default GameEngine;
