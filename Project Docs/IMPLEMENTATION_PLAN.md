# Portal Psis Implementation Plan

**Status:** Proposed delivery sequence based on current beta gaps
**Last updated:** 2026-09-25

Related documents: [PRD](PRD.md), [TRD](TRD.md), [UI/UX Design](UI_UX_DESIGN.md), [Backend Data Schema](BACKEND_DATA_SCHEMA.md), [App Flow](APP_FLOW.md).

## 1. Planning Principles

- Stabilize sensitive-data behavior before adding product breadth.
- Resolve discrepancies between direct source code, product claims, and deployment configuration before relying on them operationally.
- Make each phase independently testable with a clear exit gate.
- Keep product requirements, technical requirements, and implementation status distinct. This is a proposed plan; listed work is not presumed complete.
- Preserve existing user data and user-authored work during migrations.

## 2. Priority Summary

| Priority | Workstream | Why it comes first |
| --- | --- | --- |
| P0 | Persistence correctness and data recovery | Current whole-workspace load does not restore all collections; sync failures can be unclear |
| P0 | Unified session write path | Consent and encryption behavior differs by session entry point |
| P0 | Security/deployment truth | Client adapter, Firebase rules, and GitHub Pages headers do not currently form one verified enforcement boundary |
| P1 | Backup, deletion, and retention completeness | Snapshot and erasure behavior have coverage gaps and partial-failure risks |
| P1 | UX state and accessibility consistency | Users need accurate save/sync status, actionable errors, and consistent responsive behavior |
| P1 | Release qualification | Existing automated tests are valuable but mock external services and do not prove production configuration |
| P2 | Product expansion | Only consider after beta reliability and operational expectations are established |

## 3. Phase 0: Baseline and Decision Record

### Objectives

- Confirm production host, Firebase project usage, Google OAuth configuration, and actual persistence source of truth.
- Reconcile repository documentation with deployed behavior.
- Establish a known-good baseline before behavior changes.

### Tasks

- Record production URLs, GitHub Pages settings, OAuth authorized domains, Firebase Auth setup, and the set of enabled Google APIs/scopes.
- Verify live response headers and PWA/service-worker caching behavior.
- Capture representative non-sensitive test fixtures and current workspace schema examples; never use real clinical records.
- Decide whether the supported beta remains Drive-backed single-practitioner storage or migrates to Firestore/server-enforced access control.
- Define expected reload, offline, multi-device, conflict, backup restore, and data deletion semantics.

### Exit criteria

- Architecture and storage decisions are recorded and approved.
- Current deployment configuration has an environment checklist.
- Baseline typecheck, unit tests, Cypress tests, and production build are green or existing failures are recorded.
- A production smoke-check process exists for headers, OAuth, routes, and PWA caching.

## 4. Phase 1: Persistence and Schema Correctness (P0)

### Tasks

- Define the workspace envelope and schema version in `BACKEND_DATA_SCHEMA.md` as the migration target.
- Add `patient_consents` and `note_versions` to complete load/save/hydration behavior; preserve legacy workspace data.
- Make workspace replacement atomic and preserve queued writes during hydration, failures, and token refresh.
- Define handling for missing, malformed, duplicate, or unsupported-version `workspace.json` files without overwriting recoverable data.
- Add user-visible states for in-memory edits, pending synchronization, successful Drive persistence, and sync failure/retry.
- Normalize date/status/money/ownership data before any backend migration.

### Tests

- Round-trip every collection through save, reload, and subsequent mutation.
- Verify missing Drive token, expired token, permission denial, network failure, corrupt JSON, duplicate files, and empty workspace behavior.
- Verify writes during load are applied exactly once and do not overwrite loaded records.
- Verify no success state appears before a remote write is confirmed.

### Exit criteria

- All active collections survive a fresh app load.
- No hydration error can replace non-empty user data with an empty workspace.
- Sync outcome and retry behavior are understandable and tested.

## 5. Phase 2: Unified Clinical Write Path (P0)

### Tasks

- Move session creation and update rules into one domain-level service/hook used by patient detail, calendar modal, and session history.
- Enforce active consent consistently before session creation/update where required by product policy.
- Apply encryption policy consistently for notes across all entry points and specify exact encrypted field coverage in UI.
- Ensure the module-level master key is cleared on user change, sign-out, encryption lock, and configured timeout.
- Standardize date/status payloads, completed-session edit behavior, and note-version creation.
- Make Calendar event and workspace changes report partial success and provide a reconciliation/retry path.

### Tests

- Exercise every session creation/edit entry point with active, missing, and revoked consent.
- Test locked/unlocked encryption states for patient detail, calendar modal, and session history.
- Test Calendar creation/update/cancellation failures independently from workspace writes.
- Test completed-session edit confirmation and note version snapshots.

### Exit criteria

- Every session write path follows the same consent and encryption policy.
- Tests prove no route bypasses the shared domain workflow.
- Partial Calendar/workspace outcomes are visible and recoverable.

## 6. Phase 3: Security Boundary and Deployment (P0)

