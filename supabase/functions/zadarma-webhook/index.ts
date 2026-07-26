import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Edge Function: zadarma-webhook
 *
 * Webhook publico de Zadarma (verify_jwt = false). Recibe las notificaciones
 * de eventos de llamada que Zadarma envia por POST, y la validacion inicial
 * por GET con el parametro zd_echo.
 *
 * Validacion inicial (Paso 1 de la configuracion del webhook en Zadarma):
 *   GET /zadarma-webhook?zd_echo=VALOR
 *   => debe devolver exactamente VALOR, sin texto adicional.
 *
 * Eventos que se aceptaran (cuerpo POST con campo "event"):
 *   - NOTIFY_OUT_START   inicio de llamada saliente desde la PBX
 *   - NOTIFY_ANSWER      respuesta (interna o externa) de la llamada
 *   - NOTIFY_OUT_END     fin de llamada saliente desde la PBX
 *   - NOTIFY_RECORD      grabacion lista para descargar
 *
 * Firma de cada notificacion (HMAC-SHA1 con API_SECRET, segun docs oficiales):
 *   NOTIFY_OUT_START / NOTIFY_OUT_END:
 *     base64(HMAC-SHA1(secret, internal + destination + call_start))
 *   NOTIFY_ANSWER:
 *     base64(HMAC-SHA1(secret, caller_id + destination + call_start))
 *   NOTIFY_RECORD:
 *     base64(HMAC-SHA1(secret, pbx_call_id + call_id_with_rec))
 *
 * Hoy solo se valida zd_echo y se acusa recibo (200 OK) de los NOTIFY_*.
 * La verificacion de firma y la persistencia de eventos se implementaran
 * cuando se active el proveedor real.
 *
 * Ref: https://zadarma.com/support/api/
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPPORTED_EVENTS = new Set([
  "NOTIFY_OUT_START",
  "NOTIFY_ANSWER",
  "NOTIFY_OUT_END",
  "NOTIFY_RECORD",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Paso 1 de la configuracion del webhook: devolver exactamente zd_echo.
  const zdEcho = url.searchParams.get("zd_echo");
  if (zdEcho !== null) {
    return new Response(zdEcho, {
      status: 200,
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    });
  }

  // Notificaciones de eventos (POST).
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const payload = (await req.json()) as { event?: string; [k: string]: unknown };

    if (!payload.event) {
      return new Response(JSON.stringify({ error: "Falta el campo 'event'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const event = payload.event;
    if (!SUPPORTED_EVENTS.has(event)) {
      return new Response(
        JSON.stringify({ error: `Evento no soportado: ${event}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // TODO (cuando se active el proveedor real):
    //   1. Verificar la firma HMAC-SHA1 de Zadarma segun el tipo de evento.
    //   2. Persistir el evento (estado de llamada / URL de grabacion).
    //   3. Notificar al frontend en tiempo real (SSE / realtime).
    //
    // Por ahora se acusa recibo para que Zadarma no reintentee.

    return new Response(JSON.stringify({ status: "ok", event }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
