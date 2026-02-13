"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function randomRoom() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function CounterJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const join = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    router.push(`/counter/${c}`);
  };

  const create = () => {
    router.push(`/counter/${randomRoom()}`);
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", display: "grid", gap: 12 }}>
      <h2>Join Counter Room</h2>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") join();
          }}
          placeholder="ROOM CODE"
          style={{ flex: 1, padding: 8 }}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <button onClick={join} disabled={!code.trim()}>
          Join
        </button>
      </div>

      <button onClick={create}>Create New Room</button>
    </div>
  );
}
