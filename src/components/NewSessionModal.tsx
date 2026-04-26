import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection } from 'firebase/firestore';
import { Repeat, Calendar as CalendarIcon, Clock, Plus, Trash2 } from 'lucide-react';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';
import { addMonths, addWeeks } from 'date-fns';
import { useGoogleAuth } from '../context/GoogleAuthContext';

interface SessionSlot {
  id: string;
  date: string;
  hour: string;
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | undefined;
  patients: any[];
  preselectedPatientId?: string;
  preselectedDate?: Date;
}

export function NewSessionModal({ isOpen, onClose, userId, patients, preselectedPatientId, preselectedDate }: NewSessionModalProps) {
  const { t } = useTranslation();
  const { driveToken } = useGoogleAuth();
  
  const formatDateISO = (d: Date) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  const [patientId, setPatientId] = useState(preselectedPatientId || '');
  const [slots, setSlots] = useState<SessionSlot[]>([]);
  const [recurrence, setRecurrence] = useState({
    isRecurrent: false,
    recurrenceCount: 4,
    isInfinite: false,
    frequency: 'weekly' // weekly, fortnightly, monthly
  });

  useEffect(() => {
    if (isOpen) {
      setPatientId(preselectedPatientId || '');
      setSlots([{
        id: Math.random().toString(36).substr(2, 9),
        date: preselectedDate ? formatDateISO(preselectedDate) : formatDateISO(new Date()),
        hour: preselectedDate ? preselectedDate.getHours().toString().padStart(2, '0') + ':00' : '08:00',
      }]);
      setRecurrence({
        isRecurrent: false,
        recurrenceCount: 4,
        isInfinite: false,
        frequency: 'weekly'
      });
    }
  }, [isOpen, preselectedPatientId, preselectedDate]);

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    setSlots([...slots, {
      id: Math.random().toString(36).substr(2, 9),
      date: lastSlot ? lastSlot.date : formatDateISO(new Date()),
      hour: lastSlot ? lastSlot.hour : '08:00',
    }]);
  };

  const removeSlot = (id: string) => {
    if (slots.length > 1) {
      setSlots(slots.filter(s => s.id !== id));
    }
  };

  const handleAddAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !patientId) return;

    // Validate that no slots are in the past
    const now = new Date();
    for (const slot of slots) {
      const [year, month, day] = slot.date.split('-').map(Number);
      const [hour] = slot.hour.split(':').map(Number);
      const slotDate = new Date(year, month - 1, day, hour, 0, 0, 0);
      
      if (slotDate < now) {
        alert(t('calendar.past_date_error', 'Cannot schedule sessions in the past.'));
        return;
      }
    }

    try {
      let sessionCount = 1;
      if (recurrence.isRecurrent) {
        if (recurrence.isInfinite) {
          if (recurrence.frequency === 'weekly') sessionCount = 26;
          else if (recurrence.frequency === 'fortnightly') sessionCount = 13;
          else if (recurrence.frequency === 'monthly') sessionCount = 6;
        } else {
          sessionCount = Number(recurrence.recurrenceCount);
        }
      }

      const sessionsToAdd = [];
      const recurrenceGroupId = recurrence.isRecurrent ? `${patientId}_${Date.now()}` : null;

      for (const slot of slots) {
        const [year, month, day] = slot.date.split('-').map(Number);
        const [hour] = slot.hour.split(':').map(Number);
        const baseDate = new Date(year, month - 1, day, hour, 0, 0, 0);

        for (let i = 0; i < sessionCount; i++) {
          let sessionDate = new Date(baseDate);
          
          if (recurrence.frequency === 'weekly') {
            sessionDate = addWeeks(baseDate, i);
          } else if (recurrence.frequency === 'fortnightly') {
            sessionDate = addWeeks(baseDate, i * 2);
          } else if (recurrence.frequency === 'monthly') {
            sessionDate = addMonths(baseDate, i);
          }

          sessionsToAdd.push({
            patientId,
            date: sessionDate.toISOString(),
            psychologistId: userId,
            status: 'scheduled',
            paymentStatus: 'pending',
            type: 'individual',
            notes: '',
            createdAt: new Date().toISOString(),
            recurrenceGroup: recurrenceGroupId
          });
        }
      }

      // Create sessions one by one or in batch
      for (const sessionData of sessionsToAdd) {
        // Find matching slot for calendar sync
        const slot = slots.find(s => {
           const [y, m, d] = s.date.split('-').map(Number);
           const [h] = s.hour.split(':').map(Number);
           const sD = sessionData.date?.toDate ? sessionData.date.toDate() : new Date(sessionData.date);
           return sD.getFullYear() === y && (sD.getMonth() + 1) === m && sD.getDate() === d && sD.getHours() === h;
        });

        // Sync with Google Calendar per slot (only for the first instance of recurrence to avoid duplicates if RRULE is used)
        const isFirstInstance = sessionsToAdd.indexOf(sessionData) < slots.length;
        const googleToken = driveToken;
        
        if (googleToken && isFirstInstance && slot) {
          const patient = patients.find(p => p.id === patientId);
          const [year, month, day] = slot.date.split('-').map(Number);
          const [hour] = slot.hour.split(':').map(Number);
          const startDate = new Date(year, month - 1, day, hour, 0, 0, 0);

          const event: any = {
            summary: `Psy: Consulta - ${patient?.name || 'Paciente'}`,
            description: `**Consulta Psicológica**\n\nPaciente: ${patient?.name || 'Não informado'}\nPsicólogo(a): ${auth.currentUser?.displayName || 'Não informado'}\nTipo de sessão: ${sessionData.type || 'Individual'}\nStatus: Agendado\n\nAgendamento automático gerado via PsychePortal.`,
            start: {
              dateTime: startDate.toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            conferenceData: {
              createRequest: {
                requestId: sessionData.id || Math.random().toString(36).substring(7),
                conferenceSolutionKey: { type: 'hangoutsMeet' }
              }
            }
          };

          if (patient?.email) {
            event.attendees = [{ email: patient.email }];
          }

          if (recurrence.isRecurrent) {
            let rrule = `RRULE:FREQ=${recurrence.frequency.toUpperCase().replace('WEEKLY', 'WEEKLY').replace('FORTNIGHTLY', 'WEEKLY;INTERVAL=2').replace('MONTHLY', 'MONTHLY')};COUNT=${sessionCount}`;
            event.recurrence = [rrule];
          }

          try {
            console.log('Attempting Google Calendar sync for event:', event.summary);
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${googleToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(event)
            });
            
            const eventData = await res.json().catch(() => ({}));

            if (!res.ok) {
              console.error('Calendar API Error:', res.status, eventData);
              if (res.status === 401 || res.status === 403) {
                window.dispatchEvent(new CustomEvent('google-auth-error', { 
                  detail: { 
                    status: res.status, 
                    service: 'calendar',
                    message: eventData.error?.message || res.statusText
                  } 
                }));
              }
            } else {
              console.log('Calendar event created successfully:', eventData.id);
              if (eventData.id) {
                sessionData.googleEventId = eventData.id;
              }
              window.dispatchEvent(new CustomEvent('google-auth-success'));
            }
          } catch (calendarError) {
            console.error("Failed to add event to Google Calendar", calendarError);
          }
        }

        // Add to db
        await addDoc(collection(db, 'sessions'), sessionData);
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessions');
    }
  };

  const workingHours = Array.from({ length: 11 }, (_, i) => i + 8);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{t('calendar.modal_title', 'Schedule New Session')}</h2>
            <form onSubmit={handleAddAppt} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('calendar.patient', 'Patient')}</label>
                <select 
                  required
                  disabled={!!preselectedPatientId}
                  className="input-field disabled:opacity-50 disabled:bg-slate-50"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                >
                  <option value="">{t('calendar.select_patient', 'Select a patient')}</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 border-l-4 border-primary-custom pl-3 uppercase tracking-wider">{t('common.date_time')}</h3>
                  <button 
                    type="button" 
                    onClick={addSlot}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-primary-custom hover:bg-primary-custom/5 px-2 py-1 rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('calendar.add_another_day', 'Add another day')}
                  </button>
                </div>
                
                {slots.map((slot, index) => (
                  <div key={slot.id} className="relative group grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-1">{t('common.date', 'Date')}</label>
                      <input 
                        required
                        type="date" 
                        className="input-field text-[13px]" 
                        value={slot.date}
                        onChange={(e) => {
                          const newSlots = [...slots];
                          newSlots[index].date = e.target.value;
                          setSlots(newSlots);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-1">{t('common.time', 'Time')}</label>
                      <select 
                        required
                        className="input-field text-[13px]"
                        value={slot.hour}
                        onChange={(e) => {
                          const newSlots = [...slots];
                          newSlots[index].hour = e.target.value;
                          setSlots(newSlots);
                        }}
                      >
                        {workingHours.map(h => {
                          const timeStr = `${h.toString().padStart(2, '0')}:00`;
                          return <option key={timeStr} value={timeStr}>{timeStr}</option>
                        })}
                      </select>
                    </div>
                    {slots.length > 1 && (
                      <button 
                         type="button"
                         onClick={() => removeSlot(slot.id)}
                         className="absolute -right-2 -top-2 w-6 h-6 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-full shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{t('calendar.recurrence', 'Recurrent Session')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecurrence({ ...recurrence, isRecurrent: !recurrence.isRecurrent })}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      recurrence.isRecurrent ? "bg-primary-custom" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      recurrence.isRecurrent ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>

                {recurrence.isRecurrent && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-1">{t('calendar.frequency', 'Frequency')}</label>
                        <select 
                          className="input-field text-[13px]"
                          value={recurrence.frequency}
                          onChange={(e) => setRecurrence({ ...recurrence, frequency: e.target.value })}
                        >
                          <option value="weekly">{t('calendar.frequencies.weekly')}</option>
                          <option value="fortnightly">{t('calendar.frequencies.fortnightly')}</option>
                          <option value="monthly">{t('calendar.frequencies.monthly')}</option>
                        </select>
                      </div>
                      <div className="flex items-end justify-between pb-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox"
                            checked={recurrence.isInfinite}
                            onChange={(e) => setRecurrence({ ...recurrence, isInfinite: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-primary-custom"
                          />
                          <label className="text-sm text-slate-600 leading-none">{t('calendar.no_end_date', 'No end date')}</label>
                        </div>
                      </div>
                    </div>
                    
                    {!recurrence.isInfinite && (
                      <div>
                        <label className="block text-sm text-slate-700 mb-1">{t('calendar.occurrences', 'Number of occurrences')}</label>
                        <input 
                          type="number"
                          min="2"
                          max="52"
                          className="input-field"
                          value={recurrence.recurrenceCount}
                          onChange={(e) => setRecurrence({ ...recurrence, recurrenceCount: parseInt(e.target.value) })}
                        />
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 italic">
                      {recurrence.isInfinite 
                        ? t('calendar.infinite_info', 'Sessions will be scheduled according to frequency for the next 6 months.')
                        : t('calendar.recurrence_info', 'Sessions will be scheduled according to frequency.')}
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 btn-secondary"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  {t('calendar.schedule_button', 'Confirm Schedule')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
