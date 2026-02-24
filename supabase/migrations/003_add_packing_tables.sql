-- Puzzle Packing Tables for ThinkIn Kids
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)

-- ─── Packing Puzzles ──────────────────────────────────────────────
create table if not exists packing_puzzles (
  id uuid default gen_random_uuid() primary key,
  puzzle_number serial,
  puzzle_date date not null unique,
  pieces jsonb not null,              -- array of 6 piece IDs e.g. ['I','L','N','P','Y','V']
  anchors jsonb not null,             -- array of 2 pre-placed piece IDs e.g. ['I','L']
  anchor_positions jsonb not null,    -- map of piece ID → [[row,col], ...] positions
  solution jsonb not null,            -- 2D array (5×6) of piece IDs
  created_at timestamptz default now()
);

-- ─── Packing Results ──────────────────────────────────────────────
create table if not exists packing_results (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  packing_puzzle_id uuid not null references packing_puzzles(id) on delete cascade,
  time_seconds integer not null,
  completed_at timestamptz default now(),
  unique(profile_id, packing_puzzle_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────
create index if not exists idx_packing_puzzles_date on packing_puzzles(puzzle_date);
create index if not exists idx_packing_results_profile on packing_results(profile_id);
create index if not exists idx_packing_results_puzzle on packing_results(packing_puzzle_id);
create index if not exists idx_packing_results_time on packing_results(time_seconds);

-- ─── Row Level Security ──────────────────────────────────────────
alter table packing_puzzles enable row level security;
alter table packing_results enable row level security;

create policy "Packing puzzles are viewable by everyone"
  on packing_puzzles for select using (true);

create policy "Service role can insert packing puzzles"
  on packing_puzzles for insert with check (true);

create policy "Packing results are viewable by everyone"
  on packing_results for select using (true);

create policy "Anyone can insert packing results"
  on packing_results for insert with check (true);

create policy "Anyone can update packing results"
  on packing_results for update using (true);
