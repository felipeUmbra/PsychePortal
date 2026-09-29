# Portal Psis — Agent Instructions

This document helps AI coding agents understand the PsychePortal codebase and be immediately productive. It covers architecture, conventions, testing, and common workflows.

## Quick Reference

| Topic | Details |
|-------|---------|
| **Stack** | React 19, TypeScript, Vite 6, Tailwind CSS v4, Firebase Auth, Firestore (aliased to mock) |
| **Routing** | HashRouter, lazy-loaded pages under `/app` |
| **State** | Custom hooks + React Context (GoogleAuthContext) |
| **Persistence** | `firestore-mock.ts` — localStorage + Google Drive `appDataFolder` sync |
| **Testing** | Cypress 15 E2E (54 tests), Vitest unit tests |
| **CI/CD** | GitHub Actions: lint → E2E → build → artifacts → GitHub Pages |
| **PWA** | `vite-plugin-pwa` with Workbox, installable on mobile |

---

## Project Structure

```
src/
├── components/       # Reusable UI components (patients/, sessions/, Layout, Sidebar, etc.)
├── context/          # GoogleAuthContext — Drive/Calendar tokens + 30-min inactivity auto-clear
├── hooks/            # Domain hooks: usePatients, useSessions, useDashboard, useEncryption, etc.
├── lib/              # Core utilities: crypto, audit, backup, retention, firestore-mock, error-handler
├── pages/            # Route components (lazy-loaded): Dashboard, Patients, Calendar, Finance, etc.
├── types.ts          # Domain types: Patient, Session, Psychologist, AuditLog, PatientConsent
├── firebase.ts       # Firebase init + MockAuth for Cypress (swaps auth when window.Cypress exists)
├── main.tsx          # Entry point + PWA registration
├── i18n.ts           # i18next config (PT/EN)
└── App.tsx           # Routes + GoogleAuthProvider + ErrorBoundary + Suspense
```

**Key architectural decision:** `vite.config.ts` aliases `firebase/firestore` → `src/lib/firestore-mock.ts`. The app uses Firestore-shaped APIs but persists to Google Drive, not Firebase Firestore.

---

## Essential Commands

```bash
# Development
npm run dev              # Start Vite dev server (http://localhost:5173)

# Build & Typecheck
npm run build            # Production build (uses terser, drops console/debugger)
npm run lint             # TypeScript type-check only (tsc --noEmit)

# Testing
npm run test:unit        # Vitest unit tests
npx cypress run          # Headless E2E tests (requires dev server or CI)
npx cypress open         # Interactive Cypress runner

# Deploy
npm run predeploy && npm run deploy  # Build + deploy to GitHub Pages
```

---

## Testing Conventions

### Cypress E2E (Primary)
- **13 spec files, 54 tests** covering: auth, patients, sessions, calendar, finance, dashboard, settings, compliance, audit-log, persistence
- **MockAuth** in `firebase.ts` simulates Google OAuth when `window.Cypress` is present
- **API intercepts** in `cypress/support/commands.ts`:
  - `cy.mockDriveApi()` — stubs Drive REST calls
  - `cy.mockCalendarApi()` — stubs Calendar event deletion
  - `cy.loginWithGoogle()` — clicks real button, MockAuth handles popup
- **Custom commands**: `cy.openPatientCard(name)` handles Drive sync timing
- Reports: `cypress/reports/html/` via `cypress-mochawesome-reporter`

### Unit Tests (Vitest)
- Located alongside source files: `*.test.ts` / `*.test.tsx`
- Focus: `lib/` utilities (crypto, audit, backup, retention, export, etc.)

---

## Persistence Layer (`src/lib/firestore-mock.ts`)

**Critical to understand:** This is NOT Firebase Firestore. It's a custom adapter that:

