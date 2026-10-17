-- Personal to-do list on the dashboard. Separate from tasks: no assignee,
-- no approval flow, each user only ever sees and edits their own rows.

CREATE TABLE IF NOT EXISTS public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  due_at TIMESTAMPTZ,
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todos_user_open ON public.todos (user_id, done, due_at);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY todos_select_own ON public.todos
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY todos_insert_own ON public.todos
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY todos_update_own ON public.todos
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY todos_delete_own ON public.todos
  FOR DELETE USING (user_id = auth.uid());
