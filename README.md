<div align="center">
  <h1>🧠 Portal Psis</h1>
  <p>A professional workspace for clinical psychology management.</p>
</div>

## 📌 Overview

Portal Psis is a modern, secure, and clinical-grade web application designed specifically for mental health professionals. It provides a comprehensive suite of tools to manage patients, schedule sessions, track clinical notes, and monitor financial records all in one place.

*Note: This platform is currently in a continuous development (Beta) phase.*

## ✨ Key Features

- **📱 PWA Support:** Fully installable as a Progressive Web App on Android and iOS devices for a native-like experience.
- **🔐 Secure Authentication:** Google OAuth integration via Firebase Authentication with scoped access to Calendar and Drive.
- **🌍 Internationalization (i18n):** Full support for Portuguese (PT-BR) and English (EN), toggleable on the landing page and throughout the app.
- **👥 Patient Directory:** Manage patient profiles, anamnesis, financial plans, and demographics with quick-navigation links.
- **📅 Interactive Calendar:** Schedule and manage sessions with Month, Week, and Daily Hourly views, plus recurrence support (Weekly, Fortnightly, Monthly).
- **📝 Clinical Notes:** Markdown-supported session logging with organized clinical history tracking.
- **🗑️ Session Management:** Edit and delete session records with confirmation safeguards. Status tracking (Scheduled, Completed, No-show, Cancelled).
- **💰 Financial Management:** Real-time revenue tracking, pending payments, revenue summaries, and one-click "Mark as Paid" functionality.
- **📊 Dashboard:** Quick overview of daily schedules, patient metrics, clinical growth (month-over-month), and recent activity.
- **📤 Data Export:** Export patient and session records to CSV for external reporting, with configurable date ranges and export modes.
- **☁️ Google Drive Backup:** All patient and session data is synchronized to your personal Google Drive (`appDataFolder`) for privacy-first cloud backup.
- **⚖️ LGPD Compliance:** Audit log with integrity chain verification, data retention policies, informed consent management with digital signature, full data erasure (right to be forgotten), encrypted clinical notes with version history, and full backup snapshots.
- **📄 Public Pages:** Landing page, Terms of Service, and Privacy Policy pages for compliance and public access.

## 🛠️ Technology Stack

- **Frontend:** React 19, Vite 6, TypeScript
- **PWA:** `vite-plugin-pwa` (Service Workers, Manifest, Offline support)
- **Styling:** Tailwind CSS v4, Motion (Animations), Lucide React (Icons)
- **Routing:** React Router (HashRouter for GitHub Pages)
- **Backend:** Firebase Authentication; a Firestore-shaped mock adapter for app data, synchronized to Google Drive `appDataFolder`; Google Calendar API for event sync
- **Date Utilities:** `date-fns`
- **i18n:** i18next & react-i18next
- **Charts:** Recharts
- **Testing:** Cypress 15 for E2E and accessibility tests, Vitest for unit tests, and `cypress-mochawesome-reporter` for HTML/JSON test reports
- **CI/CD:** GitHub Actions pipeline (type check → unit tests → E2E → axe accessibility → build/artifacts); Pages deploys on successful pushes to `main`
- **Deployment:** GitHub Pages (`gh-pages`)

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18 or higher recommended)
- A Firebase project with Google Authentication enabled; enable Google Drive and Calendar APIs for live integrations

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/felipeumbra/PsychePortal.git
   cd PsychePortal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Firebase Configuration:**
   The app loads its Firebase client configuration from `firebase-applet-config.json`. Use a Firebase project with Google Authentication enabled for live sign-in; the app does not currently reference Firebase settings from `.env` variables.

   App collections do not use Cloud Firestore: Vite aliases `firebase/firestore` to `src/lib/firestore-mock.ts`, which provides the Firestore-shaped API and syncs workspace data to the signed-in user's Google Drive. The adapter also reads the legacy `localStorage` cache as a fallback.

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

## 🧪 Testing

The project uses Vitest for unit tests and Cypress for end-to-end and accessibility coverage. Cypress specs cover authentication, patients, scheduling, sessions, finance, compliance, audit logs, settings, encryption, persistence, and accessibility.

```bash
# Type-check
npm run lint

# Run unit tests
npm run test:unit

# Start `npm run dev` separately, then run Cypress against http://localhost:5173
npx cypress run

# Run the focused accessibility specs
npx cypress run --spec "cypress/e2e/accessibility.cy.ts"
npx cypress run --spec "cypress/e2e/accessibility-full.cy.ts"

# Build the production bundle
npm run build

# Open the Cypress interactive runner
npx cypress open
```

- **MockAuth:** A custom mock replaces Firebase Auth during Cypress runs, simulating the Google OAuth flow without live credentials.
- **API intercepts:** All Google Drive and Calendar network calls are stubbed, so tests run fully offline.
- **Axe/WCAG checks:** `accessibility-full.cy.ts` audits public and authenticated routes and checks forms, landmarks, keyboard navigation, color contrast, reduced motion, and error states. `checkA11yCustom` waits for finite animations, runs axe, and fails with rule IDs and affected selectors. `checkWCAG` runs selected axe tags, such as `wcag2aa` and `wcag21aa`.
- **Accessibility behavior:** `src/index.css` honors `prefers-reduced-motion`; keyboard tests use the shared commands in `cypress/support/accessibility.ts`.
- **Reports:** `cypress-mochawesome-reporter` generates HTML + JSON reports under `cypress/reports/html/` after each run.

## 🤖 CI/CD

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on pushes and pull requests targeting `main`:

1. Install dependencies (`npm ci`)
2. Type check (`npm run typecheck`)
3. Run unit tests (`npm run test:unit`)
4. Run the Cypress E2E suite against the Vite dev server
5. Run the full axe accessibility spec (`cypress/e2e/accessibility-full.cy.ts`)
6. Build the production bundle (**only if all checks pass**)
7. Upload the `dist/` build and Cypress reports as artifacts

The GitHub Pages deploy job runs only after a successful `push` to `main`; it is skipped for pull requests.

## 🌐 Deployment to GitHub Pages

This project is configured to be deployed automatically to GitHub Pages using the `gh-pages` package.

1. Build and deploy the application:
   ```bash
   npm run deploy
   ```
   *This command runs `npm run build` and then pushes the `dist` folder to the `gh-pages` branch.*

2. Make sure your GitHub Repository Settings are configured correctly:
   - Go to **Settings > Pages**.
   - Under **Build and deployment**, set the source to **Deploy from a branch**.
   - Select the `gh-pages` branch and `/ (root)` folder.

## ⚠️ Important Notes regarding Google OAuth Verification

When deploying this app to a public domain (like GitHub Pages), Google requires the OAuth Consent Screen to be verified. 

If you encounter the "Unverified App" warning during login:
1. Ensure the app domain (`github.io`) is added to the **Authorized Domains** in the Firebase Console and Google Cloud Console.
2. Verify ownership of your GitHub Pages URL via **Google Search Console**.
3. Ensure the Application Home Page is set to the root URL (e.g., `https://username.github.io/PsychePortal/`).
4. Ensure the Privacy Policy link points to the public privacy page (e.g., `https://username.github.io/PsychePortal/#/privacy`).
5. Submit the application for verification in the Google Cloud Console.

## 📄 Disclaimer

This project is in active development. The storage, management, and care of sensitive patient data registered through this portal is the sole and exclusive responsibility of the user and the underlying cloud infrastructure (Google Firebase / Google Drive). The development team is not responsible for any data loss, information leaks, or service unavailability.
