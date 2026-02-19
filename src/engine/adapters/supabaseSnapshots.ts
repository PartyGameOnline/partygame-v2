import type { SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot, SnapshotAdapter } from "../types";

type Row = {
  room_code: string;
  last_event_id: number | string; // bigintがstringで返る可能性
  state: unknown;
  created_at?: string;
};

export class SupabaseSnapshotAdapter<S> implements SnapshotAdapter<S> {
  constructor(
    private client: SupabaseClient,
    private table: string = "room_snapshots"
  ) {}

  async loadLatest(roomCode: string): Promise<Snapshot<S> | undefined> {
    const { data, error } = await this.client
      .from(this.table)
      .select("room_code, last_event_id, state, created_at")
      .eq("room_code", roomCode)
      .order("last_event_id", { ascending: false })
      .limit(1);

    if (error) throw error;
    const row = (data as Row[] | null)?.[0];
    if (!row) return undefined;

    return {
      roomCode: row.room_code,
      lastEventId: toIdString(row.last_event_id),
      state: row.state as S,
      createdAt: row.created_at,
    };
  }

  async saveSnapshot(roomCode: string, lastEventId: string, state: S): Promise<void> {
    const { error } = await this.client.from(this.table).insert({
      room_code: roomCode,
      last_event_id: lastEventId,
      state,
    });
    if (error) throw error;
  }
}

function toIdString(id: number | string): string {
  return typeof id === "string" ? id : String(id);
}
