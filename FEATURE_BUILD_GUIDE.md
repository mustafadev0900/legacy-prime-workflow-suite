# Legacy Prime Workflow — Feature Build Guide
> This document is for the next Claude session working on this codebase.
> All features listed below are NOT yet implemented in production UI.
> The infrastructure (types, AppContext methods, backend routes) exists — only the UI and trigger logic needs to be built.
> Match ALL UI exactly to the existing production design system documented at the bottom of this file.

---

## PROJECT STACK

- **Framework:** React Native + Expo 54, TypeScript, Expo Router (file-based routing)
- **State / Persistence:** `AppContext.tsx` — all app state + CRUD lives here, do NOT create new context files
- **Types:** All interfaces in `types/index.ts` — do NOT create new type files
- **Backend:** tRPC + Hono at `backend/trpc/`
- **Package manager:** Bun (`bun add`, not npm)

---

## WHAT IS ALREADY IN PLACE (infrastructure only — no UI yet)

| Item | File |
|---|---|
| `ScheduledTask.assignedEmployeeIds?: string[]` | `types/index.ts:462` |
| `ScheduledTask.assignedSubcontractorIds?: string[]` | `types/index.ts:463` |
| `updateScheduledTasks()` method | `contexts/AppContext.tsx` |
| Employee multi-select modal (works) | `components/EmployeeScheduleView.tsx:541–672` |
| `toggleEmployeeAssignment()` function | `components/EmployeeScheduleView.tsx:183–210` |
| `ScheduleShareLink` type + `generateShareLink()` / `getShareLinkByToken()` | `types/index.ts:466–475`, `contexts/AppContext.tsx:109–114` |
| `ScheduledTask.visibleToClient`, `clientVisibleNote` fields | `types/index.ts:456` |
| `Expense.isCompanyCost`, `isOfficeCost`, `isOverhead` flags | `types/index.ts:103–105` |
| `OFFICE_OVERHEAD_CATEGORIES` array | `app/(tabs)/expenses.tsx:51–57` |
| `CompactBusinessCosts` overhead display on dashboard | `components/CompactBusinessCosts.tsx` |
| `Client.jobDetails?: string` | `types/index.ts:219` |
| `Client.assignedRep?: string` | `types/index.ts:220` |
| `Client.status: 'Lead' \| 'Completed' \| 'Cold Lead'` | `types/index.ts:214` |
| `UserRole` includes `'salesperson'` | `types/index.ts:1` |
| `Appointment` type + full CRUD in AppContext | `types/index.ts`, `contexts/AppContext.tsx` |
| `AppointmentFormModal.tsx` — full create/edit form | `components/AppointmentFormModal.tsx` |
| `CRMCalendar.tsx` — calendar view | `components/CRMCalendar.tsx` |
| Twilio SMS hooks `useTwilioSMS()`, `sendSingleSMS()` | `components/TwilioIntegration.tsx` |
| Push notification backend route | `backend/trpc/routes/notifications/` |

---

## FEATURES TO BUILD

### MODULE 1 — Schedule: Subcontractor Assignment
**File:** `components/GanttChart/TaskModal/TaskDetailModal.tsx`
**Type changes:** Add `assignedSubcontractorIds?: string[]` and `assignedEmployeeIds?: string[]` to `ScheduledTask` in `types/index.ts`
**DB migration required:** Add `assigned_subcontractor_ids uuid[]` column to `scheduled_tasks` table

Below the employee list section, add:
- Section title: "Assign Subcontractors"
- Scrollable list from `subcontractors` array (AppContext)
- Each row: name + trade label + checkbox (same pattern as employee rows)
- `toggleSubcontractorAssignment(subId: string)` — mirrors `toggleEmployeeAssignment()`, updates `assignedSubcontractorIds`
- Row style: match List Row spec (see Design System below)

**Edge Cases to handle:**
1. **Empty list** — No subs added yet → show "No subcontractors found. Add them in the Subcontractors section."
2. **New unsaved task** — Hold assignments in local state, save together with task on first save (not a separate update call)
3. **workType mismatch** — Hide subcontractor picker when `workType === 'in-house'`; show only when `workType === 'subcontractor'`
4. **workType switched after selection** — If user switches from `subcontractor` → `in-house`, clear `assignedSubcontractorIds`
5. **Removing all subs** — Must save `[]` explicitly, not `undefined` or old values
6. **`assignedSubcontractorIds` undefined on existing tasks** — Default to `[]` before any `.includes()` or `.filter()` call — will crash otherwise
7. **Duplicate tap** — Deduplicate array before saving; do not add same ID twice
8. **Deleted subcontractor still on task** — Sub ID exists on task but not in `subcontractors` array → skip render or show "Removed subcontractor" label
9. **Subcontractor has no phone** — Check before SMS in Module 3; skip silently if missing
10. **Subcontractor has no trade label** — `trade` may be empty → render name only, no crash
11. **Completed task** — Picker must be read-only / disabled for completed tasks
12. **Close without saving** — Reset local sub selection state to last persisted value on modal close
13. **DB migration not run** — `assigned_subcontractor_ids` column missing → save will silently fail; migration must run first
14. **Large list (50+ subs)** — Use `keyExtractor`, avoid full re-render on every toggle
15. **Rapid double-save** — Disable Save button while `isSubmitting` is true to prevent race condition

