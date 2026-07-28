/*
  Las funciones usadas exclusivamente por triggers no deben estar disponibles
  como RPC para usuarios anónimos o autenticados.
*/

ALTER FUNCTION public.set_updated_at() SET search_path = public;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_call_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_loan_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_loan_updated() FROM PUBLIC, anon, authenticated;

