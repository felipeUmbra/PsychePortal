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
- **📄 Public Pages:** Landing page, Terms of Service, and Privacy Policy pages for compliance and public access.

## 🛠️ Technology Stack

- **Frontend:** React 19, Vite 6, TypeScript
- **PWA:** `vite-plugin-pwa` (Service Workers, Manifest, Offline support)
- **Styling:** Tailwind CSS v4, Motion (Animations), Lucide React (Icons)
- **Routing:** React Router (HashRouter for GitHub Pages)
- **Backend:** Firebase (Authentication, Firestore Database), Google Drive API (data backup & file storage), Google Calendar API (event sync)
- **Date Utilities:** `date-fns`
- **i18n:** i18next & react-i18next
- **Charts:** Recharts
- **Testing:** Cypress with a custom MockAuth implementation for end-to-end testing without live credentials
- **Deployment:** GitHub Pages (`gh-pages`)

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18 or higher recommended)
- A Firebase Project (with Firestore and Google Authentication enabled)

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

3. **Environment Setup:**
   Create a `.env` file in the root directory and add your Firebase configuration (e.g., API keys, auth domain, project ID).
   
   *Optional: For local development without a live Firebase project, the app includes a sophisticated mock data layer (`firestore-mock.ts`) that simulates Firestore operations, persists to `localStorage`, and can sync to Google Drive when authenticated.*

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

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
4. Ensure the Privacy Policy link points to the public terms page (e.g., `https://username.github.io/PsychePortal/#/terms`).
5. Submit the application for verification in the Google Cloud Console.

## 📄 Disclaimer

This project is in active development. The storage, management, and care of sensitive patient data registered through this portal is the sole and exclusive responsibility of the user and the underlying cloud infrastructure (Google Firebase / Google Drive). The development team is not responsible for any data loss, information leaks, or service unavailability.
