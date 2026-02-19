"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { EventSyncAdapter } from "../types";
import { useGameEventSync } from "../useGameEventSync";
import { participantsSpec } from "./participantsSpec";
import type { ParticipantsEvent, ParticipantsState } from "./types";

type Opts = {
  roomCode: string;
  adapter: EventSyncAdapter<ParticipantsEvent>;
  name: string;
  heartbeatMs?: number;
};

export function useParticipantsEventSync(opts: Opts) {
  const { roomCode, adapter, name, heartbeatMs = 8_000 } = opts;

  const clientId = useMemo(() => adapter.getClientId(), [adapter]);

  const { state, dispatch, hydrated } = useGameEventSync<ParticipantsState, ParticipantsEvent>(
    participantsSpec,
    { roomCode, adapter }
  );

  // 入室(マウント時) + 退出(アンマウント時)
  useEffect(() => {
    dispatch({ type: "room/open", roomCode, at: Date.now() });
    void dispatch({ type: "participants/join", id: clientId, name, at: Date.now() });

    return () => {
      void dispatch({ type: "participants/leave", id: clientId, at: Date.now() });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, clientId]);

  // heartbeat
  useEffect(() => {
    const t = setInterval(() => {
      void dispatch({ type: "participants/heartbeat", id: clientId, at: Date.now() });
    }, heartbeatMs);
    return () => clearInterval(t);
  }, [dispatch, clientId, heartbeatMs]);

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

  return {
    participants: state,
    hydrated,
    clientId,
    setReady,
    setName,
    dispatchParticipants: dispatch,
  };
}
