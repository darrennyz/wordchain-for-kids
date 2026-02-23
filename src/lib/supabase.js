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

// ─── Puzzle helpers ───────────────────────────────────────────────

function getTodayDateSGT() {
  // Get today's date in Singapore timezone (UTC+8)
  const now = new Date();
  const sgt = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return sgt.toISOString().split('T')[0];
}

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

// ─── Results helpers ──────────────────────────────────────────────

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

export async function getProfileStats(profileId) {
  const { data, error } = await supabase
    .from('results')
    .select('time_seconds, completed_at')
    .eq('profile_id', profileId)
    .order('completed_at', { ascending: false });
  if (error) throw error;

  const results = data || [];
  if (results.length === 0) {
    return { totalPlayed: 0, bestTime: null, avgTime: null, streak: 0 };
  }

  const times = results.map((r) => r.time_seconds);
  const bestTime = Math.min(...times);
  const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

  // Calculate streak
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < results.length; i++) {
    const d = new Date(results[i].completed_at);
    d.setHours(0, 0, 0, 0);
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (d.getTime() === expected.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return { totalPlayed: results.length, bestTime, avgTime, streak };
}

// ─── Utility ──────────────────────────────────────────────────────

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_wordchain_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
