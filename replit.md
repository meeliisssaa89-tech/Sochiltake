# Telegram Mini App + Shortlink Site (Monorepo)

This Replit holds **two separate apps** that share a single Supabase project:

1. **Main Telegram Mini App** (root `/`) — React 18 + Vite + TypeScript + Tailwind + shadcn/ui.
   Runs on port 5000. Workflow: **Start application** (`npm run dev`).
2. **Shortlink Site** (`shortlink-site/`) — separate Vercel-hosted React + Vite app
   with serverless API routes in `shortlink-site/api/`. Deployed independently to Vercel.

Both apps point at the same Supabase database. The shortlink-site uses the `shortlink_*`
prefixed tables; the Telegram app uses everything else.

---

## Recent Architecture Additions (April 2026)

### Unified Admin Control
The shortlink-site admin (was its own page at `/admin`) is now also fully
controllable from the Telegram app's existing AdminPanel under a new
**Shortlink** tab. That tab has six sub-views: Settings, Ad Slots, Publishers,
Articles, Payouts, Stats — see `src/components/admin/AdminShortlinkView.tsx`.

Admin actions reach the shortlink data via the existing `admin-action` edge
function. The function recognizes a `shortlink_*` prefix on the action and
proxies to `shortlink_settings` / `shortlink_publishers` / etc.

### Publisher (Author) Program

Users can sign up on the shortlink-site, write articles, get a unique
**link-code**, and paste it into the Telegram app to claim those earnings.

| Layer | What changed |
|------|--------------|
| **DB** | `supabase/migrations/20260426000000_shortlink_publishers.sql` adds `shortlink_publishers`, `shortlink_pub_articles`, `shortlink_pub_visits`, `shortlink_payouts`, plus feature flags on `shortlink_settings` (`publishers_enabled`, `payouts_enabled`, `signup_enabled`, `articles_require_approval`, `revenue_per_visit`, `min_payout`, `payout_currency_id`, `signup_bonus`). All RLS service-role only. |
| **Edge fn** | `supabase/functions/shortlink-publisher/` — Telegram-side actions: `status`, `link_code`, `unlink`, `me_stats`, `request_payout`. Approving a payout credits the user's `balances` row in the configured currency (handled inside `admin-action`). |
| **Edge fn** | `supabase/functions/admin-action/` extended with `shortlink_*` admin actions. |
| **Telegram UI** | `src/components/PublisherCard.tsx` — gated by `publishers_enabled`. Shown in the Profile page just under the wallet hero. Lets the user paste a code, view stats (pending balance, lifetime earnings, total visits), top articles & top countries, and request a payout. Article links open via `Telegram.WebApp.openLink(...)` so they pop out into the user's browser instead of the Telegram WebView. |
| **Site API** | `shortlink-site/api/_lib/pubAuth.ts` — HMAC-signed JWT-like cookie + token, sha256 password, slug & link-code generators (no extra deps). Endpoints: `publisher/{signup,login,logout,me,articles,status}`, plus `p/view` (public article fetch — also records the visit with country from `x-vercel-ip-country`, dedups by IP+slug for 1h, increments article + publisher counters). |
| **Site UI** | `shortlink-site/src/pages/{PubLoginPage,PubSignupPage,PubDashboardPage,PubEditorPage,PublicArticlePage}.tsx`. Routes wired in `shortlink-site/src/App.tsx`: `/publisher`, `/publisher/login`, `/publisher/signup`, `/publisher/dashboard`, `/publisher/article/new`, `/publisher/article/:id/edit`, `/p/:slug`. |

### Defaults
Every new feature ships **OFF**. The migration sets `publishers_enabled`,
`payouts_enabled`, `signup_enabled` all to `false`. Admin enables them per
toggle in the Shortlink → Settings tab.

---

## Workflow

- `npm run dev` (workflow: **Start application**) — runs the Telegram Mini App on port 5000.
- The shortlink-site is **not** run by the workflow. Develop it with `cd shortlink-site && npm run dev` (or `vercel dev`) when needed; it deploys to Vercel separately.

## Important Files

- `src/pages/AdminPanel.tsx` — main admin page, registers the new `shortlink` tab.
- `src/components/admin/AdminShortlinkView.tsx` — admin shortlink control center.
- `src/components/PublisherCard.tsx` — publisher card on the Profile page.
- `src/pages/ProfilePage.tsx` — embeds `<PublisherCard />`.
- `supabase/migrations/20260426000000_shortlink_publishers.sql` — schema additions.
- `supabase/functions/admin-action/index.ts` — admin RPC (incl. shortlink_*).
- `supabase/functions/shortlink-publisher/index.ts` — telegram-side publisher RPC.
- `shortlink-site/src/App.tsx` — site routes.
- `shortlink-site/api/publisher/*.ts` — publisher REST endpoints.
- `shortlink-site/api/p/view.ts` — public article viewer (records visits).

## User Preferences
- Communicate in Arabic.
- Keep new features OFF by default; admin enables via panel.
- Article links opened from inside the Telegram app must escape the WebView via `Telegram.WebApp.openLink`.
