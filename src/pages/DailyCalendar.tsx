import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addHours, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';
import { NewSessionModal } from '../components/NewSessionModal';
import { useGoogleAuth } from '../context/GoogleAuthContext';

export default function Calendar() {
  const [user] = useAuthState(auth);
  const { t, i18n } = useTranslation();
  const { driveToken } = useGoogleAuth();
  const navigate = useNavigate();
  const dateLocale = i18n.language.startsWith('pt') ? ptBR : enUS;
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    const fetchPatients = async () => {
      const q = query(collection(db, 'patients'), where('psychologistId', '==', user.uid));
      const snap = await getDocs(q);
      setPatients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchPatients();

    const q = query(collection(db, 'sessions'), where('psychologistId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sessions'));

    return () => unsubscribe();
  }, [user]);

  const cancelSession = async (session: any) => {
    try {
      await updateDoc(doc(db, 'sessions', session.id), { status: 'cancelled' });
      
      if (session.googleEventId) {
        const token = driveToken;
        if (token) {
          const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${session.googleEventId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (res.status === 401 || res.status === 403) {
            const errorData = await res.json().catch(() => ({}));
            window.dispatchEvent(new CustomEvent('google-auth-error', { 
              detail: { 
                status: res.status, 
                service: 'calendar',
                message: errorData.error?.message || res.statusText
              } 
            }));
          } else if (res.ok) {
            window.dispatchEvent(new CustomEvent('google-auth-success'));
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${session.id}`);
    }
  };

  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Generate working hours (8:00 to 18:00)
  const workingHours = Array.from({ length: 11 }, (_, i) => i + 8);
  
  const handleSlotClick = (hour: number) => {
    const slotDate = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, hour), 0), 0), 0);
    setModalInitialDate(slotDate);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('sidebar.sessions_by_day')}</h1>
          <p className="text-text-muted text-[14px]">{t('calendar.subtitle')}</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2 text-[14px]"
        >
          <Plus className="w-4 h-4" />
          {t('calendar.new_appt')}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <section className="card">
            <div className="flex items-center justify-between mb-8 border-b border-border-custom pb-4">
              <h2 className="text-[14px] font-bold text-text-main">{format(selectedDate, 'MMMM yyyy')}</h2>
              <div className="flex gap-1">
                <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="p-1.5 hover:bg-bg rounded-lg text-text-muted hover:text-primary-custom transition-colors" aria-label={t('common.previous_week', 'Previous Week')}><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="p-1.5 hover:bg-bg rounded-lg text-text-muted hover:text-primary-custom transition-colors" aria-label={t('common.next_week', 'Next Week')}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-3">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={`${d}-${i}`} className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map(day => (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-lg text-[13px] transition-all border border-transparent",
                    isSameDay(day, selectedDate) 
                      ? "bg-primary-custom text-white font-bold shadow-md shadow-primary-custom/20" 
                      : "hover:bg-accent-custom text-text-main hover:border-primary-custom/20"
                  )}
                >
                  {format(day, 'd')}
                </button>
              ))}
            </div>
          </section>

          <section className="card bg-primary-custom text-white border-none shadow-lg shadow-primary-custom/20">
            <h3 className="text-[15px] font-bold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t('calendar.weekly_overview')}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-blue-100 text-[13px]">{t('dashboard.total_sessions')}</span>
                <span className="font-bold text-[14px]">{sessions.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-100 text-[13px]">{t('calendar.completed')}</span>
                <span className="font-bold text-[14px] text-emerald-300">
                  {sessions.filter(s => s.status === 'completed').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-100 text-[13px]">{t('calendar.cancelled')}</span>
                <span className="font-bold text-[14px] text-red-300">
                  {sessions.filter(s => s.status === 'cancelled').length}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <section className="card min-h-[500px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-border-custom pb-4 gap-4">
              <h2 className="text-[16px] font-bold text-text-main flex items-center gap-2">
                <span className="capitalize">
                  {format(selectedDate, "EEEE", { locale: dateLocale })}
                </span>
                <span className="text-text-muted font-normal">
                  {format(selectedDate, i18n.language.startsWith('pt') ? "d 'de' MMMM" : 'MMMM do', { locale: dateLocale })}
                </span>
              </h2>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-accent-custom text-primary-custom text-[11px] font-bold uppercase tracking-wider">{t('calendar.day_view')}</button>
                <button onClick={() => navigate('/calendar')} className="px-3 py-1.5 rounded-lg text-text-muted text-[11px] font-bold uppercase tracking-wider hover:bg-bg transition-colors">{t('calendar.week_view')}</button>
              </div>
            </div>

            <div className="space-y-3">
              {workingHours.map((hour) => {
                const hourSessions = sessions.filter(session => {
                  if (session.status === 'cancelled') return false;
                  const sD = session.date?.toDate ? session.date.toDate() : new Date(session.date);
                  return isSameDay(sD, selectedDate) && sD.getHours() === hour;
                });

                return (
                  <div key={hour} className="flex gap-4">
                    <div className="w-16 text-right pt-4 text-[13px] font-bold text-text-muted">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 min-h-[80px] relative rounded-xl border border-border-custom bg-surface overflow-hidden">
                      {hourSessions.length > 0 ? (
                        hourSessions.map(session => {
                          const patient = patients.find(p => p.id === session.patientId);
                          return (
                            <div key={session.id} className="absolute inset-1 p-3 rounded-lg bg-bg border-l-4 shadow-sm" style={{ borderLeftColor: session.status === 'completed' ? '#10b981' : session.status === 'cancelled' ? '#ef4444' : '#f59e0b' }}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <Link to={`/app/patients/${session.patientId}`} className="hover:underline">
                                    <h3 className="text-[14px] font-bold text-primary-custom">{patient?.name || 'Unknown Patient'}</h3>
                                  </Link>
                                  <p className="text-[12px] text-text-muted flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" />
                                    1 {t('common.hour', 'hour')} • {t(`session_status.${session.status}`)}
                                  </p>
                                </div>
                                {session.status === 'scheduled' && (
                                  <button onClick={() => cancelSession(session)} className="p-1.5 text-text-muted hover:text-red-500 rounded-lg hover:bg-red-50" aria-label={t('calendar.cancel_session', 'Cancel Session')}>
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <button 
                          onClick={() => handleSlotClick(hour)} 
                          className="absolute inset-0 w-full h-full flex items-center justify-center lg:opacity-0 lg:hover:opacity-100 bg-primary-custom/5 lg:bg-transparent lg:hover:bg-primary-custom/5 transition-all text-primary-custom gap-2 font-bold text-[13px] z-10 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="lg:inline">{t('calendar.schedule_session', 'Schedule Session')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <NewSessionModal 
        isOpen={isAddModalOpen} 
        onClose={() => {
          setIsAddModalOpen(false);
          setModalInitialDate(undefined);
        }}
        userId={user?.uid}
        patients={patients}
        preselectedDate={modalInitialDate}
      />
    </div>
  );
}
