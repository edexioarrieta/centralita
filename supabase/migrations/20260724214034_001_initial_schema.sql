/*
# Esquema inicial del CRM de Prestamos Personales

## Resumen
Crea el esquema completo de la base de datos para el MVP del CRM de prestamos personales.
Incluye tablas para perfiles de operadores, solicitudes de prestamo, llamadas y cronologia de eventos.

## Tablas nuevas

### users (perfiles de operadores)
- id (uuid, PK, vinculado a auth.users con ON DELETE CASCADE)
- first_name (text, nombre del operador)
- last_name (text, apellido del operador)
- email (text, unico)
- role (text, rol: 'admin' u 'operator', por defecto 'operator')
- active (boolean, operador activo, por defecto true)
- created_at, updated_at (timestamptz)

### loans (solicitudes de prestamo)
- id (uuid, PK)
- loan_number (text, auto-generado con secuencia, formato SOL-000001)
- first_name, last_name (text, datos del cliente)
- dni (text, documento)
- phone (text, telefono)
- email (text)
- province (text, provincia)
- amount (numeric(12,2), capital solicitado)
- installments (integer, cantidad de cuotas)
- status (text, estado con CHECK de 8 valores validos)
- assigned_user (uuid, operador asignado, nullable, FK a users)
- scheduled_call_at (timestamptz, fecha/hora programada de llamada)
- created_at, updated_at (timestamptz)

### calls (llamadas)
- id (uuid, PK)
- loan_id (uuid, FK a loans con ON DELETE CASCADE)
- operator_id (uuid, FK a users, nullable)
- started_at, ended_at (timestamptz)
- duration (integer, duracion en segundos)
- result (text, resultado con CHECK de 4 valores)
- notes (text, observaciones)
- created_at (timestamptz)

### call_logs (cronologia de eventos del prestamo)
- id (uuid, PK)
- loan_id (uuid, FK a loans con ON DELETE CASCADE)
- event_type (text, tipo de evento)
- description (text, descripcion legible)
- previous_status (text, nullable, estado anterior)
- new_status (text, nullable, estado nuevo)
- operator_id (uuid, FK a users, nullable)
- metadata (jsonb, informacion adicional)
- created_at (timestamptz)

## Funciones nuevas (todas SECURITY DEFINER con search_path = public)
1. set_updated_at() — actualiza updated_at automaticamente en UPDATE
2. handle_new_user() — crea el perfil en users al registrarse un usuario en auth.users
3. is_first_user() — devuelve true si no existe ningun operador (gate de registro publico)
4. log_loan_created() — registra "Solicitud creada" en call_logs al insertar un prestamo
5. log_loan_updated() — registra cambios de estado, asignacion y reprogramacion en call_logs
6. log_call_created() — registra "Llamada registrada" en call_logs al insertar una llamada

## Triggers nuevos
- on_auth_user_created (AFTER INSERT on auth.users) → crea perfil
- users_set_updated_at (BEFORE UPDATE on users) → actualiza updated_at
- loans_set_updated_at (BEFORE UPDATE on loans) → actualiza updated_at
- loans_after_insert (AFTER INSERT on loans) → registra creacion en cronologia
- loans_after_update (AFTER UPDATE on loans) → registra cambios en cronologia
- calls_after_insert (AFTER INSERT on calls) → registra llamada en cronologia

## Seguridad (RLS)
- users: SELECT para autenticados (ven todos los perfiles); UPDATE solo del propio perfil
- loans: INSERT publico (anon + authenticated) para la pantalla publica; SELECT/UPDATE/DELETE solo autenticados
- calls: CRUD solo autenticados
- call_logs: SELECT e INSERT para autenticados; los triggers usan SECURITY DEFINER (bypass RLS)

## Notas
1. La pantalla publica de solicitud crea prestamos sin autenticacion (politica INSERT para anon)
2. La cronologia (call_logs) se alimenta automaticamente mediante triggers, sin intervencion del frontend
3. El loan_number se genera con secuencia (formato SOL-000001)
4. El gate de primer operador usa is_first_user() para no exponer datos de perfiles
5. updated_at se actualiza automaticamente en cada UPDATE
*/

-- ============================================================
-- Secuencia para loan_number
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.loan_number_seq START 1 INCREMENT 1;