---

### MODULE 2 — Schedule: Push Notification on Employee Assignment
**File:** `components/EmployeeScheduleView.tsx`

Inside `toggleEmployeeAssignment()` (line 183), after adding employee, fire push notification:
- **Title:** "New Task Assigned"
- **Body:** `"You've been assigned to: [task.name] on [task.startDate]"`
- Include location and notes if present
- Use: `backend/trpc/routes/notifications/`

---

### MODULE 3 — Schedule: Twilio SMS to Subcontractor on Assignment
**File:** `components/EmployeeScheduleView.tsx`

Inside `toggleSubcontractorAssignment()` (from Module 1), on add only:
```
"Hi [name], you've been assigned to a task: [task.name] on [task.startDate] at [task.location]. Notes: [task.notes]. - Legacy Prime"
```
Use `sendSingleSMS()` from `components/TwilioIntegration.tsx`. Only on assign, not on remove.

---

### MODULE 4 — Schedule: Client Shared View
**File:** `app/schedule/[token].tsx` ← NEW FILE

1. Load via `getShareLinkByToken(token)` on mount
2. Show: project name, phase names, task names, date ranges
3. Hide: employee names, avatars, subcontractor names
4. If `task.visibleToClient === false` → hide task entirely
5. Show `task.clientVisibleNote` instead of internal notes
- Style: white cards, phase name `#1E3A5F`, task rows with date on right

---

### MODULE 5 — Schedule: Expandable Task Cards
**File:** `components/EmployeeScheduleView.tsx`

In task card render (lines 376–465):
- Add `expandedTaskId: string | null` state
- Tap card → toggle expand
- Expanded: show full `task.notes` below divider (`borderTopWidth: 1, borderTopColor: '#E2E8F0'`)
- Notes text: `fontSize: 13, color: '#475569'`
- Chevron: `ChevronDown` (collapsed) / `ChevronUp` (expanded) from `lucide-react-native`

---

### MODULE 6 — Expenses: Business Expense Toggle
**File:** `app/(tabs)/expenses.tsx`

At top of form (before category picker), add toggle row:
- Label: "Business / Company Expense"
- Subtitle: "Office, rent, insurance, permits — not linked to a project"
- `Switch` component, active color `#2563EB`
- ON: set `isCompanyCost: true`, `isOverhead: true`, hide project picker, use `OFFICE_OVERHEAD_CATEGORIES`
- OFF: revert to normal mode
- Make `projectId` optional when `isCompanyCost` is true

Toggle row style:
```
bg: '#FFFFFF', borderRadius: 10, padding: 14
flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12
```

---

### MODULE 7 — CRM: Job Details Field
**File:** `app/(tabs)/crm.tsx`

In add/edit lead modal, after name/phone/email, before status:
- Label: "Job Details"
- Placeholder: "Describe the scope of work, project type, or any relevant details..."
- `multiline: true`, `numberOfLines: 3`
- Saves to `client.jobDetails`

---

### MODULE 8 — CRM: Sales Rep Assignment
**File:** `app/(tabs)/crm.tsx`

In add/edit lead modal:
- Label: "Assigned Sales Rep"
- Source: `users.filter(u => u.role === 'salesperson')`
- Horizontal scrollable chip list (match `AppointmentFormModal.tsx:390–419`)
- Each chip: rep full name
- Saves to `client.assignedRep`
- If no salespersons: muted hint "No sales reps found"

---

### MODULE 9 — CRM: Cold Lead Status
**File:** `app/(tabs)/crm.tsx`

- Add "Cold Lead" to status picker: Lead → Project → Completed → Cold Lead
- Badge colors:
  - Lead: text `#2563EB`, bg `#EFF6FF`
  - Project: text `#16A34A`, bg `#F0FDF4`
  - Completed: text `#64748B`, bg `#F1F5F9`
  - Cold Lead: text `#94A3B8`, bg `#F8FAFC`
