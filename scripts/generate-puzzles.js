#!/usr/bin/env node

/**
 * Batch Puzzle Generator for WordChain
 *
 * Pre-generates puzzles using Claude API and stores them in Supabase.
 * Falls back to algorithmic generation if Claude fails.
 *
 * Run: ANTHROPIC_API_KEY=sk-... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/generate-puzzles.js [days]
 *
 * Arguments:
 *   days - number of days ahead to generate (default: 30)
 */

import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables. Required:');
  console.error('  SUPABASE_URL, SUPABASE_SERVICE_KEY');
  console.error('  ANTHROPIC_API_KEY (optional - will use algorithmic fallback if missing)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const daysAhead = parseInt(process.argv[2] || '30', 10);

// ─── Verified compound word pairs (both directions mapped) ─────
// Each entry: WORD_A + WORD_B = known compound
const VERIFIED_PAIRS = {
  RAIN: ['BOW', 'COAT', 'DROP', 'FALL', 'STORM'],
  BOW: ['TIE'],
  TIE: ['DYE', 'BREAK'],
  DYE: [],
  SUN: ['FLOWER', 'LIGHT', 'BURN', 'SET', 'RISE', 'SHINE', 'SCREEN'],
  FLOWER: ['BED', 'POT'],
  BED: ['BUG', 'ROCK', 'ROOM', 'TIME', 'SIDE', 'SPREAD'],
  BUG: [],
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
  MAN: [],
  SAND: ['BOX', 'CASTLE', 'STONE', 'STORM'],
  BOX: ['CAR'],
  CAR: ['POOL', 'GO', 'PORT', 'PET'],
  FIRE: ['FLY', 'TRUCK', 'WORK', 'PLACE', 'HOUSE', 'MAN', 'WOOD', 'BALL', 'SIDE'],
  FLY: [],
  POP: ['CORN', 'STAR'],
  CORN: ['BREAD', 'FIELD'],
  BREAD: [],
  TOOTH: ['BRUSH', 'PASTE', 'PICK', 'ACHE'],
  BRUSH: [],
  BLUE: ['BERRY', 'BELL', 'BIRD', 'PRINT'],
  BERRY: [],
  BIRD: ['HOUSE', 'BATH', 'CAGE', 'SEED'],
  HOUSE: ['FLY', 'WORK', 'BOAT', 'WIFE', 'CAT', 'HOLD', 'PLANT'],
  GOLD: ['FISH', 'MINE'],
  MINE: [],
  DOG: ['HOUSE', 'FISH', 'WOOD'],
  WOOD: ['LAND', 'WORK', 'PECK'],
  LAND: ['MARK', 'SLIDE', 'LORD', 'FILL', 'LOCK'],
  BOOK: ['MARK', 'WORM', 'CASE', 'SHELF', 'SHOP', 'STORE', 'END'],
  MARK: [],
  WORM: ['HOLE'],
  HOLE: [],
  PAN: ['CAKE'],
  AIR: ['PORT', 'PLANE', 'MAIL', 'LINE', 'CRAFT', 'WAY', 'LOCK', 'SHIP'],
  PORT: ['HOLE', 'SIDE'],
  PLANE: [],
  MAIL: ['BOX', 'MAN', 'BAG'],
  BAG: ['PIPE'],
  PIPE: ['LINE', 'DREAM'],
  LINE: ['UP', 'MAN', 'BACK'],
  BACK: ['BONE', 'PACK', 'FIRE', 'YARD', 'DOOR', 'HAND', 'LOG', 'TRACK', 'GROUND'],
  BONE: ['FIRE'],
  PACK: [],
  YARD: ['STICK', 'WORK', 'SALE'],
  DOOR: ['BELL', 'KNOB', 'MAT', 'STEP', 'WAY'],
  BELL: [],
  KNOB: [],
  MAT: [],
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
  LACE: [],
  HORN: [],
  PLAY: ['GROUND', 'MATE', 'TIME', 'PEN', 'ROOM', 'DATE', 'HOUSE'],
  GROUND: ['WORK', 'HOG', 'WATER'],
  WATER: ['FALL', 'COLOR', 'MARK', 'MELON', 'PROOF', 'FRONT', 'SIDE', 'SLIDE'],
  FALL: ['OUT', 'BACK'],
  EYE: ['BALL', 'BROW', 'LID', 'LASH', 'SIGHT'],
  LID: [],
  LASH: [],
  HEAD: ['BAND', 'LINE', 'LIGHT', 'SET', 'PHONE', 'FIRST', 'LOCK', 'REST'],
  BAND: ['AID', 'STAND', 'WAGON'],
  AID: [],
  HAND: ['SHAKE', 'MADE', 'BAG', 'BALL', 'BOOK', 'STAND', 'RAIL', 'OUT'],
  RAIL: ['ROAD', 'WAY'],
  ROAD: ['SIDE', 'BLOCK', 'KILL', 'MAP', 'WORK', 'SHOW', 'TRIP', 'HOUSE', 'WAY'],
  FOOT: ['BALL', 'PRINT', 'HILL', 'HOLD', 'NOTE', 'PATH', 'REST', 'STEP', 'WEAR', 'WORK'],
  PATH: ['WAY', 'FINDER'],
  ICE: ['BERG', 'CREAM', 'LAND', 'CAP', 'BREAKER'],
  CREAM: [],
  STRAW: ['BERRY'],
  BLACK: ['BERRY', 'BIRD', 'BOARD', 'MAIL', 'OUT', 'SMITH', 'TOP'],
  BOARD: ['ROOM', 'WALK', 'GAME'],
  ROOM: ['MATE'],
  MATE: [],
  WHITE: ['BOARD', 'WASH', 'HOUSE', 'OUT', 'TAIL'],
  GREEN: ['HOUSE', 'LAND', 'BACK'],
  FARM: ['LAND', 'HOUSE', 'YARD'],
  CAMP: ['FIRE', 'GROUND', 'SITE'],
  HOME: ['WORK', 'SICK', 'TOWN', 'LAND', 'MADE', 'ROOM', 'BASE', 'COMING'],
  WORK: ['BOOK', 'BENCH', 'FORCE', 'LOAD', 'MAN', 'OUT', 'PLACE', 'ROOM', 'SHOP'],
  SHOP: ['KEEPER', 'LIFT'],
  BASE: ['BALL', 'BOARD', 'CAMP', 'LINE', 'MENT'],
  HAIR: ['BAND', 'BRUSH', 'CUT', 'LINE', 'PIN', 'SPRAY', 'STYLE', 'DRY'],
  DRY: [],
  TABLE: ['CLOTH', 'TOP', 'LAND', 'SPOON'],
  CLOTH: [],
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

// ─── Compound name lookup for pair explanations ─────
const COMPOUND_NAMES = {};
for (const [word, targets] of Object.entries(VERIFIED_PAIRS)) {
  for (const target of targets) {
    COMPOUND_NAMES[`${word}+${target}`] = `${word.toLowerCase()}${target.toLowerCase()}`;
  }
}

// ─── Algorithmic Chain Generator (guaranteed to work) ─────
function generateChainAlgorithmic(usedChains = []) {
  // Get all words that have outgoing edges (can start/continue a chain)
  const startWords = Object.keys(VERIFIED_PAIRS).filter(w => VERIFIED_PAIRS[w].length > 0);

  // Shuffle start words for variety
  const shuffled = [...startWords].sort(() => Math.random() - 0.5);

  for (const startWord of shuffled) {
    const chain = findChainDFS(startWord, 7, new Set(), usedChains);
    if (chain) return chain;
  }

  // Should never happen with our dictionary, but just in case
  return null;
}

function findChainDFS(current, targetLength, visited, usedChains, path = []) {
  path = [...path, current];
  visited = new Set(visited);
  visited.add(current);

  if (path.length === targetLength) {
    // Check this chain hasn't been used before
    const chainStr = path.join('>');
    if (!usedChains.includes(chainStr)) {
      return path;
    }
    return null;
  }

  const targets = VERIFIED_PAIRS[current] || [];
  // Shuffle targets for variety
  const shuffledTargets = [...targets].sort(() => Math.random() - 0.5);

  for (const next of shuffledTargets) {
    if (visited.has(next)) continue;
    // Check if next has enough outgoing edges to continue (unless we're at the end)
    if (path.length < targetLength - 1 && (!VERIFIED_PAIRS[next] || VERIFIED_PAIRS[next].length === 0)) {
      continue;
    }
    const result = findChainDFS(next, targetLength, visited, usedChains, path);
    if (result) return result;
  }

  return null;
}

function buildPuzzleFromChain(chain) {
  const solution = chain.map(w => w.toUpperCase());
  const words = [...solution].sort(() => Math.random() - 0.5);
  const pairExplanations = [];
  for (let i = 0; i < solution.length - 1; i++) {
    const key = `${solution[i]}+${solution[i + 1]}`;
    const compound = COMPOUND_NAMES[key] || `${solution[i].toLowerCase()} ${solution[i + 1].toLowerCase()}`;
    pairExplanations.push(`${solution[i]}+${solution[i + 1]} = ${compound}`);
  }
  return { words, solution, pair_explanations: pairExplanations };
}

// ─── Claude API Generator ─────
const PROMPT = `You are generating a word chain puzzle for kids aged 5-7. You must create a chain of EXACTLY 7 words.

THE CORE RULE:
Each neighboring pair in the chain must form a REAL, well-known compound word or two-word phrase. The word on the LEFT is always the FIRST part of the compound.

Here is a REFERENCE LIST of verified compound word pairs you should use. Pick pairs from this list to build your chain:

RAIN→BOW (rainbow), BOW→TIE (bow tie), TIE→DYE (tie-dye)
SUN→FLOWER (sunflower), FLOWER→BED (flowerbed), FLOWER→POT (flowerpot)
BED→BUG (bedbug), BED→ROCK (bedrock), BED→ROOM (bedroom), BED→TIME (bedtime), BED→SIDE (bedside)
CUP→CAKE (cupcake), CAKE→WALK (cakewalk), WALK→WAY (walkway)
WAY→SIDE (wayside), SIDE→KICK (sidekick), SIDE→WALK (sidewalk), SIDE→LINE (sideline), SIDE→STEP (sidestep), SIDE→CAR (sidecar)
KICK→BALL (kickball), KICK→BACK (kickback), KICK→START (kickstart)
BALL→ROOM (ballroom), BALL→PARK (ballpark), BALL→GAME (ball game)
STAR→FISH (starfish), STAR→LIGHT (starlight), STAR→DUST (stardust)
FISH→BOWL (fishbowl), FISH→POND (fish pond), FISH→TANK (fish tank), FISH→BONE (fishbone), FISH→CAKE (fishcake)
SNOW→MAN (snowman), SNOW→BALL (snowball), SNOW→FALL (snowfall), SNOW→FLAKE (snowflake), SNOW→BOARD (snowboard)
SAND→BOX (sandbox), SAND→CASTLE (sandcastle), SAND→STONE (sandstone)
FIRE→FLY (firefly), FIRE→TRUCK (fire truck), FIRE→WORK (firework), FIRE→PLACE (fireplace), FIRE→HOUSE (firehouse), FIRE→WOOD (firewood), FIRE→BALL (fireball), FIRE→SIDE (fireside)
POP→CORN (popcorn), POP→STAR (popstar), CORN→BREAD (cornbread)
TOOTH→BRUSH (toothbrush), TOOTH→PASTE (toothpaste)
BLUE→BERRY (blueberry), BLUE→BIRD (bluebird), BLUE→BELL (bluebell), BLUE→PRINT (blueprint)
BIRD→HOUSE (birdhouse), BIRD→BATH (birdbath), BIRD→SEED (birdseed)
HOUSE→FLY (housefly), HOUSE→BOAT (houseboat), HOUSE→WORK (housework), HOUSE→CAT (housecat), HOUSE→PLANT (houseplant)
GOLD→FISH (goldfish), GOLD→MINE (goldmine)
DOG→HOUSE (doghouse), DOG→WOOD (dogwood)
WOOD→LAND (woodland), WOOD→WORK (woodwork), WOOD→PECK (woodpecker)
LAND→MARK (landmark), LAND→SLIDE (landslide), LAND→FILL (landfill), LAND→LORD (landlord)
BOOK→MARK (bookmark), BOOK→WORM (bookworm), BOOK→CASE (bookcase), BOOK→SHELF (bookshelf), BOOK→SHOP (bookshop), BOOK→END (bookend)
AIR→PORT (airport), AIR→PLANE (airplane), AIR→MAIL (airmail), AIR→LINE (airline), AIR→WAY (airway), AIR→LOCK (airlock)
MAIL→BOX (mailbox), MAIL→MAN (mailman)
DOOR→BELL (doorbell), DOOR→KNOB (doorknob), DOOR→MAT (doormat), DOOR→STEP (doorstep), DOOR→WAY (doorway)
STEP→FATHER (stepfather), STEP→MOTHER (stepmother), STEP→LADDER (stepladder)
DAY→LIGHT (daylight), DAY→DREAM (daydream), DAY→TIME (daytime), DAY→BREAK (daybreak)
LIGHT→HOUSE (lighthouse), LIGHT→BULB (lightbulb)
DREAM→LAND (dreamland), DREAM→BOAT (dreamboat)
TIME→LINE (timeline), TIME→OUT (timeout), TIME→TABLE (timetable)
NIGHT→FALL (nightfall), NIGHT→LIGHT (nightlight), NIGHT→TIME (nighttime), NIGHT→GOWN (nightgown)
SEA→SHELL (seashell), SEA→HORSE (seahorse), SEA→FOOD (seafood), SEA→SHORE (seashore), SEA→SIDE (seaside), SEA→WEED (seaweed), SEA→BED (seabed), SEA→BIRD (seabird), SEA→PORT (seaport)
HORSE→SHOE (horseshoe), HORSE→FLY (horsefly), HORSE→BACK (horseback), HORSE→PLAY (horseplay), HORSE→TAIL (horsetail)
PLAY→GROUND (playground), PLAY→MATE (playmate), PLAY→TIME (playtime), PLAY→HOUSE (playhouse), PLAY→ROOM (playroom)
GROUND→WORK (groundwork), GROUND→HOG (groundhog), GROUND→WATER (groundwater)
WATER→FALL (waterfall), WATER→COLOR (watercolor), WATER→MARK (watermark), WATER→MELON (watermelon), WATER→FRONT (waterfront), WATER→SIDE (waterside), WATER→SLIDE (waterslide)
HEAD→BAND (headband), HEAD→LINE (headline), HEAD→LIGHT (headlight), HEAD→SET (headset), HEAD→PHONE (headphone)
BAND→AID (band-aid)
HAND→SHAKE (handshake), HAND→MADE (handmade), HAND→BALL (handball), HAND→BOOK (handbook), HAND→STAND (handstand), HAND→RAIL (handrail)
ROAD→SIDE (roadside), ROAD→MAP (roadmap), ROAD→BLOCK (roadblock), ROAD→SHOW (roadshow), ROAD→WORK (roadwork)
FOOT→BALL (football), FOOT→PRINT (footprint), FOOT→HOLD (foothold), FOOT→NOTE (footnote), FOOT→PATH (footpath), FOOT→REST (footrest), FOOT→STEP (footstep), FOOT→WORK (footwork)
PATH→WAY (pathway)
ICE→CREAM (ice cream), ICE→BERG (iceberg), ICE→LAND (Iceland)
STRAW→BERRY (strawberry)
BLACK→BERRY (blackberry), BLACK→BIRD (blackbird), BLACK→BOARD (blackboard), BLACK→MAIL (blackmail), BLACK→OUT (blackout), BLACK→SMITH (blacksmith), BLACK→TOP (blacktop)
BOARD→ROOM (boardroom), BOARD→WALK (boardwalk), BOARD→GAME (board game)
WHITE→BOARD (whiteboard), WHITE→HOUSE (White House), WHITE→WASH (whitewash)
GREEN→HOUSE (greenhouse), GREEN→LAND (Greenland), GREEN→BACK (greenback)
CAMP→FIRE (campfire), CAMP→GROUND (campground), CAMP→SITE (campsite)
HOME→WORK (homework), HOME→SICK (homesick), HOME→TOWN (hometown), HOME→LAND (homeland), HOME→MADE (homemade), HOME→ROOM (homeroom)
WORK→BOOK (workbook), WORK→BENCH (workbench), WORK→OUT (workout), WORK→PLACE (workplace), WORK→SHOP (workshop), WORK→ROOM (workroom)
BACK→BONE (backbone), BACK→PACK (backpack), BACK→FIRE (backfire), BACK→YARD (backyard), BACK→DOOR (backdoor), BACK→GROUND (background)
OVER→COAT (overcoat), OVER→FLOW (overflow), OVER→LOOK (overlook), OVER→NIGHT (overnight), OVER→TIME (overtime), OVER→ALL (overall)
OUT→DOOR (outdoor), OUT→SIDE (outside), OUT→LINE (outline), OUT→BREAK (outbreak), OUT→COME (outcome), OUT→LOOK (outlook)
TREE→HOUSE (treehouse), TREE→TOP (treetop)
BUTTER→CUP (buttercup), BUTTER→FLY (butterfly), BUTTER→MILK (buttermilk)
HAIR→BAND (hairband), HAIR→BRUSH (hairbrush), HAIR→CUT (haircut), HAIR→LINE (hairline), HAIR→PIN (hairpin), HAIR→SPRAY (hairspray)
TABLE→CLOTH (tablecloth), TABLE→TOP (tabletop), TABLE→LAND (tableland), TABLE→SPOON (tablespoon)
NET→BALL (netball), NET→WORK (network)
BASKET→BALL (basketball), BASE→BALL (baseball)
APPLE→SAUCE (applesauce), SAUCE→PAN (saucepan)
PAN→CAKE (pancake)
MILK→MAN (milkman), MILK→SHAKE (milkshake)
ROOM→MATE (roommate)
EYE→BALL (eyeball), EYE→BROW (eyebrow), EYE→LID (eyelid), EYE→LASH (eyelash)
FARM→LAND (farmland), FARM→HOUSE (farmhouse), FARM→YARD (farmyard)
BONE→FIRE (bonfire)
COAT→RACK (coat rack)
BOX→CAR (boxcar)
CAR→POOL (carpool), CAR→PORT (carport), CAR→GO (cargo), CAR→PET (carpet)
PORT→HOLE (porthole), PORT→SIDE (portside)
RAIL→ROAD (railroad), RAIL→WAY (railway)
PIPE→LINE (pipeline), PIPE→DREAM (pipe dream)
YARD→STICK (yardstick)

YOUR TASK:
1. Using ONLY pairs from the reference list above, build a chain of exactly 7 words where each adjacent pair forms a valid compound.
2. Verify the chain connects end-to-end: the second word of pair 1 must be the first word of pair 2, etc.
3. Make sure every pair appears in the reference list.

Respond with ONLY valid JSON, no other text:
{
  "words": ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
  "solution": ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
  "pair_explanations": ["W1+W2 = compound", "W2+W3 = compound", "W3+W4 = compound", "W4+W5 = compound", "W5+W6 = compound", "W6+W7 = compound"]
}

"words" = SCRAMBLED order. "solution" = CORRECT chain order. "pair_explanations" = the compound word each pair forms.`;

// Validate that every adjacent pair in the solution exists in VERIFIED_PAIRS
function validateChain(solution) {
  const errors = [];
  for (let i = 0; i < solution.length - 1; i++) {
    const a = solution[i].toUpperCase();
    const b = solution[i + 1].toUpperCase();
    const targets = VERIFIED_PAIRS[a];
    if (!targets || !targets.includes(b)) {
      errors.push(`${a}+${b} is not a verified pair`);
    }
  }
  return errors;
}

async function generateOnePuzzle(theme) {
  const themeHint = theme ? `\n\nFor variety, lean towards words related to: ${theme}` : '';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: PROMPT + themeHint }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;
  const puzzle = JSON.parse(content);

  // Validate against our verified pairs dictionary
  const errors = validateChain(puzzle.solution);
  if (errors.length > 0) {
    throw new Error(`Invalid pairs in chain: ${errors.join(', ')}`);
  }

  return puzzle;
}

const THEMES = [
  'animals and nature',
  'food and cooking',
  'space and stars',
  'ocean and sea life',
  'sports and play',
  'school and learning',
  'weather and seasons',
  'colors and art',
  'home and family',
  'music and sounds',
];

async function main() {
  console.log(`Generating puzzles for the next ${daysAhead} days...\n`);

  const today = new Date();
  let generated = 0;
  let skipped = 0;
  const usedChains = []; // Track chains to avoid duplicates

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Check if puzzle already exists
    const { data: existing } = await supabase
      .from('puzzles')
      .select('id, solution')
      .eq('puzzle_date', dateStr)
      .single();

    if (existing) {
      console.log(`  [SKIP] ${dateStr} - puzzle already exists`);
      // Track existing chain to avoid duplicates
      const sol = typeof existing.solution === 'string' ? JSON.parse(existing.solution) : existing.solution;
      usedChains.push(sol.map(w => w.toUpperCase()).join('>'));
      skipped++;
      continue;
    }

    const theme = THEMES[i % THEMES.length];
    console.log(`  [GEN]  ${dateStr} - theme: ${theme}...`);

    let success = false;

    // Try Claude API first (50 attempts)
    if (ANTHROPIC_API_KEY) {
      for (let attempt = 1; attempt <= 50; attempt++) {
        try {
          console.log(`           Claude attempt ${attempt}/50...`);
          const puzzle = await generateOnePuzzle(theme);

          if (!puzzle.words || !puzzle.solution || puzzle.words.length !== 7) {
            console.log(`           invalid format, retrying...`);
            continue;
          }

          // Check for duplicate chain
          const chainStr = puzzle.solution.map(w => w.toUpperCase()).join('>');
          if (usedChains.includes(chainStr)) {
            console.log(`           duplicate chain, retrying...`);
            continue;
          }

          const { error } = await supabase.from('puzzles').insert({
            puzzle_date: dateStr,
            words: puzzle.words,
            solution: puzzle.solution,
            pair_explanations: puzzle.pair_explanations || [],
            difficulty: 'easy',
          });

          if (error) {
            console.log(`  [ERR]  ${dateStr} - DB error: ${error.message}`);
          } else {
            console.log(`  [OK]   ${dateStr} - ${puzzle.solution.join(' > ')} (Claude)`);
            usedChains.push(chainStr);
            generated++;
            success = true;
          }
          break;
        } catch (err) {
          console.log(`           ${err.message}`);
          if (attempt < 50) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    }

    // Algorithmic fallback if Claude failed or no API key
    if (!success) {
      console.log(`           Falling back to algorithmic generation...`);
      const chain = generateChainAlgorithmic(usedChains);
      if (chain) {
        const puzzle = buildPuzzleFromChain(chain);
        const chainStr = chain.join('>');

        const { error } = await supabase.from('puzzles').insert({
          puzzle_date: dateStr,
          words: puzzle.words,
          solution: puzzle.solution,
          pair_explanations: puzzle.pair_explanations || [],
          difficulty: 'easy',
        });

        if (error) {
          console.log(`  [ERR]  ${dateStr} - DB error: ${error.message}`);
        } else {
          console.log(`  [OK]   ${dateStr} - ${puzzle.solution.join(' > ')} (algorithmic)`);
          usedChains.push(chainStr);
          generated++;
          success = true;
        }
      }
    }

    if (!success) {
      console.log(`  [FAIL] ${dateStr} - failed to generate puzzle`);
    }

    // Rate limit: wait 1 second between API calls
    if (i < daysAhead - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}, Failed: ${daysAhead - generated - skipped}`);
}

main().catch(console.error);
