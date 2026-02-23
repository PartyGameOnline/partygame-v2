"use client";

import { useCallback, useMemo } from "react";
import type { EventSyncAdapter, SnapshotAdapter, GameSpec } from "../types";
import { useGameEventSync } from "../useGameEventSync";
import type { RoomEvent, RoomState } from "./types";
import { createRoomSpec } from "./createRoomSpec";
import type { ParticipantsState, Participant } from "../participants/types";

type UseRoomOpts<G, GE> = {
  roomCode: string;

  /** 統合イベントログ (room_events) */
  adapter: EventSyncAdapter<RoomEvent<GE>>;

  /** Room全体スナップショット */
  snapshotAdapter?: SnapshotAdapter<RoomState<G>>;

  /** 表示名（入室時にparticipants/joinに使う） */
  name: string;

  /** heartbeat */
  heartbeatMs?: number;

  /** catchUpページサイズ */
  pageLimit?: number;

  /** 暫定：クライアント側スナップショット間引き */
  snapshotEveryNEvents?: number;
};

function listParticipants(p: ParticipantsState): Participant[] {
  return p.order.map((id) => p.byId[id]).filter(Boolean);
}

export function useRoom<G, GE>(gameSpec: GameSpec<G, GE>, opts: UseRoomOpts<G, GE>) {
  const {
    roomCode,
    adapter,
    snapshotAdapter,
    name,
    heartbeatMs = 8000,
    pageLimit = 500,
    snapshotEveryNEvents = 5,
  } = opts;

  const roomSpec = useMemo(() => createRoomSpec<G, GE>(gameSpec), [gameSpec]);

  // ★ clientIdは adapter から先に確定（循環参照を避ける）
  const localClientId = useMemo(() => adapter.getClientId(), [adapter]);

  console.log("[room] clientId:", localClientId);

  const { state, dispatch, hydrated, lastRemoteId } = useGameEventSync<RoomState<G>, RoomEvent<GE>>(
    roomSpec,
    {
      roomCode,
      adapter,
      snapshotAdapter,
      pageLimit,
      snapshotEveryNEvents,

      // ★host限定保存：participants.hostId === clientId のときだけ snapshot を保存する
      canSaveSnapshotFn: (s) => (s as RoomState<G>).participants.hostId === localClientId,
    }
  );

  // participants操作は共通イベントとして流す（全部room_eventsに乗る）
  const dispatchParticipants = useCallback((ev: RoomEvent<GE>) => dispatch(ev), [dispatch]);

  const dispatchGame = useCallback((ev: GE) => dispatch({ type: "game", event: ev }), [dispatch]);

  // 便利セレクタ
  const participants = state.participants;
  const game = state.game;

  const me = participants.byId[localClientId] ?? null;
  const isHost = participants.hostId === localClientId;

  // アクション（参加者）
  const join = useCallback(() => {
    const at = Date.now();
    dispatch({ type: "room/open", roomCode, at });
    dispatch({ type: "participants/join", id: localClientId, name, at });
  }, [dispatch, roomCode, localClientId, name]);

  const leave = useCallback(() => {
    dispatch({ type: "participants/leave", id: localClientId, at: Date.now() });
  }, [dispatch, localClientId]);

  const heartbeat = useCallback(() => {
    dispatch({ type: "participants/heartbeat", id: localClientId, at: Date.now() });
  }, [dispatch, localClientId]);

  const setReady = useCallback(
    (ready: boolean) =>
      dispatch({ type: "participants/setReady", id: localClientId, ready, at: Date.now() }),
    [dispatch, localClientId]
  );

  const setName = useCallback(
    (next: string) =>
      dispatch({ type: "participants/setName", id: localClientId, name: next, at: Date.now() }),
    [dispatch, localClientId]
  );

  return {
    hydrated,
    roomClosed: participants.closed,
    lastRemoteId,

    // state
    participants,
    participantsList: listParticipants(participants),
    me,
    isHost,
    clientId: localClientId,

    game,

    // actions
    join,
    leave,
    heartbeat,
    heartbeatMs,

    setReady,
    setName,

    dispatchGame,
    dispatchParticipants,
  };
}
