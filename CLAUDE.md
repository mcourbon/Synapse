# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

- **Never run `git push` without asking first and getting an explicit yes** — every time, no exceptions. Permission to push one change does not carry over to the next change later in the same session, even if the earlier instruction was "commit et push". Local commits without pushing are fine to do proactively.

## Commands

```bash
# Start dev server (opens Expo DevTools)
npx expo start

# Run on specific platform
npx expo start --ios
npx expo start --android
npx expo start --web

# Build for web
npx expo export --platform web

# Run native builds (requires native toolchain)
npx expo run:ios
npx expo run:android
```

There is no lint or test command configured. TypeScript is checked implicitly via Expo's Metro bundler with strict mode enabled.

## Environment Variables

Required in `.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture

**Stack:** Expo (SDK 53) + React Native 0.79 + TypeScript strict, with Supabase as the backend (auth, database, storage). File-based routing via expo-router v5.

### Routing (`app/`)

All screens use `headerShown: false`. Auth is enforced at the root layout level — `app/_layout.tsx` checks the auth context and renders `AuthScreen` instead of the stack if no session exists.

| Route | Purpose |
|---|---|
| `/` | Home dashboard — due card count, motivational UI |
| `/decks` | Collections list — CRUD on decks |
| `/deck/[id]` | Deck detail — card list with category system |
| `/review/global` | Review session — modal, slides from bottom |
| `/profile` | Profile, stats, settings |

### Auth & Theme (contexts/)

- **`AuthContext`** — Supabase session + guest/demo mode (stored in AsyncStorage). Provides `user`, `session`, `signUp`, `signIn`, `signOut`, `signInAsGuest`.
- **`ThemeContext`** — Light/dark toggle persisted to AsyncStorage. Provides `theme` (color object), `isDark`, `toggleTheme`. Light defaults to Apple blue (`#007AFF`), dark to `#0A84FF`.

### Supabase (`lib/supabase.ts`)

Single client export. Tables: `decks`, `cards`, `user_stats`. Storage bucket: `avatars` (path pattern: `{userId}/avatar-{timestamp}.{ext}`).

### Spaced Repetition (`utils/fsrs.ts`)

FSRS (Free Spaced Repetition Scheduler), FSRS-4.5 default weights. Three responses: `hard` / `medium` / `easy`, mapped to FSRS grades Again(1)/Good(3)/Easy(4). Models memory via `stability` (days until recall probability decays to 90%) and `difficulty` (1–10). `hard` doesn't apply the computed long-term interval — it re-queues the card ~5 minutes later, same UX as the old system. Includes ±5% fuzz factor to prevent review clustering.

Key card fields: `stability`, `difficulty` (both nullable — new/unreviewed cards), `interval` (days), `lapses`, `next_review`. `repetitions` is a UI-only "win streak" counter (increments on success, resets on `hard`), not consumed by the scheduling algorithm itself.

Migrated from a prior SM-2 implementation (`utils/spacedRepetition.ts`, deleted); existing cards were **not** migrated/approximated — they start fresh under FSRS (`stability`/`difficulty` null) at their next review.

### Stats (`lib/statsTracker.ts`)

Tracks per-user: streaks, `study_days` (JSONB array of ISO dates for heatmap), hard/medium/easy review counts, total study time (seconds), `cards_mastered` (stability ≥ 21 days and difficulty ≤ 6), `cards_difficult` (≥3 lapses). All written to `user_stats` table.

### Avatar Upload (`lib/avatarUpload.ts`)

Platform-aware: uses base64+FileSystem on mobile, data-URI parsing on web. Deletes old avatars before uploading new ones.

## Styling Conventions

- **Dynamic styles** (theme-dependent) are created with `StyleSheet.create()` inside the component and named `dynamicStyles`.
- **Static styles** (fixed colors, layout) are declared at module level in a single `styles` object.
- **Critical iOS rule:** Never put styles with hardcoded colors inside `dynamicStyles`/`StyleSheet.create()` called inside a component — iOS caches StyleSheet IDs and can render stale colors. Hardcoded-color styles must be in the module-level `styles` object.
- Theme colors are accessed via `theme.*` from `useTheme()`. Stat accent colors (`#3B82F6` blue, `#F59E0B` yellow, `#10B981` green, `#EF4444` red) are always hardcoded and static.
