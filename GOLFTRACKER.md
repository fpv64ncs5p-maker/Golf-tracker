# ⛳ Golf Tracker App — Spec & Decision Log

## Maintenance Log
- **2026-06-30** — Closed two CRUD gaps (per Jo's edit/save/resume/delete rule). (1) **Dashboard Drills card** now has an **✏️ Edit** button that opens `range-drill-detail` straight into edit mode via `autoEdit=1`. (2) **Practice sessions now autosave + resume**: new `DraftSession` type + `getDraftSession`/`saveDraftSession`/`clearDraftSession` (AsyncStorage `draftSession`). `session.tsx` autosaves committed drills + notes (timer captured, not per-tick) whenever drills/notes change, clears on save/discard, and hydrates when launched with `resume=1`. Home screen shows an amber **Resume {type} session** banner (with ✕ discard). Note: only committed drills are saved, not a half-counted current grid/bucket.
- **2026-06-30** — Range Drill **full editing** on `range-drill-detail.tsx` (per Jo's rule: every record should have edit/save/resume/delete). Added an Edit mode: change the date (web `<input>` / native `DateTimePicker`), notes, and per-hole shots — change club via a picker modal, edit distance, remove, or add shots. Save validates every shot has a distance and every hole ≥1 shot, then writes back at the original (reversed) index; score recalculates live. Delete is also available here (confirm → splice → back). Range drills now have the complete set: save + resume (drill flow), edit + delete (detail).
- **2026-06-30** — Range Drill scoring: **estimated full-hole score** adds a flat `PUTTS_PER_HOLE` (2, in new `constants/scoring.ts`) to each hole's shots-to-green. This is now the **main** strokes & vs-par number on the drill Complete screen, `range-drill-detail.tsx`, and the Dashboard Drills card (shown as "est N"). Per-hole scorecard strokes = shots + 2; a caption shows the shots/putts breakdown. Rationale: par includes putting, so comparing raw shots-to-green against par was flattering — adding 2 putts makes vs-par a fair comparison (Jo's insight). Shots-to-green still visible via the caption + the clubs/shot lists.
- **2026-06-30** — Range Drill: fixed "couldn't save / couldn't stop" on multi-hole courses.
  - Root cause: the active drill only reached the Save screen after completing **every** hole the course defines (`holeIndex + 1 >= totalHoles`). On an 18-hole course you couldn't stop after 9 — only Discard. There is no 9/18 selector; the drill always expects the full course.
  - Added a **🏁 Finish Drill** button (active phase, shown once ≥1 hole is completed) that ends the drill and saves the holes played so far. If the current hole has shots logged but isn't marked "On the Green", it prompts to include or drop that hole.
  - Hardened save: `saveToSupabase` now optionally throws (`throwOnError`); `saveRangeDrills` opts in. `saveDrill` shows a "Save failed" alert and keeps the scorecard on screen instead of silently navigating away on error. Added a `saving` guard so the button can't double-fire. Other tables keep the old non-throwing behavior.
  - Verified: `range_drills` table exists in Supabase with correct schema (`id` text, `data` jsonb), unrestricted — DB was never the problem.
  - Added a **9/18 length picker**: tapping a course with >9 holes now opens a modal (Full round / Front 9 [holes 1–9] / Back 9 [last 9]). ≤9-hole courses start immediately. The chosen subset drives the whole drill (`selectedHoles` state replaces the old `selectedCourse.holes`); holes are sorted by hole number before slicing. Saved drill records the actual hole numbers played.
  - Added a **saved-drills view**: new **🎯 Drills** tab on the Dashboard lists past range drills (course, date, holes, strokes vs par, duration) with View/Delete; added a "Drills" count to the summary bar. New screen `app/range-drill-detail.tsx` shows the full scorecard with tap-to-expand per-hole shot lists. Index mapping mirrors session/round detail (`orig = all.length - 1 - index`). Route cast `as any` like `/range-drill` to dodge the stale typed-routes cache.
  - Added **drill-data → club distances** (reverse of club suggestions): the Club Distances screen now aggregates every saved drill shot by club (avg / count / min–max) and shows it per club as a separate **📊 From drills** line. Per Jo's calls, it's kept in its own field (new `drillAvg` / `drillCount` / `drillUpdatedAt` on `ClubDistance` — Carry/Total untouched) and only applied on approval via a one-tap **Save/Update drill avg** button (shown when the live average differs from the saved one). Fixed a latent bug where editing a club via the form wiped `direction`/`note` (now preserves existing fields).
  - Added **measured-vs-real gap flags** on each club: compares the live drill average against Trackman **Total only** and flags any gap ≥ `GAP_THRESHOLD` (10m) — amber ⚠️ "shorter", green ✅ "longer", e.g. "⚠️ 12m shorter than Total (228 vs 240m)". Needs ≥ `MIN_DRILL_SHOTS` (3) drill shots before flagging to avoid noise. Both constants live at the top of `clubs.tsx`. **Total-only by design:** a drill logs only the ball's end distance (= total), so comparing against carry would just reflect roll, not performance (Jo's call).
  - Added **live "distance to the green"**: during a hole, remaining = hole length − sum of shot distances, shown both in the hole card (under the 📏 length) and as a bar above the shot input. Once remaining ≤ 0 it shows "⛳ On / near the green". Requires the hole to have a distance; otherwise hidden. To keep the number accurate, **shot distance is now required** when adding a shot (`addShot` rejects blank/0/non-numeric with a "Distance required" prompt) — per Jo's call that every shot must have a distance.
  - Added **autosave + resume + discard** for in-progress drills (mirrors Draft Round). New `DraftRangeDrill` type + `getDraftRangeDrill`/`saveDraftRangeDrill`/`clearDraftRangeDrill` in storage (AsyncStorage key `draftRangeDrill`, per-device, like `draftRound`). The drill autosaves after every shot/hole during the active phase (timer `seconds` excluded from effect deps to avoid per-tick writes). The selecting screen shows an orange **Resume drill** banner (with ✕ to discard) when a draft exists; resuming restores course, hole subset, hole index, completed holes, current shots, seconds, and notes. Draft is cleared on successful save and on discard. **Note:** the lost Westpark drill predates this and is unrecoverable — autosave only protects drills going forward.
