#!/usr/bin/env node

/**
 * Batch Puzzle Generator for WordChain
 *
 * Pre-generates puzzles using Claude API and stores them in Supabase.
 * Run: ANTHROPIC_API_KEY=sk-... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/generate-puzzles.js [days]
 *
 * Arguments:
 *   days - number of days ahead to generate (default: 30)
 */

import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables. Required:');
  console.error('  ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const daysAhead = parseInt(process.argv[2] || '30', 10);

const PROMPT = `You are a puzzle generator for a kids' word chain game called "WordChain". The players are children aged 5-7.

Generate a word chain puzzle with EXACTLY 7 words. Each adjacent pair of words must form a well-known English compound word, common phrase, or collocation that a young child would recognize.

Rules:
- Use SIMPLE words that kids aged 5-7 would know
- Each adjacent pair (word_i, word_{i+1}) must form a recognizable two-word phrase or compound
- Words should be 2-6 letters long
- The chain must have EXACTLY ONE valid ordering
- Avoid any inappropriate content
- Focus on themes kids enjoy: animals, nature, food, colors, play, school, space, ocean, sports
- IMPORTANT: Make every puzzle unique. Do not repeat chains from previous puzzles.
- Try different themes each time: one day animals, next day food, then nature, etc.

Examples of good pairs: "rain + bow" (rainbow), "sun + flower" (sunflower), "cup + cake" (cupcake), "bed + time" (bedtime), "pop + corn" (popcorn), "star + fish" (starfish)

Respond with ONLY valid JSON in this exact format, no other text:
{
  "words": ["WORD1", "WORD2", "WORD3", "WORD4", "WORD5", "WORD6", "WORD7"],
  "solution": ["WORD1", "WORD2", "WORD3", "WORD4", "WORD5", "WORD6", "WORD7"],
  "pair_explanations": ["word1+word2 explanation", "word2+word3 explanation", "word3+word4 explanation", "word4+word5 explanation", "word5+word6 explanation", "word6+word7 explanation"]
}

The "words" array should be in SCRAMBLED order (not the solution order).
The "solution" array should be the CORRECT chain order.`;

async function generateOnePuzzle(theme) {
  const themeHint = theme ? `\n\nTheme hint for this puzzle: ${theme}` : '';

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
  return JSON.parse(content);
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

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Check if puzzle already exists
    const { data: existing } = await supabase
      .from('puzzles')
      .select('id')
      .eq('puzzle_date', dateStr)
      .single();

    if (existing) {
      console.log(`  [SKIP] ${dateStr} - puzzle already exists`);
      skipped++;
      continue;
    }

    const theme = THEMES[i % THEMES.length];
    console.log(`  [GEN]  ${dateStr} - theme: ${theme}...`);

    try {
      const puzzle = await generateOnePuzzle(theme);

      if (!puzzle.words || !puzzle.solution || puzzle.words.length !== 7) {
        console.log(`  [ERR]  ${dateStr} - invalid puzzle format, retrying...`);
        const retry = await generateOnePuzzle(theme);
        if (!retry.words || !retry.solution || retry.words.length !== 7) {
          console.log(`  [FAIL] ${dateStr} - skipping after retry`);
          continue;
        }
        Object.assign(puzzle, retry);
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
        console.log(`  [OK]   ${dateStr} - ${puzzle.solution.join(' > ')}`);
        generated++;
      }
    } catch (err) {
      console.log(`  [ERR]  ${dateStr} - ${err.message}`);
    }

    // Rate limit: wait 1 second between API calls
    if (i < daysAhead - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}, Failed: ${daysAhead - generated - skipped}`);
}

main().catch(console.error);
