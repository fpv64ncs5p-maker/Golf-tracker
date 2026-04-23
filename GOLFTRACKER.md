# ⛳ Golf Tracker App — Spec & Decision Log

## Overview
A personal golf training tracker app built with **React Native + Expo**, designed for use on iPhone during practice sessions and rounds. Built collaboratively by Jo and Claude, learning to code along the way.

---

## Tech Stack
- **Framework**: React Native with Expo (managed workflow)
- **Routing**: Expo Router (file-based — each file in `/app` = a screen)
- **Language**: TypeScript (.tsx files)
- **Storage**: AsyncStorage (local, per device — web and phone are separate)
- **Dev tools**: Node.js, VS Code, Expo Go (iPhone testing via QR code)
- **Testing**: Expo Go app on iPhone — always test on phone, not web

---

## Running the App
```bash
cd golf-tracker
npx expo start        # same WiFi as phone
npx expo start --tunnel  # different network (requires @expo/ngrok)
```
- Press `r` in terminal to force reload
- Press `t` to switch to tunnel mode
- If on a different network: use iPhone as hotspot, connect Mac to it, then `npx expo start`

---

## File Structure
```
app/
├── index.tsx          # Home screen
├── session.tsx        # Practice session screen
├── dashboard.tsx      # Dashboard (sessions + rounds)
├── insights.tsx       # Insights + handicap
├── round.tsx          # Round setup
├── round-hole.tsx     # Hole-by-hole tracker
├── round-complete.tsx # End of round, save
├── round-detail.tsx   # Round detail view
├── courses.tsx        # Course database manager
└── clubs.tsx          # Club distances (Trackman reference)
```

---

## Screens & Features

### 🏠 Home (`index.tsx`)
- Select practice type: Putting / Short Game / Long Game
- Navigate to: Start Session, Dashboard, Insights, Log a Round, My Courses, My Club Distances

### 🏋️ Practice Session (`session.tsx`)
- Live timer (MM:SS)
- **Pre-loaded drill chips** (horizontal scroll) — tap to auto-fill name + attempts
- Manual drill entry: name, made, total → calculates success %
- **Session notes** — free text field above "End & Save Session"
- Notes shown on dashboard session cards with 📝 icon
- Saves to AsyncStorage under `sessions` key
- Drills sourced from practice PDF (all distances in metres):
  - **Putting**: Short Putts 1m (×25), 2m (×15), Lag 6/9/12m (×10), Pressure Ladder
  - **Short Game**: Basic Chips, Pitch Low/High, Up & Down Challenge (all ×10)
  - **Long Game**: Wedge 45/70/90m, Trajectory Drill (×15), Mid Irons Solid/Target, Fairway Finder, Shape Practice

### 📊 Dashboard (`dashboard.tsx`)
- Summary bar: total sessions, rounds, practice time
- **Practice tab**: sessions list with type, date, duration, drill results, notes
- **Rounds tab**: rounds list with course, tee, score vs par, FIR/GIR/putts
- **Tap any card** to expand → shows:
  - 📅 Edit Date (DD/MM/YYYY format)
  - 📋 Details (rounds only → navigates to round-detail)
  - 🗑 Delete (with confirmation alert)
- Uses `Pressable` instead of `TouchableOpacity` for cards (better tap handling on iOS inside ScrollView)

### 🧠 Insights (`insights.tsx`)
- **Training Handicap Index** (WHS formula):
  - Differential = `(Gross Score − Course Rating) × 113 ÷ Slope Rating`
  - 9-hole rounds: differential × 2
  - Uses best N differentials from last 20 rounds (WHS table)
  - Multiplied by 0.96
  - Requires minimum 3 rounds with CR + Slope saved
- Weakest area (lowest drill success %)
- Recommendation based on weakest area
- Practice distribution (sessions per type)
- Overall drill success %
- Total practice time

### 🏌️ Round Setup (`round.tsx`)
- Select saved course from database
- Select tee colour → auto-fills Par, CR, Slope
- **9 or 18 holes** — par automatically halved for 9-hole rounds
- Weather: Wind / Sky / Ground conditions
- Saves draft to `draftRound` key

