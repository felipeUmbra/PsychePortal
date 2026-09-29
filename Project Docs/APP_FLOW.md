# Portal Psis App Flow

**Status:** Current beta application flow
**Last updated:** 2026-09-25

This document maps the current browser routes and user journeys implemented in Portal Psis. It describes observed behavior, including known differences between entry points; it is not a target-state specification.

## 1. Application Entry and Navigation

```mermaid
flowchart TD
    A[Open Portal Psis] --> B{Requested route}
    B -->|/| C[Public landing]
    B -->|/login| D[Google sign-in]
    B -->|/terms| E[Terms]
    B -->|/privacy| F[Privacy]
    B -->|/app or /app/*| G{Firebase auth loading?}
    B -->|Unknown route| C
    G -->|Yes| H[Workspace loading state]
    H --> G
    G -->|No user| D
    G -->|Authenticated| I[Workspace shell]
    I --> J[Dashboard]
    I --> K[Patients]
    I --> L[Calendar]
    I --> M[Sessions]
    I --> N[Finance]
    I --> O[Settings]
    I --> P[Compliance]
    K --> Q[Patient detail]
    L --> R[Daily calendar]
```

All routes use `HashRouter`. The private route tree is nested under `/app` and rendered through `Layout`. `Layout` checks Firebase auth state: while it is loading, it shows a loader; without a user, it redirects to `/login`; with a user, it renders the sidebar, workspace header, alerts, and the selected child route.

The cookie-consent banner and session-timeout toast are mounted at the application level. The sidebar provides navigation, language switching between Portuguese and English, and logout. The patient and calendar navigation items have sub-actions for adding/showing patients and switching calendar views.

## 2. Sign-In and Workspace Initialization

```mermaid
flowchart TD
    A[Landing or private route] --> B[Open /login]
    B --> C[Start Google sign-in popup]
    C --> D{Sign-in result}
    D -->|Popup closed or cancelled| E[Stay on login without error]
    D -->|Network, rate limit, disabled, or other error| F[Show login error]
    D -->|Success| G[Obtain Firebase user and Google access token]
    G --> H[Set Drive and Calendar token state]
    H --> I[Attempt Drive workspace sync]
    I --> J{Psychologist profile exists?}
    J -->|No| K[Create practitioner profile]
    J -->|Yes| L[Keep existing profile]
    K --> M[Navigate to /app]
    L --> M
    M --> N[Layout verifies Firebase user]
    N --> O[Show dashboard]
```

The Google OAuth request asks for identity, Calendar event, Drive app-data, and Drive file scopes. Firebase identity and Google API authorization are separate: the workspace can be authenticated while Drive or Calendar access is unavailable. Google tokens are held in memory and must be obtained again after reload if absent.

When a Google API call returns 401 or 403, the workspace shell clears Google tokens and signs out the Firebase user in the current `Layout` handler. Other surfaced Google auth errors can appear as an authorization alert with a Settings route. Actual behavior depends on which integration emitted the event.

## 3. Main Workspace Navigation

| Destination | Main entry point | Common next actions |
| --- | --- | --- |
| Dashboard (`/app`) | Workspace default | Review today's sessions, recent activity, and practice summary; navigate to patient or calendar tasks |
| Patients (`/app/patients`) | Sidebar or patient shortcut | Search/filter, add patient, open patient detail |
| Patient detail (`/app/patients/:id`) | Patient list | Edit patient, review consent, create or update sessions, inspect note history, request deletion |
| Calendar (`/app/calendar`) | Sidebar | Browse month/week/day schedule, create a session, open daily schedule |
| Daily calendar (`/app/calendar/daily`) | Calendar sub-navigation | Inspect daily schedule and weekly session overview |
| Sessions (`/app/sessions`) | Sidebar | Search session history, edit details/notes, manage attachments, change status |
| Finance (`/app/finance`) | Sidebar | Review period summaries and patient payment state; mark payments paid/pending |
| Settings (`/app/settings`) | Sidebar or auth recovery link | Edit practitioner profile, configure consent/retention, re-authorize services, export CSV, configure encryption |
| Compliance (`/app/compliance`) | Sidebar or retention reminder | Review status/self-attestation, run retention, create backup, export data/audit records, delete patient data |

