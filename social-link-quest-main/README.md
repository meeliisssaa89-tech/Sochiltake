# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

### Deploying to Vercel

1. Push this repo to GitHub and import it on Vercel.
2. Build settings (auto-detected via `vercel.json`):
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add the following environment variables in Vercel → Settings → Environment Variables:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — your Supabase anon/publishable key
4. Deploy. The included `vercel.json` rewrites all routes to `index.html` so the SPA + the obscured admin route both work.

### Pointing the Telegram bot at your new domain

After Vercel gives you a domain (e.g. `https://my-app.vercel.app`):

1. In Supabase → Edge Functions → `telegram-webhook` → Secrets, set:
   - `WEBAPP_URL = https://my-app.vercel.app`
   - `TELEGRAM_BOT_TOKEN = <your bot token>` (if not already set)
2. Re-register the webhook so Telegram posts to your Supabase function:
   ```bash
   TELEGRAM_BOT_TOKEN=xxxx \
   SUPABASE_PROJECT_REF=<your-project-ref> \
   ./scripts/set-telegram-webhook.sh
   ```
3. Add the Vercel domain to Supabase → Authentication → URL Configuration → Redirect URLs:
   `https://my-app.vercel.app/control-panel-7a3b9c`

The `/start` command will now open the Vercel-hosted Mini App, and referral links built with the bot username will continue to work.

## Code-verification (`code_api`) tasks

A task type for "user gets a one-time code from an external site, then redeems it in the app".

- Configure from Admin → Tasks → New Task → Type = **Code Verification (External API)**.
- Fields: redirect URL, verify URL, HTTP method, headers (JSON), body template (JSON, with `{{user_id}}` and `{{code}}` placeholders), success key (e.g. `success` or `data.ok`), success value, max total completions, and per-user limit.
- The server enforces: code-reuse blocking, per-user limit, total completion cap, and rate limiting (5 attempts/user/task/min). Every attempt is logged in `task_code_attempts`.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