- **2026-06-25** — Chipping logging reworked to **proximity buckets**: per drill, count ≤1m / ≤2m / ≤3m / Out (>3m) / Mishit (+ drill name + club). Success = % within the day's adaptive target; feeds dashboard + Insights. Putting & Pitching keep the direction grid. Old grid-based chipping drills still display/edit as grids (backward compatible). Reason: the direction grid couldn't capture proximity, so detail was being lost in free-text notes.
- **2026-06-23** — Code health pass:
  - Fixed crash bug in `session.tsx` (undefined `threshold` → `actualThreshold` in the live grid summary).
  - Fixed `(tabs)/dashboard.tsx` `flatMap` union typing.
  - Renamed helper `useGridInput` → `isGridType` in `session-detail.tsx` (the `use` prefix made the linter treat it as a hook).
  - Deleted stray untracked `app/dashboard.tsx` (old AsyncStorage version that collided with the tabbed dashboard on `/dashboard`).
  - Cleaned all lint warnings → 0 (ternary-statements to if/else, unused imports, run-once `useEffect` documented with eslint-disable).
  - **Note:** 2 remaining tsc errors for `/session-detail` come from a stale Expo Router type cache (`.expo/types/router.d.ts`). They clear automatically on the next `npx expo start` — not a code bug.

## Overview
A personal golf training tracker app built with **React Native + Expo**, designed for use on iPhone during practice sessions and rounds. Built collaboratively by Jo and Claude, learning to code along the way.

---

## Tech Stack
- **Framework**: React Native with Expo (managed workflow)
- **Routing**: Expo Router (file-based — each file in `/app` = a screen)
- **Language**: TypeScript (.tsx files)
- **Storage**: **Supabase** (cloud) for all saved data — sessions, rounds, courses, club distances, range drills. **AsyncStorage** only for the transient draft round (per device). Keys/URL in `.env.local` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- **Hosting**: **Vercel** — the app runs as a deployed **web app** (used in the phone browser).
- **Dev tools**: Node.js, VS Code

---

## Running & Deploying

**Primary usage:** the **deployed Vercel web app**, opened in the phone browser.

**To ship a change:** commit and push to `main` — Vercel auto-deploys on push.
```bash
git add -A && git commit -m "..." && git push
```

**Local preview (optional):**
```bash
cd golf-tracker
npx expo start --web     # run in a browser on the Mac
```

**Manual web build (what Vercel runs):**
```bash
npx expo export --platform web   # outputs to dist/
```

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
- **⚙ Round Options menu** (top of screen, available at any moment) — modal with three clear actions, consistent on web + phone:
  - **Resume** → close menu, keep playing
  - **Save & Finish** → go to round-complete (saves round to dashboard)
  - **Discard Round** → two-step confirm, then `clearDraftRound()` and back home — never added to the dashboard
  - Replaced the old "✕ Exit Round" link, which on web could only save (forcing save-then-delete to abandon a round)

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
