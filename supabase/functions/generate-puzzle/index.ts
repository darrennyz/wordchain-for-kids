// Supabase Edge Function: generate-puzzle
// Calls Claude API to generate a daily WordChain puzzle, then stores it in the database.
//
// Environment variables needed (set in Supabase Dashboard > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY  – your Claude API key
//   SUPABASE_URL       – auto-provided by Supabase
//   SUPABASE_SERVICE_ROLE_KEY – auto-provided by Supabase

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
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

    // Call Claude to generate a new puzzle
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const prompt = `You are a puzzle generator for a kids' word chain game called "WordChain". The players are children aged 5-7.

Generate a word chain puzzle with EXACTLY 7 words. Each adjacent pair of words in the solution must form a well-known English compound word, common phrase, or collocation that a young child would instantly recognize.

CRITICAL RULES FOR WORD ORDER:
- The pairing is DIRECTIONAL: word_i + word_{i+1} must form the phrase IN THAT ORDER.
- "SAND + BOX" is valid because "sandbox" is a real word. "BOX + SAND" is INVALID because "boxsand" is not a word.
- "SNOW + MAN" is valid because "snowman" is a real word. "MAN + SNOW" is INVALID because "mansnow" is not a word.
- "SUN + FLOWER" is valid. "FLOWER + SUN" is INVALID.
- Always verify: does word_i come FIRST in the compound/phrase? If not, reverse them or pick different words.

OTHER RULES:
- Use SIMPLE words that kids aged 5-7 would know and can read
- Words should be 2-6 letters long
- The chain must have EXACTLY ONE valid ordering (no ambiguous words that could pair multiple ways)
- Avoid any inappropriate content
- Focus on themes kids enjoy: animals, nature, food, colors, play, school
- Every pair must be an OBVIOUS, well-known compound word or phrase — not a stretch

GOOD EXAMPLES (correct order):
- "RAIN + BOW" → rainbow ✓
- "BOW + TIE" → bow tie ✓
- "CUP + CAKE" → cupcake ✓
- "BED + TIME" → bedtime ✓
- "POP + CORN" → popcorn ✓
- "STAR + FISH" → starfish ✓
- "SUN + FLOWER" → sunflower ✓
- "SAND + BOX" → sandbox ✓
- "SNOW + MAN" → snowman ✓
- "FIRE + FLY" → firefly ✓
- "BLUE + BERRY" → blueberry ✓
- "TOOTH + BRUSH" → toothbrush ✓

BAD EXAMPLES (wrong order — NEVER do this):
- "BOX + SAND" ✗ (should be SAND + BOX)
- "MAN + SNOW" ✗ (should be SNOW + MAN)
- "CAKE + CUP" ✗ (should be CUP + CAKE)
- "FISH + STAR" ✗ (should be STAR + FISH)

Before finalizing, CHECK EVERY PAIR: read "word_i word_{i+1}" out loud. Does it sound like a real compound word or phrase that a 6-year-old would know? If not, fix it.

Respond with ONLY valid JSON in this exact format, no other text:
{
  "words": ["WORD1", "WORD2", "WORD3", "WORD4", "WORD5", "WORD6", "WORD7"],
  "solution": ["WORD1", "WORD2", "WORD3", "WORD4", "WORD5", "WORD6", "WORD7"],
  "pair_explanations": ["word1+word2 = compound/phrase", "word2+word3 = compound/phrase", "word3+word4 = compound/phrase", "word4+word5 = compound/phrase", "word5+word6 = compound/phrase", "word6+word7 = compound/phrase"]
}

The "words" array should be in SCRAMBLED order (not the solution order).
The "solution" array should be the CORRECT chain order.
The "pair_explanations" should name the compound word or phrase each pair forms.`;

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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      throw new Error(`Claude API error: ${claudeResponse.status} ${errText}`);
    }

    const claudeData = await claudeResponse.json();
    const content = claudeData.content[0].text;

    // Parse the JSON response
    const puzzleData = JSON.parse(content);

    // Validate the puzzle data
    if (
      !puzzleData.words ||
      !puzzleData.solution ||
      puzzleData.words.length !== 7 ||
      puzzleData.solution.length !== 7
    ) {
      throw new Error('Invalid puzzle format from Claude');
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