### Tasks

- If retaining Drive-backed persistence, document the limits of client-side ownership checks and define account/workspace isolation behavior; if moving to Firestore, route runtime data calls through the real SDK and test deployed rules.
- Verify storage-rule relevance: Drive uploads are not protected by Firebase Storage rules.
- Configure production security headers on a host/CDN that supports them; verify deployed responses instead of relying on Vite dev headers or GitHub Pages `_headers` files.
- Review OAuth scopes for least privilege and complete consent-screen domain/verification steps.
- Verify PWA caching excludes sensitive runtime data and external API responses.
- Add production-config tests or smoke checks that do not use Cypress MockAuth.

### Tests and review

- Cross-account isolation tests for records, attachments, and exports.
- Production response-header check for CSP, HSTS, frame policy, MIME sniffing, and referrer policy.
- OAuth sign-in and permission-revocation tests in a dedicated non-production environment.
- Security review of script sources, logged errors, local drafts, and sensitive export handling.

### Exit criteria

- The production authorization boundary is explicit and independently verified.
- Deployed security headers and PWA cache behavior pass smoke checks.
- No test-only authentication path can be enabled in production.

## 7. Phase 4: Backup, Export, Deletion, and Retention (P1)

### Tasks

- Make backup contents explicit and versioned; decide whether note versions and attachment binaries/references are included.
- Add and test a restore workflow before presenting backup as a recovery guarantee.
- Define retention behavior across sessions, consents, note versions, attachments, audit entries, backups, and exports.
- Make deletion results per-resource and report failures instead of only logging them.
- Specify historical backup treatment during patient erasure and clearly disclose retained copies.
- Confirm data export contains all in-scope patient data, including consent and version/attachment metadata as required.

### Tests

- Backup and restore round-trip with all supported collections and attachment references.
- Patient deletion with partial Drive/API failure and existing historical versions/backups.
- Retention boundary dates, timezone edge cases, and associated consent/version/attachment rules.
- Data export completeness and export audit logging.

### Exit criteria

- Backup can be restored in a documented, tested procedure.
- Deletion/export outcomes match the user-facing claims and identify exclusions.
- Retention rules are configured, tested, and auditable.

## 8. Phase 5: UX, Accessibility, and Localization (P1)

### Tasks

- Apply [UI/UX Design](UI_UX_DESIGN.md) requirements to loading, empty, validation, error, sync, and destructive-operation states.
- Provide a reusable sync-state presentation and integration re-authorization action.
- Verify consent visibility and consistent session entry behavior after Phase 2.
- Audit keyboard navigation, modal focus handling, labels, contrast, and reduced-motion behavior.
- Test translated copy and longer strings at mobile breakpoints.
- Review dashboard and finance summary language to ensure it does not imply unsupported accounting capabilities.

### Validation

- Keyboard-only pass for primary workflows.
- Mobile viewport checks for dashboard, patient form/detail, calendar, session editor, finance, settings, and compliance.
- Accessibility checks for names, labels, focus order, status announcements, and contrast.
- Manual review of Portuguese and English layouts and date/number formatting.

### Exit criteria

- Primary flows have consistent loading, empty, error, and success states.
- No critical keyboard or responsive blockers remain.
- Sync and compliance language accurately reflects implementation.

## 9. Phase 6: Release Qualification and Beta Operations (P1)

### Tasks

- Keep the CI gate as typecheck → unit tests → E2E → production build → artifact upload; deploy only after a green main-branch push.
- Add integration-level coverage for real Firebase/Google configuration in a controlled staging environment.
- Verify backup restore and incident response runbooks.
- Define support channels, beta limitations, release notes, and data incident escalation.
- Establish a release checklist for OAuth review, privacy/terms, security settings, data migrations, and rollback/recovery.

### Exit criteria

- CI checks and staging smoke tests pass.
- Rollback/recovery and incident contacts are documented.
- Beta release communication describes storage, encryption, sync, backup, and deletion limitations accurately.

## 10. Phase 7: Future Product Expansion (P2, Separate Approval)

Possible work such as team accounts, patient self-service, telehealth, online payments, external EHR integrations, or general calendar import requires separate product discovery and security/data-model design. These capabilities are not assumed by the current PRD or implementation plan.

## 11. Cross-Phase Definition of Done

- Product behavior matches the PRD and this repository's current scope.
- TypeScript, unit tests, E2E tests, and production build pass.
- Security-sensitive changes include focused tests and a review of their data lifecycle impact.
- Public-facing copy does not overstate compliance, encryption coverage, data durability, or backup recoverability.
- Migrations preserve existing data and have a tested recovery/rollback approach.
- Documentation links, schema, app flows, and deployed behavior remain aligned.

## 12. Current CI Reference

The repository workflow is [.github/workflows/ci.yml](../.github/workflows/ci.yml). It runs on pushes and pull requests to `main`, executes typecheck, Vitest, Cypress, and build, then deploys successful pushes to GitHub Pages. The current automated Google integrations are intercepted/mocked in Cypress; production configuration requires separate verification.