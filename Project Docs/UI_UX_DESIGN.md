# Portal Psis UI/UX Design

**Status:** Current UI baseline and design requirements
**Last updated:** 2026-09-25

Related documents: [PRD](PRD.md), [TRD](TRD.md), [App Flow](APP_FLOW.md).

## 1. Design Purpose

Portal Psis is a repeated-use clinical practice tool for independent psychologists. The interface should favor calm scanning, accurate data entry, and predictable navigation over decorative or promotional presentation. Patient and session context must remain clear while the practitioner moves between records, schedules, notes, and administrative tasks.

This document separates the visual system currently present in the repository from interaction and accessibility requirements that should guide ongoing work. It does not claim every requirement is already implemented.

## 2. Audience and UX Priorities

### Primary audience

Independent psychologists managing their own patient roster and clinical practice.

### Design priorities

1. Protect patient identity and current-record context during navigation and destructive actions.
2. Make upcoming sessions, session status, and payment status easy to scan.
3. Keep patient and session workflows short, with patient context available at the point of action.
4. Give clear feedback for save, upload, sync, authorization, export, backup, and deletion outcomes.
5. Remain usable at desktop and mobile widths, with Portuguese and English content.

## 3. Existing Visual System

The current foundation is defined in `src/index.css` and Tailwind theme tokens.

| Token | Current value | Current use |
| --- | --- | --- |
| Font | Space Grotesk with system fallbacks | Main UI typography |
| `bg` | `#F4F6F9` | Application background |
| `surface` | `#FFFFFF` | Work surfaces and forms |
| `primary-custom` | `#4338CA` | Primary actions and links |
| `text-main` | `#0F172A` | Primary content |
| `text-muted` | `#475569` | Supporting content |
| `border-custom` | `#CBD5E1` | Dividers and control boundaries |
| `accent-custom` | `#EEF2FF` | Selected navigation/accent surface |
| `success-custom` | `#0891B2` | Success state |

Existing shared styles include `.card`, `.btn-primary`, `.btn-secondary`, `.input-field`, `.status-badge`, calendar overrides, and Markdown prose rules. Keep new UI aligned with these tokens unless a reviewed system update is made. Avoid introducing isolated one-off colors for status or focus states.

## 4. Information Architecture

### Public pages

- Landing page
- Google sign-in
- Terms
- Privacy

### Authenticated workspace

- Dashboard
- Patient directory and patient detail
- Calendar and daily calendar
- Session history
- Finance
- Settings
- Compliance
- Audit log (route exists; linked from compliance/administrative context as appropriate)

The workspace uses a shared shell with sidebar navigation, header/account access, status alerts, and page content. On narrow screens, the sidebar becomes a dismissible drawer. Preserve the current route semantics from the [app flow](APP_FLOW.md).

## 5. Layout and Page Patterns

### Workspace shell

- Keep persistent navigation visually distinct from the page work area.
- Make the active route apparent, including patient-detail and daily-calendar subroutes.
- On mobile, close the navigation drawer after route selection and preserve a visible menu button.
- Keep global authorization, retention, and error notices above page content; notices must not obscure essential controls.
- Account menu actions should be reachable without hover and work by keyboard/touch.

### Dashboard

- Prioritize today's schedule, recent sessions, patient/practice counts, and quick actions.
- Keep summary metrics compact and traceable to a relevant destination.
- Avoid chart decoration that does not support an operational decision.

### Patient directory and patient detail

- Provide a visible search/filter row and clear add-patient action.
- Keep identifying patient name and essential context visible on the detail page.
- Group demographics, anamnesis, consent, and session history into scannable sections or tabs.
- Present consent status and the next consent action near session creation.
- Destructive patient erasure must name the patient and summarize affected data before confirmation.

### Calendar and sessions

- Keep month/week/day switching and date navigation stable in layout.
- Use consistent status labels and colors across calendar, patient detail, and session history.
- Do not rely on color alone to distinguish scheduled, completed, cancelled, and no-show states.
- Show recurrence settings only when recurrence is enabled; communicate the number of generated sessions before save.
- Note editing should make encryption/lock state visible without implying that all patient information is encrypted.
- Attachment controls should show upload progress, size limit, completion, and failure.

