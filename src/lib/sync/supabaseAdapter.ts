// src/lib/sync/supabaseAdapter.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SyncAdapter } from "../../engine/types";

// ===== Supabase client =====
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ===== Adapter (named export) =====
type Row<S> = { room_code: string; state: S; updated_at?: string; updated_by?: string | null };

export class SupabaseAdapter<S, _E = unknown> implements SyncAdapter<S, _E> {
  private clientId: string;

  constructor(private client: SupabaseClient = supabase) {
    this.clientId = cryptoRandom();
    console.log("[RT] clientId:", this.clientId);
  }

  async load(roomCode: string): Promise<S | undefined> {
    const { data, error } = await this.client
      .from("game_states")
      .select("state")
      .eq("room_code", roomCode)
      .single();

    // PGRST116 = row not found
    if (error && (error as any).code !== "PGRST116") {
      console.error("[RT] load error:", error);
      throw error;
    }
    return (data?.state as S) ?? undefined;
  }

  async save(roomCode: string, state: S): Promise<void> {
    const { error } = await this.client.from("game_states").upsert(
      {
        room_code: roomCode,
        state,
        updated_by: this.clientId,
        updated_at: new Date().toISOString(),
      } as Row<S>,
      { onConflict: "room_code" }
    );
    if (error) {
      console.error("[RT] save error:", error);
      throw error;
    }
  }

  subscribe(roomCode: string, onRemote: (remote: S) => void): () => void {
    const channel = this.client
      .channel(`game_states:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_states",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => this.onPayload("INSERT", payload.new as Row<S> | null, onRemote)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_states",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => this.onPayload("UPDATE", payload.new as Row<S> | null, onRemote)
      )
      .subscribe();

    return () => {
      void this.client.removeChannel(channel);
    };
  }

  private onPayload(
    _event: "INSERT" | "UPDATE",
    row: Row<S> | null,
    onRemote: (remote: S) => void
  ) {
    if (!row) return;
    // 自分が保存したイベントは無視
    if (row.updated_by && row.updated_by === this.clientId) return;
    if (row.state !== undefined) onRemote(row.state);
  }
}

function cryptoRandom(): string {
  try {
    const c = (globalThis as any)?.crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* noop */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ===== （任意）ヘルパー関数：既存コード互換のまま維持 =====
export type GameState = {
  room_code: string;
  state: Record<string, any>;
  updated_at: string;
  updated_by?: string;
};

export async function fetchGameState(room_code: string): Promise<GameState | null> {
  const { data, error } = await supabase
    .from("game_states")
    .select("*")
    .eq("room_code", room_code)
    .single();

  if (error && (error as any).code !== "PGRST116") {
    console.error("❌ fetchGameState error:", error);
    return null;
  }
  return (data as GameState) ?? null;
}

export async function updateGameState(
  room_code: string,
  state: Record<string, any>,
  user?: string
) {
  const { error } = await supabase.from("game_states").upsert({
    room_code,
    state,
    updated_by: user ?? "system",
    updated_at: new Date().toISOString(),
  } as GameState);

  if (error) {
    console.error("❌ updateGameState error:", error);
  }
}

export function subscribeGameState(room_code: string, onUpdate: (state: GameState) => void) {
  const channel = supabase
    .channel(`game_state:${room_code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_states", filter: `room_code=eq.${room_code}` },
      (payload) => {
        console.log("🔁 Realtime update:", payload);
        if (payload.new) onUpdate(payload.new as GameState);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
