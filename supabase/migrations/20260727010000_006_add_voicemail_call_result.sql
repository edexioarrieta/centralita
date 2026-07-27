ALTER TABLE public.calls
  DROP CONSTRAINT calls_result_check;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_result_check
  CHECK (
    result IN (
      'atendido',
      'no_contesto',
      'buzon_voz',
      'rechazado',
      'volver_a_llamar'
    )
  );
