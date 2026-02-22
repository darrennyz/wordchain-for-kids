-- WordChain Database Schema
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)

-- ─── Profiles ─────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  avatar_emoji text not null default '😊',
  pin_hash text not null,
  created_at timestamptz default now()
);

-- ─── Puzzles ──────────────────────────────────────────────────────
create table if not exists puzzles (
  id uuid default gen_random_uuid() primary key,
  puzzle_number serial,
  puzzle_date date not null unique,
  words jsonb not null,           -- scrambled word list, e.g. ["RAIN","BOW","TIE","DYE","HAIR","BAND","AID"]
  solution jsonb not null,        -- correct chain order, e.g. ["RAIN","BOW","TIE","DYE","HAIR","BAND","AID"]
  pair_explanations jsonb,        -- explanations for each pair, e.g. ["rainbow","bow tie",...]
  difficulty text default 'easy', -- easy, medium, hard
  created_at timestamptz default now()
);

-- ─── Results ──────────────────────────────────────────────────────
create table if not exists results (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  puzzle_id uuid not null references puzzles(id) on delete cascade,
  time_seconds integer not null,
  completed_at timestamptz default now(),
  unique(profile_id, puzzle_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────
create index if not exists idx_puzzles_date on puzzles(puzzle_date);
create index if not exists idx_results_profile on results(profile_id);
create index if not exists idx_results_puzzle on results(puzzle_id);
create index if not exists idx_results_time on results(time_seconds);

-- ─── Row Level Security ───────────────────────────────────────────
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table puzzles enable row level security;
alter table results enable row level security;

-- Profiles: anyone can read (for leaderboard), anyone can insert (no auth needed)
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Anyone can create a profile"
  on profiles for insert with check (true);

-- Puzzles: anyone can read
create policy "Puzzles are viewable by everyone"
  on puzzles for select using (true);

-- Allow service role to insert puzzles (Edge Function uses service role)
create policy "Service role can insert puzzles"
  on puzzles for insert with check (true);

-- Results: anyone can read (for leaderboard), anyone can insert/update their own
create policy "Results are viewable by everyone"
  on results for select using (true);

create policy "Anyone can insert results"
  on results for insert with check (true);

create policy "Anyone can update results"
  on results for update using (true);

-- ─── Seed: Insert a sample puzzle for testing ─────────────────────
insert into puzzles (puzzle_date, words, solution, pair_explanations, difficulty)
values (
  current_date,
  '["BAND", "RAIN", "HAIR", "AID", "BOW", "TIE", "DYE"]',
  '["RAIN", "BOW", "TIE", "DYE", "HAIR", "BAND", "AID"]',
  '["rainbow", "bow tie", "tie-dye", "dye hair / hair dye", "hairband", "band-aid"]',
  'easy'
)
on conflict (puzzle_date) do nothing;
