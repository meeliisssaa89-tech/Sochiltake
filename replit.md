# Social Link Quest

## Overview
A Telegram mini-app built with React + Vite + TypeScript + Supabase. The app allows users to complete social tasks, watch ads, do daily check-ins, earn rewards, and compete on leaderboards.

## Project Structure
The actual application lives in the `social-link-quest-main/` subdirectory.

```
social-link-quest-main/
  src/
    pages/          - App pages (Index, AdminPanel, etc.)
    components/     - Reusable components
      admin/        - Admin panel views (AdminAdsView, AdminTasksView, etc.)
      ui/           - Shadcn UI components
    hooks/          - Custom hooks (useSupabaseData.ts)
    contexts/       - React contexts (UserContext, LanguageContext)
    integrations/   - Supabase client + types
  supabase/
    migrations/     - Database migration SQL files
    functions/      - Supabase edge functions
```

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth)
- **Routing**: React Router DOM v6
- **State**: TanStack Query v5

## Running
Workflow: `cd social-link-quest-main && npm install && npm run dev`
Port: 5000

## Environment Variables
Located in `social-link-quest-main/.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID

## Currency System
The app uses a multi-currency system based on Supabase `currencies` table:
- **TON** (Toncoin) and **USDT** (Tether) are the primary currencies
- Currencies can be added from the Admin Panel → Currencies → Quick Add
- XP is displayed as a progress bar in the HomePage user card and in reward toasts
- XP level: `floor(exp / 5000) + 1`; each level requires 5000 XP
- Balance protection: amount is deducted before withdrawal record is created

## TON Wallet Integration
Uses TonConnect v2 via CDN (npm package unavailable due to libc mismatch):
- CDN script loaded in `index.html` from unpkg: `@tonconnect/ui@2.0.11`
- Manifest file at `public/tonconnect-manifest.json`
- React hook: `src/hooks/useTonConnect.ts` — wraps the global `TonConnectUI` instance
- Supports Tonkeeper, TON Space, and all TonConnect-compatible wallets
- On-chain balances fetched via TonCenter public API after connection

## Admin Panel
Access via `/admin` route. Tabs include:
- Dashboard - Platform stats + 7-day bar charts (users, tasks, ads)
- Users - Full user detail modal (profile, balances, adjust balance, ban, delete)
- Tasks - Task management
- Currencies - Currency management (quick-add TON/USDT, custom currency form)
- Ads Config - Ad network settings (SDK injection, daily ads config, zone IDs)
- Spin Wheel - Spin prize management
- Wallet - Wallet token management
- App Icons - Appearance customization
- Broadcast - Send messages to users
- Settings - General app settings

## Key Files
- `src/pages/AdminPanel.tsx` - Main admin panel component
- `src/components/admin/AdminAdsView.tsx` - Ads configuration view
- `src/hooks/useSupabaseData.ts` - All Supabase data hooks
- `src/integrations/supabase/client.ts` - Supabase client setup
- `vite.config.ts` - Vite config (port 5000)
