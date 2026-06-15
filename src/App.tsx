import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import { GoogleAuthProvider } from './context/GoogleAuthContext';
import { useState } from 'react';
import { useEncryption } from './hooks/useEncryption';
import { EncryptionSetupModal } from './components/EncryptionSetupModal';

// Lazy load all page components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const Calendar = lazy(() => import('./pages/Calendar'));
const DailyCalendar = lazy(() => import('./pages/DailyCalendar'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Finance = lazy(() => import('./pages/Finance'));
const Settings = lazy(() => import("./pages/Settings"));
const AuditLog = lazy(() => import("./pages/AuditLog"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

export default function App() {
  return (
    <GoogleAuthProvider>
      <Router>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/app" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="patients" element={<Patients />} />
                <Route path="patients/:id" element={<PatientDetail />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="calendar/daily" element={<DailyCalendar />} />
                <Route path="sessions" element={<Sessions />} />
                <Route path="finance" element={<Finance />} />
                <Route path="settings" element={<Settings />} />
                <Route path="audit" element={<AuditLog />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
      <EncryptionSetupModalWrapper />
    </GoogleAuthProvider>
  );
}

function EncryptionSetupModalWrapper() {
  const { needsSetup, setup } = useEncryption();
  const [dismissed, setDismissed] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  if (needsSetup && !dismissed) {
    return (
      <EncryptionSetupModal
        isOpen={true}
        onClose={() => setDismissed(true)}
        onComplete={async (passphrase) => {
          await setup(passphrase);
          setShowSetup(false);
        }}
        onSkip={() => setDismissed(true)}
      />
    );
  }

  return null;
}
