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

## Admin Panel
Access via `/admin` route. Tabs include:
- Dashboard - Platform stats
- Users - User management (ban/unban)
- Tasks - Task management
- Currencies - Currency management
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
