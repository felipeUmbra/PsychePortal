# PsychePortal - Project Documentation

PsychePortal is a secure, clinical-grade workspace designed for mental health professionals to manage their clinical practice efficiently. It provides tools for patient management, session scheduling, financial tracking, and secure clinical documentation.

## 🚀 Technology Stack

### Core
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Routing**: [React Router](https://reactrouter.com/) (HashRouter for GitHub Pages)

### Backend & Security
- **Authentication**: Firebase Auth (Google Provider)
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage (for file uploads)
- **Error Handling**: Centralized clinical-grade error boundary and logging system

### UI & UX
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion](https://motion.dev/) (formerly Framer Motion)
- **Date Utilities**: `date-fns`
- **Charts**: [Recharts](https://recharts.org/)
- **Editor**: Rich text editor for clinical notes

### Internationalization
- **Library**: `i18next` with `react-i18next`
- **Supported Languages**: Portuguese (PT) and English (EN)

### Mobile & Deployment
- **PWA**: `vite-plugin-pwa` (Full Progressive Web App support, installable on Android/iOS)
- **Deployment**: [GitHub Pages](https://pages.github.com/)

---

## 📂 Project Structure

```text
PsychePortal/
├── public/                 # Static assets (PWA icons, manifest)
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── patients/         # Patient-specific components (InfoCard, Form)
│   │   ├── sessions/         # Session form component
│   │   ├── NewSessionModal.tsx  # Modal for scheduling sessions
│   │   ├── RichTextEditor.tsx   # Markdown editor for notes
│   │   ├── RichTextRenderer.tsx # Markdown renderer for notes
│   │   ├── Layout.tsx        # Main application wrapper
│   │   └── Sidebar.tsx       # Navigation sidebar
│   ├── context/              # Global state (GoogleAuthContext)
│   ├── hooks/                # Custom React hooks
│   │   ├── usePatients.ts
│   │   └── useSessions.ts
│   ├── lib/                  # Core utilities
│   │   ├── error-handler.ts  # Clinical error management
│   │   ├── utils.ts          # Tailwind merge and common helpers
│   │   └── firestore-mock.ts # Local development mock layer
│   ├── pages/                # Main application views
│   │   ├── Dashboard.tsx     # Practice overview with metrics
│   │   ├── Patients.tsx      # Patient directory with search
│   │   ├── PatientDetail.tsx # Individual patient profile & session history
│   │   ├── Calendar.tsx      # Full scheduling view (Month/Week)
│   │   ├── DailyCalendar.tsx # Hourly day view with weekly overview
│   │   ├── Sessions.tsx      # Clinical history, notes, and attachments
│   │   ├── Finance.tsx       # Revenue, pending payments, and summaries
│   │   ├── Settings.tsx      # Profile, integrations, and data export
│   │   ├── Login.tsx         # Authentication screen
│   │   └── Terms.tsx         # Terms of Service page
│   ├── types.ts            # Global TypeScript definitions
│   ├── i18n.ts             # Internationalization config
│   ├── main.tsx            # Entry point & PWA registration
│   └── index.css           # Global styles and Tailwind v4 theme
├── vite.config.ts          # Build and PWA configuration
├── tsconfig.json           # TypeScript configuration
└── firestore.rules         # Firebase security rules
```

---

## ✨ Key Features

### 1. Secure Authentication
- Integration with Google Identity for secure, single-sign-on access.
- Automatic session management and permission (scopes) verification.

### 2. Patient Directory
- Comprehensive patient records including contact info, demographics, address, and additional clinical data.
- Search and filtering capabilities for easy management.
- Quick navigation from any list directly to patient profiles.
- **Patient Detail View**: Complete profile with session history, editable records, and one-click session scheduling.

### 3. Professional Scheduling
- Visual calendar with Month and Week views.
- **Daily View**: Hourly breakdown for precise session management.
- **Weekly Overview**: Accurate session counts (total, completed, cancelled) for the displayed week.
- Recurrence support (Weekly, Fortnightly, Monthly) with automated session generation.
- Direct session cancellation with Google Calendar sync.

### 4. Clinical Sessions & Notes
- Dedicated history for all therapy sessions with search and filtering.
- Markdown-supported clinical notes with rich text rendering.
- Status tracking (Scheduled, Completed, No-show, Cancelled).
- **Session Actions**: Edit session details and delete sessions with confirmation safeguards.
- Attachment support: Upload and view session-related files (up to 40MB).

### 5. Financial Management
- Real-time revenue tracking based on session status and financial plans.
- Support for multiple financial plans (Per Session, Monthly, Health Insurance, Exempt).
- One-click "Mark as Paid" functionality.
- Visual summaries of expected vs. received payments.

### 6. Data & Integrations
- Export patient and session records to CSV.
- Google Calendar synchronization for session scheduling.
- Google Drive backup for session attachments and clinical data.

### 7. PWA (Progressive Web App)
- Fully installable on mobile devices.
- Native-like experience with standalone display mode.

---

## 🛠 Development & Deployment

- **Dev Mode**: `npm run dev`
- **Build**: `npm run build`
- **Deploy to GitHub Pages**: `npm run deploy` (automatically builds and publishes PWA assets)
