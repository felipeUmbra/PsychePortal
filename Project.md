# Portal Psis - Project Documentation

Portal Psis is a secure, clinical-grade workspace designed for mental health professionals to manage their clinical practice efficiently. It provides tools for patient management, session scheduling, financial tracking, and secure clinical documentation.

## 🚀 Technology Stack

### Core
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Routing**: [React Router](https://reactrouter.com/) (HashRouter for GitHub Pages)

### Backend & Security
- **Authentication**: Firebase Auth (Google Provider) with OAuth scopes for Calendar and Drive
- **Database**: Firebase Firestore
- **Data Backup**: Google Drive API (`appDataFolder`) — a custom `firestore-mock.ts` layer syncs JSON to the user's personal Drive
- **File Storage**: Google Drive API (attachments up to 40MB stored in `appDataFolder`)
- **Error Handling**: Centralized clinical-grade error boundary and logging system

### UI & UX
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion](https://motion.dev/) (formerly Framer Motion)
- **Date Utilities**: `date-fns`
- **Charts**: [Recharts](https://recharts.org/)
- **Editor**: `@uiw/react-md-editor` for rich clinical notes with Markdown support

### Internationalization
- **Library**: `i18next` with `react-i18next`
- **Supported Languages**: Portuguese (PT) and English (EN)
- **Toggle**: Available on the landing page and app-wide via i18n language switching

### Mobile & Deployment
- **PWA**: `vite-plugin-pwa` (Full Progressive Web App support, installable on Android/iOS)
- **Deployment**: [GitHub Pages](https://pages.github.com/)

### Testing
- **E2E Framework**: Cypress 15
- **Mock Auth**: Custom `MockAuth` class swaps real Firebase Auth during Cypress runs, enabling full UI testing without live credentials

---

## 📂 Project Structure

```text
Portal Psis/
├── public/                 # Static assets (PWA icons, manifest, CNAME, headers)
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── patients/
│   │   │   ├── PatientForm.tsx
│   │   │   └── PatientInfoCard.tsx
│   │   ├── sessions/
│   │   │   └── SessionForm.tsx
│   │   ├── NewSessionModal.tsx   # Modal for scheduling sessions with recurrence
│   │   ├── RichTextEditor.tsx    # Markdown editor for clinical notes
│   │   ├── RichTextRenderer.tsx  # Markdown renderer for notes
│   │   ├── Layout.tsx            # Main application wrapper with header, mobile drawer, auth error banners
│   │   └── Sidebar.tsx           # Navigation sidebar
│   ├── context/
│   │   └── GoogleAuthContext.tsx # Global Drive + Calendar token state, 30-min inactivity auto-clear
│   ├── hooks/                # Custom React hooks
│   │   ├── usePatients.ts    # Patient CRUD + real-time Firestore listener
│   │   ├── useSessions.ts   # Session CRUD + Google Calendar sync + file upload/delete
│   │   ├── useAllSessions.ts # All sessions for calendar views
│   │   └── useDashboard.ts  # Aggregated stats + today's sessions + recent sessions
│   ├── lib/                  # Core utilities
│   │   ├── error-handler.ts  # Centralized Firestore error management
│   │   ├── utils.ts          # Tailwind merge and common helpers
│   │   └── firestore-mock.ts # Advanced localStorage + Google Drive persistence layer
│   ├── pages/                # Main application views
│   │   ├── Dashboard.tsx     # Practice overview with KPI cards, today's schedule, recent sessions, quick actions
│   │   ├── Patients.tsx      # Patient directory with search and filtering
│   │   ├── PatientDetail.tsx # Individual patient profile, session history, editable records, one-click scheduling
│   │   ├── Calendar.tsx      # Full scheduling view (Month / Week / Day) via react-big-calendar
│   │   ├── DailyCalendar.tsx # Hourly day view with weekly overview
│   │   ├── Sessions.tsx      # Clinical history, notes, attachments, and session actions
│   │   ├── Finance.tsx       # Revenue tracking, pending payments, patient financial summaries
│   │   ├── Settings.tsx      # Psychologist profile, Calendar/Drive re-authorization, CSV data export
│   │   ├── Login.tsx         # Google OAuth authentication screen with scoped permissions
│   │   ├── Landing.tsx       # Public marketing landing page with feature showcase
│   │   ├── Terms.tsx         # Terms of Service page
│   │   └── Privacy.tsx       # Privacy Policy page
│   ├── types.ts            # Global TypeScript definitions (Patient, Session, Psychologist)
│   ├── i18n.ts             # Internationalization configuration (PT/EN)
│   ├── firebase.ts         # Firebase initialization + MockAuth switch for Cypress
│   ├── main.tsx            # Entry point & PWA registration
│   └── index.css           # Global styles and Tailwind v4 theme
├── vite.config.ts          # Build and PWA configuration
├── tsconfig.json           # TypeScript configuration
├── cypress.config.ts       # Cypress E2E test configuration
├── firestore.rules         # Firebase security rules
└── storage.rules           # Firebase Storage security rules
```

---

## ✨ Key Features

### 1. Secure Authentication
- Integration with Google Identity for secure, single-sign-on access.
- OAuth scopes: `openid`, `email`, `profile`, `calendar.events`, `drive.appdata`, `drive.file`.
- Automatic session management and permission verification.
- **MockAuth** for Cypress E2E testing — swaps real Firebase Auth with a local event-based mock.

### 2. Patient Directory
- Comprehensive patient records including contact info, demographics, address, education, ethnicity, and additional clinical data.
- **Anamnesis**: Chief complaint, medical history, psychiatric history, family history, medications, substance use.
- Search and filtering capabilities for easy management.
- Quick navigation from any list directly to patient profiles.
- **Patient Detail View**: Complete profile with session history, editable records, and one-click session scheduling.
- Financial plan assignment per patient (Per Session, Monthly, Health Insurance, Exempt).

### 3. Professional Scheduling
- Visual calendar with Month, Week, and Day views powered by `react-big-calendar`.
- **Daily View**: Hourly breakdown for precise session management.
- **Weekly Overview**: Accurate session counts (total, completed, cancelled) for the displayed week.
- Recurrence support (Weekly, Fortnightly, Monthly) with automated session generation via `NewSessionModal`.
- Direct session cancellation with automatic Google Calendar event deletion.
- Session type support: individual, group, family, couple.

### 4. Clinical Sessions & Notes
- Dedicated history for all therapy sessions with search and filtering.
- Markdown-supported clinical notes with rich text rendering (`react-markdown` + `rehype-sanitize`).
- Status tracking: Scheduled, Completed, No-show, Cancelled.
- **Session Actions**: Edit session details and delete sessions with confirmation safeguards.
- **Attachment support**: Upload and view session-related files (up to 40MB) stored in Google Drive.
- **Google Calendar sync**: New sessions create Calendar events; date changes patch events; cancellations delete events.

### 5. Financial Management
- Real-time revenue tracking based on session status and patient financial plans.
- Support for multiple financial plans: Per Session, Monthly, Health Insurance, Exempt.
- One-click "Mark as Paid" / "Mark as Pending" toggle on any session.
- Visual summaries of expected vs. received payments with period filtering (Day, Week, Month, Year, All).
- Patient-level financial summary sidebar in the Finance page.

### 6. Data & Integrations
- **CSV Export**: Export patients and sessions with configurable date ranges and three export modes (all patients, patient info, patient info + sessions) using PapaParse.
- **Google Calendar synchronization**: Full two-way sync for session scheduling events.
- **Google Drive backup**: All clinical data (`workspace.json`) and file attachments backed up to the user's private `appDataFolder`.
- **Landing Page**: Public marketing page showcasing features and Google integrations.
- **Privacy & Terms**: Dedicated public pages for compliance.

### 7. PWA (Progressive Web App)
- Fully installable on mobile devices via `vite-plugin-pwa`.
- Native-like experience with standalone display mode, service workers, and offline support scaffolding.

---

## 🔧 Advanced Architecture

### `firestore-mock.ts` — Custom Persistence Layer
This module is a key architectural decision. It provides:
- **A drop-in Firestore API mock** (`collection`, `doc`, `query`, `where`, `orderBy`, `limit`, `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`, `getDocs`, `getDoc`) that real hooks consume transparently.
- **localStorage fallback**: Data is always persisted locally (`mock_db_cache`) even when offline.
- **Google Drive sync**: When the user authenticates with Drive scope, all CRUD operations automatically sync to `workspace.json` in the Google Drive `appDataFolder`.
- **Pending operation queue**: If Drive is still loading when a write occurs, the operation is queued and applied once data is ready — preventing data loss.
- **Auto-save debounce**: A 500ms debounce batches rapid mutations before syncing to Drive.
- **Emergency unload backup**: `beforeunload` ensures `localStorage` is flushed.

### Auth & Token Management (`GoogleAuthContext`)
- Tokens for Google Calendar and Google Drive are managed in React Context.
- A **30-minute inactivity timer** automatically clears tokens for security.
- Tokens are wiped on logout or auth state change.
- Custom events (`google-auth-error`, `google-auth-success`) allow the Layout to surface re-authorization banners to the user.

### Code Splitting
- All application pages under `/app` are lazy-loaded in `App.tsx` using `React.lazy()` and `Suspense` for optimal bundle size.

---

## 🛠 Development & Deployment

- **Dev Mode**: `npm run dev` (Vite development server)
- **Build**: `npm run build` (production build with PWA assets)
- **Lint**: `npm run lint` (TypeScript type checking without emit)
- **Deploy to GitHub Pages**: `npm run deploy` (automatically builds and publishes PWA assets)

---

## 📊 Data Model

### Patient
- `id`, `name`, `email`, `phone`, `dateOfBirth`, `gender`
- `address` — structured address object (country, zipCode, city, state, street, number, neighborhood, complement)
- `education`, `ethnicity`
- `financialPlan`, `financialValue`
- `anamnesis` — clinical intake data
- `notes`, `createdAt`, `updatedAt`

### Session
- `id`, `patientId`, `psychologistId`
- `date`, `duration` (minutes), `type` (individual | group | family | couple)
- `status` (scheduled | completed | cancelled | no-show)
- `notes` (markdown string)
- `attachments[]` (name, url, size)
- `googleEventId` (Calendar sync identifier)
- `paymentStatus`

### Psychologist
- `id`, `name`, `email`
- `specialization[]`, `bio`, `avatarUrl`

---

## 🧪 Testing

- **Cypress** is configured and ready for end-to-end testing.
- The `MockAuth` implementation in `firebase.ts` detects `window.Cypress` and swaps the real Firebase Auth with a controllable mock, allowing test suites to simulate login/logout without real Google credentials.
- Token setters are exposed to the Cypress window for automated integration testing.
