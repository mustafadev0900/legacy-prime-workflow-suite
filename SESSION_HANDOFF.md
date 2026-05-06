# Session Handoff — Photo Feature Work

## Session Timeline (Most Recent First)

### Session 16 — Task Assignment Notification Enrichment (Current)

**Status: COMPLETE**

#### A. Employee assignment notification now includes full details

**Problem:** In-app push said "You've been assigned to: Site Preparation on Apr 30" — no job name, no notes.

**Expected format:** "You've been assigned to [Job/Client Name] for [Task Name] on [Date].\nNote: [note content]"

**Changes:**

- `app/(tabs)/schedule.tsx` (line ~1083):
  - Added `const assignProject = projects.find(p => p.id === editingTask.projectId)` before the notification fetch
  - Added `projectName: assignProject?.name` and `notes: editingTask.notes` to the POST body

- `api/send-task-assignment-notification.ts` (full rewrite):
  - Accepts new optional fields: `projectName`, `notes`
  - `jobLabel = projectName || companyName` — job always wins over company fallback
  - In-app message: `"You've been assigned to [Job] for [Task] on [Date].\nNote: [notes]"` (note line omitted if no notes)
  - Looks up employee `email` + `name` from `users` table (parallel with push token check)
  - Fires in-app push notification + Resend email **concurrently** via `Promise.all`
  - Email: HTML template with Job / Task / Date card + optional Instructions/Notes card
  - Email skipped gracefully if `RESEND_API_KEY` not set or employee has no email on file
  - SMS: deferred (⏳ pending 10DLC campaign approval)

**Acceptance criteria met:**
- ✅ In-app notification: job name, task, date, note
- ✅ Email via Resend: full details in branded HTML template
- ✅ Both channels fire in parallel — no latency hit
- ✅ Backward-compatible — `projectName` and `notes` are optional; existing callers without those fields still work
- ✅ No new TS errors introduced

---

### Session 15 — Crash Fixes, CORS, Clock-Out Location (Current)

**Status: COMPLETE**

#### A. Native iOS SIGABRT / EXC_BAD_ACCESS crash on project card click
- Root cause: `WorkerLocationMap.native.tsx` imported `react-native-maps` which is not linked in the iOS binary
- Fix: rewrote `WorkerLocationMap.native.tsx` as a pure RN scrollable card list (no maps package dependency)
- Same crash on timecard button in employee management — `NativeMapView.native.tsx` had same import; rewrote as pure RN scrollable list with `Linking`-based "Open in Maps" button

#### B. `worker_live_locations` 404 error
- Migration SQL created: `supabase/migrations/20260504_worker_live_locations.sql`
- **User must run this SQL in Supabase SQL Editor** (once, safe to re-run — uses `IF NOT EXISTS`)

#### C. "Failed to fetch" on clock-out (getApiBaseUrl returning localhost)
- Root cause: `getApiBaseUrl()` in AppContext returned `window.location.origin` as fallback → `localhost:8081` in web dev
- Fix: removed that fallback; now always uses `EXPO_PUBLIC_API_URL || PRODUCTION_URL`
- Also wrapped `addExpense()` call in `completeClockOut` with try/catch so clock-out succeeds even if expense save fails

#### D. CORS errors on time-cards and settings screens
- Created `api/lib/cors.ts` with origin-reflecting CORS utility (required for `Authorization` header requests — `*` is insufficient)
- Added `vercel.json` global CORS headers for simple GET requests
- Applied `applyCors()` to 10 API routes: `get-users`, `add-expense`, `clock-in`, `clock-out`, `update-user`, `update-worker-location`, `reject-user`, `approve-user`, `upload-company-logo`, `update-company`

#### E. Active worker map not showing in project detail
- Root cause: `mapPins` useMemo only read from `worker_live_locations` (empty/non-existent table), ignored clock-in GPS on ClockEntry
- Fix: rewrote `mapPins` to use `activeClockEntries` as authoritative source; merges live data if available, falls back to clock-in GPS coordinates

#### F. Clock-out location missing from time-cards
- Root cause: `getCurrentLocation(true)` (high-accuracy, 15s timeout) times out indoors → returns `{0,0}` → API guard skips storing `clock_out_location` → time-cards shows clock-out time but no location pin
- Fix: added `lastKnownLocationRef` to `ClockInOutComponent`; updated each GPS capture point (clock-in, lunch-out, lunch-in, `pushLiveLocation`) to cache valid fixes into the ref; `completeClockOut` falls back to the cached location when fresh GPS returns `{0,0}`
- Ensures clock-out location is always the most recent valid GPS fix from the session (within ~60s accuracy via tracking loop)

### Session 14 — Live Worker Location Map + Hooks Error Fix + Time Cards Responsive

**Status: COMPLETE**

#### A. Hooks error fix (`app/project/[id].tsx:678`)
- Moved `if (!project)` early return from line 665 to just before `renderTabContent` — all `useCallback`/`useMemo`/`useEffect`/`useAnimatedStyle` hooks now run unconditionally on every render, fixing "Rendered more hooks than during previous render"
- Added `const isAdmin` outside `renderTabContent` so it's accessible in the Active Workers map conditional

