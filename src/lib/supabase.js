import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase credentials. Copy .env.example to .env and fill in your values.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// ─── User / Profile helpers ───────────────────────────────────────

export async function createProfile(name, avatarEmoji, pin) {
  const pinHash = await hashPin(pin);
  const { data, error } = await supabase
    .from('profiles')
    .insert({ name, avatar_emoji: avatarEmoji, pin_hash: pinHash })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_emoji, created_at')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function verifyPin(profileId, pin) {
  const pinHash = await hashPin(pin);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('pin_hash', pinHash)
    .single();
  if (error || !data) return false;
  return true;
}

// ─── Date helpers ────────────────────────────────────────────────

export function getTodayDateSGT() {
  const now = new Date();
  const sgt = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return sgt.toISOString().split('T')[0];
}

// ─── WordChain Puzzle helpers ────────────────────────────────────

export async function getTodaysPuzzle() {
  const today = getTodayDateSGT();
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('puzzle_date', today)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function hasCompletedToday(profileId) {
  const today = getTodayDateSGT();
  const { data: puzzle } = await supabase
    .from('puzzles')
    .select('id')
    .eq('puzzle_date', today)
    .single();
  if (!puzzle) return { completed: false, result: null };

  const { data: result } = await supabase
    .from('results')
    .select('*')
    .eq('profile_id', profileId)
    .eq('puzzle_id', puzzle.id)
    .single();

  return { completed: !!result, result, puzzleId: puzzle.id };
}

export async function generatePuzzleViaEdge() {
  const { data, error } = await supabase.functions.invoke('generate-puzzle');
  if (error) throw error;
  return data;
}

// ─── WordChain Results helpers ───────────────────────────────────

export async function saveResult(profileId, puzzleId, timeSeconds) {
  const { data, error } = await supabase
    .from('results')
    .upsert(
      {
        profile_id: profileId,
        puzzle_id: puzzleId,
        time_seconds: timeSeconds,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,puzzle_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProfileResults(profileId) {
  const { data, error } = await supabase
    .from('results')
    .select('*, puzzles(puzzle_date, puzzle_number)')
    .eq('profile_id', profileId)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getTodaysLeaderboard(puzzleId) {
  const { data, error } = await supabase
    .from('results')
    .select('time_seconds, profiles(name, avatar_emoji)')
    .eq('puzzle_id', puzzleId)
    .order('time_seconds', { ascending: true })
    .limit(10);
  if (error) throw error;
  return data || [];
}

// ─── Sudoku Puzzle helpers ───────────────────────────────────────

export async function getTodaysSudokuPuzzle() {
  const today = getTodayDateSGT();
  const { data, error } = await supabase
    .from('sudoku_puzzles')
    .select('*')
    .eq('puzzle_date', today)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function hasCompletedSudokuToday(profileId) {
  const today = getTodayDateSGT();
  const { data: puzzle } = await supabase
    .from('sudoku_puzzles')
    .select('id')
    .eq('puzzle_date', today)
    .single();
  if (!puzzle) return { completed: false, result: null };

  const { data: result } = await supabase
    .from('sudoku_results')
    .select('*')
    .eq('profile_id', profileId)
    .eq('sudoku_puzzle_id', puzzle.id)
    .single();

  return { completed: !!result, result, puzzleId: puzzle.id };
}

export async function saveSudokuPuzzle(puzzleData) {
  const today = getTodayDateSGT();
  const { data, error } = await supabase
    .from('sudoku_puzzles')
    .upsert(
      {
        puzzle_date: today,
        grid: puzzleData.grid,
        givens: puzzleData.givens,
        difficulty: puzzleData.difficulty || 'easy',
      },
      { onConflict: 'puzzle_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveSudokuResult(profileId, puzzleId, timeSeconds) {
  const { data, error } = await supabase
    .from('sudoku_results')
    .upsert(
      {
        profile_id: profileId,
        sudoku_puzzle_id: puzzleId,
        time_seconds: timeSeconds,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,sudoku_puzzle_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTodaysSudokuLeaderboard(puzzleId) {
  const { data, error } = await supabase
    .from('sudoku_results')
    .select('time_seconds, profiles(name, avatar_emoji)')
    .eq('sudoku_puzzle_id', puzzleId)
    .order('time_seconds', { ascending: true })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function getSudokuProfileResults(profileId) {
  const { data, error } = await supabase
    .from('sudoku_results')
    .select('*, sudoku_puzzles(puzzle_date, puzzle_number)')
    .eq('profile_id', profileId)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Packing Puzzle helpers ──────────────────────────────────────

export async function getTodaysPackingPuzzle() {
  const today = getTodayDateSGT();
  const { data, error } = await supabase
    .from('packing_puzzles')
    .select('*')
    .eq('puzzle_date', today)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function hasCompletedPackingToday(profileId) {
  const today = getTodayDateSGT();
  const { data: puzzle } = await supabase
    .from('packing_puzzles')
    .select('id')
    .eq('puzzle_date', today)
    .single();
  if (!puzzle) return { completed: false, result: null };

  const { data: result } = await supabase
    .from('packing_results')
    .select('*')
    .eq('profile_id', profileId)
    .eq('packing_puzzle_id', puzzle.id)
    .single();

  return { completed: !!result, result, puzzleId: puzzle.id };
}

export async function savePackingPuzzle(puzzleData) {
  const { data, error } = await supabase
    .from('packing_puzzles')
    .upsert(
      {
        puzzle_date: puzzleData.puzzle_date,
        pieces: puzzleData.pieces,
        anchors: puzzleData.anchors,
        anchor_positions: puzzleData.anchor_positions,
        solution: puzzleData.solution,
      },
      { onConflict: 'puzzle_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function savePackingResult(profileId, puzzleId, timeSeconds) {
  const { data, error } = await supabase
    .from('packing_results')
    .upsert(
      {
        profile_id: profileId,
        packing_puzzle_id: puzzleId,
        time_seconds: timeSeconds,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,packing_puzzle_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTodaysPackingLeaderboard(puzzleId) {
  const { data, error } = await supabase
    .from('packing_results')
    .select('time_seconds, profiles(name, avatar_emoji)')
    .eq('packing_puzzle_id', puzzleId)
    .order('time_seconds', { ascending: true })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function getPackingProfileResults(profileId) {
  const { data, error } = await supabase
    .from('packing_results')
    .select('*, packing_puzzles(puzzle_date, puzzle_number)')
    .eq('profile_id', profileId)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Combined Stats & History ────────────────────────────────────

export async function getProfileStats(profileId) {
  // Fetch WordChain, Sudoku, and Packing results
  const [wcRes, sudokuRes, packingRes] = await Promise.all([
    supabase
      .from('results')
      .select('time_seconds, completed_at')
      .eq('profile_id', profileId)
      .order('completed_at', { ascending: false }),
    supabase
      .from('sudoku_results')
      .select('time_seconds, completed_at')
      .eq('profile_id', profileId)
      .order('completed_at', { ascending: false }),
    supabase
      .from('packing_results')
      .select('time_seconds, completed_at')
      .eq('profile_id', profileId)
      .order('completed_at', { ascending: false }),
  ]);

  const wcResults = wcRes.data || [];
  const sudokuResults = sudokuRes.data || [];
  const packingResults = packingRes.data || [];
  const allResults = [...wcResults, ...sudokuResults, ...packingResults].sort(
    (a, b) => new Date(b.completed_at) - new Date(a.completed_at)
  );

  if (allResults.length === 0) {
    return { totalPlayed: 0, bestTime: null, avgTime: null, streak: 0 };
  }

  const times = allResults.map((r) => r.time_seconds);
  const bestTime = Math.min(...times);
  const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

  // Calculate streak — consecutive days with at least one game
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const datesPlayed = new Set(
    allResults.map((r) => {
      const d = new Date(r.completed_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    checkDate.setHours(0, 0, 0, 0);
    if (datesPlayed.has(checkDate.getTime())) {
      streak++;
    } else {
      break;
    }
  }

  return { totalPlayed: allResults.length, bestTime, avgTime, streak };
}

// Returns the current consecutive-day streak for one specific game type (SGT timezone)
export async function getStreakForGame(profileId, gameType) {
  const table = gameType === 'sudoku' ? 'sudoku_results'
              : gameType === 'packing' ? 'packing_results'
              : 'results';
  const { data, error } = await supabase
    .from(table)
    .select('completed_at')
    .eq('profile_id', profileId)
    .order('completed_at', { ascending: false });

  if (error || !data || data.length === 0) return 0;

  const sgtOffset = 8 * 60 * 60 * 1000;
  // Build a Set of unique SGT date strings the player completed this game
  const datesPlayed = new Set(
    data.map((r) => {
      const sgt = new Date(new Date(r.completed_at).getTime() + sgtOffset);
      return sgt.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    })
  );

  // Count consecutive days backwards from today SGT
  let streak = 0;
  const nowMs = Date.now();
  for (let i = 0; i < 365; i++) {
    const dayMs = nowMs + sgtOffset - i * 24 * 60 * 60 * 1000;
    const dateStr = new Date(dayMs).toISOString().split('T')[0];
    if (datesPlayed.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function getProfileAllResults(profileId) {
  const [wcRes, sudokuRes, packingRes] = await Promise.all([
    supabase
      .from('results')
      .select('id, time_seconds, completed_at, puzzles(puzzle_date, puzzle_number)')
      .eq('profile_id', profileId),
    supabase
      .from('sudoku_results')
      .select('id, time_seconds, completed_at, sudoku_puzzles(puzzle_date, puzzle_number)')
      .eq('profile_id', profileId),
    supabase
      .from('packing_results')
      .select('id, time_seconds, completed_at, packing_puzzles(puzzle_date, puzzle_number)')
      .eq('profile_id', profileId),
  ]);

  const wcResults = (wcRes.data || []).map((r) => ({
    ...r,
    gameType: 'wordchain',
    puzzle_date: r.puzzles?.puzzle_date,
    puzzle_number: r.puzzles?.puzzle_number,
  }));

  const sudokuResults = (sudokuRes.data || []).map((r) => ({
    ...r,
    gameType: 'sudoku',
    puzzle_date: r.sudoku_puzzles?.puzzle_date,
    puzzle_number: r.sudoku_puzzles?.puzzle_number,
  }));

  const packingResults = (packingRes.data || []).map((r) => ({
    ...r,
    gameType: 'packing',
    puzzle_date: r.packing_puzzles?.puzzle_date,
    puzzle_number: r.packing_puzzles?.puzzle_number,
  }));

  return [...wcResults, ...sudokuResults, ...packingResults].sort(
    (a, b) => new Date(b.completed_at) - new Date(a.completed_at)
  );
}

// ─── Weekly Leaderboard (Combined) ───────────────────────────────

export function getWeekBoundariesSGT() {
  const now = new Date();
  const sgtNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const dayOfWeek = sgtNow.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(sgtNow);
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const mondayDate = new Date(monday.getTime() - (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const sundayDate = new Date(sunday.getTime() - (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const opts = { month: 'short', day: 'numeric' };
  const mondayLabel = monday.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
  const sundayLabel = sunday.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC', year: 'numeric' });
  return { mondayDate, sundayDate, weekLabel: `${mondayLabel} – ${sundayLabel}` };
}

export async function getWeeklyLeaderboard() {
  const { mondayDate, sundayDate, weekLabel } = getWeekBoundariesSGT();

  // Get puzzle IDs for all three games this week
  const [wcPuzzles, sudokuPuzzles, packingPuzzles] = await Promise.all([
    supabase.from('puzzles').select('id').gte('puzzle_date', mondayDate).lte('puzzle_date', sundayDate),
    supabase.from('sudoku_puzzles').select('id').gte('puzzle_date', mondayDate).lte('puzzle_date', sundayDate),
    supabase.from('packing_puzzles').select('id').gte('puzzle_date', mondayDate).lte('puzzle_date', sundayDate),
  ]);

  const wcIds = (wcPuzzles.data || []).map((p) => p.id);
  const sudokuIds = (sudokuPuzzles.data || []).map((p) => p.id);
  const packingIds = (packingPuzzles.data || []).map((p) => p.id);

  if (wcIds.length === 0 && sudokuIds.length === 0 && packingIds.length === 0) {
    return { leaderboard: [], weekLabel };
  }

  // Get results from all three tables
  const promises = [];
  if (wcIds.length > 0) {
    promises.push(
      supabase.from('results').select('profile_id, time_seconds, profiles(name, avatar_emoji)').in('puzzle_id', wcIds)
    );
  } else {
    promises.push(Promise.resolve({ data: [] }));
  }
  if (sudokuIds.length > 0) {
    promises.push(
      supabase.from('sudoku_results').select('profile_id, time_seconds, profiles(name, avatar_emoji)').in('sudoku_puzzle_id', sudokuIds)
    );
  } else {
    promises.push(Promise.resolve({ data: [] }));
  }
  if (packingIds.length > 0) {
    promises.push(
      supabase.from('packing_results').select('profile_id, time_seconds, profiles(name, avatar_emoji)').in('packing_puzzle_id', packingIds)
    );
  } else {
    promises.push(Promise.resolve({ data: [] }));
  }

  const [wcResults, sudokuResults, packingResults] = await Promise.all(promises);
  const allResults = [...(wcResults.data || []), ...(sudokuResults.data || []), ...(packingResults.data || [])];

  if (allResults.length === 0) {
    return { leaderboard: [], weekLabel };
  }

  // Aggregate by profile
  const profileMap = {};
  for (const r of allResults) {
    if (!profileMap[r.profile_id]) {
      profileMap[r.profile_id] = {
        profile_id: r.profile_id,
        name: r.profiles?.name || 'Unknown',
        avatar_emoji: r.profiles?.avatar_emoji || '?',
        totalTime: 0,
        gamesPlayed: 0,
      };
    }
    profileMap[r.profile_id].totalTime += r.time_seconds;
    profileMap[r.profile_id].gamesPlayed += 1;
  }

  const leaderboard = Object.values(profileMap)
    .map((p) => ({
      ...p,
      avgTime: Math.round(p.totalTime / p.gamesPlayed),
    }))
    .sort((a, b) => a.avgTime - b.avgTime);

  return { leaderboard, weekLabel };
}

// ─── Utility ──────────────────────────────────────────────────────

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_wordchain_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
