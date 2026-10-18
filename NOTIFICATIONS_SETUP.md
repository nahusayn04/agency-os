# Advanced notifications: setup

## 1. Database (run once)
Run `supabase/migrations/028_advanced_notifications.sql` in the Supabase SQL editor.
It is safe to run twice.

## 2. Cron on cron-job.org
Create ONE job:

- URL: `https://YOUR-DOMAIN/api/cron/notifications`
- Schedule: every 5 minutes
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

`CRON_SECRET` must be set in your hosting environment. The cron routes now refuse to run when it is empty.
If you already have a job on `/api/cron/meeting-reminders`, you can switch it to the new URL
or leave it, because it now runs the same engine.
`/api/cron/deadline-reminders` and `/api/cron/attendance-sweep` are unchanged.

## 3. Environment
- `NEXT_PUBLIC_SITE_URL` for links inside emails.
- Push: `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (already required).
- Email backup: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (a verified sender domain on Resend).

## 4. What each person must do once
Open Notifications in the sidebar, press **Turn on**, then **Send test**.
iPhone: Share, then Add to Home Screen, and open the app from the Home Screen first.
Phone and laptop can both be turned on now (one subscription per device).

## How reminders behave
| When | What |
|---|---|
| 60 and 15 min before a callback or meeting | one notification per lead, updated in place |
| At the time, +15 min, +30 min, then every hour (same day) | same notification, re-sent |
| Next days | one overdue summary per person at 10 AM, 2 PM, 6 PM |
| 9 AM / 6 PM | today's and tomorrow's summary |
| 1 day overdue | managers (admins) get a daily summary |
| 2 days overdue | founders get a daily summary |
| 10 PM to 8 AM | nothing is sent, one 8 AM summary instead |

Reminders stop when the lead gets a **new callback date, a Spoke, or a stage change**.
Snooze (1 hour or tomorrow 9 AM) only pauses them.

Email backup: an urgent notification is emailed when the user has no working device,
or when the phone never confirmed it within 10 minutes.
