import { serve } from "@std/http";
import { createClient } from "@supabase/supabase-js";

type Body = {
  room_code: string;
  event: unknown;
  client_id: string;
  event_id: string;
};

const MAX_BODY_BYTES = 16 * 1024; // 16KB
const LIMIT_PER_SEC = 10; // 1秒あたり10件/クライアント/ルーム

function corsHeaders(origin: string | null) {
  // 開発中は localhost を許可。本番は必要に応じて絞る
  const allowOrigin =
    origin && (origin.startsWith("http://localhost:") || origin.startsWith("https://"))
      ? origin
      : "*";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(res: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(res), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

function bad(msg: string, status = 400, origin: string | null = null) {
  return json({ ok: false, error: msg }, status, origin);
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  // ★ CORS preflight 対応（これが無いとブラウザが死ぬ）
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") return bad("method_not_allowed", 405, origin);

  // payloadサイズ制限
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len && len > MAX_BODY_BYTES) return bad("payload_too_large", 413, origin);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("invalid_json", 400, origin);
  }

  const roomCode = (body.room_code ?? "").trim();
  const clientId = (body.client_id ?? "").trim();
  const eventId = (body.event_id ?? "").trim();
  const event = body.event;

  if (!roomCode) return bad("room_code_required", 400, origin);
  if (!clientId) return bad("client_id_required", 400, origin);
  if (!eventId) return bad("event_id_required", 400, origin);
  if (event === undefined) return bad("event_required", 400, origin);

  // secrets（※あなたは PROJECT_URL / SERVICE_ROLE_KEY を使う構成）
  const url = Deno.env.get("PROJECT_URL") ?? "";
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return bad("server_misconfigured", 500, origin);

  const supabase = createClient(url, serviceKey);

  // レート制限(1秒窓)
  const windowStart = new Date();
  windowStart.setMilliseconds(0);

  const { data: existing, error: selErr } = await supabase
    .from("room_event_rate")
    .select("count")
    .eq("room_code", roomCode)
    .eq("client_id", clientId)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (selErr) return bad("rate_select_failed", 500, origin);

  const current = (existing?.count ?? 0) as number;
  if (current >= LIMIT_PER_SEC) return bad("rate_limited", 429, origin);

  const nextCount = current + 1;
  const { error: upErr } = await supabase.from("room_event_rate").upsert(
    {
      room_code: roomCode,
      client_id: clientId,
      window_start: windowStart.toISOString(),
      count: nextCount,
    },
    { onConflict: "room_code,client_id,window_start" }
  );

  if (upErr) return bad("rate_upsert_failed", 500, origin);

  const { error: insErr } = await supabase.from("room_events").insert({
    room_code: roomCode,
    event,
    client_id: clientId,
    event_id: eventId,
  });

  if (insErr) {
    const msg = String(insErr.message ?? "");
    // event_id重複は成功扱い
    if (msg.includes("duplicate key") || msg.includes("unique")) {
      return json({ ok: true, deduped: true }, 200, origin);
    }
    return bad("insert_failed", 500, origin);
  }

  return json({ ok: true }, 200, origin);
});
