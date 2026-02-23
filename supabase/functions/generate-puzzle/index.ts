// Supabase Edge Function: generate-puzzle
// Calls Claude API to generate a daily WordChain puzzle, then stores it in the database.
// Falls back to algorithmic generation if Claude fails after 50 attempts.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Verified compound word pairs ─────
const VERIFIED_PAIRS: Record<string, string[]> = {
  RAIN: ['BOW', 'COAT', 'DROP', 'FALL', 'STORM'],
  BOW: ['TIE'],
  TIE: ['DYE', 'BREAK'],
  SUN: ['FLOWER', 'LIGHT', 'BURN', 'SET', 'RISE', 'SHINE', 'SCREEN'],
  FLOWER: ['BED', 'POT'],
  BED: ['BUG', 'ROCK', 'ROOM', 'TIME', 'SIDE', 'SPREAD'],
  BATH: ['ROOM', 'TUB', 'ROBE', 'WATER'],
  CUP: ['CAKE', 'BOARD'],
  CAKE: ['WALK'],
  WALK: ['WAY', 'OUT'],
  WAY: ['SIDE'],
  SIDE: ['KICK', 'WALK', 'LINE', 'SHOW', 'STEP', 'CAR'],
  KICK: ['BALL', 'BACK', 'STAND', 'START'],
  BALL: ['ROOM', 'PARK', 'GAME', 'POINT'],
  STAR: ['FISH', 'LIGHT', 'DUST', 'BOARD'],
  FISH: ['BOWL', 'POND', 'TANK', 'CAKE', 'BONE'],
  SNOW: ['MAN', 'BALL', 'FALL', 'FLAKE', 'STORM', 'DROP', 'BOARD'],
  SAND: ['BOX', 'CASTLE', 'STONE', 'STORM'],
  BOX: ['CAR'],
  CAR: ['POOL', 'GO', 'PORT', 'PET'],
  FIRE: ['FLY', 'TRUCK', 'WORK', 'PLACE', 'HOUSE', 'MAN', 'WOOD', 'BALL', 'SIDE'],
  POP: ['CORN', 'STAR'],
  CORN: ['BREAD', 'FIELD'],
  TOOTH: ['BRUSH', 'PASTE', 'PICK', 'ACHE'],
  BLUE: ['BERRY', 'BELL', 'BIRD', 'PRINT'],
  BIRD: ['HOUSE', 'BATH', 'CAGE', 'SEED'],
  HOUSE: ['FLY', 'WORK', 'BOAT', 'WIFE', 'CAT', 'HOLD', 'PLANT'],
  GOLD: ['FISH', 'MINE'],
  DOG: ['HOUSE', 'FISH', 'WOOD'],
  WOOD: ['LAND', 'WORK', 'PECK'],
  LAND: ['MARK', 'SLIDE', 'LORD', 'FILL', 'LOCK'],
  BOOK: ['MARK', 'WORM', 'CASE', 'SHELF', 'SHOP', 'STORE', 'END'],
  PAN: ['CAKE'],
  AIR: ['PORT', 'PLANE', 'MAIL', 'LINE', 'CRAFT', 'WAY', 'LOCK', 'SHIP'],
  PORT: ['HOLE', 'SIDE'],
  MAIL: ['BOX', 'MAN', 'BAG'],
  BAG: ['PIPE'],
  PIPE: ['LINE', 'DREAM'],
  LINE: ['UP', 'MAN', 'BACK'],
  BACK: ['BONE', 'PACK', 'FIRE', 'YARD', 'DOOR', 'HAND', 'LOG', 'TRACK', 'GROUND'],
  BONE: ['FIRE'],
  YARD: ['STICK', 'WORK', 'SALE'],
  DOOR: ['BELL', 'KNOB', 'MAT', 'STEP', 'WAY'],
  STEP: ['FATHER', 'LADDER', 'CHILD', 'MOTHER'],
  DAY: ['LIGHT', 'DREAM', 'TIME', 'BREAK'],
  LIGHT: ['HOUSE', 'BULB', 'YEAR', 'NING'],
  DREAM: ['LAND', 'BOAT'],
  TIME: ['LINE', 'OUT', 'TABLE', 'LOCK', 'STAMP'],
  NIGHT: ['FALL', 'LIGHT', 'TIME', 'GOWN', 'MARE', 'CAP'],
  SEA: ['SHELL', 'HORSE', 'FOOD', 'SHORE', 'SIDE', 'WEED', 'BED', 'BIRD', 'PORT'],
  SHELL: ['FISH'],
  HORSE: ['SHOE', 'FLY', 'BACK', 'PLAY', 'TAIL', 'POWER'],
  SHOE: ['LACE', 'HORN', 'MAKER', 'BOX', 'STRING'],
  PLAY: ['GROUND', 'MATE', 'TIME', 'PEN', 'ROOM', 'DATE', 'HOUSE'],
  GROUND: ['WORK', 'HOG', 'WATER'],
  WATER: ['FALL', 'COLOR', 'MARK', 'MELON', 'PROOF', 'FRONT', 'SIDE', 'SLIDE'],
  FALL: ['OUT', 'BACK'],
  EYE: ['BALL', 'BROW', 'LID', 'LASH', 'SIGHT'],
  HEAD: ['BAND', 'LINE', 'LIGHT', 'SET', 'PHONE', 'FIRST', 'LOCK', 'REST'],
  BAND: ['AID', 'STAND', 'WAGON'],
  HAND: ['SHAKE', 'MADE', 'BAG', 'BALL', 'BOOK', 'STAND', 'RAIL', 'OUT'],
  RAIL: ['ROAD', 'WAY'],
  ROAD: ['SIDE', 'BLOCK', 'KILL', 'MAP', 'WORK', 'SHOW', 'TRIP', 'HOUSE', 'WAY'],
  FOOT: ['BALL', 'PRINT', 'HILL', 'HOLD', 'NOTE', 'PATH', 'REST', 'STEP', 'WEAR', 'WORK'],
  PATH: ['WAY', 'FINDER'],
  ICE: ['BERG', 'CREAM', 'LAND', 'CAP', 'BREAKER'],
  STRAW: ['BERRY'],
  BLACK: ['BERRY', 'BIRD', 'BOARD', 'MAIL', 'OUT', 'SMITH', 'TOP'],
  BOARD: ['ROOM', 'WALK', 'GAME'],
  ROOM: ['MATE'],
  WHITE: ['BOARD', 'WASH', 'HOUSE', 'OUT', 'TAIL'],
  GREEN: ['HOUSE', 'LAND', 'BACK'],
  FARM: ['LAND', 'HOUSE', 'YARD'],
  CAMP: ['FIRE', 'GROUND', 'SITE'],
  HOME: ['WORK', 'SICK', 'TOWN', 'LAND', 'MADE', 'ROOM', 'BASE', 'COMING'],
  WORK: ['BOOK', 'BENCH', 'FORCE', 'LOAD', 'MAN', 'OUT', 'PLACE', 'ROOM', 'SHOP'],
  SHOP: ['KEEPER', 'LIFT'],
  BASE: ['BALL', 'BOARD', 'CAMP', 'LINE', 'MENT'],
  HAIR: ['BAND', 'BRUSH', 'CUT', 'LINE', 'PIN', 'SPRAY', 'STYLE', 'DRY'],
  TABLE: ['CLOTH', 'TOP', 'LAND', 'SPOON'],
  TOP: ['SOIL', 'COAT', 'SIDE'],
  COAT: ['RACK', 'TAIL'],
  NET: ['BALL', 'WORK'],
  BASKET: ['BALL', 'CASE', 'WORK'],
  OVER: ['COAT', 'FLOW', 'LOOK', 'NIGHT', 'TIME', 'ALL'],
  OUT: ['DOOR', 'FIT', 'SIDE', 'LINE', 'COME', 'LOOK', 'BREAK', 'BURST', 'LAW', 'RUN'],
  TREE: ['HOUSE', 'TOP'],
  APPLE: ['SAUCE'],
  SAUCE: ['PAN'],
  BUTTER: ['CUP', 'FLY', 'MILK', 'FINGER', 'SCOTCH'],
  MILK: ['MAN', 'SHAKE', 'MAID', 'WEED'],
};

