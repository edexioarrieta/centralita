-- El frontend escucha la fila de la llamada real mientras los webhooks la actualizan.
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