- Cold Lead entries → separate collapsible section below active leads

---

## DESIGN SYSTEM — MATCH EXACTLY

### Colors
```
#1E3A5F  Primary dark blue (headers, titles)
#2563EB  Accent blue (buttons, active)
#F1F5F9  Page background
#FFFFFF  Card / modal background
#F9FAFB  Input background
#F8FAFC  List row default
#EFF6FF  List row selected
#E5E7EB  Default border
#E2E8F0  Light border / divider
#BFDBFE  Active/selected border
#1F2937  Primary text
#4B5563  Label text
#475569  Secondary text
#94A3B8  Muted text
#9CA3AF  Muted text (alt)
#16A34A  Success green
#F0FDF4  Green background
#D97706  Warning orange
#DC2626  Error red
#FEF2F2  Red background
#7C3AED  Purple
#6366F1  Indigo
```

### Border Radius
```
2   drag handles
6   small chips, calendar cells, info boxes
8   inputs, buttons, cards
10  list rows, modal surfaces
16  modal containers
20  pill chips
```

### Components

**Input**
```
bg #F9FAFB, borderRadius 8, borderWidth 1, borderColor #E5E7EB
paddingV 10, paddingH 14, fontSize 14, color #1F2937
placeholder #9CA3AF
```

**Label**
```
fontWeight '600', color #4B5563, marginBottom 6, marginTop 14
```

**Primary Button**
```
bg #2563EB, borderRadius 8, paddingV 12
text: fontSize 15, fontWeight '600', color #FFFFFF
```

**Secondary Button**
```
borderWidth 1, borderColor #E5E7EB, borderRadius 8, paddingV 12
text: fontSize 15, fontWeight '600', color #4B5563
```

**Modal (bottom sheet)**
```
overlay: rgba(0,0,0,0.4)
sheet: bg #FFFFFF, borderTopRadius 20, maxHeight '70%' (tall: '90%')
handle: width 36, height 4, borderRadius 2, bg #D1D5DB
```

**Modal (centered)**
```
bg #FFFFFF, borderRadius 16, maxWidth 500, maxHeight '90%'
overlay: rgba(0,0,0,0.5), padding 16
```

**List Row**
```
default: bg #F8FAFC, borderRadius 10, paddingV 10, paddingH 12, marginBottom 6
selected: bg #EFF6FF, borderColor #BFDBFE, borderWidth 1
```

**Chip / Pill**
```
paddingH 12, paddingV 6, borderRadius 16, borderWidth 1
inactive: bg #F9FAFB, borderColor #E5E7EB, text #4B5563 13px '600'
active: bg #2563EB, borderColor #2563EB, text #FFFFFF 13px '600'
```

**Info Box**
```
info:  bg #EFF6FF, borderColor #BFDBFE, borderRadius 6, padding 8, text #2563EB 12px
error: bg #FEF2F2, borderColor #FECACA, borderRadius 6, padding 8, text #DC2626 12px
```

**Avatar**
```
width 36, height 36, borderRadius 18
initials: fontSize 14, fontWeight '700', color #FFFFFF
```

**Modal Footer**
```
flexDirection row, gap 12, padding 20
borderTopWidth 1, borderTopColor #E5E7EB
```

**Section Header**
```
fontSize 13, fontWeight '600', color #94A3B8
textTransform uppercase, letterSpacing 0.5
paddingV 8, paddingH 12
```

---

## BUILD ORDER

| # | Module | File |
|---|---|---|
| 1 | CRM: Job details field | `app/(tabs)/crm.tsx` |
| 2 | CRM: Sales rep dropdown | `app/(tabs)/crm.tsx` |
| 3 | CRM: Cold lead status + section | `app/(tabs)/crm.tsx` |
| 4 | Expenses: Business toggle | `app/(tabs)/expenses.tsx` |
| 5 | Schedule: Subcontractor picker | `components/EmployeeScheduleView.tsx` |
| 6 | Schedule: Push notification | `components/EmployeeScheduleView.tsx` |
| 7 | Schedule: Twilio SMS | `components/EmployeeScheduleView.tsx` |
| 8 | Schedule: Expandable cards | `components/EmployeeScheduleView.tsx` |
| 9 | Schedule: Client shared view | `app/schedule/[token].tsx` (new) |

---

## RULES

- All new state/methods → `contexts/AppContext.tsx` only
- All new types/fields → `types/index.ts` only
- StyleSheets at bottom of each component file
- No `any` types
- No new dependencies unless absolutely necessary
- Use `bun add` not npm
- Do not touch files unrelated to the feature being built
