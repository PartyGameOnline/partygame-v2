import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventSyncAdapter, RemoteEventEnvelope } from "../types";

type Row = {
  id: number | string; // bigint が文字列で来る可能性に対応
  room_code: string;
  event: unknown;
  client_id: string;
  event_id: string | null;
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
      id: toNumberId(r.id),
      roomCode: r.room_code,
      event: r.event as E,
      clientId: r.client_id,
      eventId: r.event_id ?? "",
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
    // ★呼び出しごとにユニークな channel 名にする（同名衝突を避ける）
    const channelName = `game_events:${roomCode}:${this.clientId}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;

    const channel = this.client
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_events",
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log("[EV] recv payload:", payload);

          const row = payload.new as Row | null;
          if (!row) return;

          const env: RemoteEventEnvelope<E> = {
            id: toNumberId(row.id),
            roomCode: row.room_code,
            event: row.event as E,
            clientId: row.client_id,
            eventId: row.event_id ?? "",
            createdAt: row.created_at,
          };

          if (env.clientId === this.clientId) return;
          cb(env);
        }
      )
      .subscribe((status) => {
        console.log("[EV] channel status:", status, "name:", channelName);
      });

    return () => {
      console.log("[EV] unsubscribe", channelName);
      void this.client.removeChannel(channel);
    };
  }
}

function toNumberId(id: number | string): number {
  // Supabase が int8 を string で返すことがあるので強制 number 化
  // JSの安全整数を超えるほど増えない前提（通常の連番なら問題なし）
  const n = typeof id === "number" ? id : Number(id);
  if (!Number.isFinite(n)) return 0;
  return n;
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
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}