// ─── Algorithmic chain generator ─────
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function findChainDFS(current: string, targetLength: number, visited: Set<string>, path: string[] = []): string[] | null {
  path = [...path, current];
  visited = new Set(visited);
  visited.add(current);

  if (path.length === targetLength) return path;

  const targets = VERIFIED_PAIRS[current] || [];
  const shuffledTargets = shuffleArray(targets);

  for (const next of shuffledTargets) {
    if (visited.has(next)) continue;
    if (path.length < targetLength - 1 && (!VERIFIED_PAIRS[next] || VERIFIED_PAIRS[next].length === 0)) continue;
    const result = findChainDFS(next, targetLength, visited, path);
    if (result) return result;
  }
  return null;
}

function generateChainAlgorithmic(): string[] | null {
  const startWords = Object.keys(VERIFIED_PAIRS).filter(w => VERIFIED_PAIRS[w].length > 0);
  const shuffled = shuffleArray(startWords);
  for (const startWord of shuffled) {
    const chain = findChainDFS(startWord, 7, new Set());
    if (chain) return chain;
  }
  return null;
}

function validateChain(solution: string[], words?: string[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < solution.length - 1; i++) {
    const a = solution[i].toUpperCase();
    const b = solution[i + 1].toUpperCase();
    const targets = VERIFIED_PAIRS[a];
    if (!targets || !targets.includes(b)) {
      errors.push(`${a}+${b} is not a verified pair`);
    }
  }
  // Verify words and solution contain the same set of words
  if (words) {
    const sortedWords = [...words].map(w => w.toUpperCase()).sort().join(',');
    const sortedSolution = [...solution].map(w => w.toUpperCase()).sort().join(',');
    if (sortedWords !== sortedSolution) {
      errors.push(`words do not match solution`);
    }
  }
  return errors;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    // Check if we already have today's puzzle
    const { data: existing } = await supabase
      .from('puzzles')
      .select('*')
      .eq('puzzle_date', today)
      .single();

    if (existing) {
      return new Response(JSON.stringify(existing), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try Claude API first (up to 10 attempts in Edge Function to stay within time limits)
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    let puzzleData: any = null;

    if (anthropicKey) {
      const prompt = `You are generating a word chain puzzle for kids aged 5-7. You must create a chain of EXACTLY 7 words.

THE CORE RULE:
Each neighboring pair in the chain must form a REAL, well-known compound word or two-word phrase. The word on the LEFT is always the FIRST part of the compound.

Use ONLY pairs from this verified list. Build a chain of 7 words where each adjacent pair forms a valid compound.

RAIN→BOW, BOW→TIE, TIE→DYE, SUN→FLOWER, FLOWER→BED, FLOWER→POT, BED→ROOM, BED→TIME, BED→SIDE, BED→ROCK, CUP→CAKE, CAKE→WALK, WALK→WAY, WALK→OUT, WAY→SIDE, SIDE→KICK, SIDE→WALK, SIDE→LINE, SIDE→CAR, SIDE→STEP, KICK→BALL, KICK→BACK, BALL→ROOM, BALL→PARK, STAR→FISH, STAR→LIGHT, STAR→DUST, FISH→BOWL, FISH→BONE, FISH→CAKE, SNOW→BALL, SNOW→FALL, SNOW→BOARD, SAND→BOX, SAND→CASTLE, SAND→STONE, BOX→CAR, CAR→POOL, CAR→PORT, FIRE→FLY, FIRE→WORK, FIRE→PLACE, FIRE→HOUSE, FIRE→WOOD, FIRE→BALL, FIRE→SIDE, POP→CORN, CORN→BREAD, TOOTH→BRUSH, BLUE→BERRY, BLUE→BIRD, BLUE→BELL, BIRD→HOUSE, BIRD→BATH, BIRD→SEED, HOUSE→FLY, HOUSE→WORK, HOUSE→BOAT, HOUSE→CAT, GOLD→FISH, DOG→HOUSE, DOG→WOOD, WOOD→LAND, WOOD→WORK, LAND→MARK, LAND→SLIDE, BOOK→MARK, BOOK→WORM, BOOK→CASE, BOOK→SHELF, AIR→PORT, AIR→MAIL, AIR→LINE, AIR→WAY, PORT→HOLE, PORT→SIDE, MAIL→BOX, MAIL→MAN, DOOR→BELL, DOOR→STEP, DOOR→WAY, STEP→FATHER, STEP→LADDER, DAY→LIGHT, DAY→DREAM, DAY→TIME, LIGHT→HOUSE, DREAM→LAND, DREAM→BOAT, TIME→LINE, TIME→OUT, TIME→TABLE, NIGHT→FALL, NIGHT→LIGHT, NIGHT→TIME, SEA→SHELL, SEA→HORSE, SEA→SIDE, SEA→BED, SEA→BIRD, SEA→PORT, SHELL→FISH, HORSE→SHOE, HORSE→FLY, HORSE→BACK, HORSE→PLAY, PLAY→GROUND, PLAY→MATE, PLAY→TIME, PLAY→HOUSE, PLAY→ROOM, GROUND→WORK, GROUND→WATER, WATER→FALL, WATER→MARK, WATER→MELON, WATER→SIDE, WATER→SLIDE, FALL→OUT, FALL→BACK, EYE→BALL, HEAD→BAND, HEAD→LINE, HEAD→LIGHT, BAND→AID, HAND→BALL, HAND→BOOK, HAND→RAIL, RAIL→ROAD, RAIL→WAY, ROAD→SIDE, ROAD→WORK, FOOT→BALL, FOOT→PATH, FOOT→STEP, FOOT→WORK, PATH→WAY, BACK→BONE, BACK→PACK, BACK→FIRE, BACK→YARD, BACK→DOOR, BACK→GROUND, BONE→FIRE, OVER→COAT, OVER→NIGHT, OVER→TIME, OUT→DOOR, OUT→SIDE, OUT→LINE, OUT→BREAK, TREE→HOUSE, TREE→TOP, BUTTER→CUP, BUTTER→FLY, BUTTER→MILK, CAMP→FIRE, CAMP→GROUND, HOME→WORK, HOME→LAND, HOME→ROOM, WORK→BOOK, WORK→OUT, WORK→SHOP, WORK→ROOM, HAIR→BAND, HAIR→LINE, TABLE→TOP, TABLE→LAND, TOP→COAT, TOP→SIDE, NET→BALL, NET→WORK, BASKET→BALL, BASE→BALL, BASE→BOARD, BASE→CAMP, APPLE→SAUCE, SAUCE→PAN, PAN→CAKE, MILK→MAN, ROOM→MATE, FARM→LAND, FARM→HOUSE, FARM→YARD, BOARD→ROOM, BOARD→WALK, GREEN→HOUSE, GREEN→LAND, BLACK→BIRD, BLACK→BOARD, BLACK→MAIL, WHITE→BOARD, WHITE→HOUSE, PIPE→LINE, PIPE→DREAM, YARD→STICK, BAG→PIPE, COAT→RACK

Respond with ONLY valid JSON:
{"words": ["W1","W2","W3","W4","W5","W6","W7"], "solution": ["W1","W2","W3","W4","W5","W6","W7"], "pair_explanations": ["W1+W2 = compound","W2+W3 = compound","W3+W4 = compound","W4+W5 = compound","W5+W6 = compound","W6+W7 = compound"]}

"words" = SCRAMBLED order. "solution" = CORRECT chain order.`;

      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1024,
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          if (!claudeResponse.ok) continue;

          const claudeData = await claudeResponse.json();
          const content = claudeData.content[0].text;
          const parsed = JSON.parse(content);

          if (parsed.words?.length === 7 && parsed.solution?.length === 7) {
            const errors = validateChain(parsed.solution, parsed.words);
            if (errors.length === 0) {
              puzzleData = parsed;
              break;
            }
          }
        } catch (_e) {
          // Continue to next attempt
        }
      }
    }

    // Algorithmic fallback
    if (!puzzleData) {
      const chain = generateChainAlgorithmic();
      if (chain) {
        const solution = chain.map(w => w.toUpperCase());
        const words = shuffleArray([...solution]);
        const pairExplanations = [];
        for (let i = 0; i < solution.length - 1; i++) {
          pairExplanations.push(`${solution[i]}+${solution[i + 1]} = ${solution[i].toLowerCase()}${solution[i + 1].toLowerCase()}`);
        }
        puzzleData = { words, solution, pair_explanations: pairExplanations };
      }
    }

    if (!puzzleData) {
      throw new Error('Failed to generate puzzle via both Claude and algorithmic fallback');
    }

    // Store in database
    const { data: newPuzzle, error: insertError } = await supabase
      .from('puzzles')
      .insert({
        puzzle_date: today,
        words: puzzleData.words,
        solution: puzzleData.solution,
        pair_explanations: puzzleData.pair_explanations || [],
        difficulty: 'easy',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify(newPuzzle), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate puzzle error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
