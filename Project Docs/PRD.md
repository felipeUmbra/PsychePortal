# Portal Psis Product Requirements Document

**Status:** Current-product PRD (beta)  
**Last updated:** 2026-09-25  
**Product:** Portal Psis

## 1. Product Summary

Portal Psis is a web-based practice workspace for independent psychologists. It brings patient records, appointment and session management, clinical documentation, basic practice finances, and privacy/compliance administration into one installable application. It supports Portuguese (Brazil) and English and integrates with Google services for sign-in, Calendar events, and Drive-based storage and backup workflows.

The product is in beta. It helps practitioners organize sensitive practice information and perform privacy-related workflows; it does not certify a practice as legally compliant, replace professional judgment, or replace the practitioner's responsibility for consent, retention, and data handling.

## 2. Problem and Opportunity

Independent psychologists often coordinate patient details, clinical history, appointments, session notes, payment status, and privacy records across separate tools. This creates repetitive administration, fragmented context, and avoidable risk when records are difficult to find, back up, export, or delete.

Portal Psis aims to provide one focused workspace for the practitioner to manage these recurring tasks while keeping the patient relationship and clinical record organized around the patient and their sessions.

## 3. Product Goals

- Make routine patient, appointment, session, and payment administration manageable from one workspace.
- Keep a usable clinical history connected to each patient, including session notes and related files.
- Reduce scheduling duplication through Google Calendar event creation and updates tied to session actions.
- Give practitioners practical tools for consent records, note protection, audit review, backup, retention, export, and deletion.
- Support daily use on desktop and mobile, including installation as a PWA.
- Serve Portuguese-speaking practitioners while remaining usable in English.

## 4. Non-Goals

The current product scope does not include:

- A patient-facing portal, patient login, or self-service appointment booking.
- Telehealth, messaging, clinical decision support, diagnosis, or treatment recommendations.
- Payment processing, invoicing, accounting, insurance claims, or tax reporting.
- Multi-clinician teams, organization administration, role-based staff access, or practice-wide tenancy.
- A native iOS or Android application.
- A guarantee of LGPD, CFP, or other legal/regulatory compliance. Compliance tools are practitioner-facing aids, not legal advice or certification.
- General-purpose synchronization of arbitrary Google Calendar events into the application.

## 5. Target Users

### Primary user: Independent psychologist

A psychologist managing their own patient roster and practice. They need to review patient context, schedule and document sessions, track payments, and respond to privacy obligations without switching among multiple administrative tools.

### Secondary user: Practitioner handling a patient data request

The same practitioner completing a patient-related task such as recording consent, preparing an export, reviewing access history, applying a retention policy, or deleting a patient's records.

The current product assumes one practitioner-owned workspace. Shared access by assistants or other clinicians is not part of this PRD's baseline.

## 6. Product Scope

### 6.1 Account and workspace

- Sign in using Google authentication.
- Maintain the practitioner's profile and practice details.
- Request and manage Google permissions needed for supported Drive and Calendar workflows.
- Clear sensitive authorization state after inactivity and provide a path to re-authorize when a Google permission expires or is revoked.

### 6.2 Patient management

- Create, find, view, update, and remove patient records.
- Store contact and demographic details, financial plan information, practitioner notes, and structured anamnesis.
- Search and filter the patient directory and open a patient's full record and session history.
- Start scheduling a session from the patient context.

### 6.3 Consent and clinical documentation

- Configure the practice's consent text and associate consent records with patients.
- Record consent details, including signatory information and guardian information where applicable; preserve acceptance and revocation history.
- Require active consent before creating or updating a session through the supported session workflow.
- Create and edit session notes with Markdown authoring and readable rendering.
- Keep note versions when notes are changed.
- Support optional passphrase-based encryption for clinical notes and supported anamnesis fields, with a recovery phrase workflow.
- Attach files to sessions, with the current documented upload limit of 40 MB per file.

### 6.4 Scheduling and sessions

