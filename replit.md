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
- XP/points display has been removed from the UI (still stored in DB for leveling logic)
- Balance protection: amount is deducted before withdrawal record is created

## TON Wallet Integration
Users can connect their TON wallet address in the Profile page:
- Address is stored in `localStorage` under key `ton_connected_wallet`
- On-chain balances (TON + USDT) are fetched from TonCenter public API
- USDT is fetched as a Jetton from master: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`

## Admin Panel
Access via `/admin` route. Tabs include:
- Dashboard - Platform stats
- Users - User management (ban/unban)
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
