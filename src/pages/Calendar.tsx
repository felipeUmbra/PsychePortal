import { useState } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { NewSessionModal } from '../components/NewSessionModal';
import { usePatients } from '../hooks/usePatients';
import { useAllSessions } from '../hooks/useAllSessions';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const locales = {
  'en': enUS,
  'pt': ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function Calendar() {
  const [user] = useAuthState(auth);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  const { patients, loading: patientsLoading } = usePatients();
  const { sessions, loading: sessionsLoading } = useAllSessions();

  const [view, setView] = useState<any>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>(undefined);

  const patientMap = Object.fromEntries(patients.map(p => [p.id, p]));

  if (patientsLoading || sessionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-custom/30 border-t-primary-custom rounded-full animate-spin"></div>
      </div>
    );
  }

  const events = sessions
    .filter(session => session.status !== 'cancelled')
    .map(session => {
    const sessionDate = (session.date as any)?.toDate ? (session.date as any).toDate() : new Date(session.date as any);
    const endDate = new Date(sessionDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    const patientName = patientMap[session.patientId]?.name || 'Unknown Patient';
    
    return {
      id: session.id,
      title: `${patientName} - ${t(`session_status.${session.status}`)}`,
      start: sessionDate,
      end: endDate,
      resource: session,
    };
  });

  const eventStyleGetter = (event: any) => {
    const status = event.resource.status;
    let backgroundColor = '#3b82f6'; // blue-500 (scheduled)
    
    if (status === 'completed') backgroundColor = '#10b981'; // emerald-500
    if (status === 'no_show') backgroundColor = '#f59e0b'; // amber-500
    if (status === 'cancelled') backgroundColor = '#ef4444'; // red-500

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '12px',
        fontWeight: 'bold',
        padding: '2px 6px',
        cursor: 'pointer'  // Adds the hover pointer for events
      }
    };
  };

  const handleSelectEvent = (event: any) => {
    navigate(`/app/patients/${event.resource.patientId}`);
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date; action: string }) => {
    setModalInitialDate(slotInfo.start);
    setIsAddModalOpen(true);
  };

  const currentLocale = i18n.language.startsWith('pt') ? 'pt' : 'en';

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('sidebar.entire_calendar')}</h1>
        <p className="text-text-muted text-[14px]">{t('sidebar.entire_calendar')}</p>
      </header>

      <div className="flex-1 bg-surface rounded-2xl border border-border-custom p-6 shadow-sm min-h-[600px] flex flex-col">
        <div className="flex-1 min-h-0">
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            culture={currentLocale}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={handleSelectEvent}
            selectable
            longPressThreshold={10}
            onSelectSlot={handleSelectSlot}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            messages={{
              next: t('common.next', 'Next'),
              previous: t('common.previous', 'Back'),
              today: t('common.today', 'Today'),
              month: t('common.month', 'Month'),
              week: t('common.week', 'Week'),
              day: t('common.day', 'Day'),
              agenda: t('common.agenda', 'Agenda'),
              date: t('common.date', 'Date'),
              time: t('common.time', 'Time'),
              event: t('common.event', 'Event'),
              noEventsInRange: t('common.no_events', 'No events in this range.'),
            }}
          />
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