- Create and manage individual, group, family, and couple sessions.
- Track scheduled, completed, no-show, and cancelled statuses.
- View sessions in month, week, day, and daily/weekly schedule views.
- Support weekly, fortnightly, and monthly recurrence when creating sessions.
- Create or update Google Calendar events in response to supported session actions; remove linked events when cancelling a session where authorization is available.
- Search and filter clinical session history.

### 6.5 Practice finances

- Associate a patient with a financial plan: per session, monthly, health insurance, or exempt.
- Track session payment status as paid or pending.
- Summarize expected and received amounts and show patient-level financial context.
- Filter financial summaries by day, week, month, year, or all-time period.

This is practice tracking only; it is not a ledger, payment processor, or accounting system.

### 6.6 Privacy and administration

- Provide a dashboard of configured privacy/security controls and practitioner self-attestations.
- Provide an audit log with filters and hash-chain integrity verification.
- Support export of patient/session data and audit records, with export activity logged where implemented.
- Generate a patient data bundle for a data-subject request workflow.
- Allow a practitioner to delete a patient's records through a deliberate confirmation flow.
- Configure and manually run a data-retention policy.
- Create and review full backup snapshots in Google Drive, including optional secondary Drive backup where configured.
- Provide profile settings, Google re-authorization, and CSV export options.

The app must label control status as an operational aid and must not present a passing status panel as proof of legal compliance.

### 6.7 Public and platform experience

- Provide public landing, terms, and privacy pages.
- Provide Portuguese (Brazil) and English UI localization.
- Support responsive use and installation as a Progressive Web App.
- Provide a useful loading and error state for major routes and operations.

## 7. Core User Workflows

1. **Set up the workspace:** Sign in with Google, complete the practitioner profile, configure consent and retention information, optionally set up note encryption, and authorize Drive or Calendar as needed.
2. **Manage a patient:** Find or create a patient, maintain demographics and anamnesis, review consent status and session history, and schedule the next session.
3. **Run and document a session:** Review the schedule, open the patient context, complete or update the session, write a note, add an attachment if needed, and update payment status. A linked Calendar event reflects supported schedule changes.
4. **Handle a privacy task:** Select the patient, generate a data bundle or initiate deletion with explicit confirmation, and retain the relevant audit/export record where supported.
5. **Review practice operations:** Use the dashboard for upcoming and recent activity, the finance view for payment summaries, and the compliance/audit views for configured controls and recorded changes.

## 8. Requirements and Acceptance Criteria

### P0: Core beta requirements

- **Authentication and ownership:** An unauthenticated visitor cannot access private workspace routes. A signed-in practitioner sees only their own practice data through the supported access path.
- **Patient records:** The practitioner can create, search, open, edit, and remove a patient record; patient detail presents related sessions and patient-specific actions.
- **Consent gate:** The session workflow refuses session creation or editing when the patient has no active consent and communicates a recoverable next step.
- **Session lifecycle:** The practitioner can create and update a session, change its status, and find it from patient history and calendar views.
- **Clinical notes:** The practitioner can create and edit notes and render supported Markdown safely. When encryption is enabled and unlocked, supported notes/fields are encrypted before persistence and can be decrypted by the authorized practitioner.
- **Scheduling integration:** Creating or changing a linked session date updates the corresponding Google Calendar event when a valid token is available; authorization errors are surfaced with a re-authorization path.
- **Finance tracking:** The practitioner can mark sessions paid or pending and see totals consistent with the selected period and financial plan rules.
- **Privacy actions:** The practitioner can review the audit log, export supported data, and initiate patient deletion only after the required confirmation steps.
- **Backup and retention:** The practitioner can initiate a backup and a retention run, receive a success/failure result, and see the relevant configured policy or backup state.
- **Localization and responsive use:** Primary workflows are usable in Portuguese and English and remain operable at mobile viewport sizes.

### P1: Operational quality requirements

