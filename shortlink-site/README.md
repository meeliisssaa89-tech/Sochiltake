# Shortlink Site

A self-contained "link locker" / multi-page article site that issues a single-use
verification code to users coming from the main app's **code_api** task type.

## How it fits with the main app

```
[ User taps task in main app ]
            │
            ▼
 verify-task (action=start)  ─── creates row in task_code_sessions(token)
            │
            └── opens redirect_url:  https://shortlink/?u={{user_id}}&t={{token}}
                                                                │
                                                                ▼
                                          User reads N pages here, gets a CODE
                                                                │
            ┌───────────────────────────────────────────────────┘
            ▼
 User pastes CODE in main app
            │
            ▼
 verify-task (action=verify) ── POST to https://shortlink/api/verify
                                  body: { user_id, code, token }
                                  expects { "success": true }
            │
            ▼
 Reward + xp granted in main app
```

## Setup

1. **Run the SQL migration once** in your Supabase SQL editor — `SETUP.sql`
   (uses the same Supabase project as the main app).
2. **Create a Vercel project** pointing to this folder.
3. **Set environment variables on Vercel:**
   - `SUPABASE_URL` — same as the main app
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role key from Supabase
   - `HMAC_SECRET` — any long random string (used to sign admin cookies)
4. Deploy. Visit `/admin` and set your admin password (the first password you
   submit becomes the admin password).
5. In the admin panel:
   - Configure number of pages and wait timer.
   - (Optional) paste an OpenAI API key to generate fresh AI articles.
   - Paste your ad network HTML/script tags into the ad slots.
6. In the **main app's admin**, create a `code_api` task with:
   - `redirect_url`: `https://YOUR-SITE/?u={{user_id}}&t={{token}}`
   - `verify_url`: `https://YOUR-SITE/api/verify`
   - `body_template`: `{ "user_id": "{{user_id}}", "code": "{{code}}", "token": "{{token}}" }`
   - `success_key`: `success`
   - `success_value`: `true`

## Local development

```bash
cd shortlink-site
npm install
npm install -g vercel
vercel link             # one-time, link to your Vercel project
vercel env pull .env    # pulls SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HMAC_SECRET
vercel dev              # serves both the React app and /api/* serverless functions
```

Then open http://localhost:3000.

## Security model

- Each visit generates a unique 32-byte token (issued by the main app) saved in
  `task_code_sessions`. Without a valid token the shortlink refuses to start.
- The site enforces page-by-page progression server-side: the wait timer is
  checked on the server before advancing.
- The final code is generated server-side with `crypto.randomBytes` and saved
  bound to the session row. Codes are unique (DB unique index).
- `/api/verify` only succeeds for codes that completed all pages, match the
  user_id, and haven't been burned. After one successful verify the code is
  marked `used_at` and can never be replayed.
- Admin endpoints require either an HttpOnly signed cookie or a Bearer token
  with the admin password.
- All Supabase access is via the service-role key on the server only — the key
  is never exposed to the browser. RLS on the new tables blocks all anon
  access regardless.

## Files

- `api/start.ts` — initialize a session, generate articles, return first page
- `api/page.ts` — advance to next page (enforces timer, returns code on last)
- `api/verify.ts` — called by the main app to verify a code
- `api/admin/login.ts` — admin password (bootstraps on first call)
- `api/admin/settings.ts` — get/save admin settings
- `api/admin/preview.ts` — test the AI generation
- `api/admin/stats.ts` — basic counters
- `src/pages/LandingPage.tsx` — landing screen with "Start reading"
- `src/pages/ReaderPage.tsx` — paged articles + timer + final code reveal
- `src/pages/AdminPage.tsx` — admin dashboard
- `SETUP.sql` — Supabase schema additions
