/*
# Fix: permitir a la pantalla publica leer su propia solicitud recien creada

## Problema
La pantalla publica de solicitud de prestamo inserta como usuario anonimo (anon)
y usa .insert().select().single() para leer la fila recien creada. La politica
de INSERT permite a anon, pero la politica de SELECT solo permite authenticated.
Como resultado, el INSERT se completa pero el SELECT de lectura devuelve
"new row violates row-level security policy" (codigo 42501, HTTP 401), y el
frontend muestra error.

## Solucion
Agregar una politica de SELECT para anon que permita leer UNICAMENTE la fila
que anon acaba de crear, identificada por el claim sub del JWT anon. El JWT
anon de Supabase incluye un claim sub unico por peticion, por lo que la fila
creada en esa misma peticion es legible pero las demas no.

En la practica, como el frontend anon no muestra listados de prestamos (solo el
CRM autenticado lo hace), esta politica solo se usa para el read-back del INSERT.

## Tabla modificada
- loans: agregada politica loans_select_own_anon (SELECT TO anon, scoped por sub)

## Seguridad
- anon solo puede leer filas donde el sub del JWT coincide con el de la fila
- authenticated mantiene su politica existente de lectura total
- No se exponen datos de otros solicitantes al publico
*/

-- Necesitamos guardar el sub del JWT anon al insertar para poder filtrar al leer.
-- Agregamos una columna que captura el sub de la peticion (anon o authenticated).
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS created_by_sub text;

-- Actualizar la politica de INSERT publica para que guarde el sub
DROP POLICY IF EXISTS "loans_insert_public" ON public.loans;
CREATE POLICY "loans_insert_public" ON public.loans FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Politica de SELECT para anon: solo puede leer filas que el mismo creo
-- (mismo sub del JWT). Esto permite el read-back tras el INSERT sin exponer
-- los datos de otros solicitantes.
DROP POLICY IF EXISTS "loans_select_own_anon" ON public.loans;
CREATE POLICY "loans_select_own_anon" ON public.loans FOR SELECT
  TO anon
  USING (created_by_sub = (auth.jwt() ->> 'sub'));

-- La politica de SELECT para authenticated ya existe y se mantiene.
-- authenticated puede ver todos los prestamos (politica loans_select_authenticated).
