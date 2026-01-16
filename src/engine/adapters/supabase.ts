import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncAdapter } from "../types";

type Row<S> = { room_code: string; state: S; updated_by: string | null; updated_at?: string };

export class SupabaseAdapter<S, _E = unknown> implements SyncAdapter<S, _E> {
  private clientId: string;

  constructor(private client: SupabaseClient) {
    this.clientId = cryptoRandom();
    console.log("[RT] clientId:", this.clientId);
  }

  async load(roomCode: string): Promise<S | undefined> {
    const { data, error } = await this.client
      .from("game_states")
      .select("state")
      .eq("room_code", roomCode)
      .single();

    if (error && (error as any).code !== "PGRST116") {
      console.error("[RT] load error:", error);
      throw error;
    }
    console.log("[RT] load:", roomCode, "=>", data?.state);
    return (data?.state as S) ?? undefined;
  }

  async save(roomCode: string, state: S): Promise<void> {
    console.log("[RT] save:", roomCode, state);
    const { error } = await this.client.from("game_states").upsert(
      {
        room_code: roomCode,
        state,
        updated_by: this.clientId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_code" }
    );

    if (error) {
      console.error("[RT] save error:", error);
      throw error;
    }
  }

  subscribe(roomCode: string, onRemote: (remote: S) => void): () => void {
    console.log("[RT] subscribe to:", roomCode);
    const channel = this.client
      .channel(`game_states:${roomCode}`)
      // INSERT / UPDATE を明示
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_states",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => this.handlePayload("INSERT", payload.new as Row<S> | null, onRemote)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_states",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => this.handlePayload("UPDATE", payload.new as Row<S> | null, onRemote)
      )
      .subscribe((status) => {
        console.log("[RT] channel status:", status);
      });

    return () => {
      console.log("[RT] unsubscribe:", roomCode);
      void this.client.removeChannel(channel);
    };
  }

  private handlePayload(
    event: "INSERT" | "UPDATE",
    row: Row<S> | null,
    onRemote: (remote: S) => void
  ) {
    console.log("[RT] recv:", event, row);
    if (!row) return;
    // 自己エコーは無視（他端末の更新のみ反映）
    if (row.updated_by && row.updated_by === this.clientId) {
      console.log("[RT] ignore self");
      return;
    }
    if (row.state !== undefined) onRemote(row.state);
  }
}

function cryptoRandom(): string {
  try {
    const cryptoObj = (globalThis as any)?.crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
      return cryptoObj.randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
