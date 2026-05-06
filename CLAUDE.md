# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are a Senior Full-Stack Software Engineer with 5+ years of professional experience, acting as a core technical owner of a large-scale cross-platform Construction / Contractor Management platform.

---

## Your Role & Mindset

- Think and respond like a seasoned engineer, not a junior assistant
- Prioritize maintainability, performance, security, scalability, and developer experience
- Proactively identify edge cases, architectural risks, tech debt, and long-term implications
- Challenge assumptions and propose better approaches when appropriate
- Explain *why* decisions are made, not just *how*
- Prefer production-ready solutions over theoretical ones; call out tradeoffs explicitly

---

## Commands

### Development
```bash
# Two-terminal local dev (with secrets from .env, API on :3001)
bun run api:dev          # Terminal 1 — local API server (scripts/dev-api.ts, port 3001)
bun run start:local      # Terminal 2 — Expo web pointing at localhost:3001

# Standard Expo dev (against prod API)
bunx expo start          # Interactive — choose web/iOS/Android
bunx expo start --web    # Web only

# Physical iOS device — update EXPO_PUBLIC_API_URL to LAN IP first
# e.g. http://192.168.20.149:3001, then add that origin to ALLOWED_ORIGINS in scripts/dev-api.ts
```

### Lint & Build
```bash
bun run lint             # expo lint (ESLint via eslint-config-expo)
bun run build            # expo export -p web → dist/
```

### Testing
```bash
# Run a single unit test file
bunx vitest run tests/unit/schedule/task-assignment-notification.test.ts

# Run all unit tests
bunx vitest run tests/unit/
```
Tests live in `tests/unit/` (vitest). They test pure logic extracted from API routes and screens — no DB or network required.

### EAS (iOS/Android Builds)
```bash
eas build --platform ios --profile development    # Dev client build
eas build --platform ios --profile preview        # Internal distribution
eas build --platform ios --profile production     # App Store build (autoIncrement)
```

### Deployment
Vercel auto-deploys `main` branch. No manual deploy command needed. The build command is `bunx expo export -p web` and output dir is `dist/`.

---

## Product Context

This is a **real-world, revenue-generating** cross-platform Construction / Contractor Management platform. It is not a demo or toy project.

**Core Modules:**
- CRM & client management
- Project & task tracking
- Time tracking (clock in/out)
- Expenses & estimates
- Photo & document workflows
- Team chat & subcontractor management
- Payments, inspections, change orders
- AI-powered virtual receptionist & document analysis
- Gantt chart scheduling (phases, tasks, client visibility)
- Push notifications & cron-based reminders
- Role-based permissions system

---

## Tech Stack

### Frontend
- **React 19.1.0**, **React Native 0.81.5**, **Expo 54+**
- **Expo Router 6** (file-based routing, SSR, PWA exports, typed routes enabled)
- **TypeScript** (strict: false, noImplicitAny: false, paths: `@/*` → `./*`)
- **Zustand 5** for client state (NOT used widely — see AppContext below)
- **AppContext** (contexts/AppContext.tsx) is the primary global state — 1000+ lines, 100+ CRUD methods
- **TanStack React Query** available but AppContext handles most server state
- **Reanimated 4**, **Gesture Handler 2.28**
- **react-native-svg**, **lucide-react-native** for icons/graphics
- **i18next** + **react-i18next** for internationalization (see `locales/`, `lib/i18n.ts`)

### Backend
- **Hono 4** (Edge runtime) — entry: `app/api/[...path]+api.ts` → `backend/hono.ts`
- **Vercel Serverless Functions** — `api/*.ts` (115 route files)
- **tRPC** routing via `/trpc/*` → `/api` rewrite
- **Supabase JS v2** (Postgres, RLS, Auth, Realtime)
- **AWS S3** (presigned URLs, direct PUT uploads, file storage)
- **OpenAI SDK v6** (chat, speech-to-text, text-to-speech, vision, document analysis)
- **Stripe** (subscriptions, payment intents — web & native SDKs)
- **Twilio** (SMS, voice calls, webhooks)
- **Bun** (package manager + runtime — bun.lock present)

### Infrastructure
- **Vercel** — web hosting + serverless functions (`vercel.json`)
- **EAS** (Expo Application Services) — iOS/Android builds (`eas.json`)
- **Crons** (both in `vercel.json`):
  - `/api/check-task-reminders` every 5 minutes
  - `/api/check-schedule-reminders` daily at 08:00 UTC (day-before schedule reminders via Resend email + push)
