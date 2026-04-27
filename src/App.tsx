import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Terms from './pages/Terms';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Calendar from './pages/Calendar';
import DailyCalendar from './pages/DailyCalendar';
import Sessions from './pages/Sessions';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import { GoogleAuthProvider } from './context/GoogleAuthContext';

export default function App() {
  return (
    <GoogleAuthProvider>
      <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<Patients />} />
          <Route path="patients/:id" element={<PatientDetail />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="calendar/daily" element={<DailyCalendar />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="finance" element={<Finance />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </GoogleAuthProvider>
  );
}