On mobile, the sidebar is a drawer that closes after navigation. Language switching is available from the sidebar. Logout clears Google tokens, signs out, and routes to `/login`.

## 4. Patient and Session Workflow

```mermaid
flowchart TD
    A[Open Patients] --> B[Search/filter or add patient]
    B --> C[Open patient detail]
    C --> D{Choose patient task}
    D -->|Edit demographics or anamnesis| E[Update patient record]
    D -->|Consent tab| F{Consent configured?}
    F -->|No| G[Go to Settings and configure consent text]
    G --> F
    F -->|Yes| H[Record acceptance or revoke active consent]
    D -->|Schedule from patient detail| I[Create session via useSessions]
    I --> J{Active consent?}
    J -->|No| K[Block save and show consent-required message]
    J -->|Yes| L[Save session; encrypt note if encryption is unlocked]
    D -->|Review session| M[Expand session or edit]
    M --> N[View note, attachment, or note-version history]
    N --> O[Edit, complete, cancel, delete, or update payment state]
```

### Session creation entry points

- **From patient detail:** `useSessions.addSession` checks for active patient consent. If consent is missing or revoked, save is rejected with a consent-required message. When an encryption key is unlocked, session notes are encrypted before they are stored.
- **From calendar's new-session modal:** the modal writes session records through the Firestore-shaped adapter directly. It can create recurring session records and optionally creates a Google Calendar event for the first instance of each selected slot. This route currently does not call the patient-detail consent gate or the encryption hook. This is a known behavior inconsistency and should be resolved before treating consent and encryption behavior as uniform across all session entry points.

The exact Calendar event behavior varies by operation. The modal attempts event creation and stores the returned event ID on the session. Session edit/cancel flows attempt to update or delete linked events when tokens are available; these are separate remote operations from workspace persistence.

## 5. Session Documentation Workflow

```mermaid
flowchart TD
    A[Open Sessions or patient detail] --> B[Find and open a session]
    B --> C{Session completed?}
    C -->|Yes, edit requested| D[Show completed-session warning/justification flow]
    C -->|No| E[Open session editor]
    D --> E
    E --> F[Edit note, type, status, attachments]
    F --> G{Attachment operation?}
    G -->|Upload| H[Check 40 MiB client limit]
    H --> I[Upload file to Google Drive]
    I --> J[Add attachment metadata]
    G -->|No| K[Save session changes]
    J --> K
    K --> L[Save previous note version when available]
    L --> M[Persist session through adapter]
    M --> N{Status changed to cancelled?}
    N -->|Yes and linked event/token exists| O[Attempt Calendar event deletion]
    N -->|No or unavailable| P[Finish edit flow]
    O --> P
```

Notes use Markdown editing and sanitized Markdown rendering. Previous note content can be stored in note-version records when an existing note is overwritten. Draft edit forms in the Sessions page use localStorage keys named `draft_edit_<sessionId>`; these drafts are separate from the workspace persistence mechanism.

## 6. Privacy and Compliance Workflows

```mermaid
flowchart TD
    A[Open Compliance] --> B[Review configured control indicators]
    B --> C[Save practitioner self-attestation]
    B --> D[Run retention policy]
    B --> E[Trigger full backup]
    B --> F[Export audit CSV or compliance report]
    B --> G[Select patient for data request]
    G --> H[Generate and download patient data bundle]
    G --> I[Start patient deletion]
    I --> J[Confirm affected patient in deletion flow]
    J --> K[Delete patient/session/consent/version records and attempt attachment cleanup]
    K --> L[Show per-operation deletion result]
```

The compliance status panel reflects a combination of local configuration checks and user self-attestation; a passing panel is not an external compliance certification. Backup snapshots and deletion are separate workflows: patient deletion attempts to remove current records and associated attachments, but historical backup snapshots are not removed by the deletion function.

