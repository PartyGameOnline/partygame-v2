"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameEngine } from "./GameEngine";
import type { GameSpec, SyncAdapter } from "./types";

/** メモリアダプタ（デモ用） */
class MemoryAdapter<S, _E> implements SyncAdapter<S, _E> {
  private store = new Map<string, S>();
  private subs = new Map<string, Set<(s: S) => void>>();

  async load(roomCode: string): Promise<S | undefined> {
    return this.store.get(roomCode);
  }
  async save(roomCode: string, state: S): Promise<void> {
    this.store.set(roomCode, state);
    const set = this.subs.get(roomCode);
    if (set) for (const cb of set) cb(state);
  }
  subscribe(roomCode: string, cb: (s: S) => void): () => void {
    let set = this.subs.get(roomCode);
    if (!set) {
      set = new Set();
      this.subs.set(roomCode, set);
    }
    set.add(cb);
    return () => set!.delete(cb);
  }
}

type UseGameOpts<S, E> = {
  roomCode?: string;
  adapter?: SyncAdapter<S, E>;
  saveDebounceMs?: number;
};

export function useGame<S, E>(spec: GameSpec<S, E>, opts?: UseGameOpts<S, E>) {
  const { roomCode, adapter, saveDebounceMs = 120 } = opts ?? {};

  const effectiveAdapter = useMemo(() => adapter ?? new MemoryAdapter<S, E>(), [adapter]);

  const engineRef = useRef<GameEngine<S, E> | null>(null);
  if (engineRef.current === null) engineRef.current = new GameEngine<S, E>(spec);
  const engine = engineRef.current;

  const [state, setState] = useState<Readonly<S>>(engine.getState());

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(
    (s: Readonly<S>) => {
      if (!roomCode) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void effectiveAdapter.save(roomCode, s as S);
      }, saveDebounceMs);
    },
    [roomCode, effectiveAdapter, saveDebounceMs]
  );

  useEffect(() => {
    if (!roomCode) return;
    let alive = true;
    let unsub = () => {};

    (async () => {
      const remote = await effectiveAdapter.load(roomCode);
      if (!alive) return;
      if (remote !== undefined) {
        engine.replaceState(remote);
      } else {
        await effectiveAdapter.save(roomCode, engine.getState() as S);
      }
      unsub = effectiveAdapter.subscribe(roomCode, (incoming: S) => {
        engine.replaceState(incoming);
      });
    })();

    return () => {
      alive = false;
      unsub();
    };
  }, [roomCode, effectiveAdapter, engine]);

  useEffect(() => {
    return engine.subscribe((s) => {
      setState(s);
      scheduleSave(s);
    });
  }, [engine, scheduleSave]);

  return {
    state,
    dispatch: (e: E) => engine.dispatch(e),
    replaceState: (s: S) => engine.replaceState(s),
    engine,
  };
}
