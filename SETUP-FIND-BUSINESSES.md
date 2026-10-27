# Find Businesses — setup

No database migration is needed.

1. Vercel → Settings → Environment Variables: `APIFY_TOKEN` = your Apify personal API token
   (do NOT prefix with NEXT_PUBLIC). Add it to `.env.local` as well for local runs. Redeploy.
2. Optional:
   - `APIFY_ACTOR_ID`  (default `compass~crawler-google-places`)
   - `APIFY_MONTHLY_BUDGET_USD` (default `5`; search stops when less than $0.15 is left)
3. Open `/crm/find` (also reachable from the dashboard and the CRM page — admins/founder only).

Notes
- A search starts an Apify run and the page polls for the result (no serverless timeout issue).
- Per-run ceiling is $0.50 (Apify's minimum). Real spend is set by the places limit: ~$0.08 for 20 places, ~$0.02 for 5.
- Duplicates are skipped by phone number (last 10 digits), same as Import Leads.
- Leads need a phone number; places without one can't be added.
- Voice search uses the browser's speech recognition (Chrome/Edge/Android Chrome/Safari). Hidden if unsupported.
