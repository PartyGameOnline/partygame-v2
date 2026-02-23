"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameEngine } from "./GameEngine";
import type { EventSyncAdapter, GameSpec, RemoteEventEnvelope, SnapshotAdapter } from "./types";

/** 開発時のみデバッグログを出す（本番は無音） */
const DEBUG_SYNC = process.env.NODE_ENV !== "production";

/** 重複排除用の簡易LRU Set */
class LruSet {
  private map = new Map<string, true>();
  constructor(private readonly capacity: number) {}

  has(k: string) {
    return this.map.has(k);
  }

  add(k: string) {
    if (this.map.has(k)) {
      this.map.delete(k);
      this.map.set(k, true);
      return;
    }
    this.map.set(k, true);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest) this.map.delete(oldest);
    }
  }

  clear() {
    this.map.clear();
  }
}

type UseGameEventSyncOpts<E, S> = {
  roomCode?: string;
  adapter: EventSyncAdapter<E>;

  /** bigint安全: "0" 推奨 */
  initialAfterId?: string;

  dedupeCapacity?: number;

  /**
   * publish後に即ローカル適用するか。
   * 整合性優先(推奨)なら false。
   */
  optimistic?: boolean;

  /** catchUp 1回の最大件数（ページング単位） */
  pageLimit?: number;

  /** Snapshot対応（Room全体Stateを渡す想定） */
  snapshotAdapter?: SnapshotAdapter<S>;

  /**
   * クライアント側でNイベントごとにスナップショット保存
   * 0 なら無効。
   */
  snapshotEveryNEvents?: number;
};

type DispatchResult = { published: true } | { published: false; reason: "no-room" };

function toBig(id: string) {
  if (!id) return BigInt(0);
  return BigInt(id);
}

export function useGameEventSync<S, E>(spec: GameSpec<S, E>, opts: UseGameEventSyncOpts<E, S>) {
  const {
    roomCode,
    adapter: eventAdapter,
    initialAfterId = "0",
    dedupeCapacity = 2000,
    optimistic = false,
    pageLimit = 500,
    snapshotAdapter,
    // ★本番デフォルト：100
    snapshotEveryNEvents = 100,
  } = opts;

  // spec固定前提（変更しない設計）
  const engineRef = useRef<GameEngine<S, E> | null>(null);
  if (engineRef.current === null) engineRef.current = new GameEngine<S, E>(spec);
  const engine = engineRef.current;

  const [state, setState] = useState<Readonly<S>>(engine.getState());
  const [hydrated, setHydrated] = useState(false);

  const lastIdRef = useRef<string>(initialAfterId);
  const seenRef = useRef(new LruSet(dedupeCapacity));
  const fetchingRef = useRef(false);

  // スナップショット間引き用（適用イベント数）
  const appliedCountRef = useRef(0);

  const clientId = useMemo(() => eventAdapter.getClientId(), [eventAdapter]);

  // Engine -> React
  useEffect(() => engine.subscribe(setState), [engine]);

  const maybeSaveSnapshot = useCallback(
    (room: string, lastEventId: string) => {
      if (!snapshotAdapter) return;
      if (!snapshotEveryNEvents || snapshotEveryNEvents <= 0) return;

      appliedCountRef.current++;
      const count = appliedCountRef.current;

      if (count % snapshotEveryNEvents !== 0) return;

      void snapshotAdapter
        .saveSnapshot(room, lastEventId, engine.getState() as S)
        .catch((e) => console.error("[snapshot] save failed", e));
    },
    [snapshotAdapter, snapshotEveryNEvents, engine]
  );

  const applyEnvelope = useCallback(
    (env: RemoteEventEnvelope<E>) => {
      if (seenRef.current.has(env.eventId)) return;

      const envId = toBig(env.id);
      const lastId = toBig(lastIdRef.current);

      // 古い/同じ id は捨てる（dedupe目的でeventIdだけ記録）
      if (envId <= lastId) {
        seenRef.current.add(env.eventId);
        return;
      }

      engine.dispatch(env.event);

      lastIdRef.current = env.id;
      seenRef.current.add(env.eventId);

      // snapshot（保存先roomCodeはopts.roomCodeで固定）
      if (roomCode) maybeSaveSnapshot(roomCode, env.id);
    },
    [engine, maybeSaveSnapshot, roomCode]
  );

  const catchUp = useCallback(
    async (room: string) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        while (true) {
          const after = lastIdRef.current;
          const list = await eventAdapter.loadAfter(room, after, pageLimit);
          if (list.length === 0) break;

          list.sort((a, b) => (toBig(a.id) < toBig(b.id) ? -1 : 1));
          for (const env of list) applyEnvelope(env);

          if (list.length < pageLimit) break;
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    [applyEnvelope, eventAdapter, pageLimit]
  );

  useEffect(() => {
    if (!roomCode) {
      setHydrated(true);
      return;
    }

    let alive = true;
    setHydrated(false);

    // room切替時にリセット
    seenRef.current.clear();
    appliedCountRef.current = 0;

    let unsub: (() => void) | null = null;

    (async () => {
      try {
        if (DEBUG_SYNC) console.log("[sync] start", { roomCode, clientId });

        // 0) Snapshotがあれば先に復元（Room全体State）
        if (snapshotAdapter) {
          const snap = await snapshotAdapter.loadLatest(roomCode);
          if (!alive) return;

          if (snap) {
            engine.replaceState(snap.state);
            lastIdRef.current = snap.lastEventId || "0";
          } else {
            lastIdRef.current = initialAfterId;
          }
        } else {
          lastIdRef.current = initialAfterId;
        }

        // 1) Snapshot地点から追いつき
        await catchUp(roomCode);
        if (!alive) return;

        // 2) subscribe開始
        unsub = eventAdapter.subscribe(roomCode, (env) => {
          if (!alive) return;

          const envId = toBig(env.id);
          const expected = toBig(lastIdRef.current) + BigInt(1);

          // ギャップがあれば補完してから適用（このenvもdedupeで安全）
          if (envId > expected) {
            void catchUp(roomCode).then(() => applyEnvelope(env));
            return;
          }

          applyEnvelope(env);
        });

        if (!alive) return;
        setHydrated(true);
        if (DEBUG_SYNC)
          console.log("[sync] hydrated", { roomCode, lastRemoteId: lastIdRef.current });
      } catch (e) {
        console.error("[sync] error", e);
        if (!alive) return;
        setHydrated(true);
      }
    })();

    return () => {
      alive = false;
      setHydrated(false);
      if (unsub) unsub();
    };
  }, [
    roomCode,
    eventAdapter,
    snapshotAdapter,
    catchUp,
    applyEnvelope,
    initialAfterId,
    engine,
    clientId,
  ]);

  const dispatch = useCallback(
    async (event: E): Promise<DispatchResult> => {
      if (!roomCode) {
        engine.dispatch(event);
        return { published: false, reason: "no-room" };
      }

      if (optimistic) {
        engine.dispatch(event);
      }

      await eventAdapter.publish(roomCode, event);
      return { published: true };
    },
    [roomCode, engine, eventAdapter, optimistic]
  );

  return {
    state,
    hydrated,
    clientId,
    lastRemoteId: lastIdRef.current, // string cursor
    dispatch,
    engine,
  };
}