- Long-running operations expose loading, completion, and actionable error states without silently implying success.
- Destructive actions identify the affected patient and require an explicit confirmation step.
- Loss of Google authorization does not silently discard local edits; the interface makes sync/authorization state understandable.
- The UI distinguishes a locally saved or cached change from a completed remote backup when those states differ.
- Audit integrity verification reports a broken or unverifiable chain distinctly from a verified chain.
- Public privacy and terms pages are reachable without signing in.

## 9. Quality Attributes and Constraints

### Security and privacy

- Use Google authentication and enforce practitioner ownership for private records.
- Do not persist OAuth access tokens in browser storage; keep token lifetime and inactivity behavior constrained.
- Use authenticated encryption for supported encrypted fields and keep the recovery phrase separate from the account password.
- Explain the consequence of losing the passphrase and recovery phrase before encryption setup is completed.
- Protect clinical content from unsafe Markdown rendering and avoid exposing sensitive patient data in public routes, logs, or error messages.
- Treat exports, attachments, backups, local cache, and deletion behavior as sensitive-data flows and document their actual retention semantics.
- Do not claim encryption coverage for all patient data: the implementation's encryption support is limited to selected clinical notes and anamnesis fields.

### Reliability and data handling

- Preserve workspace data across refreshes using the configured persistence and synchronization behavior.
- Report sync, backup, and integration failures rather than presenting an unverified success state.
- Make conflict handling and authoritative-copy behavior explicit before promising multi-device consistency.
- Keep backup and retention actions understandable and auditable.

### Usability and compatibility

- Support current desktop and mobile browsers used by the PWA.
- Keep patient, session, finance, and privacy workflows navigable by keyboard and clearly labeled controls.
- Keep Portuguese and English available across private and public product surfaces.
- Support practical session attachment uploads up to the currently implemented 40 MB limit.

## 10. Success Measures

The repository does not establish production analytics baselines. Initially, evaluate success through product testing and operational review rather than assuming telemetry exists:

- A practitioner can complete the five core workflows in Section 7 without data-loss or blocking errors.
- Automated tests cover authentication, patient/session management, scheduling, finance, consent, privacy actions, and persistence integrations.
- Session-to-calendar changes produce the expected event update when Google authorization is valid.
- Backup, export, deletion, and audit integrity workflows produce clear and verifiable outcomes.
- No critical or high-severity data-isolation, data-loss, or sensitive-data exposure issue remains open at release.

Any future product analytics must be privacy-reviewed and must not collect clinical note contents or unnecessary patient identifiers.

## 11. Dependencies and Risks

- Google OAuth scopes, consent-screen verification, Drive availability, and Calendar API availability affect key workflows.
- The practitioner is responsible for obtaining valid patient/guardian consent and choosing appropriate retention and deletion practices.
- Loss of the encryption passphrase and recovery phrase may make encrypted clinical information unrecoverable.
- Backup availability does not by itself establish restore correctness; restore procedures need separate verification.
- Local cache, Drive synchronization, Firebase/Firestore configuration, and backup snapshots can have different persistence and retention behavior. The user-facing product claims must match the deployed configuration.
- The project is in beta; sensitive-data use requires careful operational review, security testing, and clear user-facing limitations.

## 12. Explicitly Out of Scope for This PRD

The following may be considered separately but are not implied by the current product: team accounts and role management, patient-facing accounts, telehealth, messaging, online payments, automated insurance billing, external EHR integrations, general two-way Google Calendar import, automated legal advice, and guaranteed legal compliance.

## 13. Open Product Decisions

- Confirm and document the authoritative source of truth for patient/session data in each deployment, including the roles of Firebase/Firestore, local cache, and Google Drive synchronization.
- Define user-visible sync state, offline guarantees, and conflict resolution across multiple devices.
- Define and test whether patient deletion also removes or expires copies in backups, exports, Drive attachments, and local caches; communicate any limits before deletion.
- Define a tested backup restoration workflow and recovery expectations.
- Confirm which exact patient fields are encrypted in the production build and ensure UI/status language matches that coverage.
- Establish release gates and support expectations for moving from beta to production use with sensitive clinical records.