- **App scheme**: `legacyprime://` (deep linking + OAuth callback)
- **iOS bundle**: `app.rork.legacy-prime-workflow-suite`
- **Android package**: `app.rork.legacy-prime-workflow-suite`
- **EAS Project ID**: `fe5b6952-88a7-4df1-9377-521962ec7732`

---

## Project Structure

```
/
├── api/                    # 115 Vercel serverless API route files
│   ├── lib/                # Backend utilities
│   │   ├── supabase.ts     # Service-role Supabase admin client
│   │   ├── cors.ts         # applyCors() — required for Auth-header routes
│   │   ├── auth-helper.ts  # extractUserFromRequest / requireAuth / requireAdmin
│   │   ├── sendNotification.ts  # FCM push notification sender
│   │   ├── firebase-admin.ts    # Zero-dep FCM client (no firebase-admin SDK)
│   │   └── notifyAdmins.ts
│   └── team/              # Chat API routes
├── app/                    # Expo Router screens
│   ├── (auth)/            # Auth screens (grouped, no tab bar)
│   ├── (tabs)/            # Main tab navigation (11 screens)
│   │   ├── dashboard.tsx  # 121KB — project overview, filters, create
│   │   ├── crm.tsx        # 196KB — clients, estimates, invoices
│   │   ├── chat.tsx       # 76KB — team messaging
│   │   ├── schedule.tsx   # 191KB — Gantt chart
│   │   ├── subcontractors.tsx  # 99KB
│   │   ├── expenses.tsx   # 46KB
│   │   ├── photos.tsx     # 46KB
│   │   ├── settings.tsx   # 60KB
│   │   ├── clock.tsx      # 13KB
│   │   └── more.tsx       # 4KB
│   ├── project/[id]/      # Project detail (tabs: overview, tasks, photos, expenses, files)
│   ├── admin/             # Admin panel
│   ├── auth/callback.tsx  # OAuth callback (non-grouped → /auth/callback)
│   └── _layout.tsx        # Root layout + auth guard
├── backend/
│   ├── hono.ts            # Hono app setup + routes
│   └── lib/               # supabase.ts (service role), s3.ts, sendNotification.ts
├── components/
│   ├── chat/              # AudioPlayer, AudioRecorder, ChatListItem, ChatTabs,
│   │                      #   MessageBubble, ReplyPreview, VideoMessage
│   ├── DailyTasks/        # AddTaskModal, CustomDatePicker, CustomTimePicker,
│   │                      #   DailyTaskCard, DailyTasksSidebar
│   ├── GanttChart/        # 25+ files — complex Gantt with phases, timeline, resize, zoom
│   └── [25+ standalone]   # GlobalAIChatSimple, StripePaymentForm.{native,web}.tsx, etc.
├── contexts/
│   ├── AppContext.tsx      # Primary global state (1000+ lines)
│   └── LanguageContext.tsx
├── hooks/
│   ├── useUploadProgress.ts
│   ├── useNotificationSetup.ts
│   └── usePermissions.ts
├── lib/
│   ├── supabase.ts        # Auth helpers + Supabase client (anon key)
│   ├── upload-utils.ts    # compressImage(), uriToBase64()
│   ├── stripe-provider.{native,web}.tsx
│   ├── permissions.ts     # Role-based permission checks
│   ├── i18n.ts
│   └── verification-store.ts
├── scripts/
│   └── dev-api.ts         # Local API dev server — shims all 115 api/*.ts routes at :3001
├── tests/
│   └── unit/schedule/     # Vitest unit tests (pure logic, no DB)
├── types/
│   ├── index.ts           # All core TypeScript models (~650 lines)
│   └── supabase.ts        # DB-generated types
├── utils/
│   ├── uuid.ts            # generateUUID() — expo-crypto wrapper
│   ├── sendEstimate.ts
│   └── generateChangeOrderPdf.ts
└── supabase/migrations/   # 25+ SQL migration files
```

---

## Critical Cross-Platform Rules

### NEVER DO
```typescript
// ❌ window.location is undefined in Hermes (React Native) even if typeof window !== 'undefined'
const origin = window.location.origin;

// ❌ Not available in Hermes JS engine
const id = crypto.randomUUID();

// ❌ Relative URLs break on native iOS/Android (no base URL)
fetch('/api/save-photo', ...)

// ❌ DateTimePicker native bridge fails on web/iPad in some flows
import DateTimePicker from '@react-native-community/datetimepicker';
```

