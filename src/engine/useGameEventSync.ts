"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "./GameEngine";
import type { EventSyncAdapter, GameSpec, RemoteEventEnvelope } from "./types";

type UseGameEventOpts<E> = {
  roomCode: string;
  adapter: EventSyncAdapter<E>;
};

export function useGameEventSync<S, E>(spec: GameSpec<S, E>, opts: UseGameEventOpts<E>) {
  const { roomCode, adapter } = opts;

  const engineRef = useRef<GameEngine<S, E> | null>(null);
  if (engineRef.current === null) engineRef.current = new GameEngine<S, E>(spec);
  const engine = engineRef.current;

  const [state, setState] = useState<Readonly<S>>(engine.getState());

  // 最後に適用したDBイベントID（取りこぼし復旧に使う）
  const lastAppliedIdRef = useRef<number>(0);

  // 同一eventIdを二重適用しないための簡易ガード（念のため）
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  // Engine -> React
  useEffect(() => {
    return engine.subscribe((s) => setState(s));
  }, [engine]);

  // Remote -> Engine（subscribe + catch-up）
  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;

    const apply = (env: RemoteEventEnvelope<E>) => {
      // 自己エコーは無視（adapter側で弾けるが二重防御）
      if (env.clientId === adapter.getClientId()) return;

      if (seenEventIdsRef.current.has(env.eventId)) return;
      seenEventIdsRef.current.add(env.eventId);

      // 古い/重複（idが戻るケース）を弾く
      if (env.id <= lastAppliedIdRef.current) return;

      lastAppliedIdRef.current = env.id;
      engine.dispatch(env.event);
    };

    (async () => {
      try {
        // 1) まず catch-up（subscribe 前後の取りこぼしも拾えるように）
        const missed = await adapter.loadAfter(roomCode, lastAppliedIdRef.current);
        if (!alive) return;
        for (const env of missed) apply(env);

        // 2) subscribe
        unsub = adapter.subscribe(roomCode, (env) => {
          if (!alive) return;
          apply(env);
        });

        // 3) subscribe開始直後にもう一回 catch-up（ごく短いレース対策）
        const missed2 = await adapter.loadAfter(roomCode, lastAppliedIdRef.current);
        if (!alive) return;
        for (const env of missed2) apply(env);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, [roomCode, adapter, engine]);

  // Local dispatch（ローカル適用→publish）
  const dispatch = useCallback(
    (e: E) => {
      // 体感遅延を無くすためローカルは即適用
      engine.dispatch(e);
      void adapter.publish(roomCode, e).catch(console.error);
    },
    [engine, adapter, roomCode]
  );

  return { state, dispatch, engine };
}
