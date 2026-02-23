import type { SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot, SnapshotAdapter } from "../../engine/types";

/**
 * room_snapshots:
 * - room_code text unique
 * - last_event_id bigint
 * - state jsonb
 * - created_at timestamptz
 * - updated_at timestamptz
 * - version int
 * - updated_by text
 */
export function createSupabaseSnapshotAdapter<S>(
  supabase: SupabaseClient,
  opts: {
    /** upsert_room_snapshot Edge Function 名（デフォルトでOK） */
    functionName?: string;
    /** updated_by に入れる値（通常は eventAdapter.getClientId()） */
    clientId: string;
    /** snapshot version（任意、将来の破壊的変更に備える） */
    version?: number;
  }
): SnapshotAdapter<S> {
  const functionName = opts.functionName ?? "upsert_room_snapshot";
  const version = opts.version ?? 1;

  return {
    async loadLatest(roomCode: string): Promise<Snapshot<S> | undefined> {
      const { data, error } = await supabase
        .from("room_snapshots")
        .select("room_code,last_event_id,state,created_at")
        .eq("room_code", roomCode)
        .maybeSingle();

      if (error) throw error;
      if (!data) return undefined;

      // bigint列は string で返ることが多いが、numberで返る環境もあり得るので吸収
      const last = (data as any).last_event_id;
      const lastEventId =
        typeof last === "string" ? last : typeof last === "number" ? String(last) : "0";

      return {
        roomCode: (data as any).room_code,
        lastEventId,
        state: (data as any).state as S,
        createdAt: (data as any).created_at ?? undefined,
      };
    },

    async saveSnapshot(roomCode: string, lastEventId: string, state: S): Promise<void> {
      // Edge側のReqBodyが number 受けになっている場合に備えて number化する
      // ※長期的には Edge を string 受けにするのがより安全
      const lastEventIdNum = Number(lastEventId);
      if (!Number.isFinite(lastEventIdNum) || lastEventIdNum < 0) {
        throw new Error(`Invalid lastEventId: ${lastEventId}`);
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          roomCode,
          lastEventId: lastEventIdNum,
          state,
          version,
          clientId: opts.clientId,
        },
      });

      if (error) throw error;
      if (data?.ok !== true) {
        throw new Error(`Snapshot save failed: ${JSON.stringify(data)}`);
      }
    },
  };
}
