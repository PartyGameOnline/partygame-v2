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

  const myClientIdRef = useRef<string>(adapter.getClientId());

  // 部屋ごとの lastApplied を保持(部屋移動/HotReloadに強くする)
  const lastAppliedByRoomRef = useRef<Map<string, number>>(new Map());
  const lastAppliedIdRef = useRef<number>(0);

  // Engine -> React
  useEffect(() => {
    return engine.subscribe((s) => setState(s));
  }, [engine]);

  // ★重要：roomCodeが変わったら「必ず」復元/リセットする（Fast Refresh対策）
  useEffect(() => {
    const last = lastAppliedByRoomRef.current.get(roomCode) ?? 0;
    lastAppliedIdRef.current = last;
  }, [roomCode]);

  // Remote -> Engine（subscribe + catch-up）
  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;

    const apply = (env: RemoteEventEnvelope<E>) => {
      if (env.clientId === myClientIdRef.current) return;

      // ここを追加（重要）
      console.log("[HOOK] apply", { id: env.id, event: env.event });

      if (env.id < lastAppliedIdRef.current) {
        lastAppliedIdRef.current = 0;
        lastAppliedByRoomRef.current.set(roomCode, 0);
      }
      if (env.id <= lastAppliedIdRef.current) return;

      lastAppliedIdRef.current = env.id;
      lastAppliedByRoomRef.current.set(roomCode, env.id);

      engine.dispatch(env.event);
    };

    (async () => {
      try {
        // 1) catch-up
        const missed = await adapter.loadAfter(roomCode, lastAppliedIdRef.current);
        if (!alive) return;
        for (const env of missed) apply(env);

        // 2) subscribe
        unsub = adapter.subscribe(roomCode, (env) => {
          if (!alive) return;
          apply(env);
        });

        // 3) subscribe直後にもう一回catch-up
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

  // Local dispatch（ローカル即適用→publish）
  const dispatch = useCallback(
    (e: E) => {
      engine.dispatch(e);
      void adapter.publish(roomCode, e).catch(console.error);
    },
    [engine, adapter, roomCode]
  );

  return { state, dispatch, engine };
}
