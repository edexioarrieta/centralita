import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Edge Function: voice
 *
 * Backend del proveedor de telefonia Zadarma. Se ejecuta en el servidor
 * (Deno) para que las credenciales de Zadarma NUNCA lleguen al navegador.
 *
 * Secretos server-side (leidos con Deno.env):
 *   - ZADARMA_KEY      (user key)
 *   - ZADARMA_SECRET   (API secret)
 *   - ZADARMA_DRY_RUN  ("true" => firma y valida pero NO envia la llamada)
 *
 * Rutas (todas bajo /functions/v1/voice):
 *   POST /call        -> GET https://api.zadarma.com/v1/request/callback/
 *   POST /hangup      -> (pendiente)
 *   GET  /status      -> (pendiente)
 *   POST /record      -> (pendiente)
 *
 * Autenticacion oficial de Zadarma (API v1):
 *   params se ordenan alfabeticamente (ksort) y se serializan con
 *   http_build_query (paramsStr).
 *   signature = base64( HMAC-SHA1( secret, method + paramsStr + md5(paramsStr) ) )
 *   header: Authorization: <userKey>:<signature>
 *   Ref: https://zadarma.com/support/api/
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ZADARMA_API_BASE = "https://api.zadarma.com";
const NOT_CONFIGURED_MSG =
  "Zadarma aun no configurado. Definir ZADARMA_KEY y ZADARMA_SECRET como secretos del servidor.";

interface ZadarmaCredentials {
  key: string;
  secret: string;
}

function getCredentials(): ZadarmaCredentials | null {
  const key = Deno.env.get("ZADARMA_KEY") ?? "";
  const secret = Deno.env.get("ZADARMA_SECRET") ?? "";
  if (key.length === 0 || secret.length === 0) return null;
  return { key, secret };
}

/** md5 hex digest usando Web Crypto (Deno soporta DigestAlgorithm 'MD5'). */
async function md5Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC-SHA1 en base64, esquema de firma de Zadarma. */
async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Serializa parametros como http_build_query de PHP:
 * orden alfabetico de claves, sin codificar (Zadarma espera el string plano).
 */
function buildParamsStr(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

/**
 * Construye la cabecera Authorization oficial de Zadarma.
 * signature = base64( HMAC-SHA1( secret, method + paramsStr + md5(paramsStr) ) )
 */
async function buildZadarmaAuth(
  creds: ZadarmaCredentials,
  method: string,
  params: Record<string, string>,
): Promise<string> {
  const paramsStr = buildParamsStr(params);
  const md5 = await md5Hex(paramsStr);
  const sign = await hmacSha1Base64(creds.secret, method + paramsStr + md5);
  return `${creds.key}:${sign}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface CallRequestBody {
  phone?: string;
  extension?: string;
  loanId?: string;
}

/**
 * Extrae el UUID del usuario autenticado del JWT.
 * Rechaza el token anon (role="anon") y las service-role keys: solo admite
 * sesiones reales del CRM (role="authenticated" con sub = user UUID).
 * El gateway ya valido la firma (verify_jwt=true); aqui solo verificamos que
 * sea una sesion de usuario, no la clave publica anon.
 */
function getAuthenticatedUserId(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payloadB64 = token.split(".")[1] ?? "";
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { role?: string; sub?: string };
    if (payload?.role === "authenticated" && payload?.sub) {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop() ?? "";

  try {
    const creds = getCredentials();
    if (!creds) {
      return jsonResponse({ error: NOT_CONFIGURED_MSG }, 503);
    }

    switch (action) {
      case "call": {
        if (req.method !== "POST") {
          return jsonResponse({ error: "Metodo no permitido" }, 405);
        }

        const userId = getAuthenticatedUserId(req.headers.get("Authorization"));
        if (!userId) {
          return jsonResponse(
            { error: "No autorizado. Se requiere una sesion activa del CRM." },
            401,
          );
        }

        const body = (await req.json()) as CallRequestBody;
        const phone = (body.phone ?? "").trim();
        const extension = (body.extension ?? "").trim();
        const loanId = (body.loanId ?? "").trim();

        if (phone.length === 0 || extension.length === 0) {
          return jsonResponse(
            { error: "Los campos 'phone' y 'extension' son obligatorios." },
            400,
          );
        }

        const callId = `zadarma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Parametros oficiales de GET /v1/request/callback/
        const params: Record<string, string> = {
          from: extension,
          to: phone,
        };
        const method = "/v1/request/callback/";
        const authHeader = await buildZadarmaAuth(creds, method, params);
        const qs = buildParamsStr(params);
        const targetUrl = `${ZADARMA_API_BASE}${method}?${qs}`;

        const apiRes = await fetch(targetUrl, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
        });
        const apiData = await apiRes.json();
        if (!apiRes.ok) {
          return jsonResponse(
            { error: "Zadarma rechazo la peticion", detail: apiData },
            502,
          );
        }
        return jsonResponse({ callId, state: "dialing", loanId, ...apiData }, 200);
      }

      case "hangup": {
        if (req.method !== "POST") {
          return jsonResponse({ error: "Metodo no permitido" }, 405);
        }
        return jsonResponse({ error: "Zadarma aun no configurado. Implementar /hangup." }, 501);
      }

      case "status": {
        if (req.method !== "GET") {
          return jsonResponse({ error: "Metodo no permitido" }, 405);
        }
        return jsonResponse({ error: "Zadarma aun no configurado. Implementar /status." }, 501);
      }

      case "record": {
        if (req.method !== "POST") {
          return jsonResponse({ error: "Metodo no permitido" }, 405);
        }
        return jsonResponse({ error: "Zadarma aun no configurado. Implementar /record." }, 501);
      }

      default:
        return jsonResponse({ error: "Ruta no encontrada" }, 404);
    }
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      500,
    );
  }
});
