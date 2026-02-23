// supabase/functions/upsert_room_snapshot/index.ts
import { createClient } from "@supabase/supabase-js";

type ReqBody = {
  roomCode: string;
  lastEventId: number; // room_events.id (bigint)
  state: unknown; // JSON serializable
  version?: number; // default 1
  clientId: string; // who is updating snapshot (must be host client_id)
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    // CORS preflight
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = (await req.json()) as Partial<ReqBody>;

    // ---- validate (minimum) ----
    if (!body.roomCode || typeof body.roomCode !== "string") {
      return json(400, { error: "roomCode required" });
    }
    if (
      body.lastEventId === undefined ||
      !Number.isInteger(body.lastEventId) ||
      body.lastEventId < 0
    ) {
      return json(400, { error: "lastEventId invalid" });
    }
    if (!body.clientId || typeof body.clientId !== "string") {
      return json(400, { error: "clientId required" });
    }
    if (body.state === undefined) {
      return json(400, { error: "state required" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---- authorization: host only ----
    const { data: meta, error: metaErr } = await supabase
      .from("room_meta")
      .select("host_client_id")
      .eq("room_code", body.roomCode)
      .maybeSingle();

    if (metaErr) {
      return json(500, { error: `room_meta lookup failed: ${metaErr.message}` });
    }

    // room_meta が無い = host確定前。公開向けには安全側で拒否。
    if (!meta?.host_client_id) {
      return json(403, { error: "host_not_registered" });
    }

    if (meta.host_client_id !== body.clientId) {
      return json(403, { error: "host_only" });
    }

    const version = Number.isInteger(body.version) ? (body.version as number) : 1;

    // ---- monotonic upsert via RPC (prevents rollback overwrite) ----
    const { error } = await supabase.rpc("upsert_room_snapshot", {
      p_room_code: body.roomCode,
      p_last_event_id: body.lastEventId,
      p_state: body.state,
      p_version: version,
      p_updated_by: body.clientId,
    });

    if (error) {
      return json(500, { error: error.message });
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