## 7. Session Timeout, Re-Authorization, and Logout

```mermaid
flowchart TD
    A[Authenticated workspace] --> B[User activity resets timers]
    B --> C{Configured encryption auto-lock timeout reached?}
    C -->|Yes| D[Dispatch session-timeout and lock note encryption]
    C -->|No| E[Continue workspace]
    A --> F{Google token inactivity timer reaches 30 minutes?}
    F -->|Yes| G[Clear Drive and Calendar tokens]
    F -->|No| E
    G --> H[Google-backed operation requires re-authorization]
    H --> I[Open Settings/login authorization flow]
    A --> J[User selects logout]
    J --> K[Clear Google tokens]
    K --> L[Sign out Firebase user]
    L --> M[Navigate to /login]
```

The Google token timer clears Google API tokens after 30 minutes without observed pointer, keyboard, click, or scroll activity in `GoogleAuthContext`. A separate workspace inactivity timer can lock note encryption when an auto-lock duration is configured on the practitioner profile. Firebase sign-in and encryption-key state have separate lifecycle behavior; they should not be represented as one shared timeout.

## 8. Route and Error Behavior

- Unknown paths redirect to the public landing page.
- Private workspace routes wait for Firebase auth state, redirect unauthenticated users to login, and otherwise render the requested page within the workspace shell.
- Lazy-loaded workspace pages use a route-level loading fallback.
- An application error boundary wraps route rendering.
- Google API authorization failures may clear tokens/sign out or show an alert, depending on event handling and status.
- Drive persistence errors are not uniformly represented as a user-visible sync state in the current adapter; an operation may complete in memory while remote synchronization fails.
- Session creation/editing from different routes currently follows different consent and encryption paths, as described in Section 4.

## 9. Known Flow Gaps

1. **Session consent enforcement:** patient-detail session creation checks active consent, while the calendar modal writes directly. Consolidate session creation behind one domain-level workflow and test each entry point.
2. **Encryption consistency:** patient-detail creation encrypts notes only when the key is unlocked; the calendar modal bypasses this path. Ensure all session write paths share the same encryption policy.
3. **Data reload continuity:** the current Drive workspace loader restores fewer collections than the app uses. Consent and note-version flows may not survive reload consistently until the persisted collection contract is fixed.
4. **Sync outcome visibility:** the adapter can catch Drive failures without a durable per-write sync status. The UI should distinguish saved-in-memory, pending, and remotely confirmed states.
5. **Deletion scope:** the current patient deletion flow does not remove backup snapshots, and some sub-operation errors are logged rather than returned as complete per-resource results.
6. **Authorization recovery:** a 401/403 handler currently signs out the Firebase user as well as clearing Google tokens; this is broader than simply re-authorizing the affected Google service.

## 10. Source Map

- Route tree and global providers: [src/App.tsx](src/App.tsx)
- Auth gate, alerts, and timeout setup: [src/components/Layout.tsx](src/components/Layout.tsx)
- Sidebar destinations and actions: [src/components/Sidebar.tsx](src/components/Sidebar.tsx)
- Google sign-in and requested scopes: [src/pages/Login.tsx](src/pages/Login.tsx)
- Patient detail workflow: [src/pages/PatientDetail.tsx](src/pages/PatientDetail.tsx)
- Session creation and Calendar event flow: [src/components/NewSessionModal.tsx](src/components/NewSessionModal.tsx)
- Session history and editing: [src/pages/Sessions.tsx](src/pages/Sessions.tsx)
- Consent state and actions: [src/hooks/usePatientConsent.ts](src/hooks/usePatientConsent.ts)
- Session consent/encryption path: [src/hooks/useSessions.ts](src/hooks/useSessions.ts)
- Compliance data tasks: [src/pages/Compliance.tsx](src/pages/Compliance.tsx)
- Google token lifecycle: [src/context/GoogleAuthContext.tsx](src/context/GoogleAuthContext.tsx)
- Persistence and Drive adapter: [src/lib/firestore-mock.ts](src/lib/firestore-mock.ts)