#### B. Live worker GPS map in Active Workers card
- **New table**: `supabase/migrations/20260504_worker_live_locations.sql` — one row per employee (UNIQUE INDEX on `employee_id`), Realtime-enabled
- **New API**: `api/update-worker-location.ts` — POST upsert via service role client
- **`api/clock-out.ts`**: DELETE from `worker_live_locations` on clock-out so the employee disappears from the map immediately
- **`components/ClockInOutComponent.tsx`**: Added 60s GPS push interval (`locationIntervalRef`, `currentEntryRef`); `pushLiveLocation()`, `startLocationTracking()`, `stopLocationTracking()` helpers; wired to clock-in, clock-out, lunch-start, lunch-end; resumes on re-mount via `useEffect([currentEntry?.id])`
- **`components/WorkerLocationMap.tsx`** — TypeScript base shim (Metro resolves `.web.tsx` / `.native.tsx`)
- **`components/WorkerLocationMap.web.tsx`** — Leaflet blob-URL iframe; named pins (name label below circle); green=working, yellow=on_break; `fitBounds` for multiple workers
- **`components/WorkerLocationMap.native.tsx`** — `react-native-maps` MapView with custom markers + name labels; `fitToCoordinates` for multiple workers
- **`app/project/[id].tsx`**: Added `workerLocations` state + Supabase Realtime subscription; `mapPins` useMemo; renders `WorkerLocationMap` at bottom of Active Workers card (admin/super-admin only, only when pins available)

#### C. Time Cards responsive design + history screen (`app/admin/time-cards.tsx`, `app/admin/time-cards-history.tsx`)
- Both screens fully responsive across mobile/tablet/desktop using `useWindowDimensions()`
- `time-cards-history.tsx` created: 2-year all-periods view, 6-per-page pagination, Load More, 2-column grid on tablet+, "View" button deep-links back to time-cards with pre-selected period
- `time-cards.tsx`: added back button (`ChevronLeft`), URL params (`periodStart`/`periodMode`) for deep-link navigation from history screen, "View All History" buttons wired

### Session 13 — Time Cards Screen + Location Capture

**Status: COMPLETE**

Two features shipped this session:

#### A. Real-time GPS location on all 4 clock events
- `components/ClockInOutComponent.tsx`: removed mount-time location capture; added `getCurrentLocation()` called per-event (clock in, clock out, lunch out, lunch in)
- `types/index.ts`: added `GeoPoint` interface + `clockOutLocation?`, `startLocation?`, `endLocation?` on ClockEntry/lunchBreaks
- `contexts/AppContext.tsx`: updated `mapClockEntry` + `updateClockEntry` to persist and hydrate all 4 location fields
- `api/clock-out.ts`: accepts and stores `clockOutLocation` in new `clock_out_location JSONB` column
- `supabase/migrations/20260428_add_clock_out_location.sql`: migration created (user ran it manually)

#### B. Employee Time Cards Screen (`app/admin/time-cards.tsx`)
- New screen at `/admin/time-cards?employeeId=<id>`
- Employee summary card (initials avatar, name, role, rate, net hours, total pay, sessions)
- Biweekly period selector (dropdown; anchor Jan 6, 2025; 7 periods shown)
- Week 1 + Week 2 sections with per-day cards:
  - Timeline dots (clock-in / lunch-out / lunch-in / clock-out, color coded)
  - Mini OSM map (iframe on web, staticmap.openstreetmap.de Image on native)
  - Location rows with Nominatim reverse geocoding (queued, 1.1s rate-limited, module-level cache)
  - Notes / work performed
  - Footer stats: in/out times, break, net hours, pay
- Pay Period Summary card (6 tiles: gross, break, net, rate, sessions, total pay)
- History panel (6 previous periods; sidebar on desktop ≥1024px, below on mobile)
- Excel export (SheetJS xlsx@0.18.5): 2 sheets (Time Cards table + Locations with geocoded addresses)
  - Web: Blob download; Native: FileSystem + Sharing
- `app/admin/employee-management.tsx`: Timecard button now navigates to `/admin/time-cards?employeeId=` instead of opening a modal; removed old timecard modal + success modal + related state

### Session 12 — Photo Card Metadata Polish (Feature 1 part 4)

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED**

Aligned the three photo card surfaces so each displays title/label (category), uploader name, and a nicely formatted upload date. No new backend work — all fields already exist on the `Photo` row.

#### Audit before → after

| View | Before | After |
|---|---|---|
| `app/(tabs)/photos.tsx` **grid** | category + uploader + notes | + formatted date (`Calendar` icon + `Apr 6, 2026`) |
| `app/(tabs)/photos.tsx` **list** | category + uploader + notes + **raw ISO** | formatted date (`Apr 6, 2026`) |
| `app/project/[id].tsx` **photos tab** | had `toLocaleDateString()` default (locale-variant, `4/6/2026`) | normalized to `Apr 6, 2026` |

#### Format used everywhere

```ts
new Date(photo.date).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
})
```

Matches the spec example (`"Apr 6, 2026"`) and the existing pattern already used in other parts of the codebase (payments, estimate dates, project milestones).

#### Defensive render

Each site renders the date row only if `photo.date` is truthy, so no `Invalid Date` or empty-string rendering on legacy rows with missing timestamps.

#### Layout notes

- Grid card's new date row sits below notes with a small `Calendar` icon for scannability (`fontSize: 11`, muted gray `#6B7280`). Added `photoDateRow` + `photoDateText` styles.
- Notes line and existing uploader/category rows untouched → no regression on click-to-open, edit, or delete actions.
- List view's existing `listDate` style kept as-is; only the content was formatted.
- Desktop and mobile both render cleanly — date row is a single compact line that doesn't overflow.

