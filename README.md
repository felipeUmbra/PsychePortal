<div align="center">
  <h1>🧠 PsychePortal</h1>
  <p>A professional workspace for clinical psychology management.</p>
</div>

## 📌 Overview

PsychePortal is a modern, secure, and clinical-grade web application designed specifically for mental health professionals. It provides a comprehensive suite of tools to manage patients, schedule sessions, track clinical notes, and monitor financial records all in one place.

*Note: This platform is currently in a continuous development (Beta) phase.*

## ✨ Key Features

- **🔐 Secure Authentication:** Google OAuth integration via Firebase Authentication.
- **🌍 Internationalization (i18n):** Full support for Portuguese (PT-BR) and English (EN).
- **👥 Patient Directory:** Manage patient profiles, anamnesis, financial plans, and basic demographic data.
- **📅 Interactive Calendar:** Schedule, view, and manage daily and weekly therapy sessions with recurrence support.
- **📝 Clinical Notes:** Markdown-supported session logging with history tracking for each patient.
- **💰 Financial Management:** Track expected revenues, pending payments, and paid sessions natively.
- **📊 Dashboard:** Quick overview of daily schedules, total patients, and financial growth.
- **📤 Data Export:** Export patient and session data to CSV for external backups or reporting.

## 🛠️ Technology Stack

- **Frontend Framework:** React 19 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, Framer Motion (Animations), Lucide React (Icons)
- **Routing:** React Router v7 (HashRouter for GitHub Pages compatibility)
- **Backend & Database:** Firebase (Authentication, Firestore Database)
- **Internationalization:** i18next & react-i18next
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
   Create a `.env` file in the root directory and add your Firebase configuration (e.g., API keys, auth domain).

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

This project is in active development. The storage, management, and care of sensitive patient data registered through this portal is the sole and exclusive responsibility of the user and the underlying cloud infrastructure (Google Firebase). The development team is not responsible for any data loss, information leaks, or service unavailability.
