import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventSyncAdapter, RemoteEventEnvelope } from "../types";

type Row = {
  id: number | string; // bigint が文字列で来る可能性
  room_code: string;
  event: unknown;
  client_id: string;
  event_id: string | null;
  created_at?: string;
};

type SupabaseEventAdapterOpts = {
  table?: string; // ★統合ログなら "room_events"
  schema?: string; // default "public"
  ignoreSelf?: boolean; // false推奨（整合性優先）
};

export class SupabaseEventAdapter<E> implements EventSyncAdapter<E> {
  private readonly clientId: string;
  private readonly table: string;
  private readonly schema: string;
  private readonly ignoreSelf: boolean;

  constructor(
    private client: SupabaseClient,
    opts: SupabaseEventAdapterOpts = {}
  ) {
    this.clientId = cryptoRandom();
    // ★デフォルトを room_events に変更（統合ログ前提）
    this.table = opts.table ?? "room_events";
    this.schema = opts.schema ?? "public";
    this.ignoreSelf = opts.ignoreSelf ?? false;

    console.log("[EV] clientId:", this.clientId, "table:", this.table);
  }

  getClientId(): string {
    return this.clientId;
  }

  async loadAfter(
    roomCode: string,
    afterId: string,
    limit = 500
  ): Promise<RemoteEventEnvelope<E>[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select("id, room_code, event, client_id, event_id, created_at")
      .eq("room_code", roomCode)
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data as Row[]).map((r) => ({
      id: toIdString(r.id),
      roomCode: r.room_code,
      event: r.event as E,
      clientId: r.client_id,
      eventId: r.event_id ?? "",
      createdAt: r.created_at,
    }));
  }

  async publish(roomCode: string, event: E): Promise<void> {
    const eventId = cryptoRandomUUID();

    const { error } = await this.client.functions.invoke("publish_room_event", {
      body: {
        room_code: roomCode,
        event,
        client_id: this.clientId,
        event_id: eventId,
      },
    });

    if (error) throw error;
  }

  subscribe(roomCode: string, cb: (env: RemoteEventEnvelope<E>) => void): () => void {
    const channelName = `${this.table}:${roomCode}:${this.clientId}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;

    const channel = this.client
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: this.schema,
          table: this.table,
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const row = payload.new as Row | null;
          if (!row) return;

          const env: RemoteEventEnvelope<E> = {
            id: toIdString(row.id),
            roomCode: row.room_code,
            event: row.event as E,
            clientId: row.client_id,
            eventId: row.event_id ?? "",
            createdAt: row.created_at,
          };

          if (this.ignoreSelf && env.clientId === this.clientId) return;
          cb(env);
        }
      )
      .subscribe((status) => {
        console.log("[EV] channel status:", status, "name:", channelName);
      });

    return () => {
      void this.client.removeChannel(channel);
    };
  }
}

function toIdString(id: number | string): string {
  return typeof id === "string" ? id : String(id);
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