1. **In-memory state** — collections: `patients`, `sessions`, `psychologists`, `audit_logs`, `patient_consents`, `note_versions`
2. **Google Drive sync** — `workspace.json` in `appDataFolder` (user's private Drive)
3. **Debounced saves** — 500ms debounce after writes
4. **Pending queue** — operations queued during initial load, replayed after
5. **Atomic replacement** — state only replaced once Drive/localStorage data fully arrives (prevents data-loss race on reload)
6. **localStorage fallback** — legacy `mock_db_cache` (read-only on load, not maintained on writes)

**Collections restored from Drive:** `patients`, `sessions`, `psychologists`, `audit_logs`  
**NOT restored:** `patient_consents`, `note_versions` (known gap, see TRD.md)

---

## Authentication & Google APIs

- **Firebase Auth** — Google provider, UID = practitioner ID
- **Google scopes**: `openid email profile calendar.events drive.appdata drive.file`
- **Tokens** held in `GoogleAuthContext` (React Context), NOT persisted to storage
- **30-min inactivity** auto-clears tokens (`token-expiration.ts`)
- **Separate states**: Firebase sign-in ≠ Drive/Calendar authorization
- **Custom events**: `google-auth-error`, `google-auth-success` for UI banners

---

## Encryption (`src/lib/note-crypto.ts`, `useEncryption.ts`)

- **Opt-in** clinical field encryption (AES-GCM 256-bit, PBKDF2 600k iterations)
- **Encrypts**: session notes, selected anamnesis fields
- **Key lifecycle**: in-memory only; cleared on lock, logout, inactivity, page reload
- **Recovery phrase** shown once during setup, hash stored for validation

---

## Key Files to Reference

| File | Purpose |
|------|---------|
| `src/types.ts` | Domain types (Patient, Session, Psychologist, AuditLog, PatientConsent) |
| `src/lib/firestore-mock.ts` | Persistence adapter — read this for data flow |
| `src/lib/audit.ts` | Audit trail with SHA-256 hash chain |
| `src/lib/retention.ts` | Data retention policy enforcement |
| `src/lib/note-crypto.ts` | Clinical note encryption |
| `src/lib/backup.ts` | Full workspace snapshots to Drive |
| `src/context/GoogleAuthContext.tsx` | Drive/Calendar token management |
| `src/hooks/usePatients.ts` | Patient CRUD + real-time listener + encryption |
| `src/hooks/useSessions.ts` | Session CRUD + Calendar sync + attachments |
| `cypress.config.ts` | Cypress config (baseUrl, viewport, reporter) |
| `vite.config.ts` | Build, PWA, CSP, chunking, Firestore alias |
| `Project Docs/TRD.md` | Technical requirements & known gaps |

---

## Common Workflows

### Adding a New Page
1. Create `src/pages/NewPage.tsx`
2. Add lazy import in `App.tsx`
3. Add route under `/app` in `App.tsx`
4. Add sidebar link in `Sidebar.tsx`
5. Add i18n keys in `src/locales/en/pt/common.json`

### Adding a Firestore Collection
1. Add to `state` in `firestore-mock.ts`
2. Add to Drive load projection in `loadFromDrive()`
3. Add to backup snapshot in `backup.ts`
4. Add audit logging in relevant hook

### Running a Single Cypress Spec
```bash
npx cypress run --spec "cypress/e2e/patients.cy.ts"
```

### Type-Check Only
```bash
npm run lint
```

---

## Known Gaps & Gotchas (from TRD.md)

- **Consent & note versions not restored** from Drive on reload
- **No durable offline persistence** without Drive token
- **Firebase rules not deployed** — Vite aliases Firestore to mock, GitHub Pages doesn't deploy rules
- **CSP headers** only in dev server (`vite.config.ts`); GitHub Pages ignores `public/_headers`
- **No sync-state UI** — users can't tell if changes are pending/confirmed on Drive
- **Whole-file sync** — no conflict resolution for multi-device
- **Backup doesn't include** note versions or attachment binaries

---

## Documentation Links

- [README.md](README.md) — Project overview, setup, testing, deployment
- [Project.md](Project.md) — Detailed architecture, features, stack
- [Project Docs/TRD.md](Project%20Docs/TRD.md) — Technical requirements, constraints, gaps
- [Project Docs/PRD.md](Project%20Docs/PRD.md) — Product requirements
- [Project Docs/UI_UX_DESIGN.md](Project%20Docs/UI_UX_DESIGN.md) — Design system
- [Project Docs/BACKEND_DATA_SCHEMA.md](Project%20Docs/BACKEND_DATA_SCHEMA.md) — Data schema
- [Project Docs/IMPLEMENTATION_PLAN.md](Project%20Docs/IMPLEMENTATION_PLAN.md) — Implementation roadmap
- [Project Docs/APP_FLOW.md](Project%20Docs/APP_FLOW.md) — User flow diagrams

---

## Agent Customization Suggestions

For future specialization, consider creating:
- `/create-skill firestore-mock` — Patterns for the persistence adapter
- `/create-skill clinical-encryption` — Encryption/decryption workflows
- `/create-skill cypress-mockauth` — Cypress MockAuth patterns
- `/create-instruction patient-crud` — Patient CRUD with encryption
- `/create-instruction session-calendar-sync` — Session + Google Calendar integration