"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameEngine } from "./GameEngine";
import type { GameSpec, SyncAdapter } from "./types";
import { devLog, devError } from "./logger";

class MemoryAdapter<S, _E> implements SyncAdapter<S, _E> {
  private store = new Map<string, S>();
  private subs = new Map<string, Set<(s: S) => void>>();

  async load(roomCode: string) {
    return this.store.get(roomCode);
  }

  async save(roomCode: string, state: S) {
    this.store.set(roomCode, state);
    this.subs.get(roomCode)?.forEach((cb) => cb(state));
  }

  subscribe(roomCode: string, cb: (s: S) => void) {
    let set = this.subs.get(roomCode);
    if (!set) this.subs.set(roomCode, (set = new Set()));
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) this.subs.delete(roomCode);
    };
  }
}

type UseGameOpts<S, E> = {
  roomCode?: string;
  adapter?: SyncAdapter<S, E>;
  saveDebounceMs?: number;
};

export function useGame<S, E>(spec: GameSpec<S, E>, opts: UseGameOpts<S, E> = {}) {
  const { roomCode, adapter, saveDebounceMs = 150 } = opts;

  const effectiveAdapter = useMemo<SyncAdapter<S, E>>(
    () => adapter ?? new MemoryAdapter<S, E>(),
    [adapter]
  );

  // spec固定前提（変更しない設計）
  const engineRef = useRef<GameEngine<S, E> | null>(null);
  if (engineRef.current === null) engineRef.current = new GameEngine<S, E>(spec);
  const engine = engineRef.current;

  const [state, setState] = useState<Readonly<S>>(engine.getState());

  // 初回同期完了フラグ（load→(必要ならsave)→subscribe開始まで false）
  const hydratedRef = useRef(false);

  // リモートからの state 適用中フラグ（この間は save を抑止）
  const applyingRemoteRef = useRef(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // アンマウント時にタイマー停止
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, []);

  const scheduleSave = useCallback(
    (s: Readonly<S>) => {
      if (!roomCode) return;

      // 初回同期完了まで保存しない（上書き事故防止）
      if (!hydratedRef.current) return;

      // リモート反映中は保存しない（更新リレー防止）
      if (applyingRemoteRef.current) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        devLog("[RT] save()");
        void effectiveAdapter.save(roomCode, s as S).catch((e) => devError("[RT] save failed", e));
      }, saveDebounceMs);
    },
    [roomCode, effectiveAdapter, saveDebounceMs]
  );

  // Engine -> React（更新のたび保存をスケジュール）
  useEffect(() => {
    return engine.subscribe((s) => {
      setState(s);
      scheduleSave(s);
    });
  }, [engine, scheduleSave]);

  // リモート同期（初回 load / 無ければ upsert / subscribe）
  useEffect(() => {
    if (!roomCode) return;

    let alive = true;
    let unsubRemote: (() => void) | undefined;

    hydratedRef.current = false;

    (async () => {
      try {
        const remote = await effectiveAdapter.load(roomCode);
        if (!alive) return;

        if (remote !== undefined) {
          devLog("[RT] load -> replaceState");
          applyingRemoteRef.current = true;
          try {
            engine.replaceState(remote);
          } finally {
            applyingRemoteRef.current = false;
          }
        } else {
          devLog("[RT] no row -> upsert initial");
          await effectiveAdapter.save(roomCode, engine.getState() as S);
        }

        hydratedRef.current = true;

        unsubRemote = effectiveAdapter.subscribe(roomCode, (incoming: S) => {
          if (!alive) return;
          devLog("[RT] incoming -> replaceState");
          applyingRemoteRef.current = true;
          try {
            engine.replaceState(incoming);
          } finally {
            applyingRemoteRef.current = false;
          }
        });
      } catch (e) {
        devError("[RT] sync error", e);
        // 失敗時も「hydrated=true」にしない（事故防止のため）
      }
    })();

    return () => {
      alive = false;
      hydratedRef.current = false;
      if (unsubRemote) unsubRemote();
    };
  }, [roomCode, effectiveAdapter, engine]);

  const dispatch = useCallback((e: E) => engine.dispatch(e), [engine]);

  return {
    state,
    dispatch,
    replaceState: (s: S) => engine.replaceState(s),
    engine,
  };
}
