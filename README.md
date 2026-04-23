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
Handicap Index = Average of best N differentials × 0.96
```

Rounds on 9-hole courses have their differential doubled to convert to an 18-hole equivalent. The number of best differentials used scales with rounds played (per WHS table, up to 8 of the last 20).

Rounds automatically inherit CR & Slope from the course/tee when the rating isn't stored directly on the round (backwards compatible with rounds logged before ratings were added).

## Running the App

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or run on an iOS/Android simulator.

## Tech Stack

- React Native + Expo (managed workflow)
- Expo Router (file-based navigation)
- AsyncStorage (local device storage — no backend)
- TypeScript
