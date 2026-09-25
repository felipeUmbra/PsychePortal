# Portal Psis Technical Requirements Document

**Status:** Current beta technical baseline and requirements
**Last updated:** 2026-09-25
**Related product document:** [PRD.md](PRD.md)

## 1. Purpose and Scope

This document describes the technical baseline and constraints for the Portal Psis web application. It records the architecture visible in the repository and defines technical requirements for the current single-practitioner product scope. It is not a claim that every requirement below is already satisfied in production.

The application handles sensitive clinical and personal data. Technical controls must be described according to their actual enforcement point. In particular, a client-side workflow, a local hash chain, a Google Drive backup, and Firebase rules have different security properties and must not be treated as interchangeable controls.

## 2. Current Architecture

### 2.1 Application layers

- **Browser application:** React 19 and TypeScript, bundled with Vite 6.
- **Routing:** React Router `HashRouter`; public routes include landing, login, terms, and privacy. Workspace routes are mounted under `/app` and lazy-loaded.
- **UI:** Tailwind CSS v4, Lucide React, Motion, and localized English/Portuguese strings through i18next.
- **Domain access:** Page components use React hooks for patients, sessions, dashboard summaries, encryption, and Google authorization. Shared data and cryptographic helpers live under `src/lib`.
- **Authentication:** Firebase Authentication with Google sign-in. The OAuth result also supplies Google API access used by Drive and Calendar integrations.
- **Persistence adapter:** Vite aliases `firebase/firestore` to `src/lib/firestore-mock.ts`. The adapter implements a subset of the Firestore-shaped API over in-memory collection state and synchronizes the workspace JSON to Google Drive. Therefore, normal Firestore SDK calls in the app do not imply that documents are being read from or written to Firebase Firestore at runtime.
- **Attachments and backups:** The same adapter uploads attachment files to Google Drive `appDataFolder`. Separate backup helpers create timestamped JSON snapshots in that folder.
- **Hosting:** GitHub Pages deployment from the `gh-pages` branch, initiated by CI after a successful `main` push.

### 2.2 Runtime routes

| Route | Responsibility |
| --- | --- |
| `/` | Public landing page |
| `/login` | Google sign-in |
| `/terms` | Public terms |
| `/privacy` | Public privacy information |
| `/app` | Dashboard and authenticated workspace shell |
| `/app/patients`, `/app/patients/:id` | Patient directory and patient record |
| `/app/calendar`, `/app/calendar/daily` | Calendar and daily schedule |
| `/app/sessions` | Clinical session history |
| `/app/finance` | Payment/revenue summaries |
| `/app/settings` | Profile, integration authorization, exports |
| `/app/audit` | Audit history and integrity review |
| `/app/compliance` | Compliance status, backup, retention, export, and deletion tools |

## 3. Technology Baseline

The following are repository dependencies/configuration, not a recommendation to upgrade independently of compatibility testing.

| Area | Current baseline |
| --- | --- |
| Runtime | Browser-based SPA; Node.js 20 in CI |
| Language | TypeScript 5.8 |
| UI/runtime | React 19, React DOM 19 |
| Build and local server | Vite 6, React plugin, Tailwind Vite plugin |
| Routing | React Router 7 with `HashRouter` |
| Authentication and APIs | Firebase Auth SDK 12; Google Drive and Calendar REST APIs via `fetch` |
| Date/calendar | `date-fns` 4 and `react-big-calendar` 1.20 |
| Clinical note rendering | `react-markdown` with `rehype-sanitize` |
| Internationalization | i18next and react-i18next |
| PWA | `vite-plugin-pwa` 0.21, auto-update registration, Workbox-generated service worker |
| Unit tests | Vitest 5, Testing Library, jsdom |
| End-to-end tests | Cypress 15 with Mochawesome reports |
| Static deployment | GitHub Pages through `gh-pages` |

The exact installed versions are controlled by `package-lock.json`; dependency upgrades must be made there and exercised through the full CI pipeline.

## 4. Authentication and Google Authorization

### 4.1 Identity