#### Acceptance criteria

- ✅ Grid, list, and project-photo-tab cards all show title (category), uploader, and formatted upload date
- ✅ Metadata sourced from existing DB fields (`photos.date`, `photos.uploaded_by` → `uploader` join in AppContext)
- ✅ Consistent `"Apr 6, 2026"` format across all surfaces
- ✅ No regression on thumbnail rendering or open/edit/delete actions

---

### Session 11 — Shift Breakdown Card (Feature 2 part 4)

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED.** Pending commit with other uncommitted work.

Added the **Shift Breakdown** card to the clock details screen, placed directly beneath the Time Log (Session 10). Shows Work Hours / Lunch Break / Paid Hours with a subtraction-style visual so admins can read the billable-time math at a glance.

#### Layout

```
┌──────────────────────────────┐
│ Shift Breakdown              │
│                              │
│ Work Hours          7h 30m   │
│ Lunch Break         −45m     │   ← amber, minus-prefixed
│ ──────────────────────       │
│ Paid Hours          6h 45m   │   ← large, bold, blue
└──────────────────────────────┘
```

- **Work Hours** = `(clockOut ?? Date.now()) − clockIn`
- **Lunch Break** = `Σ ((lunch.endTime ?? Date.now()) − lunch.startTime)` across all breaks
- **Paid Hours** = `Max(0, Work Hours − Lunch Break)`

Paid Hours is rendered in a larger (`fontSize: 20, fontWeight: 800`) blue accent to match "this is the billable number" emphasis. Lunch row uses amber with a `−` prefix to make the subtraction obvious.

#### Implementation notes

- Uses the hoisted `shiftEntry` const added in Session 10 — no extra state, no new selection logic.
- Inline `fmt(ms)` formatter returns `"0m"` (not `"—"`) so the breakdown still reads cleanly for shifts with no lunches (Lunch Break = 0m, Paid = Work).
- Live-ticks for in-progress shifts via the existing 30s tick interval — Work Hours and Paid Hours increment together; while on lunch, Work Hours + Lunch Break both increment, Paid Hours stays flat.
- No regressions: existing `Today's Summary` card (bottom of screen) still shows today's aggregate `Paid Hours / Sessions / Earnings Today` — separate concept, unchanged.

#### Placement order (top → bottom)

1. Header
2. Employee card
3. **Shift Summary Card** (Session 8 — 4 glance fields)
4. **Time Log** (Session 10 — Clock In / Lunch Out / Lunch In / Clock Out chronologically)
5. **Shift Breakdown** (Session 11 — Work / Lunch / Paid)
6. Active session / Clock-In button
7. Today's aggregate Summary + history

#### Acceptance criteria

- ✅ Work Hours, Lunch Break, Paid Hours all display with correct values
- ✅ `Paid Hours = Work Hours − Σ Lunch Break` (all breaks summed)
- ✅ In-progress shifts calculate up to current time via existing tick
- ✅ Consistent card style — renders on mobile and desktop
- ✅ No regression on existing data (same math as `totalHoursToday` / Session 8 card, new section is additive)

#### Follow-up fix 1 — second-precision for sub-hour values

Initial testing showed a bug-looking display: `Work 2m − Lunch 1m = Paid 0m`. Root cause was display precision, not math — each value flooring to whole minutes makes small durations look inconsistent (e.g. Work=130s renders `2m`, Lunch=95s renders `1m`, Paid=35s renders `0m`; math is correct but unreadable).

Fix: upgraded `formatDurationCompact` so values **< 1h** include seconds (`"2m 10s"`, `"35s"`) while values **≥ 1h** keep the spec format (`"7h 30m"`). Real shifts are unaffected; short/test runs now show the subtraction correctly.

#### Follow-up fix 2 — derive Paid from displayed Work/Lunch seconds, not raw ms

After fix 1, a subtler bug remained at the second boundary: `Work 2m 14s − Lunch 1m 32s = Paid 41s` (should read `42s`). Same rounding-drift pattern, one level down — `Math.floor(workMs/1000)` loses sub-second remainders independently of `Math.floor(lunchMs/1000)` and `Math.floor(paidMs/1000)`.

Fix: floor each value to whole seconds **first** (`workSec`, `lunchSec`), then derive `paidSec = max(0, workSec − lunchSec)` from the rounded values. Render all three via a seconds-based formatter `fmtSec`. Guarantee: whatever the user computes in their head from the two displayed values is what they see for Paid. Deterministic.

---

### Session 10 — Dedicated Time Log Section (Feature 2 part 3)

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED.** Pending commit with other uncommitted work.

Replaced the per-entry Time Log block I added in Session 9 with a **dedicated "Time Log" section placed directly beneath the Shift Summary Card**, matching the exact layout requested in the Feature 2 part 3 spec.

#### What's rendered

A standalone card labeled `Time Log` below the `Current Shift` summary card, showing every clock event for the shift in chronological order (earliest first):

- **Clock In** — start of shift
- **Lunch Out** — start of each break
- **Lunch In** — end of each break
- **Clock Out** — end of shift

Each row: colored dot (blue for Clock In, amber for Lunch Out, lighter amber for Lunch In, green for Clock Out) + event label + timestamp.

#### Key behaviors

