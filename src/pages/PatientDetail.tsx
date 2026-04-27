import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, Plus, Clock, Edit3 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { useTranslation } from 'react-i18next';
import MDEditor from '@uiw/react-md-editor';
import { cn } from '../lib/utils';
import { NewSessionModal } from '../components/NewSessionModal';
import { PatientForm } from '../components/patients/PatientForm';
import { SessionForm } from '../components/sessions/SessionForm';
import { PatientInfoCard } from '../components/patients/PatientInfoCard';
import { usePatient } from '../hooks/usePatients';
import { useSessions } from '../hooks/useSessions';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import rehypeSanitize from 'rehype-sanitize';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user] = useAuthState(auth);
  
  const { patient, loading: patientLoading, updatePatient } = usePatient(id);
  const { sessions, loading: sessionsLoading, addSession, updateSession, cancelSession, uploadFile, isUploading } = useSessions(id);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [registeringSessionId, setRegisteringSessionId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);

  if (patientLoading || sessionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-custom/30 border-t-primary-custom rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!patient) return null;

  const upcomingSessions = sessions.filter(s => s.status === 'scheduled' && !isPast((s.date as any)?.toDate ? (s.date as any).toDate() : new Date(s.date)));
  const pastSessions = sessions.filter(s => s.status !== 'scheduled' || isPast((s.date as any)?.toDate ? (s.date as any).toDate() : new Date(s.date)));

  const handleAddSessionSubmit = async (data: any) => {
    await addSession(data);
    setIsAddingSession(false);
  };

  const handleUpdateSessionSubmit = async (data: any, sessionId: string) => {
    await updateSession(sessionId, data);
    setEditingSessionId(null);
    setRegisteringSessionId(null);
  };

  const toggleSessionNotes = (sessionId: string) => {
    setExpandedSessions(prev => 
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/patients')}
            className="p-2 hover:bg-surface rounded-lg text-text-muted transition-colors border border-transparent hover:border-border-custom"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">{patient.name}</h1>
            <p className="text-text-muted text-[14px]">{t('patient_detail.id')}: {patient.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="btn-secondary flex items-center gap-2 text-[13px] sm:text-[14px] flex-1 sm:flex-none justify-center"
          >
            <FileText className="w-4 h-4" />
            {t('patient_detail.edit_profile')}
          </button>
          <button 
            onClick={() => setIsScheduleModalOpen(true)}
            className="btn-secondary flex items-center gap-2 text-[13px] sm:text-[14px] flex-1 sm:flex-none justify-center"
          >
            <Calendar className="w-4 h-4" />
            {t('calendar.schedule_session', 'Schedule Appointment')}
          </button>
          <button 
            onClick={() => setIsAddingSession(true)}
            className="btn-primary flex items-center gap-2 text-[13px] sm:text-[14px] flex-1 sm:flex-none justify-center"
          >
            <Plus className="w-4 h-4" />
            {t('patient_detail.log_session')}
          </button>
        </div>
      </header>
      
      <NewSessionModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        userId={user?.uid}
        patients={[patient]}
        preselectedPatientId={patient.id}
      />

      <PatientForm 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={async (data) => { await updatePatient(data); }}
        initialData={patient}
        title={t('patient_detail.edit_profile')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <PatientInfoCard patient={patient} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          
          {upcomingSessions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[18px] font-bold text-text-main mb-4">{t('dashboard.upcoming_appts')}</h2>
              <div className="space-y-3">
                {upcomingSessions.map((session: any) => (
                  <div key={session.id} className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-accent-custom/50 border-primary-custom/20 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg border border-border-custom">
                        <Calendar className="w-4 h-4 text-primary-custom" />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-text-main">{format((session.date as any)?.toDate ? (session.date as any).toDate() : new Date(session.date), 'MMMM d, yyyy - HH:mm')}</p>
                        <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          1 hour • {t(`session_status.${session.status}`)}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => cancelSession(session)}
                      className="btn-secondary text-[12px] text-red-600 hover:bg-red-50 hover:border-red-200 w-full sm:w-auto"
                    >
                      {t('session_action.cancel')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[18px] font-bold text-text-main">{t('patient_detail.session_history')}</h2>
          </div>

          {isAddingSession && (
            <div className="mb-4">
              <SessionForm 
                title={t('patient_detail.log_new_title')}
                submitLabel={t('patient_detail.save_record')}
                onSubmit={handleAddSessionSubmit}
                onCancel={() => setIsAddingSession(false)}
                onUploadFile={(file) => uploadFile(file, id!)}
                isUploading={isUploading}
              />
            </div>
          )}

          <div className="space-y-4">
            {pastSessions.length > 0 ? (
              pastSessions.map((session: any) => (
                <div key={session.id} className="card p-0 overflow-hidden bg-[#fafbfc] hover:border-primary-custom/20 transition-all">
                  {(editingSessionId === session.id || registeringSessionId === session.id) ? (
                    <div className="p-6 bg-white">
                      <SessionForm 
                        title={registeringSessionId === session.id ? t('session_action.register') : t('session_action.edit_notes')}
                        submitLabel={t('common.save')}
                        initialData={session}
                        onSubmit={(data) => handleUpdateSessionSubmit(data, session.id)}
                        onCancel={() => {
                          setEditingSessionId(null);
                          setRegisteringSessionId(null);
                        }}
                        onUploadFile={(file) => uploadFile(file, session.id)}
                        isUploading={isUploading}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="px-6 py-4 bg-surface border-b border-border-custom flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-accent-custom rounded-lg border border-border-custom">
                            <FileText className="w-4 h-4 text-primary-custom" />
                          </div>
                          <div>
                            <p className="text-[14px] font-bold text-text-main">{format((session.date as any)?.toDate ? (session.date as any).toDate() : new Date(session.date), 'MMMM d, yyyy - HH:mm')}</p>
                            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              1 hour • {t(`patient_detail.types.${session.type || 'individual'}`)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                          <span className={cn(
                            "status-badge",
                            session.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                            session.status === 'scheduled' ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            {t(`session_status.${session.status}`)}
                          </span>
                          {session.status === 'scheduled' ? (
                            <button 
                              onClick={() => setRegisteringSessionId(session.id)}
                              className="btn-primary py-1 px-3 text-[12px]"
                            >
                              {t('session_action.register')}
                            </button>
                          ) : (
                            <button 
                              onClick={() => setEditingSessionId(session.id)}
                              className="p-1.5 text-text-muted hover:text-primary-custom hover:bg-bg rounded-md transition-colors"
                              title={t('session_action.edit_notes')}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {(session.notes || (session.attachments && session.attachments.length > 0)) && (
                        <div className="px-6 pb-6 pt-2">
                          <button 
                            onClick={() => toggleSessionNotes(session.id)}
                            className="text-[12px] font-bold text-primary-custom flex items-center gap-1.5 hover:underline mb-2"
                          >
                            {expandedSessions.includes(session.id) ? t('common.hide_notes', 'Hide Notes') : t('common.show_notes', 'Show Notes')}
                          </button>
                          {expandedSessions.includes(session.id) && (
                            <div className="mt-3">
                              {session.notes && (
                                <div data-color-mode="light" className="text-text-main text-[14px]">
                                  <MDEditor.Markdown 
                                    source={session.notes} 
                                    className="!bg-[#fafbfc]" 
                                    style={{ fontSize: '14px' }} 
                                    rehypePlugins={[rehypeSanitize]}
                                  />
                                </div>
                              )}
                              {session.attachments && session.attachments.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-border-custom">
                                  {session.attachments.map((att: any, idx: number) => (
                                    <a 
                                      key={idx} 
                                      href={att.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-custom rounded-lg hover:border-primary-custom/50 hover:bg-bg transition-all group"
                                    >
                                      <div className="p-1.5 bg-white rounded-md border border-border-custom group-hover:border-primary-custom/30">
                                        <FileText className="w-3 h-3 text-primary-custom" />
                                      </div>
                                      <div>
                                        <p className="text-[12px] font-bold text-text-main group-hover:text-primary-custom transition-colors truncate max-w-[200px]">
                                          {att.name}
                                        </p>
                                        <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                                          {(att.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 card border-dashed border-2 bg-transparent">
                <FileText className="w-12 h-12 text-border-custom mx-auto mb-4" />
                <p className="text-text-muted text-[14px]">{t('patient_detail.no_sessions')}</p>
                <button 
                  onClick={() => setIsAddingSession(true)}
                  className="mt-4 btn-primary inline-flex items-center gap-2 text-[13px]"
                >
                  <Plus className="w-4 h-4" />
                  {t('patient_detail.log_session')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
