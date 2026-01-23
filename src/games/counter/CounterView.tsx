"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../engine/useGame";
import { useGameEventSync } from "../../engine/useGameEventSync";
import { SupabaseEventAdapter } from "../../engine/adapters/supabaseEvents";
import { supabase } from "../../lib/supabaseClient";
import { counterSpec, type CounterEvent, type CounterState } from "./spec";

type Props = { roomCode?: string };

export default function CounterView({ roomCode }: Props) {
  return roomCode ? <CounterRoom roomCode={roomCode} /> : <CounterLocal />;
}

function CounterLocal() {
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${m}`]);

  const { state, dispatch } = useGame<CounterState, CounterEvent>(counterSpec);

  useEffect(() => {
    push("mode = LOCAL (memory)");
  }, []);

  useEffect(() => {
    push(`render value=${state.value}`);
  }, [state.value]);

  return <CounterUI title="Counter" state={state} dispatch={dispatch} log={log} />;
}

function CounterRoom({ roomCode }: { roomCode: string }) {
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${m}`]);

  const eventAdapter = useMemo(() => new SupabaseEventAdapter<CounterEvent>(supabase), []);

  useEffect(() => {
    push("mode = EVENT_SYNC (realtime input)");
    push(`room = ${roomCode}`);
  }, [roomCode]);

  const { state, dispatch } = useGameEventSync<CounterState, CounterEvent>(counterSpec, {
    roomCode,
    adapter: eventAdapter,
  });

  const devOnly = process.env.NODE_ENV !== "production";
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!devOnly) return;

    unsubRef.current?.();
    unsubRef.current = eventAdapter.subscribe(roomCode, (env) => {
      push(
        `recv event(id=${env.id}) from=${env.clientId.slice(0, 8)} event=${JSON.stringify(
          env.event
        )}`
      );
    });
    push("debug subscribe() called (dev only)");

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [devOnly, roomCode, eventAdapter]);

  useEffect(() => {
    push(`render value=${state.value}`);
  }, [state.value]);

  return (
    <CounterUI
      title={`Counter (room: ${roomCode})`}
      state={state}
      dispatch={dispatch}
      log={log}
      roomCode={roomCode}
    />
  );
}

function CounterUI(props: {
  title: string;
  state: CounterState;
  dispatch: (e: CounterEvent) => void;
  log: string[];
  roomCode?: string;
}) {
  const { title, state, dispatch, log, roomCode } = props;

  // hydration mismatch 回避（マウント後に描画）
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const devOnly = process.env.NODE_ENV !== "production";

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", maxWidth: 720 }}>
      <h2>{title}</h2>

      <div style={{ fontSize: 40, fontWeight: 700, textAlign: "center" }}>{state.value}</div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => dispatch({ type: "dec", by: 1 })}>-1</button>
        <button onClick={() => dispatch({ type: "inc", by: 1 })}>+1</button>
        <button onClick={() => dispatch({ type: "reset" })}>reset</button>
      </div>

      {devOnly && roomCode && (
        <div style={{ padding: 12, border: "1px solid #444", borderRadius: 8 }}>
          <b>Dev Debug (events)</b>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                for (let i = 0; i < 10; i++) dispatch({ type: "inc", by: 1 });
              }}
            >
              burst +10
            </button>
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              maxHeight: 220,
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