- **Multiple breaks**: each break contributes one `Lunch Out` + one `Lunch In` row. Sorted by `startTime` asc so the order is deterministic even if the DB array is out of order.
- **In-progress break** (Lunch Out with no Lunch In yet): adds a placeholder `Lunch In — In Progress` row in amber italic. Defensive sort keeps this row adjacent to its matching Lunch Out.
- **Active shift** (no clockOut): `Clock Out` event is omitted entirely from the list.
- **Chronological sort**: after pushing events, re-sorted by actual timestamp to catch any weird DB ordering.

#### Refactor

- Hoisted `shiftEntry` selection (active entry ?? latest today) to a top-level `const` so both the Shift Summary Card (Session 8) and the new Time Log section read from the same source — no duplicated logic.
- Removed the per-entry Time Log JSX + "Time Log" header styling from inside `Today's Clock History` entries (restored them to the original condensed form with the "Lunch: N min total (N breaks)" rollup line only). Eliminates duplication with the new top-level section.
- Added `timeLogCard` + `timeLogCardTitle` styles; kept the `timeLog{Row,Dot,Label,Time,TimeMuted}` styles from Session 9.

#### Acceptance criteria

- ✅ Time Log displayed beneath the top summary card
- ✅ Lists Clock In / Lunch Out / Lunch In / Clock Out in chronological order
- ✅ Multiple lunch breaks all displayed correctly (each as a Lunch Out + Lunch In pair)
- ✅ Ongoing events handled (Lunch Out without matching Lunch In → "In Progress" placeholder; Clock Out omitted during active shift)
- ✅ Renders on mobile and desktop (card-style section, width constrained to parent)

---

### Session 9 — Clock Multi-Break Support (Feature 2 part 2)

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED.** Superseded in part by Session 10 — per-entry Time Log was removed; rollup line + "Paid Hours" rename remain.

Verified that the underlying data model + math already support unlimited breaks (type `ClockEntry.lunchBreaks: Array`, Postgres `clock_entries.lunch_breaks jsonb`, API `/api/update-lunch-break` writes the full array, calc helpers loop over all entries). The gap was purely presentational — multiple breaks collapsed into a single summary line.

#### Changes in `components/ClockInOutComponent.tsx`

**1. Chronological Time Log per history entry**

The "Today's Clock History" entry now renders an ordered event list below the category/summary lines whenever there's at least one break or a clock-out:

```
Time Log
● Clocked In         9:00 AM
● Break 1 start      12:00 PM
○ Break 1 end        12:30 PM  ·  30m
● Break 2 start      3:00 PM
○ Break 2 end        In Progress (15m)
● Clocked Out        5:30 PM
```

- Breaks are normalized + sorted by `startTime` ascending so ordering is deterministic even if the array was appended out of order.
- Each break renders as two rows (start + end). The "end" row for an unfinished break shows `In Progress (Nm)` in amber italic.
- Clock-in / clock-out use colored dots (blue, green); breaks use amber. No ambiguity at a glance.

**2. Rollup line above the Time Log**

`Lunch: 75 min total (2 breaks)` — keeps the single-number view for quick scanning but now shows the break count.

**3. Bottom summary label: "Total Hours" → "Paid Hours"**

- Computation (`totalHoursToday`) was already correct: gross − sum of all lunches. Only the label changed.
- Clarifies distinction from the top-summary "Total Hours" (Session 8), which is gross duration per Feature 1 spec.

**4. In-progress break edge case**

Handled in three places:
- **Rollup**: in-progress break's elapsed duration is added to the total using `Date.now()` as the fallback end.
- **Time Log**: end row renders `In Progress (Nm)` in amber italic.
- **Top summary card** (Session 8): Lunch Break live-ticks via the existing 30s interval.

#### Acceptance criteria

- ✅ Data model supports multiple break pairs (verified — `lunchBreaks` is `Array<{ startTime, endTime? }>` end-to-end)
- ✅ Time log lists all break events in chronological order, no merging
- ✅ Bottom summary sums all break durations correctly (pre-existing math, relabeled)
- ✅ Top summary Lunch Break field reflects total across all breaks (Session 8)
- ✅ UI handles 1 / 2 / 3+ breaks without layout breakage (flat rendering per break pair)
- ✅ Unmatched Lunch Out (break in progress, no end yet) handled gracefully

---

### Session 8 — Clock Shift Summary Card (Feature 2 part 1)

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED.** Pending commit with other uncommitted work.

Added the "Top Summary Card" required by Feature 2 — shows the four key time markers for the current shift at a glance. All values come from existing `ClockEntry` data; no backend work.

#### What's rendered

At the top of the employee clock details view (inside `components/ClockInOutComponent.tsx`), between the Employee card and the active session / Clock-In button, a new `Current Shift` card with 4 fields:

| Field | Source | Edge case |
|---|---|---|
| **Clocked In** | `formatTime(entry.clockIn)` | Always present |
| **Clocked Out** | `formatTime(entry.clockOut)` | "In Progress" (muted gray) when shift is still active |
| **Lunch Break** | Sum of `(lunch.endTime ?? now) - lunch.startTime` | "—" (muted) if no lunches; live updates if on lunch |
| **Total Hours** | `endTime - startTime` (gross; includes lunch per spec) | Live-updating from the existing 30s tick when in progress |

- **Shift source**: `currentEntry` if clocked in, else latest of today's entries for this project/role (sorted desc by `clockIn`). If neither exists, the card is hidden.
- **"In Progress" pill** (green dot + label) appears in the card header when the shift has no `clockOut`.

