/*
# Capturar el sub del JWT al insertar un prestamo (para el read-back anon)

## Resumen
Agrega una funcion y trigger que guardan automaticamente el claim sub del JWT
de la peticion en la columna created_by_sub al insertar un prestamo. Esto
permite que la politica loans_select_own_anon (agregada en la migracion anterior)
identifique la fila que el usuario anonimo acaba de crear y le permita leerla
para el read-back tras .insert().select().

## Funcion nueva
- set_created_by_sub() — BEFORE INSERT on loans, captura auth.jwt()->>'sub'

## Trigger nuevo
- loans_set_created_by_sub (BEFORE INSERT on loans)

## Notas
- Para usuarios autenticados, sub contiene su user id.
- Para anon, sub contiene un identificador unico de la peticion.
- created_by_sub es nullable (compatibilidad con filas existentes).
*/

CREATE OR REPLACE FUNCTION public.set_created_by_sub()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by_sub IS NULL THEN
    NEW.created_by_sub := auth.jwt() ->> 'sub';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loans_set_created_by_sub ON public.loans;
CREATE TRIGGER loans_set_created_by_sub
  BEFORE INSERT ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by_sub();