### 🕳️ Hole Tracker (`round-hole.tsx`)
- Par selector (3/4/5)
- Fairway hit Yes/No (hidden on Par 3)
- **Tee miss direction**: Left / Right / Short / Long (shown when fairway missed)
- Penalties: Water / OB / Hazard / Other + optional comment
- Clubs per stroke (Driver → Putter) with undo
- Putts counter
- GIR auto-detected: strokes ≤ par − 2
- **Approach miss direction**: Left / Right / Short / Long — shown when putts > 0 AND GIR missed (i.e. after you're on the green, looking back at where the approach landed)
- Score vs par shown live
- Saves hole data to `draftRound`, navigates to next hole

### 🏁 Round Complete (`round-complete.tsx`)
- Auto-calculates: total strokes, score vs par, FIR%, GIR%, putts/hole, Par 3 GIR
- Hole-by-hole summary
- Free-text round notes
- Saves to `rounds` key, clears `draftRound`

### 📋 Round Detail (`round-detail.tsx`)
- Full breakdown of a saved round
- Header: course, date, tee, weather
- Score card (green): total strokes + vs par label
- Stats grid: Fairways, GIR, Putts, Par 3 GIR
- Hole-by-hole table: score, +/-, FIR, GIR, putts
  - Colour coded: birdie=green, bogey=red, eagle=blue, double+=dark red
- Under each hole: clubs used, tee miss direction, approach miss direction, penalties
- Round notes

### ⛳ Course Database (`courses.tsx`)
- Add / delete courses
- Each course has 5 tee colours: **Blue, White, Yellow, Red, Orange**
- Each tee stores: Par (18-hole), Course Rating (CR), Slope
- Colour-coded tee badges, expandable cards, inline editing
- Saves to `courses` key

### 🏌️ My Club Distances (`clubs.tsx`)
- Full list of clubs: Driver, 3W, 5W, 4H, 5H, 4i–9i, PW, GW, SW, LW
- Tap any club to log Trackman data: **Carry (m)**, **Total (m)**, **Ball Speed (km/h)**
- Shows last updated date per club
- Used as an on-course reference for club selection
- Saves to `clubDistances` key

---

## AsyncStorage Keys
| Key | Contents |
|-----|----------|
| `sessions` | Array of practice sessions |
| `rounds` | Array of completed rounds |
| `draftRound` | Current round in progress |
| `courses` | Array of saved courses with tee data |
| `clubDistances` | Club carry/total/ball speed from Trackman |

---

## Data Structures

### Practice Session
```json
{
  "type": "Putting",
  "duration": 3600,
  "date": "2026-03-27T10:00:00.000Z",
  "notes": "Felt good on short putts today",
  "drills": [
    { "name": "Short Putts 1m", "made": "23", "attempts": "25", "success": 92 }
  ]
}
```

### Round
```json
{
  "courseName": "Quinta do Peru",
  "tee": "White",
  "holes": 18,
  "coursePar": 72,
  "courseRating": 71.2,
  "slopeRating": 130,
  "weather": { "wind": "Light Wind", "sky": "Sunny", "ground": "Dry" },
  "date": "2026-03-27T10:00:00.000Z",
  "notes": "...",
  "holeData": [
    {
      "hole": 1,
      "par": 4,
      "strokes": ["Driver", "7i"],
      "putts": 2,
      "totalStrokes": 4,
      "fairwayHit": true,
      "missDirection": null,
      "approachMiss": null,
      "gir": true,
      "penalties": []
    }
  ],
  "stats": {
    "totalStrokes": 85,
    "totalPutts": 34,
    "puttsPerHole": "1.9",
    "fairwaysHit": 9,
    "fairwayTotal": 14,
    "fairwayPct": 64,
    "girCount": 7,
    "girPct": 39,
    "par3Gir": 2,
    "par3Total": 4,
    "scoreVsPar": 13
  }
}
```

### Course
```json
{
  "id": "1234567890",
  "name": "Quinta do Peru",
  "tees": {
    "White": { "par": 72, "rating": 71.2, "slope": 130 },
    "Yellow": { "par": 72, "rating": 69.5, "slope": 125 },
    "Red": { "par": 72, "rating": 67.0, "slope": 118 }
  }
}
```

### Club Distances
```json
{
  "Driver": { "carry": "210", "total": "230", "ballSpeed": "155", "updatedAt": "2026-03-27T10:00:00.000Z" },
  "7 Iron": { "carry": "145", "total": "155", "ballSpeed": "120", "updatedAt": "2026-03-27T10:00:00.000Z" }
}
```

---

## Key Design Decisions
- **Distances in metres** (not yards/feet) throughout the app
- **9-hole par** = course par ÷ 2 (auto-calculated on round start)
- **AsyncStorage is device-specific** — data logged on phone won't appear on web and vice versa. Always use phone for real data.
- **Expo Go** requires Mac server running + same WiFi (or tunnel mode). Not usable on course without Mac running.
- **FlatList replaced with .map()** inside ScrollView to avoid "VirtualizedLists nested in ScrollView" error
- **KeyboardAvoidingView** used on session + round-complete screens to prevent keyboard covering inputs
- **Pressable** used instead of TouchableOpacity for cards inside ScrollView (better tap handling on iOS)
- **addPenalty** function must be at component scope, not nested inside saveHoleAndContinue
- **Approach miss direction** shown only when putts > 0 (not while still logging strokes) — avoids confusion about which stroke it refers to
- **TextInput** must be explicitly imported in each file that uses it

---

## WHS Handicap Table (differentials to use)
| Rounds | Best N |
|--------|--------|
| 3–5 | 1 |
| 6–8 | 2 |
| 9–11 | 3 |
| 12–14 | 4 |
| 15–16 | 5 |
| 17–18 | 6 |
| 19 | 7 |
| 20 | 8 |

---

## Completed Features
- [x] Practice session tracking with timer and drill logging
- [x] Pre-loaded drills from practice PDF (in metres)
- [x] Session notes
- [x] Round tracking hole-by-hole (par, clubs, fairway, GIR, putts, penalties)
- [x] Tee miss direction (Left/Right/Short/Long when fairway missed)
- [x] Approach miss direction (Left/Right/Short/Long when GIR missed, shown after first putt)
- [x] Course database with 5 tee colours and CR/Slope per tee
- [x] 9 vs 18 holes (par auto-adjusted)
- [x] Weather tracking per round
- [x] Dashboard with Practice + Rounds tabs
- [x] Edit date and delete for sessions and rounds
- [x] Round detail view with hole-by-hole breakdown and colour-coded scores
- [x] Training Handicap Index (WHS formula)
- [x] Insights: weakest area, recommendations, practice distribution
- [x] My Club Distances (Trackman reference — carry, total, ball speed)

## Pending / Future Features
- [ ] Home screen quick stats (last session, current handicap)
- [ ] Miss pattern analysis in insights (e.g. "you miss left 68% off the tee")
- [ ] Progress charts (handicap trend, FIR%/GIR% over last 10 rounds)
- [ ] Build standalone app (requires Apple Developer account, €99/year)
- [ ] Re-edit full round hole by hole
- [ ] Export data (CSV / PDF)