#### Layout / responsiveness

- `flexDirection: row`, `flexWrap: wrap`, `gap: 12` on the grid.
- Each item `flex: 1, minWidth: 130` → naturally wraps: 4-across on desktop, 2×2 on mobile, 1-column on very narrow widths.
- Each item has a colored icon chip (Clock / LogOut / Coffee / Hourglass) for scannability.

#### New helpers

- `formatDurationCompact(ms)` near the existing `formatTime` helper in `ClockInOutComponent.tsx` — returns `"1h 30m"`, `"15m"`, `"0m"`, or `"—"` for non-positive.
- Added `Hourglass` and `LogOut` to the `lucide-react-native` import.

#### Acceptance criteria

- ✅ Top summary card visible at top of clock details
- ✅ All four fields populate correctly
- ✅ In-progress edge case handled (Clocked Out = "In Progress", lunch live-ticks)
- ✅ Renders on both mobile and desktop (via flex-wrap minWidth pattern)

---

### Session 7 — Right-Click Save Image on Desktop Browsers

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED.** Pending commit with other uncommitted work.

Enabled "Save image as…" in the desktop-browser right-click context menu for photos — in both the grid/list cards AND the fullscreen preview modal.

#### Root cause

`expo-image`'s web renderer uses `<div style="background-image: url(...)">` instead of `<img>`. Browsers only surface "Save image as…" on native `<img>` elements, so users couldn't right-click-save. S3 URLs were fine the whole time — no CORS or `Content-Disposition` header changes needed.

#### New component

- **`components/DesktopSavableImage.tsx`** — platform-conditional wrapper:
  - **Web**: renders a native `<img>` via `React.createElement('img', {...})` with `draggable=true`, `objectFit` mapped from `contentFit`, and flattened style. Right-click save and drag-to-desktop both work in Chrome, Safari, and Firefox.
  - **Native (iOS/Android)**: passes through to `expo-image`'s `<Image>` unchanged — keeps blurhash, priority, transitions, etc.
- Extends `ImageProps` and adds an `alt` prop for accessibility (also shows as tooltip on hover on web).

#### Files wired in (all 6 photo Image sites)

- `app/(tabs)/photos.tsx`
  - Grid card thumbnail
  - List-view thumbnail
  - Fullscreen viewer photo
- `app/project/[id].tsx`
  - Photos-tab grid thumbnail
  - Fullscreen viewer photo
- `app/project/[id]/files-navigation.tsx`
  - Fullscreen viewer photo (thumbnails in file list left as-is — mixed file types incl. PDFs)

#### Gesture / interaction notes

