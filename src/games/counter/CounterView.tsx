"use client";

import { useEffect, useMemo, useState } from "react";
import { useGame } from "../../engine/useGame";
import { useGameEventSync } from "../../engine/useGameEventSync";
import { SupabaseEventAdapter } from "../../engine/adapters/supabaseEvents";
import { supabase } from "../../lib/supabaseClient";
import { counterSpec, type CounterEvent, type CounterState } from "./spec";
import { createSupabaseSnapshotAdapter } from "../../lib/game/SupabaseSnapshotAdapter";

type Props = { roomCode?: string };

export default function CounterView({ roomCode }: Props) {
  return roomCode ? <CounterRoom roomCode={roomCode} /> : <CounterLocal />;
}

function CounterLocal() {
  const { state, dispatch } = useGame<CounterState, CounterEvent>(counterSpec);
  return <CounterUI title="Counter" state={state} dispatch={dispatch} />;
}

function CounterRoom({ roomCode }: { roomCode: string }) {
  // ★統合ログ: room_events を使う（adapter側デフォルトもroom_eventsだが明示して事故防止）
  const eventAdapter = useMemo(
    () => new SupabaseEventAdapter<CounterEvent>(supabase, { table: "room_events" }),
    []
  );

  // ★ snapshotAdapter を注入（Edge側で host 強制される）
  const snapshotAdapter = useMemo(() => {
    const clientId = eventAdapter.getClientId();
    return createSupabaseSnapshotAdapter<CounterState>(supabase, { clientId, version: 1 });
  }, [eventAdapter]);

  const { state, dispatch } = useGameEventSync<CounterState, CounterEvent>(counterSpec, {
    roomCode,
    adapter: eventAdapter,

    snapshotAdapter,
    snapshotEveryNEvents: 50, // 本番値（軽量なCounterなら50推奨）
  });

  return <CounterUI title={`Counter (room: ${roomCode})`} state={state} dispatch={dispatch} />;
}

function CounterUI(props: {
  title: string;
  state: CounterState;
  dispatch: (e: CounterEvent) => void;
}) {
  const { title, state, dispatch } = props;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", maxWidth: 720 }}>
      <h2>{title}</h2>

      <div style={{ fontSize: 40, fontWeight: 700, textAlign: "center" }}>{state.value}</div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => dispatch({ type: "dec", by: 1 })}>-1</button>
        <button onClick={() => dispatch({ type: "inc", by: 1 })}>+1</button>
        <button onClick={() => dispatch({ type: "reset" })}>reset</button>
      </div>
    </div>
  );
}
