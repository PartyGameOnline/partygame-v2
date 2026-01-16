"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../engine/useGame";
import { SupabaseAdapter, supabase } from "../../lib/sync/supabaseAdapter";
import { counterSpec } from "./spec";

type Props = { roomCode?: string };

export default function CounterView({ roomCode }: Props) {
  // ---- 画面ログ（診断用） ----
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${m}`]);

  // ---- アダプタ作成 ----
  const adapter = useMemo(
    () => (roomCode ? new SupabaseAdapter<{ value: number }>(supabase) : undefined),
    [roomCode]
  );

  useEffect(() => {
    push(
      `adapter = ${adapter ? "SupabaseAdapter" : "MemoryAdapter"} / room=${roomCode ?? "(none)"}`
    );
  }, [adapter, roomCode]);

  // ---- エンジン接続 ----
  const { state, dispatch } = useGame(counterSpec, {
    roomCode,
    adapter,
    saveDebounceMs: 120,
  });

  // ---- 手動テスト & サブスク可視化 ----
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!roomCode || !adapter) return;

    (async () => {
      const remote = await adapter.load(roomCode);
      push(`load -> ${JSON.stringify(remote)}`);
    })();

    unsubRef.current?.();
    unsubRef.current = adapter.subscribe(roomCode, (incoming) => {
      push(`recv -> ${JSON.stringify(incoming)}`);
    });
    push("subscribe() called");

    return () => {
      unsubRef.current?.();
    };
  }, [roomCode, adapter]);

  // state 変化可視化
  useEffect(() => {
    push(`render value=${state.value}`);
  }, [state.value]);

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", maxWidth: 720 }}>
      <h2>Counter {roomCode ? `(room: ${roomCode})` : ""}</h2>

      <div style={{ fontSize: 40, fontWeight: 700, textAlign: "center" }}>{state.value}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => dispatch({ type: "dec", by: 1 })}>-1</button>
        <button onClick={() => dispatch({ type: "inc", by: 1 })}>+1</button>
        <button onClick={() => dispatch({ type: "reset" })}>reset</button>
      </div>

      {roomCode && adapter && (
        <div style={{ padding: 12, border: "1px solid #444", borderRadius: 8 }}>
          <b>Realtime / DB 手動テスト</b>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={async () => {
                await adapter.save(roomCode, { value: Math.floor(Math.random() * 1000) });
                push("manual save() done");
              }}
            >
              手動 save()
            </button>
            <button
              onClick={async () => {
                const r = await supabase
                  .from("game_states")
                  .select("*")
                  .eq("room_code", roomCode)
                  .maybeSingle();
                push("raw select -> " + JSON.stringify(r.data ?? null));
                if (r.error) push("raw select error -> " + (r.error.message ?? r.error.code));
              }}
            >
              直接 select（raw）
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
