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

  // adapter は「タブ単位で1個」でOK
  const eventAdapter = useMemo(() => new SupabaseEventAdapter<CounterEvent>(supabase), []);

  // devtools から触れるように（PC検証用）
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as any).supabase = supabase;
  }, []);

  useEffect(() => {
    push("mode = EVENT_SYNC (realtime input)");
    push(`room = ${roomCode}`);
  }, [roomCode]);

  // メイン：イベント同期（これがUIの数字を動かす）
  const { state, dispatch } = useGameEventSync<CounterState, CounterEvent>(counterSpec, {
    roomCode,
    adapter: eventAdapter,
  });

  // ---- PROBE(1): adapter.subscribe(roomCode, filterあり) が動くか ----
  const unsubFilteredRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    unsubFilteredRef.current?.();
    push("[PROBE] filtered subscribe() start");

    unsubFilteredRef.current = eventAdapter.subscribe(roomCode, (env) => {
      push(
        `[PROBE] filtered recv id=${env.id} from=${env.clientId.slice(
          0,
          8
        )} event=${JSON.stringify(env.event)}`
      );
    });

    push("[PROBE] filtered subscribe() set");

    return () => {
      unsubFilteredRef.current?.();
      unsubFilteredRef.current = null;
      push("[PROBE] filtered unsubscribe()");
    };
  }, [roomCode, eventAdapter]);

  // ---- PROBE(2): filter無しで “全部” 受け取れるか（publication/権限の切り分け） ----
  const unsubRawRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    unsubRawRef.current?.();
    push("[PROBE] raw subscribe(no filter) start");

    const ch = supabase
      .channel("probe-game-events-all")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events" },
        (payload) => {
          const row = payload.new as any;
          push(
            `[PROBE] raw recv room=${row?.room_code ?? "?"} id=${row?.id ?? "?"} client=${String(
              row?.client_id ?? ""
            ).slice(0, 8)} event=${JSON.stringify(row?.event ?? null)}`
          );
        }
      )
      .subscribe((status) => {
        push(`[PROBE] raw status=${status}`);
      });

    push("[PROBE] raw subscribe set");

    unsubRawRef.current = () => {
      push("[PROBE] raw unsubscribe()");
      void supabase.removeChannel(ch);
    };

    return () => {
      unsubRawRef.current?.();
      unsubRawRef.current = null;
    };
  }, []);

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
