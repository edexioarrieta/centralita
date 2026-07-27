import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createHash, createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Signature",
};
const supported = new Set([
  "NOTIFY_OUT_START",
  "NOTIFY_ANSWER",
  "NOTIFY_OUT_END",
  "NOTIFY_RECORD",
]);
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const zadarmaKey = Deno.env.get("ZADARMA_KEY") ?? "";
const zadarmaSecret = Deno.env.get("ZADARMA_SECRET") ?? "";
const dbHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

function response(body: unknown, status = 200): Response {
  return new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
      },
    },
  );
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function expectedWebhookSignature(
  event: string,
  payload: Record<string, string>,
): string {
  let message = "";
  if (event === "NOTIFY_OUT_START" || event === "NOTIFY_OUT_END") {
    message =
      `${payload.internal ?? ""}${payload.destination ?? ""}${payload.call_start ?? ""}`;
  } else if (event === "NOTIFY_ANSWER") {
    message =
      `${payload.caller_id ?? ""}${payload.destination ?? ""}${payload.call_start ?? ""}`;
  } else if (event === "NOTIFY_RECORD") {
    message = `${payload.pbx_call_id ?? ""}${payload.call_id_with_rec ?? ""}`;
  }
  const hmacHex = createHmac("sha1", zadarmaSecret)
    .update(message, "utf8")
    .digest("hex");
  return btoa(hmacHex);
}

function zadarmaApiSignature(
  method: string,
  params: Record<string, string>,
): { query: string; signature: string } {
  const query = new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
  ).toString();
  const md5 = createHash("md5").update(query, "utf8").digest("hex");
  const signatureInput = `${method}${query}${md5}`;
  const hmacHex = createHmac("sha1", zadarmaSecret)
    .update(signatureInput, "utf8")
    .digest("hex");
  return { query, signature: btoa(hmacHex) };
}

function signaturesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function parsePayload(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = await req.json() as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(json).map(([key, value]) => [key, String(value ?? "")]),
    );
  }
  const form = await req.formData();
  return Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, String(value)]),
  );
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, data };
}

async function findCall(
  payload: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const pbxId = payload.pbx_call_id;
  if (pbxId) {
    const exact = await fetchJson(
      `${supabaseUrl}/rest/v1/calls?provider=eq.zadarma&provider_call_id=eq.${
        encodeURIComponent(pbxId)
      }&limit=1&select=*`,
      { headers: dbHeaders },
    );
    if (exact.ok && Array.isArray(exact.data) && exact.data[0]) {
      return exact.data[0] as Record<string, unknown>;
    }
  }

  const internal = payload.internal || "100";
  const recent = await fetchJson(
    `${supabaseUrl}/rest/v1/calls?provider=eq.zadarma&extension=eq.${
      encodeURIComponent(internal)
    }&status=in.(initiated,ringing,answered)&order=started_at.desc&limit=20&select=*`,
    { headers: dbHeaders },
  );
  if (!recent.ok || !Array.isArray(recent.data)) return null;
  const target = digits(payload.destination);
  return (recent.data as Record<string, unknown>[]).find(
    (call) => digits(call.destination) === target,
  ) ?? null;
}

async function patchCall(
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/calls?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...dbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    throw new Error(`No se pudo actualizar la llamada (${res.status})`);
  }
}

