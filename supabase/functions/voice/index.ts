import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createHash, createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const ZADARMA_API_BASE = "https://api.zadarma.com";

interface ZadarmaCredentials {
  key: string;
  secret: string;
}

interface CallRequestBody {
  phone?: string;
  loanId?: string;
}

interface OperatorProfile {
  extension: string | null;
  active: boolean;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getCredentials(): ZadarmaCredentials | null {
  const key = Deno.env.get("ZADARMA_KEY")?.trim() ?? "";
  const secret = Deno.env.get("ZADARMA_SECRET")?.trim() ?? "";
  return key && secret ? { key, secret } : null;
}

function getAuthenticatedUserId(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const part = authHeader.slice(7).split(".")[1] ?? "";
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    ) as { role?: string; sub?: string };
    return payload.role === "authenticated" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  const digits = trimmed.replace(/\D/g, "");
  return digits.startsWith("54") ? `+${digits}` : trimmed;
}

function buildParamsStr(params: Record<string, string>): string {
  return new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
  ).toString();
}

function buildZadarmaAuth(
  creds: ZadarmaCredentials,
  method: string,
  params: Record<string, string>,
): string {
  const paramsStr = buildParamsStr(params);
  const md5 = createHash("md5").update(paramsStr, "utf8").digest("hex");
  const hmacHex = createHmac("sha1", creds.secret)
    .update(method + paramsStr + md5, "utf8")
    .digest("hex");
  return `${creds.key}:${btoa(hmacHex)}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function serviceHeaders(): Record<string, string> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function getOperatorProfile(userId: string): Promise<OperatorProfile | null> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const response = await fetch(
    `${url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=extension,active`,
    { headers: serviceHeaders() },
  );
  const data = await parseResponse(response);
  if (!response.ok || !Array.isArray(data) || !data[0]) return null;
  return data[0] as OperatorProfile;
}

async function insertCall(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const response = await fetch(`${url}/rest/v1/calls`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  const data = await parseResponse(response);
  if (!response.ok || !Array.isArray(data) || !data[0]) {
    throw new Error("No se pudo registrar la llamada");
  }
  return data[0] as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  const action = new URL(req.url).pathname.split("/").pop() ?? "";

  try {
    const creds = getCredentials();
    if (!creds) {
      return jsonResponse({ error: "Faltan las credenciales privadas de Zadarma en el servidor." }, 503);
    }

    if (action === "call") {
      if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);
      const userId = getAuthenticatedUserId(req.headers.get("Authorization"));
      if (!userId) {
        return jsonResponse({ error: "No autorizado. Se requiere una sesión activa del CRM." }, 401);
      }

      const operator = await getOperatorProfile(userId);
      if (!operator?.active) return jsonResponse({ error: "La cuenta del operador está inactiva." }, 403);
      const extension = operator.extension?.trim() ?? "";
      if (!/^[0-9]{3}$/.test(extension)) {
        return jsonResponse(
          { error: "El administrador debe asignarte una extensión PBX antes de llamar." },
          409,
        );
      }

      const body = (await req.json()) as CallRequestBody;
      const phone = normalizePhone(body.phone ?? "");
      const loanId = (body.loanId ?? "").trim();
      if (!phone || !loanId) {
        return jsonResponse({ error: "phone y loanId son obligatorios." }, 400);
      }

      const method = "/v1/request/callback/";
      const params = { from: extension, to: phone, sip: extension };
      const paramsStr = buildParamsStr(params);
      const providerResponse = await fetch(`${ZADARMA_API_BASE}${method}?${paramsStr}`, {
        method: "GET",
        headers: { Authorization: buildZadarmaAuth(creds, method, params) },
      });
      const providerData = await parseResponse(providerResponse);
      if (!providerResponse.ok) {
        return jsonResponse(
          {
            error: "Zadarma rechazó la petición.",
            providerStatus: providerResponse.status,
            detail: providerData,
          },
          502,
        );
      }

      const call = await insertCall({
        loan_id: loanId,
        operator_id: userId,
        provider: "zadarma",
        status: "initiated",
        destination: phone,
        extension,
        provider_payload: providerData,
      });
      return jsonResponse({
        callId: call.id,
        state: "dialing",
        extension,
        loanId,
        provider: providerData,
      });
    }

    if (["hangup", "status", "record"].includes(action)) {
      return jsonResponse({ error: "Operación aún no implementada." }, 501);
    }
    return jsonResponse({ error: "Ruta no encontrada" }, 404);
  } catch (error) {
    console.error("voice function error", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: "Error interno al procesar la llamada." }, 500);
  }
});
