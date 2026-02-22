# WordChain - Setup Guide

## Quick Start (5 steps)

### 1. Supabase Setup (Free Tier)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (pick any name and a strong database password)
3. Wait for the project to finish setting up (~2 min)
4. Go to **SQL Editor** in the left sidebar
5. Copy the contents of `supabase/migrations/001_initial_schema.sql` and run it
6. Note your project credentials from **Settings > API**:
   - `Project URL` → this is your `VITE_SUPABASE_URL`
   - `anon/public` key → this is your `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_KEY` (keep secret!)

### 2. Local Development

```bash
# Clone and install
cd wordchain
npm install

# Create .env file
cp .env.example .env
# Edit .env and fill in your Supabase URL and anon key

# Start dev server
npm run dev
```

Open http://localhost:5173/wordchain/ in your browser.

### 3. Deploy Edge Function (Optional Fallback)

If you want the on-demand puzzle generation fallback:

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set the Claude API key as a secret
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Deploy the function
supabase functions deploy generate-puzzle
```

### 4. Pre-Generate Puzzles

Generate 30 days of puzzles in advance:

```bash
ANTHROPIC_API_KEY=sk-ant-... \
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_KEY=your-service-role-key \
npm run generate-puzzles
```

Or generate a specific number of days: `node scripts/generate-puzzles.js 60`

### 5. Deploy to GitHub Pages

1. Create a GitHub repository called `wordchain`
2. Push the code:
   ```bash
   git init
   git add .
   git commit -m "Initial WordChain setup"
   git remote add origin https://github.com/YOUR_USERNAME/wordchain.git
   git push -u origin main
   ```
3. Go to your repo **Settings > Pages** and set Source to **GitHub Actions**
4. Go to **Settings > Secrets and variables > Actions** and add these secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_SERVICE_KEY`
5. The deploy workflow will run automatically on push
6. For daily puzzle generation, the GitHub Action runs at midnight UTC

Your game will be live at: `https://YOUR_USERNAME.github.io/wordchain/`

---

## Architecture

```
Browser (GitHub Pages)
  ├── React SPA with Tailwind CSS
  ├── Supabase JS client (direct connection)
  └── No server needed!

Supabase (Free Tier)
  ├── PostgreSQL database
  │   ├── profiles (users + PIN hashes)
  │   ├── puzzles (daily puzzles)
  │   └── results (completion times)
  ├── Row Level Security (public read, write)
  └── Edge Function (optional puzzle generator)

Claude API
  ├── Called by Edge Function (on-demand)
  └── Called by GitHub Action (daily cron)
```

## Cost Breakdown

| Service | Cost |
|---------|------|
| Supabase (Free Tier) | $0 - 500MB DB, 50K Edge Function invocations |
| GitHub Pages | $0 - free for public repos |
| GitHub Actions | $0 - 2000 min/month free |
| Claude API | ~$0.01-0.03 per puzzle generation |

**Monthly estimate**: ~$0.30-0.90/month for daily puzzle generation via Claude API.
