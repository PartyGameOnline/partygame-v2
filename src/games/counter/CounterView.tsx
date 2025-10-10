// src/games/counter/CounterView.tsx
"use client";

import { useGame } from "../../engine/useGame";
import { CounterSpec, type CounterEvent, type CounterState } from "./spec";

export default function CounterView({ roomCode }: { roomCode?: string }) {
  const { state, dispatch } = useGame<CounterState, CounterEvent>(CounterSpec, { roomCode });

  const inc = (by = 1) => dispatch({ type: "inc", by } as CounterEvent);
  const dec = (by = 1) => dispatch({ type: "dec", by } as CounterEvent);

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <h2>Counter {roomCode ? `(room: ${roomCode})` : ""}</h2>
      <div style={{ fontSize: 40, fontWeight: 700, textAlign: "center" }}>{state.value}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => dec(1)}>-1</button>
        <button onClick={() => inc(1)}>+1</button>
        <button onClick={() => dec(10)}>-10</button>
        <button onClick={() => inc(10)}>+10</button>
        <button onClick={() => dispatch({ type: "reset" } as CounterEvent)}>Reset</button>
      </div>
    </div>
  );
}
