import React from 'react';

// Linearly interpolates between a and b by t (0–1)
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// Maps streak day (0–30) into a normalised phase value 0–1 for a given range
function phase(day, start, end) {
  if (day <= start) return 0;
  if (day >= end) return 1;
  return (day - start) / (end - start);
}

// Colour interpolation between two hex colours
function lerpColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r},${g},${b})`;
}

/**
 * StreakTree — renders a seed-to-tree SVG that grows across 30 daily stages.
 *
 * Props:
 *   streak    — current streak count (clamped 0–30 internally, 30+ = full tree)
 *   size      — rendered size in px (default 80)
 *   gameType  — 'wordchain' | 'sudoku' (affects leaf colour tint)
 *   showLabel — whether to render the "Day N" label below (default true)
 */
export default function StreakTree({ streak = 0, size = 80, gameType = 'wordchain', showLabel = true }) {
  const day = Math.min(Math.max(Math.floor(streak), 0), 30);

  // ── Colour palette ────────────────────────────────────────────────
  // WordChain: blue-green tones; Sudoku: warm teal-green tones
  const leafLight = gameType === 'sudoku' ? '#86efac' : '#6ee7b7'; // green-300 / emerald-300
  const leafMid   = gameType === 'sudoku' ? '#22c55e' : '#10b981'; // green-500 / emerald-500
  const leafDeep  = gameType === 'sudoku' ? '#15803d' : '#065f46'; // green-700 / emerald-800

  const leafColor    = lerpColor(leafLight, leafDeep, phase(day, 4, 30));
  const leafColorMid = lerpColor(leafLight, leafMid,  phase(day, 6, 28));
  const trunkColor   = '#92400e';
  const soilColor    = '#d97706';
  const soilDark     = '#b45309';
  const fruitColor   = '#ef4444';

  // ── Geometry ──────────────────────────────────────────────────────
  // ViewBox: 0 0 80 96.  Ground line at y = 76.
  const gY = 76; // ground y
  const cx = 40; // centre x

  // Trunk: appears day 5, grows to full by day 20
  const trunkH  = lerp(0, 38, phase(day, 4, 20));
  const trunkW  = lerp(2, 10, phase(day, 4, 22));
  const trunkX  = cx - trunkW / 2;
  const trunkY  = gY - trunkH;

  // Main (top) canopy blob
  const canopyR = lerp(0, 22, phase(day, 6, 24));
  const canopyCY = trunkY + lerp(0, -4, phase(day, 10, 26));

  // Side canopy blobs (appear day 12)
  const sideR  = lerp(0, 16, phase(day, 11, 25));
  const sideCY = lerp(gY, trunkY + 12, phase(day, 11, 25));

  // Lower leaf clusters on branches (day 14+)
  const branchR = lerp(0, 11, phase(day, 13, 27));

  // Extra top density blobs (day 20+)
  const topR = lerp(0, 14, phase(day, 19, 30));

  // Roots at base (day 18+)
  const rootW = lerp(0, 6, phase(day, 17, 28));

  // Fruits (day 23+)
  const fruitOpacity = phase(day, 22, 30);

  // ── Sprout phase (days 1–5) ────────────────────────────────────────
  const sproutH    = lerp(0, 18, phase(day, 0, 5));
  const sproutW    = lerp(0, 3,  phase(day, 0, 5));
  const leafScale  = phase(day, 1, 5);

  // ── Label ─────────────────────────────────────────────────────────
  let label, labelColor;
  if (day === 0) {
    label = 'Plant a seed';
    labelColor = '#78716c';
  } else if (day === 1) {
    label = 'Day 1 🌱';
    labelColor = '#15803d';
  } else if (day < 30) {
    label = `Day ${day} 🔥`;
    labelColor = day >= 20 ? '#b45309' : '#16a34a';
  } else {
    label = 'Day 30 🌳';
    labelColor = '#065f46';
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* ── Ground ── */}
        <ellipse cx={cx} cy={gY + 4} rx={28} ry={8} fill={soilDark} opacity="0.5" />
        <ellipse cx={cx} cy={gY + 2} rx={24} ry={5} fill={soilColor} opacity="0.8" />

        {/* ── Seed (day 0–1) ── */}
        {day <= 2 && (
          <ellipse
            cx={cx}
            cy={gY - 2}
            rx={lerp(0, 4, phase(day, 0, 1))}
            ry={lerp(0, 3, phase(day, 0, 1))}
            fill="#92400e"
            opacity={lerp(0, 0.9, phase(day, 0, 1))}
          />
        )}

        {/* ── Sprout stem (days 1–6) ── */}
        {day >= 1 && day <= 7 && sproutH > 0 && (
          <rect
            x={cx - sproutW / 2}
            y={gY - sproutH}
            width={sproutW}
            height={sproutH}
            rx={1}
            fill={leafColor}
          />
        )}

        {/* ── Sprout leaves (days 2–6) ── */}
        {day >= 2 && day <= 7 && leafScale > 0 && (
          <>
            {/* Left leaf */}
            <ellipse
              cx={cx - lerp(0, 9, leafScale)}
              cy={gY - sproutH * 0.6}
              rx={lerp(0, 8, leafScale)}
              ry={lerp(0, 5, leafScale)}
              fill={leafColorMid}
              transform={`rotate(-30 ${cx - lerp(0, 9, leafScale)} ${gY - sproutH * 0.6})`}
            />
            {/* Right leaf */}
            <ellipse
              cx={cx + lerp(0, 9, leafScale)}
              cy={gY - sproutH * 0.6}
              rx={lerp(0, 8, leafScale)}
              ry={lerp(0, 5, leafScale)}
              fill={leafColorMid}
              transform={`rotate(30 ${cx + lerp(0, 9, leafScale)} ${gY - sproutH * 0.6})`}
            />
          </>
        )}

        {/* ── Roots (day 18+) ── */}
        {rootW > 0 && (
          <>
            <path
              d={`M ${cx - trunkW / 2} ${gY} Q ${cx - 14} ${gY + 5} ${cx - 20} ${gY + 2}`}
              stroke={trunkColor}
              strokeWidth={rootW * 0.5}
              strokeLinecap="round"
              opacity={phase(day, 17, 26)}
            />
            <path
              d={`M ${cx + trunkW / 2} ${gY} Q ${cx + 14} ${gY + 5} ${cx + 20} ${gY + 2}`}
              stroke={trunkColor}
              strokeWidth={rootW * 0.5}
              strokeLinecap="round"
              opacity={phase(day, 17, 26)}
            />
          </>
        )}

        {/* ── Trunk (day 5+) ── */}
        {trunkH > 0 && (
          <rect
            x={trunkX}
            y={trunkY}
            width={trunkW}
            height={trunkH}
            rx={trunkW / 2}
            fill={trunkColor}
          />
        )}

        {/* ── Branches (day 10+) ── */}
        {day >= 10 && trunkH > 0 && (
          <>
            {/* Left branch */}
            <path
              d={`M ${cx} ${trunkY + trunkH * 0.45} Q ${cx - 16} ${trunkY + trunkH * 0.3} ${cx - lerp(0, 22, phase(day, 9, 22))} ${trunkY + trunkH * 0.2}`}
              stroke={trunkColor}
              strokeWidth={lerp(0, 4, phase(day, 9, 20))}
              strokeLinecap="round"
              opacity={phase(day, 9, 18)}
            />
            {/* Right branch */}
            <path
              d={`M ${cx} ${trunkY + trunkH * 0.45} Q ${cx + 16} ${trunkY + trunkH * 0.3} ${cx + lerp(0, 22, phase(day, 9, 22))} ${trunkY + trunkH * 0.2}`}
              stroke={trunkColor}
              strokeWidth={lerp(0, 4, phase(day, 9, 20))}
              strokeLinecap="round"
              opacity={phase(day, 9, 18)}
            />
            {/* Upper branches (day 16+) */}
            {day >= 16 && (
              <>
                <path
                  d={`M ${cx} ${trunkY + trunkH * 0.2} Q ${cx - 10} ${trunkY - 2} ${cx - lerp(0, 14, phase(day, 15, 25))} ${trunkY - lerp(0, 8, phase(day, 15, 25))}`}
                  stroke={trunkColor}
                  strokeWidth={lerp(0, 3, phase(day, 15, 23))}
                  strokeLinecap="round"
                  opacity={phase(day, 15, 22)}
                />
                <path
                  d={`M ${cx} ${trunkY + trunkH * 0.2} Q ${cx + 10} ${trunkY - 2} ${cx + lerp(0, 14, phase(day, 15, 25))} ${trunkY - lerp(0, 8, phase(day, 15, 25))}`}
                  stroke={trunkColor}
                  strokeWidth={lerp(0, 3, phase(day, 15, 23))}
                  strokeLinecap="round"
                  opacity={phase(day, 15, 22)}
                />
              </>
            )}
          </>
        )}

        {/* ── Side canopy blobs (day 12+) ── */}
        {sideR > 0 && (
          <>
            <circle cx={cx - lerp(0, 20, phase(day, 11, 24))} cy={sideCY} r={sideR} fill={leafColorMid} opacity="0.9" />
            <circle cx={cx + lerp(0, 20, phase(day, 11, 24))} cy={sideCY} r={sideR} fill={leafColorMid} opacity="0.9" />
          </>
        )}

        {/* ── Lower branch leaf clusters (day 14+) ── */}
        {branchR > 0 && (
          <>
            <circle cx={cx - 22} cy={trunkY + trunkH * 0.15} r={branchR} fill={leafColor} opacity={phase(day, 13, 24)} />
            <circle cx={cx + 22} cy={trunkY + trunkH * 0.15} r={branchR} fill={leafColor} opacity={phase(day, 13, 24)} />
          </>
        )}

        {/* ── Main canopy (day 6+) ── */}
        {canopyR > 0 && (
          <circle cx={cx} cy={canopyCY} r={canopyR} fill={leafColor} opacity="0.95" />
        )}

        {/* ── Extra density blobs (day 20+) ── */}
        {topR > 0 && (
          <>
            <circle cx={cx - 10} cy={canopyCY - 8} r={topR * 0.75} fill={leafColorMid} opacity={phase(day, 19, 30) * 0.9} />
            <circle cx={cx + 10} cy={canopyCY - 8} r={topR * 0.75} fill={leafColorMid} opacity={phase(day, 19, 30) * 0.9} />
            <circle cx={cx}      cy={canopyCY - 16} r={topR * 0.85} fill={leafColor}   opacity={phase(day, 21, 30) * 0.95} />
          </>
        )}

        {/* ── Fruits (day 23+) ── */}
        {fruitOpacity > 0 && canopyR > 10 && (
          <>
            {/* Left fruit */}
            <circle cx={cx - 12} cy={canopyCY + 8}  r={lerp(0, 4, phase(day, 22, 28))} fill={fruitColor} opacity={fruitOpacity} />
            {/* Right fruit */}
            <circle cx={cx + 14} cy={canopyCY + 4}  r={lerp(0, 4, phase(day, 23, 29))} fill={fruitColor} opacity={fruitOpacity} />
            {/* Centre fruit (day 26+) */}
            {day >= 26 && (
              <circle cx={cx}     cy={canopyCY + 12} r={lerp(0, 4, phase(day, 25, 30))} fill="#f97316" opacity={phase(day, 25, 30)} />
            )}
            {/* Extra fruits (day 28+) */}
            {day >= 28 && (
              <>
                <circle cx={cx - 6}  cy={canopyCY - 6} r={3} fill={fruitColor} opacity={phase(day, 27, 30)} />
                <circle cx={cx + 6}  cy={canopyCY - 4} r={3} fill="#f97316"    opacity={phase(day, 27, 30)} />
              </>
            )}
          </>
        )}

        {/* ── Day 30 star / sparkle ── */}
        {day === 30 && (
          <>
            <circle cx={cx - 28} cy={28} r={3} fill="#fbbf24" opacity="0.8" />
            <circle cx={cx + 28} cy={22} r={2} fill="#fbbf24" opacity="0.7" />
            <circle cx={cx}      cy={10} r={2.5} fill="#fef08a" opacity="0.9" />
          </>
        )}
      </svg>

      {/* Label */}
      {showLabel && (
        <p
          className="font-display font-bold text-xs text-center leading-tight"
          style={{ color: labelColor, fontSize: size < 60 ? '10px' : '12px' }}
        >
          {label}
        </p>
      )}
    </div>
  );
}
