"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function randomRoom() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function CounterJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", display: "grid", gap: 12 }}>
      <h2>Join Counter Room</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ROOM CODE"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={() => code && router.push(`/counter/${code}`)}>Join</button>
      </div>
      <button onClick={() => router.push(`/counter/${randomRoom()}`)}>Create New Room</button>
    </div>
  );
}