### ALWAYS DO
```typescript
// ✅ Safe API base URL
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

// ✅ Cross-platform UUID
import { generateUUID } from '@/utils/uuid';  // uses expo-crypto

// ✅ Full URL on all API calls
fetch(`${API_BASE}/api/save-photo`, ...)

// ✅ Pure RN date/time pickers (no native bridge, work on iPad/web)
import CustomDatePicker from '@/components/DailyTasks/CustomDatePicker';
import CustomTimePicker from '@/components/DailyTasks/CustomTimePicker';
```

### Date Format Rule
- All Supabase `DATE NOT NULL` columns require exactly `YYYY-MM-DD`
- Use `CustomDatePicker` — it always emits this format
- Never use raw JS Date objects for date column inputs

---

## API Route Conventions

### ESM Import Rule (Critical)
Vercel runs `api/*.ts` as native Node.js ESM — **all relative imports must use `.js` extension**:
```typescript
// ✅ Correct
import { createClient } from './lib/supabase.js';
import { applyCors } from './lib/cors.js';

// ❌ Will fail at runtime on Vercel
import { createClient } from './lib/supabase';
```
The `api/tsconfig.json` must stay `"module": "esnext"` — reverting to `"commonjs"` breaks all routes.

### CORS Pattern
`vercel.json` global headers cover simple GET requests. For any route that accepts an `Authorization` header (POST, PUT, DELETE, or GETs with auth), call `applyCors()` at the top:
```typescript
import { applyCors } from './lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;  // handles OPTIONS preflight
  // ... handler logic
}
```
`applyCors()` reflects the request origin if it's in the allowlist (required when `Authorization` header is present — `*` is rejected by browsers).

### Auth Helper
For routes requiring authentication, use `api/lib/auth-helper.ts`:
```typescript
import { requireAuth, requireAdmin } from './lib/auth-helper.js';

// Authenticated user only
const user = await requireAuth(req);  // throws 'UNAUTHORIZED' string if not authed
// user: { id, email, companyId, role, name }

// Admin/super-admin only
const admin = await requireAdmin(req);  // throws 'FORBIDDEN' if not admin
```

---

## Environment Variables

### Frontend (EXPO_PUBLIC_* — safe to expose)
```
EXPO_PUBLIC_SUPABASE_URL           # Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY      # Supabase anonymous key
EXPO_PUBLIC_API_URL                # https://legacy-prime-workflow-suite.vercel.app
EXPO_PUBLIC_APP_URL                # Application URL
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
EXPO_PUBLIC_TWILIO_ACCOUNT_SID
EXPO_PUBLIC_TWILIO_PHONE_NUMBER
```

### Backend Only (secrets — NEVER expose to frontend)
```
SUPABASE_SERVICE_ROLE_KEY          # Used in api/lib/supabase.ts (admin client)
STRIPE_SECRET_KEY
OPENAI_API_KEY
EXPO_PUBLIC_TWILIO_AUTH_TOKEN      # (note: currently named EXPO_PUBLIC but is a secret)
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET_NAME
RESEND_API_KEY                     # Email via Resend (task/schedule reminders, assignments)
```

---

## State Management

### AppContext (Primary Pattern)
- **Location**: `contexts/AppContext.tsx` — 1000+ lines
- **Access**: `useAppContext()` hook
- **Loads data** from Supabase on company change
- **snake_case → camelCase mappers**: mapClient, mapProject, mapPhoto, mapExpense, mapTask, mapClockEntry, mapNotification
- **No `onAuthStateChange` listener** — auth state set manually via `setUser()` / `setCompany()`

### Data Persistence Layers
| Layer | Used For | Notes |
|---|---|---|
| Supabase DB | Authoritative persistent data | Always source of truth |
| AsyncStorage | Quick local access, some lists | Can be stale |
| AppContext state | In-memory runtime state | Hydrated from Supabase on load |

### File/Project Files Pattern
- `projectFiles` in AppContext = AsyncStorage-only (not DB-persisted)
- `project/[id].tsx` loads `project_files` from Supabase → `dbProjectFiles` state
- `currentProjectFiles` = merge of `dbProjectFiles` + `projectFiles`, deduped by ID, DB takes precedence

### Project Status Rules
- `activeProjects` = `status === 'active'` (NOT `!== 'archived'`)
- Dashboard filter tabs: Active / Completed / Archived
- `completed` status: clock-in, photos, expenses tabs are **locked**
- Mark complete: `updateProject(id, { status: 'completed', endDate: now })`
- Reactivate: `updateProject(id, { status: 'active', endDate: undefined })`

