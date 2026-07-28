/*
  Administración segura de operadores.

  Cada operador puede tener una única extensión PBX de tres dígitos. Los
  usuarios posteriores al primero siempre nacen como operadores y los perfiles
  dejan de poder modificarse directamente desde el navegador.
*/

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS extension text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_extension_format_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_extension_format_check
  CHECK (extension IS NULL OR extension ~ '^[0-9]{3}$');

CREATE UNIQUE INDEX IF NOT EXISTS users_extension_unique_idx
  ON public.users (extension)
  WHERE extension IS NOT NULL;

UPDATE public.users
SET extension = '100'
WHERE id = (
  SELECT id FROM public.users
  WHERE role = 'admin'
  ORDER BY created_at
  LIMIT 1
)
AND extension IS NULL
AND NOT EXISTS (SELECT 1 FROM public.users WHERE extension = '100');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role text;
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.users) THEN 'operator' ELSE 'admin' END
  INTO assigned_role;

  INSERT INTO public.users (id, first_name, last_name, email, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    assigned_role,
    true
  );
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "users_update_own" ON public.users;
REVOKE UPDATE ON public.users FROM authenticated;

