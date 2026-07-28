import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type OperatorRole = "admin" | "operator";

interface OperatorPayload {
  action?: "invite" | "update";
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: OperatorRole;
  extension?: string;
  active?: boolean;
  redirectTo?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: string | undefined): string {
  return (value ?? "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!supabaseUrl || !serviceRoleKey || !accessToken) {
      return jsonResponse({ error: "No autorizado." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData.user) return jsonResponse({ error: "La sesión no es válida." }, 401);

    const { data: actor, error: actorError } = await adminClient
      .from("users")
      .select("id, role, active")
      .eq("id", authData.user.id)
      .single();
    if (actorError || actor?.role !== "admin" || !actor.active) {
      return jsonResponse({ error: "Solo un administrador activo puede gestionar operadores." }, 403);
    }

    const body = (await req.json()) as OperatorPayload;
    const firstName = cleanText(body.firstName);
    const lastName = cleanText(body.lastName);
    const role: OperatorRole = body.role === "admin" ? "admin" : "operator";
    const extension = cleanText(body.extension);
    if (!firstName || !lastName || !/^[0-9]{3}$/.test(extension)) {
      return jsonResponse(
        { error: "Nombre, apellido y una extensión PBX de tres dígitos son obligatorios." },
        400,
      );
    }

    const { data: extensionOwner } = await adminClient
      .from("users")
      .select("id")
      .eq("extension", extension)
      .neq("id", body.userId ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    if (extensionOwner) {
      return jsonResponse({ error: `La extensión ${extension} ya está asignada.` }, 409);
    }

    if (body.action === "invite") {
      const email = cleanText(body.email).toLowerCase();
      if (!email) return jsonResponse({ error: "El correo electrónico es obligatorio." }, 400);

      const redirectTo = cleanText(body.redirectTo);
      const { data: invitation, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { first_name: firstName, last_name: lastName },
          redirectTo: redirectTo || undefined,
        });
      if (inviteError || !invitation.user) {
        return jsonResponse({ error: inviteError?.message ?? "No se pudo enviar la invitación." }, 400);
      }

      const { error: profileError } = await adminClient
        .from("users")
        .update({ first_name: firstName, last_name: lastName, role, extension, active: true })
        .eq("id", invitation.user.id);
      if (profileError) {
        await adminClient.auth.admin.deleteUser(invitation.user.id);
        return jsonResponse({ error: "No se pudo crear el perfil del operador." }, 500);
      }

      await adminClient.auth.admin.updateUserById(invitation.user.id, {
        app_metadata: { role },
      });
      return jsonResponse({ success: true, userId: invitation.user.id });
    }

    if (body.action === "update") {
      const userId = cleanText(body.userId);
      if (!userId) return jsonResponse({ error: "Falta el operador a modificar." }, 400);
      const active = body.active !== false;
      if (userId === actor.id && (!active || role !== "admin")) {
        return jsonResponse(
          { error: "No puedes desactivar tu propia cuenta ni quitarte el rol de administrador." },
          400,
        );
      }

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
        app_metadata: { role },
        ban_duration: active ? "none" : "876000h",
      });
      if (authUpdateError) return jsonResponse({ error: authUpdateError.message }, 400);

      const { error: profileError } = await adminClient
        .from("users")
        .update({ first_name: firstName, last_name: lastName, role, extension, active })
        .eq("id", userId);
      if (profileError) return jsonResponse({ error: profileError.message }, 400);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    console.error("operator-admin error", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: "Error interno al gestionar el operador." }, 500);
  }
});