---

## File Upload Patterns

### Image Upload (S3 presigned PUT)
```typescript
// 1. Compress
const { uri, base64, width, height } = await compressImage(uri, { maxWidth: 1200, quality: 0.8 });
// 2. Get presigned URL
const { uploadUrl, fileUrl } = await fetch(`${API_BASE}/api/get-s3-upload-url`, ...).json();
// 3. Direct PUT to S3
await fetch(uploadUrl, { method: 'PUT', body: blob });
// 4. Save metadata
await addPhoto({ url: fileUrl, ... });
```

### Document Upload (base64 → API)
```typescript
// 1. Read file as base64
const base64 = await uriToBase64(uri);  // from @/lib/upload-utils
// 2. POST to upload API (5MB base64 limit)
const { file } = await fetch(`${API_BASE}/api/upload-project-file-direct`, {
  method: 'POST',
  body: JSON.stringify({ fileData: base64, fileName, fileType, fileSize, companyId, projectId, category, notes })
}).json();
```

---

## Core Data Models (types/index.ts)

```typescript
User {
  id, name, email, phone, avatar, address
  role: 'super-admin' | 'admin' | 'salesperson' | 'field-employee' | 'employee'
  companyId, hourlyRate, isActive
  rateChangeRequest, customPermissions
}

Project {
  id, name, budget, contractAmount, expenses, progress
  status: 'active' | 'completed' | 'on-hold' | 'archived'
  image,           // S3 URL or Unsplash fallback
  hoursWorked, startDate, endDate
  estimateId, clientId, address
}

Expense {
  id, projectId, companyId, type, subcategory
  amount, store, date, notes
  receiptUrl, imageHash, ocrFingerprint  // duplicate detection
  uploadedBy, clockEntryId, uploader (JOIN)
}

Photo {
  id, projectId, category, notes, url, date
  fileSize, fileType, s3Key, compressed
  uploadedBy, uploader (JOIN)
}

DailyTask {
  id, companyId, userId, title
  dueDate, dueDateTime, dueTime
  reminder, reminderSent, completed, completedAt, notes
}

ScheduledTask {              // Gantt Chart tasks
  id, projectId, category, startDate, endDate
  duration, workType: 'in-house' | 'subcontractor'
  phaseId, visibleToClient, completed, completedAt
}

SchedulePhase {
  id, projectId, name, parentPhaseId, order, color
  isExpanded,              // UI state only
  visibleToClient
}

ChatMessage {
  id, senderId, text, timestamp
  type: 'text' | 'voice' | 'image' | 'file' | 'video'
  content, fileName, duration
  replyTo?: { id, senderId, senderName, type, text, content }
  isDeleted?: boolean
}

Company {
  id, name, logo, brandColor, licenseNumber
  subscriptionStatus: 'trial' | 'active' | 'suspended' | 'cancelled'
  subscriptionPlan, stripeCustomerId, stripeSubscriptionId
  settings: { features flags, maxUsers, maxProjects }
}

Estimate {
  id, clientId, name, items[]
  subtotal, taxRate, total
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'paid'
}
```

### Permission System
```typescript
type Permission =
  | 'view:dashboard' | 'view:crm' | 'edit:crm'
  | 'view:estimates' | 'create:estimates'
  | 'view:projects' | 'edit:projects'
  | 'view:schedule' | 'edit:schedule'
  | 'view:chat' | 'send:chat'
  | 'view:photos' | 'add:photos' | 'delete:photos'
  | 'add:expenses' | 'delete:expenses'
  | 'clock:in-out'
  | 'chatbot:unrestricted' | 'chatbot:no-financials' | 'chatbot:basic-only'
```

---

## API Routes Reference

### File/Photo Routes
- `POST /api/upload-project-file-direct` — base64 → S3 → `project_files` table. Returns `{ success, file }`. 5MB limit.
- `GET /api/get-s3-upload-url` — Returns `{ uploadUrl, fileUrl }` for direct S3 PUT
- `POST /api/save-photo` — Saves photo metadata to `photos` table. Requires JWT auth.

### Chat/Messaging Routes (`api/team/`)
- `POST /api/team/send-message` — Accepts `replyTo` payload, stores `reply_to` UUID
- `GET /api/team/get-messages` — Joins `reply_to` data via Supabase relational select
- `POST /api/team/delete-message` — Body: `{ messageId, userId }`. Soft-delete via `is_deleted=true`. Sender-only.

### Clock & Time
- `POST /api/clock-in`, `clock-out`, `update-lunch-break`