- Use Firebase Authentication's Google provider for the practitioner identity.
- Use the authenticated Firebase UID as the practitioner identifier in domain records.
- In Cypress, `src/firebase.ts` substitutes a `MockAuth` implementation when `window.Cypress` is present. This is test-only behavior and must not be enabled in a production browser.

### 4.2 Requested Google scopes

The login flow requests:

- `openid`, `email`, and `profile`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/drive.appdata`
- `https://www.googleapis.com/auth/drive.file`

Google API access must remain limited to the workflows that need it. Scope additions require product/security review and an updated consent explanation.

### 4.3 Token lifecycle

- Drive and Calendar access tokens are held in React context state and are not persisted in browser storage by the current auth context.
- The user must re-authorize after a page reload if the access token is no longer present.
- The context clears Google tokens after 30 minutes without observed mouse, keyboard, click, or scroll activity, and when the Firebase user signs out.
- The adapter receives the Drive token in module memory. A 401/403 from Google APIs must surface a recoverable re-authorization state.
- Firebase sign-in state and Google API token state are separate conditions. A signed-in user can lack Drive or Calendar authorization.

The UI must not imply that Firebase authentication alone means Drive backup or Calendar synchronization is available.

## 5. Data and Persistence

### 5.1 Runtime adapter behavior

The Firestore-shaped adapter in `src/lib/firestore-mock.ts` currently:

- Stores active collection state in JavaScript module memory.
- Loads a `workspace.json` file from the signed-in Google account's Drive `appDataFolder` when a Drive token is supplied.
- Saves the serialized state back to Drive after a 500 ms debounce.
- Queues add, update, set, and delete operations while the initial Drive load is in progress, then processes the queue after loading.
- Notifies subscribed UI consumers after reads and writes using an in-module listener set.
- Contains a legacy fallback that can read `mock_db_cache` from localStorage when a Drive workspace is absent or a general load fails. Current data-write paths do not maintain this cache, although deletion cleanup may remove or update remnants from older versions.
- Does not provide a reliable offline persistence guarantee. With no Drive token, the current loader returns without loading a saved workspace; application state is not a durable local database.

### 5.2 Important persisted-state contract

The application uses the following logical collections:

- `patients`
- `sessions`
- `psychologists`
- `audit_logs`
- `patient_consents`
- `note_versions`

The current Drive load projection explicitly reconstructs only `patients`, `sessions`, `psychologists`, and `audit_logs`. Consent records and note-version records can be written by app features but are not restored by that projection. The Drive snapshot builder includes patient consents but does not include note versions. These are persistence/restore gaps and must be resolved before claiming durable consent history or note-version continuity across reloads/devices.

### 5.3 Data model

The typed domain contracts are defined in `src/types.ts`:

- **Patient:** practitioner association, identity/contact fields, optional demographics/address, financial plan/value, anamnesis, free-text notes, and timestamps.
- **Session:** patient and practitioner IDs, date, duration, session type/status, notes, attachments, optional Calendar event ID, and payment status.
- **Psychologist:** practitioner profile, consent template/version, retention settings, professional attestation, and optional contact details.
- **PatientConsent:** patient ID, version and captured text, acceptance/signatory details, optional guardian details, and optional revocation timestamp.
- **AuditLog:** actor/action/entity, timestamp, entity hashes, previous-record hash, and record hash.

`note_versions` are persisted as session-associated snapshots but are not represented by an exported type in `src/types.ts`; their schema needs a maintained, versioned contract.

### 5.4 Data integrity and migrations

- Persist a schema version with serialized workspace and backup payloads before introducing incompatible data changes.
- Migrations must be idempotent and must not replace non-empty state with an empty or partially loaded workspace.
- A migration must cover all collections and attachment metadata, not only the four arrays currently restored from Drive.
- Detect unsupported/corrupt workspace versions and preserve the source file until the user can recover or export it.
- Define duplicate `workspace.json` handling; the current adapter selects the first search result.
- Define a multi-device conflict policy before claiming concurrent or multi-device editing support. Current whole-file synchronization does not establish conflict-free merging.

## 6. Google Drive and Calendar Integration

### 6.1 Workspace file

