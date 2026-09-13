# QA Improvement Plan — PsychePortal (Portal Psis)

**Status**: Approved for planning (plan only — no code changes yet)
**Date**: 2026-09-13
**Prepared using**: `.github/.agents/qa.agent.md` conventions

---

## 0. Executive Summary

PsychePortal is a clinical-grade React 19 + TypeScript + Vite app (Firebase Auth/Firestore, Google Drive `appDataFolder` sync, Google Calendar, i18n PT/EN, PWA). Today it has:

- ✅ **Typecheck**: `npm run lint` = `tsc --noEmit` (already present, wired in CI)
- ❌ **Unit tests**: none (no Vitest/Jest, no `*.test.*`)
- ✅ **E2E**: Cypress 15, 13 specs / 54 tests, fully offline (`MockAuth` + `cy.intercept`)
- ⚠️ **Quality gate**: partial — CI gates PR→main on lint+E2E+build, but has **no unit tests** and **no gated deploy**

This plan adds unit test coverage for all `src/lib` modules, closes E2E coverage gaps (encryption, notes, exports, backup), and hardens the CI into a full no-merge/no-deploy quality gate.

---

## 1. Unit Tests (all modules)

### 1.1 Framework

- **Vitest 3** (Vite-native) — `npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- Node 20+ provides global WebCrypto (`crypto.subtle`, `crypto.getRandomValues`) — no polyfill needed
- DOM tests (hooks, token-expiration): `jsdom` environment
- Firestore-dependent modules: use the project's **real `firestore-mock`** (already aliased in `tsconfig.json`: `firebase/firestore` → `src/lib/firestore-mock.ts`) — in-memory, localStorage-backed, matches app behavior
- Config: **`vitest.config.ts` at root** (separate file), extending Vite config's react plugin; add `test:unit` script
- Setup file `src/test/setup.ts`: `@testing-library/jest-dom` import + `sessionStorage`/`localStorage` cleanup per test

### 1.2 Files to create (`src/**/*.test.ts`)

#### Tier A — pure modules (no infra risk, highest value)

| File | Cases |
|---|---|
| `src/lib/crypto.test.ts` | `sha256('...')` known vector (64 hex chars); `computeEntityHashAsync` — key-order stability (same object, shuffled insertion order → same hash); `computeRecordHash` — chaining (`sha256(prevHash + payload)`), different prevHash ⇒ different hash |
| `src/lib/note-crypto.test.ts` | `base64Encode`/`base64Decode` round-trip (binary-safe); `generateSalt()` length = 16; `deriveKeyFromPassphrase` — deterministic given same salt+phrase, different for different salt; `encryptNote`/`decryptNote` round-trip; **tamper detection** (flip ciphertext byte or IV ⇒ decrypt rejects; wrong key ⇒ rejects); `generateRecoveryPhrase()` = exactly 12 words, all in `WORD_LIST`, at least 2 distinct; `hashRecoveryPhrase` = 64 hex |
| `src/lib/utils.test.ts` | `cn()` — clsx+twMerge (conflicting utilities resolved); **OWASP CSV injection (CWE-1236)**: `sanitizeCsvCell('=SUM(A1)')` → `"'=SUM(A1)"`, same for `+ - @ \t \r`, non-string passthrough, safe strings unchanged; `sanitizeCsvRows` maps every cell of every row |
| `src/lib/token-expiration.test.ts` (jsdom) | `setTokenExpiration` stores `Date.now()+expiresIn*1000`; `getTokenTimeRemaining` math + floor at 0; `isTokenExpiringSoon` boundary (just outside vs inside 5-min window, fake timers); `clearTokenExpiration` removes key; storage errors ignored |
| `src/lib/ip-hint.test.ts` (jsdom) | mock `fetch`: success `{ip:'203.0.113.42'}` ⇒ `'203.0.113.xxx'` (last octet anonymized); non-ok response ⇒ `'unavailable'`; invalid/missing IP ⇒ `'unavailable'`; second call returns cached value (fetch called once); abort path (5s timeout) ⇒ `'unavailable'` |
| `src/lib/word-list.test.ts` | 512 entries, all unique, all non-empty strings |

#### Tier B — Firestore-dependent modules (via project firestore-mock)

| File | Cases |
|---|---|
| `src/lib/audit.test.ts` | `getLastAuditHash('')` ⇒ `'0'.repeat(64)` (genesis); new actor ⇒ genesis; after seeded log ⇒ that log's hash; **per-actor chain isolation** (two actors don't cross-link — CWE-353 regression); `clearLastHashCache(actor)` clears only that actor; `logEvent` writes entry whose `hash` chains `prevHash`; cache invalidated after write |
| `src/lib/retention.test.ts` | cutoff math (`retentionYears * 365.25 * 24 * 60 * 60 * 1000`); expired (older than cutoff, Timestamp & ISO-8601 date forms) filtered & deleted; recent session retained; result `sessionsDeleted` / `consentsAffected` counts; `lastRetentionRun` updated; `logDelete` invoked per deletion |
| `src/lib/data-deletion.test.ts` | full erasure: patient doc deleted, sessions count, consents count, attachments (via `deleteObject` on stored `storagePath` and legacy reconstructed path), audit `logDelete` bulk entry; missing attachments don't throw |
| `src/lib/data-export.test.ts` | `generateDataBundle` shape (metadata/patient/sessions/consents/integrity); patient null when missing; `tryDecryptNote` states: plaintext passthrough, encrypted w/o passphrase (`encrypted:true`), encrypted + correct passphrase ⇒ decrypted + `_notesDecrypted`, wrong passphrase ⇒ stays encrypted; integrity hash present & computed over payload |
| `src/lib/export-log.test.ts` | `logDataExport` writes doc with all fields; failure swallowed (no throw) |
| `src/lib/firestore-mock.test.ts` | CRUD (`addDoc`/`getDoc`/`getDocs`/`updateDoc`/`deleteDoc`); `DocSnapshot.data()` deep-clones (mutating result doesn't change state); `doc(collectionRef,id)` overload; `setDriveToken(null)` clears; `onSnapshot` fires on writes |

#### Tier C — hooks (jsdom + @testing-library/react)

| File | Cases |
|---|---|
| `src/hooks/usePatients.test.ts` | mock `react-firebase-hooks` `useAuthState`; unlocked ⇒ addPatient encrypts `notes`/`anamnesis` fields before `addDoc`; locked ⇒ plaintext write; no user ⇒ `addPatient`/`updatePatient` throw `Unauthenticated`; `handleFirestoreError` invoked on snapshot error |
| (optional) `src/hooks/useSessions.test.ts` | session CRUD + calendar sync call made only when tokens present |

### 1.3 Quality bar

- `npm run test:unit` must be green **and** `npm run lint` must still pass (test files are included in `tsconfig` via `"include": ["src"]` — keep types strict).

---

## 2. E2E Review — Fixes & Missing Coverage

### 2.1 Coverage audit (13 specs / 54 tests read)

| Feature | Covered? | Where |
|---|---|---|
| Auth / login / logout | ✅ | `auth.cy.ts`, `login.cy.ts`, `app-shell.cy.ts` |
| Patients CRUD + filters | ✅ | `patients.cy.ts` |
| Patient detail, consent, scheduling, erasure | ✅ (partial) | `patient-detail.cy.ts` |
| Calendar views + scheduling + recurrence (labels) | ✅ | `calendar.cy.ts` |
| Sessions list/search/navigate | ✅ | `sessions.cy.ts` |
| **Session notes (editor, markdown, save/render)** | ❌ **GAP** | — |
| **Attachments upload** | ❌ **GAP** | — |
| **Encryption setup / unlock modal (core security feature)** | ❌ **GAP** | `compliance.cy.ts` checks only a static label |
| Finance + filters | ✅ | `finance.cy.ts` |
| Dashboard KPIs/navigation/quick actions | ✅ | `dashboard.cy.ts` |
| Settings profile/consent/inactivity | ✅ | `settings.cy.ts` |
| **CSV data export (Settings)** | ❌ **GAP** | — |
| Compliance panel | ✅ (labels only) | `compliance.cy.ts` |
| **Retention enforcement run** | ❌ **GAP** | label-only |
| **Backup now / off-site copy** | ❌ **GAP** | label-only |
| Audit log + **integrity chain verify** | ✅ | `audit-log.cy.ts` |
| App shell nav / language toggle / logout | ✅ | `app-shell.cy.ts` |
| Drive+Calendar persistence payloads | ✅ | `persistence.cy.ts` |

### 2.2 New/changed specs

1. **`cypress/e2e/encryption.cy.ts`** (NEW)
   - First-run: setup modal → generate recovery phrase → confirm → encryption active
   - Unlock flow with phrase; wrong phrase rejected
   - **Encrypted note flow**: log session w/ note → assert Drive upload payload contains `version:'v1'` + ciphertext (not plaintext) — proves AES-GCM at rest (CWE-311 regression check like `persistence.cy.ts`)
2. **`cypress/e2e/sessions.cy.ts`** (EXTEND)
   - Open note editor (`RichTextEditor`), type Markdown, save, assert rendered output via `RichTextRenderer`
   - Attachment upload (intercept `upload/drive/v3/files`) + delete
3. **`cypress/e2e/settings.cy.ts`** (EXTEND)
   - CSV export: click through, assert filename/`download`/`blob` via intercepted request
4. **`cypress/e2e/compliance.cy.ts`** (EXTEND)
   - Trigger "Backup now" → assert Drive `upload/drive/v3/files` call with `workspace-backup-*` name
   - Retention: seed an old session via mock state → run enforcement → assert deletion + audit entries

### 2.3 Flakiness fixes

- **`sessions.cy.ts`**: `createPatientWithSession()` builds `datetime-local` from `new Date()` → day-boundary flake at midnight. Use an explicit fixed past date (e.g. `2026-01-15T14:00`) instead of `yesterday.getDate()-1`.
- **`patient-detail.cy.ts` erasure test**: after typed confirmation it asserts `.card` `not.exist` while the Drive sync layer may still be settling — follow the `openPatientCard` philosophy: wait via `cy.contains('h1', ...)` / URL, never `cy.reload()`.
- Verify specs against both PT and EN locales (all text selectors already use regex alternation — keep that invariant when extending).

---

## 3. Typecheck — decision

- **Already present**: `"lint": "tsc --noEmit"` (covers `src` + `cypress` via `tsconfig` include).
- **Recommended (optional, non-breaking)**: add `"typecheck": "tsc --noEmit"` alias so the conventional name matches qa.agent.md docs. Then re-point CI comment labels to `npm run typecheck` (script body identical). No functional change.

---

## 4. Quality Gate — `ci.yml` upgrade

Current: `push/PR → main` ⇒ lint → Cypress (dev server `:5173`) → build → upload artifacts.

### Proposed pipeline (single `test-and-build` job + gated `deploy` job)

```yaml
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test-and-build:
    steps:
      1. checkout + setup-node(20) + npm ci
      2. npm run lint                      # typecheck — gates merge
      3. npm run test:unit                 # NEW: vitest run — gates merge
      4. cypress-io/github-action@v6       # E2E (start: npm run dev, wait-on :5173, browser: chrome)
      5. npm run build                     # gated on 2–4
      6. upload dist/ + cypress reports/ (if: always)

  deploy:                                   # NEW — production deploy
    needs: [test-and-build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      1. checkout + setup-node(20) + npm ci
      2. download build artifact
      3. gh-pages deploy to main (or actions/deploy-pages)   # ONLY when ALL tests green
```

Key properties:
- **Everything gates merge** (`lint` + `test:unit` + `e2e` are required status checks on PRs).
- **Production deploy** happens *only* on `push → main` after the whole gate passes — turns the current gate into a true "no green, no deploy" policy.
- **Cancel-in-progress** avoids wasted runs on stale commits.
- Reports (`mochawesome` HTML/JSON + screenshots + videos) uploaded as artifacts even on failure (existing behavior preserved).

---

## 5. Execution Order (when approved)

1. **Infra**: `vitest` + `jsdom` + testing-library deps; `vitest.config.ts`; `src/test/setup.ts`; `test:unit` script
2. **Tier A pure unit tests** (6 files)
3. **Tier B DB-dependent unit tests** (via firestore-mock, 7 files)
4. **Tier C hook tests** (usePatients, optional useSessions)
5. **E2E gaps**: `encryption.cy.ts` (new) + extend sessions/settings/compliance + flakiness fixes
6. **CI upgrade**: `test:unit` step + `typecheck` alias + gated `deploy` job

## 6. Acceptance Criteria

- [ ] `npm run test:unit` green (all tiers)
- [ ] `npm run lint` green with test files included
- [ ] `npx cypress run` green (13 + new specs)
- [ ] Encryption E2E asserts no plaintext notes in Drive payload
- [ ] CI runs lint → unit → E2E → build; deploy job only on green `main` push
- [ ] No production code modified to make tests pass (qa.agent.md constraint)

---

*Prepared per `.github/.agents/qa.agent.md` constraints: never modify prod code for tests, offline-only E2E, bilingual selectors, deterministic waits.*