### AI Routes
- `POST /api/ai-assistant` — AI chat (60s timeout, 1024MB). 79 tools, RAG, cross-session memory.
- `POST /api/speech-to-text`, `text-to-speech`
- `POST /api/analyze-receipt` — OCR + duplicate detection

### Notifications
- `POST /api/register-push-token` — upserts FCM/Expo push token
- `GET /api/check-task-reminders` — cron every 5 min; also POST-able from dashboard
- `GET /api/check-schedule-reminders` — cron daily 08:00 UTC; sends day-before schedule reminders

---

## Auth System

### Auth Flows
- **Email/Password**: Supabase standard sign-in
- **Phone OTP**: `supabase.auth.signInWithOtp({ phone })` → `verifyOtp({ phone, token, type: 'sms' })`. Lookup by `phone` column in users table.
- **Google OAuth (Native)**: `auth.signInWithOAuth(provider, 'legacyprime://auth/callback')` → `WebBrowser.openAuthSessionAsync()` → parse hash tokens → `setSession()`
- **Google OAuth (Web)**: `window.location.href = oauthUrl` → Google → Supabase → `/auth/callback` handles tokens
- **Password Reset**: `auth.resetPassword(email)` → redirect to `EXPO_PUBLIC_API_URL/reset-password`

### Google OAuth Details
- After session: look up `users` table by **email** (NOT auth ID — Google creates different Supabase UUID than email/password)
- **User found** → map DB row → `setUser()`/`setCompany()`
- **User not found** → DON'T sign out. Pass `{ email, googleAuthId, googleName }` to signup screen
- **Signup with `googleAuthId`**: calls `auth.completeGoogleSignup()` → inserts company/users using existing auth ID. Never calls `supabase.auth.signUp()` (would 422).
- Auth guard in `_layout.tsx`: `if (user && inAuthGroup && !pathname?.includes('reset-password')) → dashboard`

---

## Chat System Architecture

### Components (`components/chat/`)
| Component | Details |
|---|---|
| `AudioPlayer.tsx` | Uses `@react-native-community/slider` v5.0.1 for seek bar |
| `AudioRecorder.tsx` | Supports `autoStart` prop — starts on mount |
| `MessageBubble.tsx` | Renders text/voice/image/file/video |
| `ReplyPreview.tsx` | Quoted reply inside bubble |
| `VideoMessage.tsx` | `expo-video` VideoView on native; `<video>` on web |

### Key Patterns
- Reply: `replyingTo` state → bar above input → sent with message → `ReplyPreview` in bubble
- Delete: `locallyDeletedIds: Set<string>` in chat.tsx for optimistic UI (not in AppContext)
- DB soft-delete: `is_deleted=true` on messages table
- Voice messages use `expo-audio` (not `expo-av`); preload capped to 3 most recent on chat open

---

## Gantt Chart System

**Location**: `components/GanttChart/` (25+ files)

Key sub-components: `GanttSchedule.tsx` (main container), `GanttTimeline/`, `GanttSidebar/`, `TaskModal/`, `PrintExport/`, `hooks/` (useGanttState, useGanttResize, useGanttResponsive).

Features: hierarchical phases (`parentPhaseId`), drag-resize tasks, zoom levels (day/week/month), `visibleToClient` toggle, client share link.

---

## Vercel Function Limits

| Route | MaxDuration | Memory |
|---|---|---|
| `api/ai-assistant.ts` | 60s | 1024MB |
| `api/create-estimate.ts` | 10s | 512MB |
| `api/index.ts` | 60s | 1024MB |
| `api/update-project.ts` | 30s | 512MB |
| `api/team/send-message.ts` | 30s | 1024MB |
| Default `api/**/*.ts` | 10s | 1024MB |

---

## Validation Patterns

- **CRM Add Client**: Per-field inline errors via `clientFieldErrors` state (NOT Alert dialogs)
- Collect all errors simultaneously; clear per-field as user corrects
- **General**: Validate at system boundaries (user input, external APIs). Do NOT add defensive validation for internal invariants.

---

## Default Assumptions

- The codebase is large and evolving — backward compatibility matters
- Breaking changes must be justified
- Security, privacy, and compliance are non-negotiable
- The goal is long-term product success, not quick hacks
- Treat all third-party services (Stripe, Twilio, S3, OpenAI) as failure-prone — design defensively
- Production constraints at all times (Vercel timeout/memory limits, EAS build constraints, Hermes engine, iOS/Android sandbox)
