/*
# Revertir: eliminar created_by_sub y politicas innecesarias

## Resumen
El intento de permitir el read-back anon via created_by_sub no funciona porque
el JWT anon de Supabase no incluye claim sub. La solucion final fue cambiar el
frontend para que la pantalla publica no lea la fila tras insertar (solo inserta
y muestra mensaje de exito).

## Cambios
- Elimina el trigger loans_set_created_by_sub y la funcion set_created_by_sub
- Elimina la columna created_by_sub (no contiene datos utiles)
- Elimina la politica loans_select_own_anon (no puede funcionar sin sub)

## Seguridad
- La politica loans_insert_public se mantiene (anon puede INSERT)
- La politica loans_select_authenticated se mantiene (authenticated puede SELECT)
- anon NO puede leer prestamos, lo cual es correcto: la pantalla publica no
  necesita leerlos, solo crearlos.
*/

DROP TRIGGER IF EXISTS loans_set_created_by_sub ON public.loans;
DROP FUNCTION IF EXISTS public.set_created_by_sub();

DROP POLICY IF EXISTS "loans_select_own_anon" ON public.loans;

ALTER TABLE public.loans DROP COLUMN IF EXISTS created_by_sub;
