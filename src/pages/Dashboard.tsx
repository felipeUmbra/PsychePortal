import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Clock, 
  TrendingUp,
  ChevronRight,
  Plus,
  History
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, addHours } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [user] = useAuthState(auth);
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState({ patients: 0, sessions: 0, scheduled: 0, growth: '0%' });
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) return;

    const fetchPatients = async () => {
      const q = query(collection(db, 'patients'), where('psychologistId', '==', user.uid));
      const snap = await getDocs(q);
      const patientMap: Record<string, any> = {};
      snap.docs.forEach(doc => {
        patientMap[doc.id] = doc.data();
      });
      setPatients(patientMap);
    };
    fetchPatients();

    // Fetch Stats
    const fetchStats = async () => {
      try {
        const patientsSnap = await getDocs(query(collection(db, 'patients'), where('psychologistId', '==', user.uid)));
        const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('psychologistId', '==', user.uid), where('status', 'in', ['completed', 'no_show'])));
        const scheduledSnap = await getDocs(query(collection(db, 'sessions'), where('psychologistId', '==', user.uid), where('status', '==', 'scheduled')));
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        let currentMonthSessions = 0;
        let prevMonthSessions = 0;

        sessionsSnap.docs.forEach(doc => {
          const data = doc.data();
          const d = data.date?.toDate ? data.date.toDate() : new Date(data.date);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) currentMonthSessions++;
          if (d.getMonth() === previousMonth && d.getFullYear() === previousYear) prevMonthSessions++;
        });

        let growthPercentage = 0;
        if (prevMonthSessions === 0) {
          growthPercentage = currentMonthSessions > 0 ? 100 : 0;
        } else {
          growthPercentage = Math.round(((currentMonthSessions - prevMonthSessions) / prevMonthSessions) * 100);
        }

        const growthString = growthPercentage > 0 ? `+${growthPercentage}%` : `${growthPercentage}%`;

        setStats({
          patients: patientsSnap.size,
          sessions: sessionsSnap.size,
          scheduled: scheduledSnap.size,
          growth: growthString
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'stats');
      }
    };

    fetchStats();

    // Listen for today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const qToday = query(
      collection(db, 'sessions'),
      where('psychologistId', '==', user.uid),
      where('date', '>=', today),
      where('date', '<', tomorrow),
      orderBy('date', 'asc')
    );

    const unsubscribeToday = onSnapshot(qToday, (snapshot) => {
      setTodaySessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sessions'));

    // Listen for recent sessions
    const qSessions = query(
      collection(db, 'sessions'),
      where('psychologistId', '==', user.uid),
      where('status', 'in', ['completed', 'no_show']),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
      setRecentSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sessions'));

    return () => {
      unsubscribeToday();
      unsubscribeSessions();
    };
  }, [user]);

  const statCards = [
    { label: t('dashboard.total_patients'), value: stats.patients, icon: Users, color: 'bg-primary-custom' },
    { label: t('dashboard.total_sessions'), value: stats.sessions, icon: History, color: 'bg-primary-custom' },
    { label: t('dashboard.upcoming_appts'), value: stats.scheduled, icon: CalendarIcon, color: 'bg-success-custom' },
    { label: t('dashboard.growth'), value: stats.growth, icon: TrendingUp, color: 'bg-amber-500' },
  ];

  const dateLocale = i18n.language.startsWith('pt') ? ptBR : enUS;

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-text-muted text-[14px] mt-1">{t('dashboard.welcome', { name: user?.displayName?.split(' ')[1] || 'Psychologist' })}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/calendar" className="btn-secondary flex items-center gap-2 text-[14px]">
            <CalendarIcon className="w-4 h-4" />
            {t('dashboard.view_calendar')}
          </Link>
          <Link to="/calendar" className="btn-primary flex items-center gap-2 text-[14px]">
            <Plus className="w-4 h-4" />
            {t('dashboard.new_session')}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card flex items-center gap-4 bg-[#fafbfc]"
          >
            <div className={cn("p-2.5 rounded-lg text-white shadow-sm", stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-text-main">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="card">
            <div className="flex justify-between items-center mb-8 border-b border-border-custom pb-4">
              <h2 className="text-[16px] font-bold text-text-main">{t('dashboard.today_schedule')}</h2>
              <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">{format(new Date(), i18n.language.startsWith('pt') ? "EEEE, d 'de' MMMM" : 'EEEE, MMMM do', { locale: dateLocale })}</span>
            </div>
            
            <div className="space-y-4">
              {todaySessions.filter(s => s.status !== 'cancelled').length > 0 ? (
                todaySessions.filter(s => s.status !== 'cancelled').map((session) => {
                  const startDate = session.date?.toDate ? session.date.toDate() : new Date(session.date);
                  const endDate = addHours(startDate, 1);
                  return (
                    <div key={session.id} className="flex items-center gap-4 p-4 rounded border border-border-custom hover:bg-bg transition-colors group">
                      <div className="w-16 text-center">
                        <p className="text-[14px] font-bold text-text-main">{format(startDate, 'HH:mm')}</p>
                        <p className="text-[11px] text-text-muted font-medium">{format(endDate, 'HH:mm')}</p>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[15px] font-semibold text-text-main">{patients[session.patientId]?.name || 'Unknown Patient'}</h3>
                        <p className="text-[13px] text-text-muted flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          1 hour session • {t(`session_status.${session.status}`)}
                        </p>
                      </div>
                      <Link to={`/patients/${session.patientId}`} className="p-2 rounded-sm hover:bg-surface text-text-muted hover:text-primary-custom transition-all">
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="text-text-muted w-6 h-6" />
                  </div>
                  <p className="text-text-muted text-[14px]">{t('dashboard.no_appts_today')}</p>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="text-[16px] font-bold text-text-main mb-8 border-b border-border-custom pb-4">{t('dashboard.recent_sessions')}</h2>
            <div className="space-y-4">
              {recentSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 rounded bg-bg border border-border-custom">
                  <div>
                    <p className="text-[14px] font-semibold text-text-main">{patients[session.patientId]?.name || 'Unknown Patient'}</p>
                    <p className="text-[12px] text-text-muted font-medium">{format(session.date?.toDate ? session.date.toDate() : new Date(session.date), i18n.language.startsWith('pt') ? "d 'de' MMM, yyyy" : 'MMM d, yyyy', { locale: dateLocale })}</p>
                  </div>
                  <span className={cn(
                    "status-badge",
                    session.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}>
                    {t(`session_status.${session.status}`)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="card">
            <h3 className="text-[16px] font-bold text-text-main mb-6 border-b border-border-custom pb-4">{t('dashboard.quick_actions')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/patients" className="p-4 rounded bg-bg border border-border-custom hover:bg-accent-custom hover:text-primary-custom hover:border-primary-custom/30 transition-all text-center group">
                <Users className="w-6 h-6 mx-auto mb-2 text-text-muted group-hover:text-primary-custom" />
                <span className="text-[12px] font-bold uppercase tracking-wider">{t('dashboard.add_patient')}</span>
              </Link>
              <Link to="/calendar" className="p-4 rounded bg-bg border border-border-custom hover:bg-accent-custom hover:text-primary-custom hover:border-primary-custom/30 transition-all text-center group">
                <CalendarIcon className="w-6 h-6 mx-auto mb-2 text-text-muted group-hover:text-primary-custom" />
                <span className="text-[12px] font-bold uppercase tracking-wider">{t('dashboard.schedule')}</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