### Finance

- Make the selected reporting period explicit and keep period totals tied to session/payment rules.
- Distinguish expected, received, and pending amounts with text labels as well as color.
- Avoid accounting terminology or invoice affordances that imply capabilities outside the product scope.

### Settings and compliance

- Group profile, consent template, retention, encryption, and Google authorization settings by task.
- Explain consequences before encryption setup, disablement, or recovery-code handling.
- Present compliance status as a configuration checklist and practitioner aid, not a legal certification.
- Backup, export, retention, and deletion actions require visible progress and clear result states.

## 6. Interaction and Component Requirements

### Forms

- Use explicit labels, required-field indicators, helpful inline validation, and field-level error messages.
- Preserve entered data when a recoverable network or authorization error occurs.
- Prevent duplicate submission while an operation is pending.
- When validation fails, move focus to the first invalid field or an error summary.

### Saving and synchronization

The current persistence adapter can accept a change in memory while a Drive upload later fails. UI states should distinguish:

- Editing/unsaved
- Saved locally in current runtime memory
- Waiting for remote Drive synchronization
- Confirmed synchronized
- Synchronization failed, with retry/re-authorization action

Do not use a generic “Saved” message to mean a remote write succeeded unless the adapter confirms it.

### Dialogs and destructive actions

- Trap focus inside modal dialogs, support Escape where safe, and return focus to the invoking control after close.
- Require explicit confirmation for patient deletion and session deletion.
- For patient erasure, require confirmation that makes the selected patient identity unambiguous.
- Communicate partial deletion results per resource type; never convert partial completion into a success-only toast.

### Status and alerts

- Use consistent labels for session, payment, integration, encryption, and sync states.
- Alerts must be dismissible where appropriate and not disappear before their information can be read.
- Provide an actionable next step for expired/missing Google permissions.
- Use polite live-region announcements for asynchronous outcomes and errors.

## 7. Responsive and Accessibility Requirements

- Support narrow mobile widths, tablet widths, and desktop layouts without horizontal scrolling for primary pages.
- Reflow forms into a single column when needed; keep labels and validation messages attached to their controls.
- Calendar views may require horizontal/vertical scrolling, but date controls and event details must remain operable.
- All functionality must be keyboard accessible with visible focus indicators.
- Use semantic headings, landmarks, buttons, links, and form labels.
- Provide accessible names for icon-only buttons; hide decorative icons from assistive technology.
- Maintain readable contrast for body text, muted text, borders, focus rings, and status colors.
- Do not encode meaning by color alone; pair status color with text or an accessible icon/label.
- Respect reduced-motion preferences for transitions and modal animations.
- Check long names, translated text, and error strings at mobile sizes to avoid clipping or overlap.

## 8. Localization

- Portuguese (Brazil) and English are supported product languages.
- Translate labels, validation messages, status text, dialogs, empty states, and integration errors consistently.
- Format dates, times, and numbers according to the selected locale.
- Allow translated labels to wrap; do not rely on fixed widths sized only for English.
- Keep user-entered clinical text unchanged when switching UI language.

## 9. UX Acceptance Checklist

- A practitioner can reach patients, calendar, sessions, finance, settings, and compliance from the workspace navigation.
- Every route communicates loading, empty, error, and success states where applicable.
- Keyboard and touch users can open/close navigation, operate forms, and complete dialogs.
- Consent status is visible before session creation from every session-entry route.
- Session encryption behavior is consistent across all session-entry and edit routes, and the UI accurately identifies its scope.
- A user can tell whether a change was only made in memory or confirmed by Drive.
- Mobile layouts keep primary actions visible and do not clip important patient/session context.
- Destructive actions identify the affected record and report partial outcomes.

## 10. Source References

- Global visual tokens and shared components: [src/index.css](../src/index.css)
- Workspace route tree: [src/App.tsx](../src/App.tsx)
- Authenticated shell and global notices: [src/components/Layout.tsx](../src/components/Layout.tsx)
- Sidebar navigation: [src/components/Sidebar.tsx](../src/components/Sidebar.tsx)
- Patient and session workflows: [APP_FLOW.md](APP_FLOW.md)