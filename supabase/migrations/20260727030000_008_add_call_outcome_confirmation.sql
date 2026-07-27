/*
  Separa el registro técnico automático de la llamada de la clasificación
  manual que completa el operador al finalizar.

  Las llamadas existentes se consideran ya clasificadas para no convertir
  el historial previo en tareas pendientes.
*/

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS outcome_confirmed_at timestamptz;

UPDATE public.calls
SET outcome_confirmed_at = COALESCE(ended_at, created_at)
WHERE outcome_confirmed_at IS NULL;

