# ⛳ Golf Tracker — Jo's Personal Golf App

A React Native + Expo app for tracking golf rounds, practice sessions, and progress over time. Built for personal use with Hollandsche Golfclub courses and Campo Real (Portugal).

## Features

- **Log rounds** — hole-by-hole stroke tracking with club selection, shot direction, penalties, and putts
- **My Courses** — organised by country (🇳🇱 Netherlands / 🇵🇹 Portugal) and club (Hollandsche Golfclub / Others), with per-tee CR & Slope ratings
- **Course stats** — best score, average, times played, and recent rounds per course
- **Round history** — view and edit saved rounds, with hole-by-hole breakdown and running total
- **Hole progress strip** — visual strip during round logging showing completed holes with score vs par
- **Insights** — WHS Training Handicap Index (calculated from qualifying rounds with CR & Slope), practice distribution, weakest areas, and recommendations
- **Practice sessions** — log putting, short game, and long game sessions with drills and success rates
- **Dashboard** — overview of all rounds and sessions with quick stats

## Courses

### 🇳🇱 Netherlands — Hollandsche Golfclub
| Course | Holes | Tee | CR | Slope |
|---|---|---|---|---|
| Gendersteyn — Gele lus | 9 | Yellow | 36.1 | 132 |
| Gendersteyn — Rode lus | 9 | Red | 35.4 | 129 |
| De Loonsche Duynen | 18 | White/Yellow/Blue/Red/Orange | 72.7–65.2 | 131–107 |
| De Kurenpolder | 18 | Yellow | 34.75 | 128 |
| De Breuninkhof | 18 | Yellow | 36.5 | 137 |
| De Berendonck | 18 | White | 72.0 | 132 |
| De Haverleij | 18 | White | 70.7 | 131 |
| Golfpark De Purmer (3 loops) | 9 each | — | — | — |
| Westepark | 18 | Blue | 71.1 | 136 |
| Almkreek | 18 | White | 71.5 | 128 |
| ShortGolf Utrecht Par 3 | 9 | Yellow | 23 | 65 |
| ShortGolf Utrecht Par 3 | 9 | Red | 24 | 68 |
| ShortGolf Utrecht Par 3/4 | 9 | Yellow | 27 | 89 |
| ShortGolf Utrecht Par 3/4 | 9 | Red | 28 | 89 |

### 🇳🇱 Netherlands — Other
| Course | Holes | Tee | CR | Slope |
|---|---|---|---|---|
| Kromme Rijn | 9 | White | — | — |

### 🇵🇹 Portugal
| Course | Holes | Tee | CR | Slope |
|---|---|---|---|---|
| Campo Real | 18 | Black/White/Yellow/Blue/Red/Green/Purple | 71.5–59.1 | 136–110 |

## Handicap Calculation

Uses the **World Handicap System (WHS)** formula:

```
Score Differential = (Gross Score − Course Rating) × 113 / Slope Rating
Handicap Index     = Average of best N differentials  (+ thin-record adjustment)
```

The number of best differentials used scales with rounds played (per the WHS table — best 1 of 3 up to best 8 of 20), and a downward adjustment is applied for very thin records (−2.0 at 3 rounds, −1.0 at 4 and 6). The result is capped at the WHS maximum of 54.0.

**9-hole rounds** are scaled to an 18-hole Score Differential the WHS 2024 way: `18-hole differential = 9-hole differential + expected differential for the unplayed 9`. The official expected-score table is proprietary (USGA/R&A don't publish it), so an approximation is used — `expected half = index ÷ 2 + 1.5` — which matches USGA's published worked example (index 14 → expected half 8.5) and is accurate in the mid-handicap range. The index is computed in two passes: a provisional index (9-holers doubled) provides the "current index" used to scale, then the final index is computed from the scaled differentials.

**Adjusted Gross Score:** when a course has per-hole **Stroke Index** filled in (Manage Courses → Holes → SI), the handicap uses WHS Adjusted Gross Score — each hole is capped at net double bogey (par + 2 + strokes received, allocated from the round's Course Handicap by Stroke Index). Rounds without Stroke Index fall back to raw gross.

**Known simplifications (vs. official WHS):** no Playing Conditions Calculation, soft/hard caps, or exceptional-score reductions; the 9-hole expected-score factor approximates the proprietary table; and the Course Handicap used for the net-double-bogey allocation is derived from the app's own (provisional) index. This is a personal **training** index — it tracks your trend but will not exactly equal your official NGF/WHS handicap.

Rounds automatically inherit CR & Slope from the course/tee when the rating isn't stored directly on the round (backwards compatible with rounds logged before ratings were added).

## Running the App

The app runs as a **web app deployed on Vercel** and is used in the phone browser. Vercel auto-deploys on every push to `main`:

```bash
git add -A && git commit -m "..." && git push
```

To preview locally in a browser:

```bash
npm install
npx expo start --web
```

## Tech Stack

- React Native + Expo (managed workflow)
- Expo Router (file-based navigation)
- **Supabase** for saved data (cloud); AsyncStorage only for the in-progress draft round
- Deployed on **Vercel** (web)
- TypeScript
