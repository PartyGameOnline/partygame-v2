// src/lib/sync/supabaseAdapter.ts
import { createClient } from "@supabase/supabase-js";

// ===== Supabase client =====
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ===== Adapter (single source of truth) =====
// 実装は engine 側に統一し、ここは re-export のみにする
export { SupabaseAdapter } from "../../engine/adapters/supabase";

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
