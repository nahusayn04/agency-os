-- Migration 028: Advanced notifications
--
-- 1. notifications: priority, grouping, "needs action", push delivery tracking
-- 2. notifications: lock down INSERT (all writes go through the service role
--    or SECURITY DEFINER triggers — a logged-in user must NOT be able to
--    create notifications for other people)
-- 3. push_subscriptions: many devices per user (unique per endpoint, not per user)
-- 4. leads: last_action_at (set by trigger), reminder snooze, meeting columns
-- 5. notify_upsert(): one atomic function for grouped / once / refresh writes
-- 6. Realtime publication for notifications

-- ============================================================
-- 1. notifications columns
-- ============================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS group_key TEXT,
  ADD COLUMN IF NOT EXISTS item_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS needs_action BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_slot TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_acked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_fallback_sent BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_priority_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_priority_check CHECK (priority IN ('normal', 'urgent'));
  END IF;
END $$;

-- Existing rows: updated_at should reflect when they were created.
UPDATE public.notifications SET updated_at = created_at WHERE updated_at > created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_group
  ON public.notifications (user_id, group_key)
  WHERE group_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_updated
  ON public.notifications (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_needs_action
  ON public.notifications (user_id)
  WHERE needs_action;

CREATE INDEX IF NOT EXISTS idx_notifications_push_health
  ON public.notifications (push_sent_at)
  WHERE priority = 'urgent' AND push_acked_at IS NULL AND email_fallback_sent = false;

-- ============================================================
-- 2. Close the open INSERT policy
-- ============================================================
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
REVOKE INSERT ON public.notifications FROM authenticated;

-- ============================================================
-- 3. push_subscriptions: multiple devices per user
-- ============================================================
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

UPDATE public.push_subscriptions
  SET endpoint = (subscription::json ->> 'endpoint')
  WHERE endpoint IS NULL;

DELETE FROM public.push_subscriptions WHERE endpoint IS NULL;

DELETE FROM public.push_subscriptions a
  USING public.push_subscriptions b
  WHERE a.endpoint = b.endpoint AND a.ctid < b.ctid;

ALTER TABLE public.push_subscriptions ALTER COLUMN endpoint SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_endpoint
  ON public.push_subscriptions (endpoint);

-- ============================================================
-- 4. leads: action tracking + snooze
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meeting_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meeting_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;

-- Backfill from what we already know. A lead whose last contact is after its
-- callback date counts as handled; everything else is treated as not yet
-- actioned, so genuinely missed leads start getting reminders.
UPDATE public.leads
  SET last_action_at = COALESCE(last_contact, created_at)
  WHERE last_action_at IS NULL;

ALTER TABLE public.leads ALTER COLUMN last_action_at SET DEFAULT now();
ALTER TABLE public.leads ALTER COLUMN last_action_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_followup_active
  ON public.leads (next_followup)
  WHERE deleted_at IS NULL AND stage NOT IN ('deal_won', 'deal_lost');

-- A "real action" = stage change, new callback date, Spoke, or new meeting
-- time. Reminders stop the moment one of these happens. Snoozing does not
-- touch these columns, so it is never treated as an action.
CREATE OR REPLACE FUNCTION public.leads_track_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage
     OR NEW.next_followup IS DISTINCT FROM OLD.next_followup
     OR NEW.last_contact IS DISTINCT FROM OLD.last_contact
     OR NEW.meeting_datetime IS DISTINCT FROM OLD.meeting_datetime THEN
    NEW.last_action_at := now();
    NEW.reminder_snoozed_until := NULL;

    UPDATE public.notifications
      SET needs_action = false
      WHERE reference_id = NEW.id AND needs_action = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_track_action ON public.leads;
CREATE TRIGGER trg_leads_track_action
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_track_action();

-- ============================================================
-- 5. notify_upsert(): atomic grouped / once / refresh notification write
--    modes:
--      count / append : merge into the existing row for this group_key
--      once           : insert if missing, otherwise do nothing
--      refresh        : update the existing row only when p_slot changed
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_upsert(
  p_user UUID,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT,
  p_type TEXT,
  p_ref UUID,
  p_priority TEXT,
  p_group_key TEXT,
  p_mode TEXT,
  p_slot TEXT,
  p_needs_action BOOLEAN,
  p_cap INTEGER DEFAULT 4
)
RETURNS TABLE (id UUID, item_count INTEGER, inserted BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF p_mode = 'once' THEN
    RETURN QUERY
    INSERT INTO public.notifications
      (user_id, title, message, link, type, reference_id, priority, group_key, needs_action, last_slot, updated_at)
    VALUES
      (p_user, p_title, p_message, COALESCE(p_link, '/'), p_type, p_ref, p_priority, p_group_key, p_needs_action, p_slot, now())
    ON CONFLICT (user_id, group_key) WHERE group_key IS NOT NULL DO NOTHING
    RETURNING notifications.id, notifications.item_count, TRUE;

  ELSIF p_mode = 'refresh' THEN
    RETURN QUERY
    INSERT INTO public.notifications
      (user_id, title, message, link, type, reference_id, priority, group_key, needs_action, last_slot, updated_at)
    VALUES
      (p_user, p_title, p_message, COALESCE(p_link, '/'), p_type, p_ref, p_priority, p_group_key, p_needs_action, p_slot, now())
    ON CONFLICT (user_id, group_key) WHERE group_key IS NOT NULL DO UPDATE
      SET title = EXCLUDED.title,
          type = EXCLUDED.type,
          message = EXCLUDED.message,
          priority = EXCLUDED.priority,
          needs_action = EXCLUDED.needs_action,
          item_count = notifications.item_count + 1,
          last_slot = EXCLUDED.last_slot,
          is_read = false,
          updated_at = now(),
          push_sent_at = NULL,
          push_acked_at = NULL,
          email_fallback_sent = false
      WHERE notifications.last_slot IS DISTINCT FROM EXCLUDED.last_slot
    RETURNING notifications.id, notifications.item_count, (notifications.xmax = 0);

  ELSE
    RETURN QUERY
    INSERT INTO public.notifications
      (user_id, title, message, link, type, reference_id, priority, group_key, needs_action, last_slot, updated_at)
    VALUES
      (p_user, p_title, p_message, COALESCE(p_link, '/'), p_type, p_ref, p_priority, p_group_key, p_needs_action, p_slot, now())
    ON CONFLICT (user_id, group_key) WHERE group_key IS NOT NULL DO UPDATE
      SET item_count = notifications.item_count + 1,
          is_read = false,
          updated_at = now(),
          message = CASE
            WHEN p_mode = 'append' AND notifications.item_count < p_cap
              THEN notifications.message || E'\n' || EXCLUDED.message
            ELSE notifications.message
          END,
          priority = CASE
            WHEN EXCLUDED.priority = 'urgent' THEN 'urgent'
            ELSE notifications.priority
          END
    RETURNING notifications.id, notifications.item_count, (notifications.xmax = 0);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_upsert(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_upsert(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_upsert(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO service_role;

-- ============================================================
-- 6. Realtime: make sure notifications changes reach the bell/sidebar live
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