-- ============================================================
-- Tabla: users (perfiles de operadores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Tabla: loans (solicitudes de prestamo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number text NOT NULL DEFAULT ('SOL-' || lpad(nextval('public.loan_number_seq')::text, 6, '0')),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  dni text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  installments integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'nuevo'
    CHECK (status IN ('nuevo', 'programado', 'listo_para_llamar', 'llamando', 'atendido', 'no_contesto', 'rechazado', 'finalizado')),
  assigned_user uuid REFERENCES public.users(id) ON DELETE SET NULL,
  scheduled_call_at timestamptz NOT NULL DEFAULT (now() + interval '3 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Tabla: calls (llamadas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration integer NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'no_contesto'
    CHECK (result IN ('atendido', 'no_contesto', 'rechazado', 'volver_a_llamar')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Tabla: call_logs (cronologia de eventos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  previous_status text,
  new_status text,
  operator_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Indices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_loan_number ON public.loans(loan_number);
CREATE INDEX IF NOT EXISTS idx_loans_dni ON public.loans(dni);
CREATE INDEX IF NOT EXISTS idx_loans_phone ON public.loans(phone);
CREATE INDEX IF NOT EXISTS idx_loans_first_name ON public.loans(first_name);
CREATE INDEX IF NOT EXISTS idx_loans_last_name ON public.loans(last_name);
CREATE INDEX IF NOT EXISTS idx_loans_scheduled_call_at ON public.loans(scheduled_call_at);
CREATE INDEX IF NOT EXISTS idx_calls_loan_id ON public.calls(loan_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_loan_id ON public.call_logs(loan_id);

-- ============================================================
-- Funcion: set_updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS loans_set_updated_at ON public.loans;
CREATE TRIGGER loans_set_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Funcion: handle_new_user (crea perfil al registrarse)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, email, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'operator'),
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Funcion: is_first_user (gate de registro publico)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.users);
$$;

-- ============================================================
-- Funcion: log_loan_created (cronologia: creacion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_loan_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.call_logs (loan_id, event_type, description, new_status)
  VALUES (NEW.id, 'solicitud_creada', 'Solicitud de prestamo recibida', NEW.status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loans_after_insert ON public.loans;
CREATE TRIGGER loans_after_insert
  AFTER INSERT ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.log_loan_created();

-- ============================================================
-- Funcion: log_loan_updated (cronologia: cambios)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_loan_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.call_logs (loan_id, event_type, description, previous_status, new_status, operator_id)
    VALUES (NEW.id, 'cambio_estado',
      'Estado cambiado de "' || COALESCE(OLD.status, '—') || '" a "' || NEW.status || '"',
      OLD.status, NEW.status, NEW.assigned_user);
  END IF;
  IF NEW.assigned_user IS DISTINCT FROM OLD.assigned_user THEN
    INSERT INTO public.call_logs (loan_id, event_type, description, operator_id)
    VALUES (NEW.id, 'asignacion_operador', 'Operador asignado', NEW.assigned_user);
  END IF;
  IF NEW.scheduled_call_at IS DISTINCT FROM OLD.scheduled_call_at THEN
    INSERT INTO public.call_logs (loan_id, event_type, description, metadata)
    VALUES (NEW.id, 'reprogramacion',
      'Llamada reprogramada para ' || to_char(NEW.scheduled_call_at, 'DD/MM/YYYY HH24:MI'),
      jsonb_build_object('scheduled_call_at', NEW.scheduled_call_at));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loans_after_update ON public.loans;
CREATE TRIGGER loans_after_update
  AFTER UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.log_loan_updated();

-- ============================================================
-- Funcion: log_call_created (cronologia: llamada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_call_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public as $$
BEGIN
  INSERT INTO public.call_logs (loan_id, event_type, description, operator_id, metadata)
  VALUES (NEW.loan_id, 'fin_llamada',
    'Llamada registrada — Resultado: ' || NEW.result,
    NEW.operator_id,
    jsonb_build_object('call_id', NEW.id, 'result', NEW.result, 'duration', NEW.duration, 'notes', NEW.notes));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calls_after_insert ON public.calls;
CREATE TRIGGER calls_after_insert
  AFTER INSERT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.log_call_created();

-- ============================================================
-- RLS: users
-- ============================================================
DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- RLS: loans
-- ============================================================
DROP POLICY IF EXISTS "loans_select_authenticated" ON public.loans;
CREATE POLICY "loans_select_authenticated" ON public.loans FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "loans_insert_public" ON public.loans;
CREATE POLICY "loans_insert_public" ON public.loans FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "loans_update_authenticated" ON public.loans;
CREATE POLICY "loans_update_authenticated" ON public.loans FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "loans_delete_authenticated" ON public.loans;
CREATE POLICY "loans_delete_authenticated" ON public.loans FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- RLS: calls
-- ============================================================
DROP POLICY IF EXISTS "calls_select_authenticated" ON public.calls;
CREATE POLICY "calls_select_authenticated" ON public.calls FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "calls_insert_authenticated" ON public.calls;
CREATE POLICY "calls_insert_authenticated" ON public.calls FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "calls_update_authenticated" ON public.calls;
CREATE POLICY "calls_update_authenticated" ON public.calls FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "calls_delete_authenticated" ON public.calls;
CREATE POLICY "calls_delete_authenticated" ON public.calls FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- RLS: call_logs
-- ============================================================
DROP POLICY IF EXISTS "call_logs_select_authenticated" ON public.call_logs;
CREATE POLICY "call_logs_select_authenticated" ON public.call_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "call_logs_insert_authenticated" ON public.call_logs;
CREATE POLICY "call_logs_insert_authenticated" ON public.call_logs FOR INSERT
  TO authenticated WITH CHECK (true);