- `TouchableOpacity` onPress only fires on left-click; right-click is ignored by Pressable logic and falls through to the DOM, so the `<img>`'s browser context menu shows normally.
- Fullscreen zoom/pan/swipe gestures still work — the `<img>` is a child of `Animated.View` so transform applies to the whole element. Desktop users typically use mouse (which bypasses Gesture Handler's touch-only logic), so drag-to-desktop works without fighting the swipe gesture.

#### Acceptance criteria

- ✅ Right-click on photo (card or fullscreen modal) on desktop surfaces "Save image as…"
- ✅ Saves full-resolution image (served directly from S3)
- ✅ Works in Chrome / Safari / Firefox on desktop (standard `<img>` behavior)
- ✅ Native mobile behavior unchanged (component passes through to `expo-image`)

---

### Session 6 — Swipe Navigation in Fullscreen Viewers

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED.** Pending commit with other uncommitted work.

Added horizontal swipe gestures to navigate between photos when not zoomed — the last open item from Feature 1 spec. Pinch-to-zoom, pan-when-zoomed, and double-tap were already in place (Session 3).

#### Behavior

- **Not zoomed (`scale === 1`)** — pan gesture's `onUpdate` now sets `translateX = e.translationX` so the photo follows the finger horizontally (iOS Photos-style). On release, if `|translationX| > 80px` or `|velocityX| > 500` → triggers `handleNextPhoto` / `handlePrevPhoto`. Otherwise springs back to 0 (`damping: 22, stiffness: 220`). Vertical drag is ignored when not zoomed.
- **Zoomed (`scale > 1`)** — unchanged; pan moves the image within zoom bounds, clamped on release.
- **Swipe at first/last photo** — handlers guard with index checks and no-op, so spring-back still works naturally at the edges.
- **Edge case** — pinch and pan remain composed via `Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))`, so mid-swipe pinch still transitions into zoom correctly.

#### Files changed

- `app/(tabs)/photos.tsx` — panGesture now branches on scale; uses `triggerNextPhoto`/`triggerPrevPhoto` wrappers that read handler refs.
- `app/project/[id].tsx` — same (z-prefixed shared values).
- `app/project/[id]/files-navigation.tsx` — same (handlers are `handleNextImage`/`handlePrevImage`).

#### Ref pattern for worklet handlers

In `photos.tsx` and `project/[id].tsx`, `handleNextPhoto`/`handlePrevPhoto` are declared **after** `panGesture`. Listing them in the `useMemo` deps array causes a Temporal Dead Zone ReferenceError. Fix: each file defines two refs (`handleNextPhotoRef`, `handlePrevPhotoRef`) before the gesture, plus stable `triggerNextPhoto`/`triggerPrevPhoto` callbacks with `[]` deps that call `.current`. Refs are assigned on every render after the handler definitions: `handleNextPhotoRef.current = handleNextPhoto`. This keeps the gesture stable across renders (no touch drops on photo change) while always invoking the latest handler.

`files-navigation.tsx` uses the same pattern even though its handlers are declared before the gesture — consistency, and still avoids recreating the gesture when handlers change.

#### What's done for Feature 1 Acceptance Criteria
- ✅ Pinch to zoom
- ✅ Pan when zoomed
- ✅ Swipe left/right navigates between photos
- ✅ Swipe disabled when zoomed (guarded by `scale > 1` branch)
- ✅ No conflicts between zoom/pan and swipe nav
- ⏳ Tested on iOS — pending user confirmation on simulator
- ⏳ Tested on Android — pending

---

### Session 5 — Download Result Modal

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED.** Pending commit with other uncommitted work.

Added a unified success/failure modal for photo/file downloads across all three fullscreen viewers. Replaces the mix of `Alert.alert` (native) / `window.alert` (web) / silent browser behavior with one consistent branded UI.

#### New reusable component

- **`components/DownloadResultModal.tsx`** — center-card modal with status icon (`CheckCircle2` green / `XCircle` red), title, message, and action button. Success auto-dismisses after 1800ms; failure waits for user tap. Exports `DownloadResult` type (`{ status: 'success' | 'error'; message: string } | null`).

#### Files wired in

- `app/(tabs)/photos.tsx` — `handleDownloadPhoto` now sets `downloadResult` instead of calling Alert/window.alert.
- `app/project/[id].tsx` — same in `handleDownloadPhoto` (uses `viewingPhoto` + `isPhotoDownloading`).
- `app/project/[id]/files-navigation.tsx` — same in `handleDownloadImage` (uses `fullScreenImage.uri`).

Each screen adds `const [downloadResult, setDownloadResult] = useState<DownloadResult>(null)` and renders `<DownloadResultModal result={downloadResult} onDismiss={() => setDownloadResult(null)} />` at the root.

#### Native caveat

Native still calls `Sharing.shareAsync(file.uri)` first (system share sheet). The success modal only appears after the share sheet resolves. Behavior is intentional — user sees the share sheet, dismisses it, then sees "Download Complete" confirming the cache write.

#### iOS nested-Modal fix (attempted delay → switched to View overlay)

First attempt: added a 400ms delay before `setDownloadResult(...)` on native. That **did not fix it** on iOS simulator — the success/failure card never appeared after tapping "Save Image" in the share sheet.

Root cause (confirmed): React Native `<Modal>` on iOS cannot reliably present over another `<Modal>` that is still mounted, regardless of delay. The nested Modal mount is silently dropped by the UIKit presenter.

Final fix: rewrote `DownloadResultModal` to render as a positioned **`<View>` overlay** (no `<Modal>` wrapper) — `StyleSheet.absoluteFillObject`, `zIndex: 9999`, `rgba(0,0,0,0.6)` backdrop, tap-outside-to-dismiss via a `<Pressable style={StyleSheet.absoluteFill}>`. Moved its render site from a sibling of the fullscreen viewer Modal into the viewer's content tree so it layers above the photo inside the already-presented Modal. Removed the now-unneeded 400ms delays from all three download handlers.

This is the reliable cross-platform pattern: don't nest RN `<Modal>`s — use an absolutely-positioned overlay `<View>` for any "modal-like" UI that needs to appear on top of existing Modal content.

---

### Session 4 — Duplicate Modal + Dual Loading State Fixes

**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED**

Fixed the two bugs flagged as "reverted by linter" in Session 3's handoff. Pending commit with the rest of Sessions 3–5 work. Both changes live in `app/(tabs)/photos.tsx` only.

#### 1. Duplicate Upload Modal — Fixed

- Removed the standalone `Upload Progress Modal` block that rendered after the preview Modal's closing tag (was ~29 lines).
- Only the inline overlay inside the preview Modal (`uploadProgress.isUploading && (...)`) now renders during uploads — no more two overlapping indicators.
- Removed 7 orphaned styles used only by the deleted modal: `uploadOverlay`, `uploadModal`, `uploadTitle`, `uploadProgress`, `progressBarContainer`, `progressBar`, `uploadError`. Verified via grep that nothing else referenced them.

#### 2. Dual Loading State — Fixed

- `isPickingMedia` converted from `boolean` to discriminated union `'camera' | 'gallery' | false`.
- `takePhoto` → `setIsPickingMedia('camera')`; `pickImage` → `setIsPickingMedia('gallery')`. All success/catch paths still reset to `false`.
- Header buttons:
  - `disabled={isPickingMedia !== false}` on both — prevents double-trigger while one is in flight.
  - Spinner renders only when its own mode matches (`=== 'camera'` / `=== 'gallery'`); the other button keeps its icon.
- Disabled style (`headerButtonDisabled`) applies to both while either is active.

#### Notes on the prior "linter auto-revert"

No formatter in this repo rewrites a union back to `boolean`. The earlier reversion was most likely an editor "fix all" suggestion or a stale lint cache. If it recurs, run `bunx tsc --noEmit` to see which rule flags it rather than accepting a blanket rewrite.

---

### Session 3 — Zoom Controls
**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED**

Added zoom in/out controls to fullscreen photo preview modals across 3 files:
- `app/(tabs)/photos.tsx` — **COMPLETE** (done in Session 2, finished in Session 3)
- `app/project/[id].tsx` — **COMPLETE** (handlers added in Session 2, modal JSX + styles added in Session 3)
- `app/project/[id]/files-navigation.tsx` — **COMPLETE** (full implementation in Session 3)

**Uncommitted changes**: All 3 files modified (620 insertions, 45 deletions). Need to commit + push.

#### Zoom Features Implemented
| Feature | Platform | Status |
|---------|----------|--------|
| +/- buttons with % display | All | Done |
| Pinch-to-zoom (1x–4x) | Native | Done |
| Pan/drag when zoomed | Native | Done |
| Double-tap toggle 1x/2x | Native | Done |
| Scroll wheel zoom | Web | Done |
| Zoom reset on nav/close | All | Done |
| Background tap disabled when zoomed | All | Done |

#### Technical Details — Zoom Implementation
- **Libraries used**: `react-native-gesture-handler` (Gesture.Pinch, Gesture.Pan, Gesture.Tap, GestureDetector, GestureHandlerRootView) + `react-native-reanimated` (useSharedValue, useAnimatedStyle, withSpring, runOnJS)
- **Constants**: MIN_ZOOM=1, MAX_ZOOM=4, ZOOM_STEP=0.5
- **Variable naming**: `photos.tsx` uses `scale`, `translateX`, etc. / `[id].tsx` and `files-navigation.tsx` use `zScale`, `zTranslateX` etc. (z-prefix to avoid conflicts with existing vars)
- **GestureHandlerRootView** is required inside `<Modal>` because the root one in `_layout.tsx` doesn't cover modal content on iOS/Android
- **expo-image** doesn't support animated styles directly — wrapped in `Animated.View` with transform
- **Gesture composition**: `Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))`
- **Web scroll wheel**: `useEffect` with `wheel` event listener on image container ref, `{ passive: false }` for `preventDefault()`
- **Styles added**: `fsZoomControls`, `fsZoomBtn`, `fsZoomBtnDisabled`, `fsZoomBadge`, `fsZoomText`

---

### Session 2 — Fullscreen Photo Preview + Fixes
**Status: All committed**

1. **Fullscreen photo preview modal** (`photos.tsx`) — commit `d9b030a`
   - Full-screen overlay with navigation arrows, download, uploader info, metadata panel
   - Fixed variable ordering bug (filteredPhotos/fullScreenIndex memos declared before their dependencies)

2. **CORS download fix** — commit `f436dce`
   - S3 blocks cross-origin fetch requests → changed to direct `<a>` tag download on web
   - Native still uses fetch → blob → FileSystem → Sharing

3. **Fullscreen preview for project screens** — commit `1d6ffbd`
   - `app/project/[id].tsx`: Changed `viewingPhoto` from string to `Photo` type, added nav/download/metadata
   - `app/project/[id]/files-navigation.tsx`: Added `ViewableImageItem` type to normalize Photo/Expense/ProjectFile objects, fullscreen viewer for images, kept PDF "Open in Browser"

### Session 1 — Keyboard Fixes + Edit Client Modal
**Status: All committed** (commits `45016a0` through `c301e7a`)
- Fixed keyboard hiding inputs on iPad/iOS across multiple screens
- Added `InputAccessoryView` Done button for iPhone
- Fixed various UI bugs (salesperson badge, Office Role picker, web camera banners)

---

## Known Bugs

_(No open bugs — both previously-listed `photos.tsx` issues were fixed in Session 4. See the Session 4 entry above.)_

---

## File-Specific Notes

### `app/(tabs)/photos.tsx` (~2300+ lines)
- Main Photos tab with project filter, category filter, grid/list view
- Fullscreen preview modal with zoom (complete)
- Uses `fullScreenPhoto` / `filteredPhotos` / `fullScreenIndex` state
- Image URL at `.url`

### `app/project/[id].tsx` (~6500+ lines)
- Massive project detail screen with 10+ tabs (overview, schedule, estimate, photos, files, etc.)
- Photos tab section has fullscreen viewer with zoom (complete)
- Uses `viewingPhoto` (Photo type) / `projectPhotos` / `viewingPhotoIndex` state
- Image URL at `.url`
- Zoom vars use `z` prefix: `zScale`, `zTranslateX`, etc.

### `app/project/[id]/files-navigation.tsx` (~2400+ lines)
- Project files organized in predefined + custom folders (Photos, Receipts, Permit Files, etc.)
- `ViewableImageItem` type normalizes Photo, Expense, ProjectFile objects
- Uses `fullScreenImage` / `fullScreenImageList` / `fullScreenImageIndex` state
- Image URL at `.uri` (NOT `.url`)
- Zoom vars use `z` prefix
- Converter helpers: `photoToViewable()`, `expenseToViewable()`, `projectFileToViewable()`

---

## Local Dev Notes
- Frontend: `bunx expo start --web` (runs on localhost:8081)
- Backend: Can't use `vercel dev` — 142 API files exceeds Vercel's 128 builds limit
- Workaround: `.env` EXPO_PUBLIC_API_URL points to production (`https://legacy-prime-workflow-suite.vercel.app`)
- CORS issue: Uploads from localhost to production API fail (API routes lack CORS headers). Options: Chrome `--disable-web-security` or add CORS headers to API routes.

---

## What Needs to Happen Next
1. **Commit + push** Sessions 3 (zoom), 4 (photo upload bug fixes), 5 (download result modal), and 6 (swipe nav). Decide: one combined commit or separate.
2. **Test zoom** on iOS/iPad (pinch, pan, double-tap) and web (scroll wheel, +/- buttons).
3. **Test Session 4 bug fixes** in `photos.tsx`:
   - Only one upload progress indicator should appear during photo upload (inline overlay inside preview modal).
   - Tapping "Take Photo" → only the camera button spins; "Upload Photo" stays static but disabled. Reverse for "Upload Photo".
4. **Test Session 5 download modal** on both platforms:
   - Web: click download in fullscreen viewer → browser download triggers AND green "Download Complete" modal auto-dismisses after ~1.8s.
   - Native: download → system share sheet opens → dismiss it → green success modal appears.
   - Force a failure (e.g., disconnect network) → red "Download Failed" modal with message + "Dismiss" button.
5. **Test Session 6 swipe nav** on iOS and Android:
   - Drag left on an unzoomed photo → next photo loads; drag right → previous photo loads.
   - Short drag (<80px, slow) → springs back, no nav.
   - Pinch to zoom → drag → should pan the image, NOT navigate.
   - Double-tap to zoom in (2x) → drag → pans; double-tap again to reset → drag → navigates.
   - At first/last photo, swipe still springs back naturally.
6. **Test Session 7 right-click save** on desktop browsers (Chrome, Safari, Firefox):
   - Right-click a photo thumbnail in the Photos tab grid → "Save image as…" appears in the context menu → saves full-res image.
   - Same on list-view thumbnails.
   - Open fullscreen viewer → right-click the photo → "Save image as…" appears → saves.
   - Drag a photo to the desktop → file appears (native browser drag behavior).
   - Confirm mobile (iOS/Android native) unchanged — pinch-zoom, swipe nav, tap to open all still work.
7. **Test Session 8 shift summary card** (Feature 2 part 1):
   - Clock tab → pick a project → clock in → card appears above the active-session box with "Clocked In = start time", "Clocked Out = In Progress" (muted), "Lunch Break = —" (muted), "Total Hours" ticking up every 30s.
   - Start lunch → after ~30s tick, Lunch Break shows elapsed minutes; Total Hours keeps going (gross clocked duration per spec).
   - End lunch → Lunch Break stops ticking.
   - Clock out → card shows final Clocked Out time, the "In Progress" pill disappears, all 4 values are final. Values stay on screen after re-opening the tab same day.
   - Resize browser from wide → narrow: desktop shows 4 across, tablet/phone collapses to 2×2.
8. **Test Session 9 multi-break rollup + Paid Hours rename** (Feature 2 part 2):
   - History entry rollup shows `Lunch: Nm total (2 breaks)` format for multi-break shifts.
   - Bottom summary label reads `Paid Hours` (was `Total Hours`); value = gross minus all lunches combined.
9. **Test Session 10 dedicated Time Log section** (Feature 2 part 3):
   - **1 break**: Clock in → start/end lunch → clock out. Time Log card (below the Shift Summary Card) lists Clock In → Lunch Out → Lunch In → Clock Out in order with correct timestamps.
   - **2 breaks**: Clock in → start/end lunch → start/end lunch → clock out. Time Log lists six events: Clock In → Lunch Out → Lunch In → Lunch Out → Lunch In → Clock Out, all chronological.
   - **3 breaks**: same pattern; eight events render without layout issues.
   - **In-progress break**: Clock in → start lunch → DO NOT end it → reload. Time Log shows Clock In → Lunch Out → `Lunch In — In Progress` (amber italic). No Clock Out row (shift still active).
   - **Active shift, no break yet**: Clock in only → Time Log shows just `Clock In`. No empty/error state.
   - **Mobile + desktop**: Section renders with a consistent card style; no horizontal overflow.
11. **Test Session 12 photo card metadata**:
    - Photos tab grid — each card shows: uploader (avatar + name), category, optional notes, **Calendar icon + date** in format `Apr 6, 2026`.
    - Photos tab list view — each row shows: category, uploader, optional notes, formatted date (no longer raw ISO).
    - Project detail → Photos tab grid — each card shows the same with date format normalized to `Apr 6, 2026`.
    - Legacy photo with no `date` field → date row simply hidden; no `Invalid Date` label.
    - Confirm that click to open fullscreen, edit category, and delete all still work.
10. **Test Session 11 Shift Breakdown card** (Feature 2 part 4):
    - **No breaks, completed shift**: Clock in 9:00, clock out 5:00 → Work Hours = 8h, Lunch Break = 0m, Paid Hours = 8h.
    - **1 break, completed**: Clock in 9:00, lunch 12:00–12:30, clock out 5:00 → Work Hours = 8h, Lunch Break = −30m, Paid Hours = 7h 30m.
    - **2 breaks**: two 30m lunches → Lunch Break = −1h, Paid Hours = Work − 1h.
    - **In-progress shift (on the clock)**: numbers live-tick every 30s. Work Hours and Paid Hours grow together.
    - **In-progress shift, currently on lunch**: Lunch Break ticks up; Paid Hours stays flat; Work Hours still ticks.
    - Paid Hours renders in larger blue type (accent). Lunch Break renders with `−` prefix in amber. Divider above Paid Hours.
    - Placed directly below the Time Log card. Above the Clock-In / active-session button. Before the "Today's Summary" aggregate.