async function patchLoan(id: string, status: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/loans?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...dbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo actualizar el prestamo (${res.status})`);
  }
}

async function insertLog(
  call: Record<string, unknown>,
  event: string,
  payload: Record<string, string>,
): Promise<void> {
  const eventId =
    `${payload.pbx_call_id || "pending"}:${event}:${payload.internal || ""}:${payload.call_start || ""}`;
  const metadata = {
    provider: "zadarma",
    pbx_call_id: payload.pbx_call_id,
    destination: payload.destination,
    internal: payload.internal,
    disposition: payload.disposition,
    duration: payload.duration,
    call_id_with_rec: payload.call_id_with_rec,
  };
  const res = await fetch(`${supabaseUrl}/rest/v1/call_logs`, {
    method: "POST",
    headers: {
      ...dbHeaders,
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      loan_id: call.loan_id,
      operator_id: call.operator_id,
      event_type: event.toLowerCase(),
      description: `Evento Zadarma: ${event}`,
      metadata,
      provider_event_id: eventId,
    }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`No se pudo registrar el evento (${res.status})`);
  }
}

async function storeRecording(
  call: Record<string, unknown>,
  callIdWithRecording: string,
): Promise<string> {
  if (!zadarmaKey || !zadarmaSecret) {
    throw new Error("Faltan credenciales privadas de Zadarma");
  }

  const method = "/v1/pbx/record/request/";
  const params = { call_id: callIdWithRecording, lifetime: "300" };
  const { query, signature } = zadarmaApiSignature(method, params);
  const recordingInfo = await fetchJson(
    `https://api.zadarma.com${method}?${query}`,
    { headers: { Authorization: `${zadarmaKey}:${signature}` } },
  );
  const info = recordingInfo.data as {
    status?: string;
    link?: string;
    links?: string[];
    message?: string;
  };
  const temporaryLink = info.link ?? info.links?.[0];
  if (!recordingInfo.ok || info.status !== "success" || !temporaryLink) {
    throw new Error(
      `Zadarma no entrego la grabacion: ${info.message ?? "respuesta invalida"}`,
    );
  }

  const audioResponse = await fetch(temporaryLink);
  if (!audioResponse.ok) {
    throw new Error(`No se pudo descargar la grabacion (${audioResponse.status})`);
  }
  const audio = await audioResponse.arrayBuffer();
  const safeRecordingId = callIdWithRecording.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${String(call.loan_id)}/${String(call.id)}/${safeRecordingId}.mp3`;
  const encodedPath = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/call-recordings/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "audio/mpeg",
        "x-upsert": "true",
      },
      body: audio,
    },
  );
  if (!uploadResponse.ok) {
    const detail = (await uploadResponse.text()).slice(0, 200);
    throw new Error(
      `No se pudo guardar la grabacion (${uploadResponse.status}): ${detail}`,
    );
  }
  return objectPath;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  const url = new URL(req.url);
  const echo = url.searchParams.get("zd_echo");
  if (echo !== null) return response(echo);
  if (req.method !== "POST") {
    return response({ error: "Metodo no permitido" }, 405);
  }

  try {
    const payload = await parsePayload(req);
    const event = payload.event ?? "";
    if (!supported.has(event)) {
      return response({ error: "Evento no soportado" }, 400);
    }
    const supplied = req.headers.get("Signature") ?? "";
    if (
      !zadarmaSecret ||
      !supplied ||
      !signaturesEqual(supplied, expectedWebhookSignature(event, payload))
    ) {
      return response({ error: "Firma invalida" }, 401);
    }

    const call = await findCall(payload);
    if (!call) {
      console.warn(
        "Uncorrelated Zadarma event",
        JSON.stringify({
          event,
          pbx_call_id: payload.pbx_call_id,
          destination: payload.destination,
          internal: payload.internal,
        }),
      );
      return response({ status: "ok", correlated: false });
    }

    const callId = String(call.id);
    const loanId = String(call.loan_id);
    const providerPayload = {
      ...(call.provider_payload as Record<string, unknown> ?? {}),
      last_event: payload,
    };

    if (event === "NOTIFY_OUT_START") {
      await patchCall(callId, {
        status: "ringing",
        provider_call_id: payload.pbx_call_id || null,
        provider_payload: providerPayload,
      });
      await patchLoan(loanId, "llamando");
    } else if (event === "NOTIFY_ANSWER") {
      await patchCall(callId, {
        status: "answered",
        provider_call_id: payload.pbx_call_id || call.provider_call_id,
        answered_at: new Date().toISOString(),
        provider_payload: providerPayload,
      });
    } else if (event === "NOTIFY_OUT_END") {
      const answered = payload.disposition === "answered";
      await patchCall(callId, {
        status: answered ? "completed" : "failed",
        provider_call_id: payload.pbx_call_id || call.provider_call_id,
        ended_at: new Date().toISOString(),
        duration: Number(payload.duration || 0),
        result: answered ? "atendido" : "no_contesto",
        provider_payload: providerPayload,
      });
      await patchLoan(loanId, answered ? "atendido" : "no_contesto");
    } else if (event === "NOTIFY_RECORD") {
      const recordingPath = await storeRecording(
        call,
        payload.call_id_with_rec,
      );
      await patchCall(callId, {
        provider_call_id: payload.pbx_call_id || call.provider_call_id,
        recording_url: recordingPath,
        provider_payload: providerPayload,
      });
    }

    await insertLog(call, event, payload);
    return response({ status: "ok", correlated: true });
  } catch (error) {
    console.error(
      "zadarma webhook error",
      error instanceof Error ? error.message : "unknown",
    );
    return response({ error: "Error interno" }, 500);
  }
});