- Workspace records are serialized as JSON in `workspace.json` in `appDataFolder`.
- Reads and writes use Drive REST endpoints and the in-memory OAuth token.
- Writes replace the contents of one file; they are not per-record Drive operations.
- API failure, quota limits, token expiration, and network loss must not be reported as successful synchronization.
- The app should expose whether a change is only in memory, pending upload, or confirmed by Drive. The current adapter has no durable sync-state UI.

### 6.2 Attachments

- Session attachment upload has a client-side 40 MiB limit.
- Files are uploaded as separate Drive files under `appDataFolder`, with a description encoding the application storage path.
- Session records retain attachment name, URL, size, and storage path metadata.
- Attachment download resolves the Drive file and returns an object URL; the Firebase Storage rules file does not govern these Drive REST calls.
- Upload, download, and deletion failures must be surfaced to the user and must not leave attachment metadata implying a completed operation if the file operation failed.

### 6.3 Calendar events

- Session workflows create Calendar events and update linked events when the session date changes.
- Cancellation attempts to delete a linked event when Calendar authorization exists.
- The product does not import arbitrary Calendar events as sessions.
- Calendar event updates and record updates are separate API operations. The UI and error handling must account for partial success and retry/reconciliation needs.

## 7. Encryption, Audit, Backup, and Deletion

### 7.1 Clinical-field encryption

- Browser Web Crypto is used for optional note encryption: AES-GCM with a 256-bit key, derived using PBKDF2-HMAC-SHA-256 with 600,000 iterations and a per-user salt.
- The current encryption implementation supports session notes and selected anamnesis fields. It does not encrypt the entire patient/session workspace.
- The master key remains in JavaScript module memory after unlock; lock, inactivity timeout, logout, and page reload behavior must clear or require re-entry as designed.
- Setup creates a recovery phrase and stores a hash for validation. The recovery phrase must be shown once in a controlled flow and must not be logged or sent to Drive.
- Encryption is opt-in in the current product. Unencrypted supported fields may be serialized in plaintext in Drive workspace and backup JSON.
- Any change to algorithms, payload shape, fields, or key derivation requires a versioned migration and tests for old payload compatibility.

### 7.2 Audit trail

- Audit records are chained per actor using SHA-256 record hashes and previous-hash references.
- The current audit implementation is client-side and writes records through the same workspace adapter.
- A hash chain stored in the same user-editable persistence domain is tamper-evident only under limited assumptions; it is not an immutable, independently anchored audit service.
- Audit logging failures are currently caught and logged rather than blocking the primary action. Sensitive or compliance-critical workflows must have an explicit policy for audit-write failure.
- Avoid collecting note content in audit records. The implementation stores entity-state hashes rather than full before/after clinical documents for normal audit helpers.

### 7.3 Backup

- Full backup is manually triggered through the compliance workflow.
- The current snapshot includes patients, sessions, audit records, patient consents, practitioner profile, and metadata; attachment binaries are separate Drive files and note-version history is not included in the snapshot builder.
- The current pruning policy retains snapshots for the 30 most recent distinct dates, not necessarily 30 individual snapshots.
- An optional secondary Google account token can receive a copy. Secondary failure is returned separately from primary backup success.
- A successful upload is not proof that restore is possible. Backup restore verification and a documented recovery procedure remain required operational work.

### 7.4 Patient deletion

The current deletion workflow attempts to remove the patient record, associated sessions, consent records, note-version snapshots, Drive attachments, related legacy local drafts/cache entries, and writes deletion audit events. The workflow does not remove historical backup snapshots. Deletion counts can be partial if an attachment or sub-operation fails.

Deletion requirements:

- Confirm patient identity and summarize affected record categories before execution.
- Return an accurate per-category result; do not present partial deletion as full success.
- Define how backup snapshots, Drive workspace copies, browser drafts, and any export files are handled.
- Preserve only records whose retention is explicitly required, and communicate those limits to the practitioner.
- Test deletion after a fresh reload, including when consent and note-version records exist.

## 8. Security Boundary Requirements

### 8.1 Authorization and isolation

