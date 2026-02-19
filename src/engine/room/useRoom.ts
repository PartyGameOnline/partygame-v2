"use client";

import { useCallback, useMemo } from "react";
import type { EventSyncAdapter, SnapshotAdapter } from "../types";
import { useGameEventSync } from "../useGameEventSync";
import type { GameSpec } from "../types";
import type { RoomEvent, RoomState } from "./types";
import { createRoomSpec } from "./createRoomSpec";
import type { ParticipantsState } from "../participants/types";
import type { Participant } from "../participants/types";

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
    snapshotEveryNEvents = 0,
  } = opts;

  const roomSpec = useMemo(() => createRoomSpec<G, GE>(gameSpec), [gameSpec]);

  const { state, dispatch, hydrated, clientId, lastRemoteId } = useGameEventSync<
    RoomState<G>,
    RoomEvent<GE>
  >(roomSpec, {
    roomCode,
    adapter,
    snapshotAdapter,
    pageLimit,
    snapshotEveryNEvents,
  });

  // participants操作は共通イベントとして流す（全部room_eventsに乗る）
  const dispatchParticipants = useCallback((ev: RoomEvent<GE>) => dispatch(ev), [dispatch]);

  const dispatchGame = useCallback((ev: GE) => dispatch({ type: "game", event: ev }), [dispatch]);

  // 便利セレクタ
  const participants = state.participants;
  const game = state.game;

  const me = participants.byId[clientId] ?? null;
  const isHost = participants.hostId === clientId;

  // アクション（参加者）
  const join = useCallback(() => {
    const at = Date.now();
    dispatch({ type: "room/open", roomCode, at });
    dispatch({ type: "participants/join", id: clientId, name, at });
  }, [dispatch, roomCode, clientId, name]);

  const leave = useCallback(() => {
    dispatch({ type: "participants/leave", id: clientId, at: Date.now() });
  }, [dispatch, clientId]);

  const heartbeat = useCallback(() => {
    dispatch({ type: "participants/heartbeat", id: clientId, at: Date.now() });
  }, [dispatch, clientId]);

  const setReady = useCallback(
    (ready: boolean) =>
      dispatch({ type: "participants/setReady", id: clientId, ready, at: Date.now() }),
    [dispatch, clientId]
  );

  const setName = useCallback(
    (next: string) =>
      dispatch({ type: "participants/setName", id: clientId, name: next, at: Date.now() }),
    [dispatch, clientId]
  );

  // heartbeatタイマー/auto join-leave は「ゲーム側でいつ開始するか」もあるので、
  // 共通フックでは関数として提供し、呼び出し側で useEffect を書く方が自由度が高いです。
  // (ここで勝手にjoinすると、ロビー/観戦などで困るため)

  return {
    hydrated,
    roomClosed: participants.closed,
    lastRemoteId,

    // state
    participants,
    participantsList: listParticipants(participants),
    me,
    isHost,
    clientId,

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
