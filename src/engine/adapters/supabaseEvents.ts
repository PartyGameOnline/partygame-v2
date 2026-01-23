import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventSyncAdapter, RemoteEventEnvelope } from "../types";

type Row = {
  id: number;
  room_code: string;
  event: any;
  client_id: string;
  event_id: string;
  created_at?: string;
};

export class SupabaseEventAdapter<E> implements EventSyncAdapter<E> {
  private readonly clientId: string;

  constructor(private client: SupabaseClient) {
    this.clientId = cryptoRandom();
    console.log("[EV] clientId:", this.clientId);
  }

  getClientId(): string {
    return this.clientId;
  }

  async loadAfter(roomCode: string, afterId: number): Promise<RemoteEventEnvelope<E>[]> {
    const { data, error } = await this.client
      .from("game_events")
      .select("id, room_code, event, client_id, event_id, created_at")
      .eq("room_code", roomCode)
      .gt("id", afterId)
      .order("id", { ascending: true });

    if (error) throw error;

    return (data as Row[]).map((r) => ({
      id: r.id,
      roomCode: r.room_code,
      event: r.event as E,
      clientId: r.client_id,
      eventId: r.event_id,
      createdAt: r.created_at,
    }));
  }

  async publish(roomCode: string, event: E): Promise<void> {
    const eventId = cryptoRandomUUID();
    const { error } = await this.client.from("game_events").insert({
      room_code: roomCode,
      event,
      client_id: this.clientId,
      event_id: eventId,
    });

    if (error) throw error;
  }

  subscribe(roomCode: string, cb: (env: RemoteEventEnvelope<E>) => void): () => void {
    const channel = this.client
      .channel(`game_events:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_events",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const row = payload.new as Row | null;
          if (!row) return;

          const env: RemoteEventEnvelope<E> = {
            id: row.id,
            roomCode: row.room_code,
            event: row.event as E,
            clientId: row.client_id,
            eventId: row.event_id,
            createdAt: row.created_at,
          };

          // 自己エコーは基本ここで弾く（hookでも二重防御）
          if (env.clientId === this.clientId) return;

          cb(env);
        }
      )
      .subscribe();

    return () => {
      void this.client.removeChannel(channel);
    };
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

function cryptoRandomUUID(): string {
  try {
    const c = (globalThis as any)?.crypto;
    if (typeof c?.randomUUID === "function") return c.randomUUID();
  } catch {
    /* noop */
  }
  // UUID形式でなくても一意ならDBユニーク制約で十分だが、念のためUUIDっぽく
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}