- Every patient, session, consent, attachment, audit, and backup operation must be scoped to the authenticated practitioner and the correct Google account.
- The current application-level query filters and Firestore-shaped API are not a server-side authorization boundary.
- `firestore.rules` and `storage.rules` exist in the repository, but normal Firestore/Storage imports are aliased to the local adapter in Vite. Those Firebase rules do not authorize the adapter's Google Drive REST requests and the current GitHub Pages workflow does not deploy Firebase rules.
- Before production claims about server-enforced ownership, the runtime persistence and rule deployment model must be resolved and verified independently of Cypress mocks.

### 8.2 Browser and hosting controls

- `vite.config.ts` defines CSP headers for the Vite development server.
- `public/_headers` uses a static-host header-file convention, but GitHub Pages does not interpret that file. The deployed response headers must be verified at the actual host; development CSP is not evidence of production CSP.
- The production hosting configuration must provide and test appropriate CSP, HSTS, frame, MIME-sniffing, and referrer policies compatible with Google OAuth and APIs.
- PWA caching must not cache sensitive API responses or clinical data. The current service-worker configuration does not constitute offline clinical-data persistence.
- Production errors and analytics must not expose patient content, OAuth tokens, recovery phrases, or unnecessary identifiers.

### 8.3 Threat and privacy assumptions

- The browser, its extensions, and the signed-in Google account are within the client-side trust boundary; script injection or a compromised browser can access plaintext while the app is unlocked.
- Google Drive `appDataFolder` limits normal visibility through Drive UI, but it is still the user's Google account storage and is not equivalent to application-managed zero-knowledge storage.
- Optional field encryption narrows stored plaintext exposure only for the fields encrypted by the current app flow.
- Security claims must be scoped to a tested build, deployment, OAuth configuration, and operational process.

## 9. Technical Requirements

### 9.1 Must-have runtime requirements

- **TR-001:** Private workspace routes must require an authenticated practitioner and redirect or deny access when auth state is absent.
- **TR-002:** Google Drive and Calendar authorization state must be represented separately from Firebase identity and must have explicit loading, expired, denied, and re-authorize states.
- **TR-003:** Persistence hydration must complete or fail explicitly before the UI treats an empty collection as authoritative.
- **TR-004:** The serialized workspace contract must round-trip every collection used by the application, including `patient_consents` and `note_versions`.
- **TR-005:** Writes made during hydration must be preserved and applied exactly once; concurrent writes must not be overwritten by a stale whole-file snapshot.
- **TR-006:** Users must be able to distinguish local/in-memory change, pending Drive upload, and confirmed Drive upload.
- **TR-007:** Failed Drive operations must retain a retryable state or expose a clear failure; failures must not be swallowed as success.
- **TR-008:** Attachment metadata must be created only after successful upload, and failed delete/upload operations must be reported accurately.
- **TR-009:** Calendar and workspace updates must report partial success and provide a reconciliation path when only one side succeeds.
- **TR-010:** All workspace, backup, and export formats must carry a schema version and migration tests.
- **TR-011:** Sensitive fields must be encrypted before persistence when encryption is enabled and unlocked; all encrypted fields and exclusions must be documented in the UI.
- **TR-012:** Lock, logout, user change, and inactivity must clear the in-memory encryption key and Google API tokens according to the session policy.
- **TR-013:** Deletion must provide per-resource outcomes and clearly identify backup copies or exports not removed by the operation.
- **TR-014:** The deployed host must enforce and test security headers; development-server headers alone do not satisfy this requirement.
- **TR-015:** UI routes and PWA assets must work from the configured GitHub Pages origin and base path, including direct hash-route reloads.

### 9.2 Operational requirements

- Keep environment-specific Firebase configuration and Google OAuth configuration documented; never place private service credentials in the client bundle.
- Restrict API scopes to necessary product capabilities and maintain the OAuth consent-screen setup for the public deployment domain.
- Provide a tested backup restore runbook before treating manual backup as a recovery control.
- Establish a data incident and support process appropriate for a beta product handling clinical data.
- Document the source of truth, data residency assumptions, retention period, and deletion limitations for each deployment.

## 10. Testing and CI Requirements

### 10.1 Existing CI pipeline

On pushes and pull requests targeting `main`, GitHub Actions runs on Ubuntu with Node.js 20:

