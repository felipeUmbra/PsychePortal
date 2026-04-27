# PsychePortal - Project Documentation

PsychePortal is a secure, clinical-grade workspace designed for mental health professionals to manage their clinical practice efficiently. It provides tools for patient management, session scheduling, financial tracking, and secure clinical documentation.

## 🚀 Technology Stack

### Core
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Routing**: [React Router 7](https://reactrouter.com/)

### Backend & Security
- **Authentication**: Firebase Auth (Google Provider)
- **Database**: Firebase Firestore
- **Persistence**: Google Drive API integration (storing data in a secure, hidden application folder)
- **Error Handling**: Centralized clinical-grade error boundary and logging system

### UI & UX
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion](https://motion.dev/) (formerly Framer Motion)
- **Calendar**: [React Big Calendar](https://jquense.github.io/react-big-calendar/)
- **Charts**: [Recharts](https://recharts.org/)
- **Editor**: [React MD Editor](https://uiwjs.github.io/react-md-editor/)

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
│   │   ├── patients/       # Patient-specific components (InfoCard, Form)
│   │   ├── Layout.tsx      # Main application wrapper
│   │   └── Sidebar.tsx     # Navigation sidebar
│   ├── context/            # Global state (GoogleAuthContext)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Core utilities
│   │   ├── error-handler.ts# Clinical error management
│   │   ├── utils.ts        # Tailwind merge and common helpers
│   │   └── firestore-mock.ts# Local development mock layer
│   ├── pages/              # Main application views
│   │   ├── Dashboard.tsx   # Practice overview
│   │   ├── Patients.tsx    # Patient directory
│   │   ├── Calendar.tsx    # Full scheduling view
│   │   ├── DailyCalendar.tsx# Hourly day view
│   │   ├── Sessions.tsx    # Clinical history and notes
│   │   ├── Finance.tsx     # Revenue and payment tracking
│   │   └── Settings.tsx    # Profile and integrations
│   ├── types.ts            # Global TypeScript definitions
│   ├── i18n.ts             # Internationalization config
│   ├── main.tsx            # Entry point & PWA registration
│   └── index.css           # Global styles and Tailwind v4 theme
├── vite.config.ts          # Build and PWA configuration
└── tsconfig.json           # TypeScript configuration
```

---

## ✨ Key Features

### 1. Secure Authentication
- Integration with Google Identity for secure, single-sign-on access.
- Automatic session management and permission (scopes) verification.

### 2. Patient Directory
- Comprehensive patient records including contact info, address, and additional clinical data.
- Search and filtering capabilities for easy management.
- Quick navigation from any list directly to patient profiles.

### 3. Professional Scheduling
- Visual calendar with Month and Week views.
- **Daily View**: Hourly breakdown for precise session management.
- Recurrence support (Weekly, Fortnightly, Monthly) with automated session generation.

### 4. Clinical Sessions & Notes
- Dedicated history for all therapy sessions.
- Markdown-supported clinical notes for rich text documentation.
- Status tracking (Scheduled, Completed, No-show, Cancelled).

### 5. Financial Management
- Real-time revenue tracking based on session status.
- Support for multiple financial plans (Per Session, Monthly, Health Insurance).
- One-click "Mark as Paid" functionality.
- Visual summaries of expected vs. received payments.

### 6. PWA (Progressive Web App)
- Fully installable on mobile devices.
- Offline support and automatic updates.
- Native-like experience with standalone display mode.

### 7. Google Drive Persistence
- Optional synchronization that stores clinical data in a hidden folder on the user's personal Google Drive, ensuring privacy and data ownership.

---

## 🛠 Development & Deployment

- **Dev Mode**: `npm run dev`
- **Build**: `npm run build`
- **Deploy to GitHub Pages**: `npm run deploy` (automatically builds and publishes PWA assets)
