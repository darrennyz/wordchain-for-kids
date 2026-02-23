-- Sudoku Tables for WordChain Platform
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)

-- ─── Sudoku Puzzles ──────────────────────────────────────────────
create table if not exists sudoku_puzzles (
  id uuid default gen_random_uuid() primary key,
  puzzle_number serial,
  puzzle_date date not null unique,
  grid jsonb not null,              -- full 4x4 solution as flat array [1,2,3,4,3,4,1,2,...]
  givens jsonb not null,            -- indices of pre-filled cells [0,2,3,5,7,...]
  difficulty text default 'easy',   -- easy (8-10 givens), medium (6-8), hard (4-6)
  created_at timestamptz default now()
);

-- ─── Sudoku Results ──────────────────────────────────────────────
create table if not exists sudoku_results (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  sudoku_puzzle_id uuid not null references sudoku_puzzles(id) on delete cascade,
  time_seconds integer not null,
  completed_at timestamptz default now(),
  unique(profile_id, sudoku_puzzle_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────
create index if not exists idx_sudoku_puzzles_date on sudoku_puzzles(puzzle_date);
create index if not exists idx_sudoku_results_profile on sudoku_results(profile_id);
create index if not exists idx_sudoku_results_puzzle on sudoku_results(sudoku_puzzle_id);
create index if not exists idx_sudoku_results_time on sudoku_results(time_seconds);

-- ─── Row Level Security ──────────────────────────────────────────
alter table sudoku_puzzles enable row level security;
alter table sudoku_results enable row level security;

create policy "Sudoku puzzles are viewable by everyone"
  on sudoku_puzzles for select using (true);

create policy "Service role can insert sudoku puzzles"
  on sudoku_puzzles for insert with check (true);

create policy "Sudoku results are viewable by everyone"
  on sudoku_results for select using (true);

create policy "Anyone can insert sudoku results"
  on sudoku_results for insert with check (true);

create policy "Anyone can update sudoku results"
  on sudoku_results for update using (true);