1. `npm ci`
2. `npm run typecheck`
3. `npm run test:unit` (Vitest)
4. Cypress E2E against `npm run dev` at `http://localhost:5173`
5. `npm run build`
6. Upload build and test-report artifacts

On a green push to `main`, a dependent job downloads the build and publishes it to GitHub Pages via `npm run deploy`. Pull requests do not deploy.

### 10.2 Test requirements

- Unit-test persistence serialization/hydration for every collection and backward-compatible migrations.
- Unit-test encryption setup, unlock, lock, recovery, encrypted-field coverage, and payload-version handling.
- E2E-test patient/session/consent, finance, audit, backup, deletion, Calendar, and authorization-expiry workflows.
- Keep Cypress MockAuth and intercepted Google API tests clearly classified as mocked integration tests; they do not prove Firebase rules, live OAuth consent, production headers, Google API behavior, or Drive restore.
- Add targeted tests for no-token startup, expired/revoked token, Drive failure, malformed workspace JSON, duplicate workspace files, partial writes, reload persistence, and multi-device conflicts.
- Run production-host checks for headers, route reloads, OAuth redirect behavior, and PWA caching separately from local Vite tests.
- Do not use real patient data or live clinical records in automated tests, screenshots, reports, or CI artifacts.

## 11. Current Implementation Gaps and Decisions

| Area | Verified current behavior | Required decision or work |
| --- | --- | --- |
| Persistence collections | Drive reload restores four arrays; consent and note-version arrays are omitted. | Make workspace hydration a complete, versioned round trip; add regression tests. |
| Local/offline behavior | Current write path is in-memory plus Drive sync; localStorage is a legacy fallback and cleanup path, not a supported durability layer. | Do not claim offline persistence. Decide if a secure durable local store is needed. |
| Authorization boundary | Firestore-shaped calls route through a client adapter; Firebase rules do not protect Drive REST calls. | Define and verify the actual access-control boundary before production use or multi-user expansion. |
| Backups | Snapshot omits note versions and attachment binaries; historical snapshots are not removed by patient deletion. | Define restore completeness, retention, and erasure behavior. |
| Audit integrity | Hash chain is client-side and persisted with user-controlled data. | Treat as tamper-evident assistance, not immutable audit evidence; consider independent anchoring if required. |
| Token continuity | Google tokens are intentionally not persisted; re-authorization is needed after reload. | Confirm the UX and session expectations for routine reloads and token expiration. |
| Security headers | Vite dev server sets headers; static `_headers` file is not applied by GitHub Pages. | Configure headers at a compatible host/CDN and verify live responses. |
| Firebase rules deployment | Rule files exist; current CI deploys static build to GitHub Pages only. | Decide whether Firebase services are part of runtime and separately deploy/test their rules if so. |

## 12. Source Map

- Application routes and providers: [src/App.tsx](src/App.tsx)
- Firebase initialization and Cypress auth substitution: [src/firebase.ts](src/firebase.ts)
- Google OAuth scopes and login flow: [src/pages/Login.tsx](src/pages/Login.tsx)
- Google token lifecycle: [src/context/GoogleAuthContext.tsx](src/context/GoogleAuthContext.tsx)
- Firestore-shaped adapter and Drive-backed persistence: [src/lib/firestore-mock.ts](src/lib/firestore-mock.ts)
- Domain contracts: [src/types.ts](src/types.ts)
- Session workflows and encryption integration: [src/hooks/useSessions.ts](src/hooks/useSessions.ts)
- Note encryption: [src/lib/note-crypto.ts](src/lib/note-crypto.ts)
- Audit chain: [src/lib/audit.ts](src/lib/audit.ts)
- Backup snapshots: [src/lib/backup.ts](src/lib/backup.ts)
- Patient deletion: [src/lib/data-deletion.ts](src/lib/data-deletion.ts)
- Build, PWA, aliases, and development headers: [vite.config.ts](vite.config.ts)
- Dependencies and scripts: [package.json](package.json)
- Cypress configuration: [cypress.config.ts](cypress.config.ts)
- CI and GitHub Pages deployment: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Firebase rules present in repository: [firestore.rules](firestore.rules), [storage.rules](storage.rules)
- Static-host header file: [public/_headers](public/_headers)