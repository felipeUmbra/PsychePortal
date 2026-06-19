import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, Plus, Clock, Edit3, Trash2, X, ClipboardCheck, AlertTriangle, Loader2, History, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isPast } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import RichTextRenderer from '../components/RichTextRenderer';
import { cn } from '../lib/utils';
import { NewSessionModal } from '../components/NewSessionModal';
import { PatientForm } from '../components/patients/PatientForm';
import { SessionForm } from '../components/sessions/SessionForm';
import { PatientInfoCard } from '../components/patients/PatientInfoCard';
import { usePatient } from '../hooks/usePatients';
import { useSessions } from '../hooks/useSessions';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { logView, logEditCompleted } from '../lib/audit';
import { deleteAllPatientData } from '../lib/data-deletion';
import { PatientConsent } from '../components/patients/PatientConsent';
import { usePatientConsent } from '../hooks/usePatientConsent';
import { useEncryption } from '../hooks/useEncryption';
import { getNoteVersions, type NoteVersion } from '../lib/note-versioning';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('pt') ? ptBR : enUS;
  const [user] = useAuthState(auth);

  const { patient, loading: patientLoading, updatePatient } = usePatient(id);
  const { sessions, loading: sessionsLoading, addSession, updateSession, cancelSession, deleteSession, uploadFile, isUploading } = useSessions(id);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [registeringSessionId, setRegisteringSessionId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
const [showEditWarningModal, setShowEditWarningModal] = useState(false);
const [pendingEditSessionId, setPendingEditSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sessions' | 'consent'>('sessions');
  const [psychologistConsentText, setPsychologistConsentText] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllConfirmName, setDeleteAllConfirmName] = useState('');
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  // Version history state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedSessionForHistory, setSelectedSessionForHistory] = useState<any>(null);
  const [noteVersions, setNoteVersions] = useState<NoteVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [decryptedVersionNotes, setDecryptedVersionNotes] = useState<string | null>(null);
  const { isUnlocked, decrypt } = useEncryption();

  const { consents, hasActiveConsent, acceptConsent, revokeConsent } = usePatientConsent(id);
// Log patient view
  useEffect(() => {
    if (user && patient) {
      logView(user.uid, 'patient', patient.id);
    }
  }, [user, patient]);

  // Fetch psychologist profile for consentText
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'psychologists', user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data.consentText && data.consentText.trim().length > 0) {
            setPsychologistConsentText(data.consentText);
          }
        }
      } catch (err) {
        console.error('Failed to fetch psychologist profile:', err);
      }
    })();
  }, [user]);

  const getSessionDate = (s: any) => s?.date ? ((s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date)) : new Date(NaN);

  const formatSessionDate = (session: any) => {
    const d = getSessionDate(session);
    return !isNaN(d.getTime()) ? format(d, 'MMMM d, yyyy - HH:mm', { locale: dateLocale }) : t('common.na', 'N/A');
  };

  const handleAddSessionSubmit = async (data: any) => {
    try {
      await addSession(data);
      setIsAddingSession(false);
    } catch (err: any) {
      if (err.message === 'CONSENT_REQUIRED') {
        alert(t('consent.required_before_session'));
      } else {
        console.error('Failed to add session:', err);
      }
    }
  };

  const handleUpdateSessionSubmit = async (data: any, sessionId: string) => {
    try {
      await updateSession(sessionId, data);
      setEditingSessionId(null);
      setRegisteringSessionId(null);
    } catch (err: any) {
      if (err.message === 'CONSENT_REQUIRED') {
        alert(t('consent.required_before_session'));
      } else {
        console.error('Failed to update session:', err);
      }
    }
  };

  const handleDeleteSession = async () => {
    if (!deletingSessionId) return;

    try {
      await deleteSession(deletingSessionId);
      setShowDeleteModal(false);
      setDeletingSessionId(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleEditSessionClick = async (session: any) => {
    if (session.status === 'completed') {
      setPendingEditSessionId(session.id);
      setShowEditWarningModal(true);
    } else {
      setEditingSessionId(session.id);
    }
  };

  const toggleSessionNotes = (sessionId: string) => {
    if (user) {
      logView(user.uid, 'session', sessionId);
    }
    setExpandedSessions(prev =>
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  const handleDeleteAllPatientData = async () => {
    if (!user || !patient) return;
    setDeleteAllLoading(true);
    try {
      await deleteAllPatientData(patient.id, user.uid);
      navigate('/app/patients');
    } catch (err: any) {
      console.error('Failed to delete all patient data:', err);
      alert(t('data_deletion.error_failed', 'Deletion failed. Please try again.'));
    } finally {
      setDeleteAllLoading(false);
      setShowDeleteAllModal(false);
      setDeleteAllConfirmName('');
    }
  };

  const handleViewHistory = async (session: any) => {
    if (!user) return;
    setSelectedSessionForHistory(session);
    setShowVersionHistory(true);
    setNoteVersions([]);
    setSelectedVersion(null);
    setDecryptedVersionNotes(null);
    setVersionsLoading(true);
    try {
      const versions = await getNoteVersions(session.id, user.uid);
      setNoteVersions(versions);
    } catch (err) {
      console.error('Failed to load note versions:', err);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleSelectVersion = async (version: NoteVersion) => {
    setSelectedVersion(version);
    setDecryptedVersionNotes(null);
    if (!isUnlocked) return;
    try {
      const payload = JSON.parse(version.notes);
      if (payload.version && payload.ciphertext) {
        const pt = await decrypt(payload);
        setDecryptedVersionNotes(pt);
      } else {
        setDecryptedVersionNotes(version.notes);
      }
    } catch {
      setDecryptedVersionNotes(version.notes);
    }
  };

  if (patientLoading || sessionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-custom/30 border-t-primary-custom rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!patient) return null;

  
  const upcomingSessions = sessions.filter(s => {
    const d = getSessionDate(s);
    return s.status === 'scheduled' && !isNaN(d.getTime()) && !isPast(d);
  });
  const pastSessions = sessions.filter(s => {
    const d = getSessionDate(s);
    return s.status !== 'scheduled' || isNaN(d.getTime()) || isPast(d);
  });

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
          <button
            onClick={() => { setDeleteAllConfirmName(''); setShowDeleteAllModal(true); }}
            disabled={deleteAllLoading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg text-[13px] sm:text-[14px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {t('data_deletion.button_label', 'Delete All Patient Data')}
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
        onSubmit={async (data) => {
          await updatePatient(data);
          setIsEditModalOpen(false);
        }}
        initialData={patient}
        title={t('patient_detail.edit_profile')}
      />

      <div className="flex gap-1 border-b border-border-custom mb-6">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 text-[13px] font-bold border-b-2 transition-colors ${
            activeTab === 'sessions' ? 'border-primary-custom text-primary-custom' : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          {t('patient_detail.session_history', 'Session History')}
        </button>
        <button
          onClick={() => setActiveTab('consent')}
          className={`px-4 py-2 text-[13px] font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'consent' ? 'border-primary-custom text-primary-custom' : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          {t('consent.title', 'Consent')}
        </button>
      </div>

      {activeTab === 'consent' ? (
        <PatientConsent
          consentText={psychologistConsentText || (consents && consents.length > 0 ? consents[0].text : t('consent.default_text', 'Please configure consent text in Settings.'))}
          consentVersion={consents && consents.length > 0 ? consents[0].version : '1.0'}
          currentConsent={consents && consents.length > 0 ? consents[0] : undefined}
          hasActiveConsent={hasActiveConsent}
          onAccept={async (data) => {
            await acceptConsent(data);
            return Promise.resolve();
          }}
          onRevoke={async () => {
            await revokeConsent();
            return Promise.resolve();
          }}
        />
      ) : (
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
                        <p className="text-[14px] font-bold text-text-main">{formatSessionDate(session)}</p>
                        <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {t('dashboard.one_hour_session')} â€¢ {t(`session_status.${session.status}`)}
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
                <div key={session.id || Math.random()} className="card p-0 overflow-hidden bg-[#fafbfc] hover:border-primary-custom/20 transition-all">
                  {(editingSessionId === session.id || registeringSessionId === session.id) ? (
                    <div className="p-6 bg-white">
                      <SessionForm
                        title={registeringSessionId === session.id ? t('session_action.register') : t('session_action.edit_session')}
                        submitLabel={t('common.save')}
                        initialData={session}
                        onSubmit={(data) => {
                          if (!session.id) {
                            alert(t('common.error_invalid_session', 'ID de sessÃ£o invÃ¡lido. Salve a sessÃ£o primeiro.'));
                            return Promise.reject();
                          }
                          return handleUpdateSessionSubmit(data, session.id);
                        }}
                        onCancel={() => {
                          setEditingSessionId(null);
                          setRegisteringSessionId(null);
                        }}
                        onUploadFile={(file) => {
                          if (!session.id) {
                            alert(t('common.error_upload_no_id', 'NÃ£o Ã© possÃ­vel fazer upload: SessÃ£o sem identificador.'));
                            return Promise.reject();
                          }
                          return uploadFile(file, session.id);
                        }}
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
                            <p className="text-[14px] font-bold text-text-main">{formatSessionDate(session)}</p>
                            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {t('dashboard.one_hour_session')} â€¢ {t(`patient_detail.types.${session.type || 'individual'}`)}
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
                            <>
                              <button
                                onClick={() => handleEditSessionClick(session)}
                                className="p-1.5 text-text-muted hover:text-primary-custom hover:bg-bg rounded-md transition-colors"
                                title={t('session_action.edit_session')}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingSessionId(session.id);
                                  setShowDeleteModal(true);
                                }}
                                className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title={t('common.delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {session.notes && (
                                <button
                                  onClick={() => handleViewHistory(session)}
                                  className="p-1.5 text-text-muted hover:text-primary-custom hover:bg-bg rounded-md transition-colors"
                                  title={t('note_version.view_history', 'View Version History')}
                                >
                                  <History className="w-4 h-4" />
                                </button>
                              )}
                            </>
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
                                <RichTextRenderer
                                  content={session.notes}
                                  className="!bg-[#fafbfc]"
                                  style={{ fontSize: '14px' }}
                                />
                              )}
                              {session.attachments && session.attachments.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-border-custom">
                                  {session.attachments.map((att: any, idx: number) => (
                                    <a
                                      key={idx}
                                      href={att.url}
                                      download={att.name}
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
      )}

            <AnimatePresence>
        {showEditWarningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowEditWarningModal(false);
                setPendingEditSessionId(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            >
              <div className="mb-6">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
                  {t('sessions.edit_completed_warning_title')}
                </h2>
                <p className="text-text-muted text-[14px] text-center">
                  {t('sessions.edit_completed_warning_message')}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowEditWarningModal(false);
                    setPendingEditSessionId(null);
                  }}
                  className="btn-secondary"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={async () => {
                    if (user && pendingEditSessionId) {
                      await logEditCompleted(user.uid, pendingEditSessionId, pendingEditSessionId);
                    }
                    setEditingSessionId(pendingEditSessionId);
                    setShowEditWarningModal(false);
                    setPendingEditSessionId(null);
                  }}
                  className="btn-primary"
                >
                  {t('sessions.edit_completed_warning_confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

<AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            >
              <div className="mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
                  {t('sessions.delete_confirm_title', 'Delete Session')}
                </h2>
                <p className="text-text-muted text-[14px] text-center">
                  {t('sessions.delete_confirm_message', 'Are you sure you want to delete this session? This action cannot be undone.')}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleDeleteSession}
                  className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
                >
                  {t('common.delete', 'Delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowDeleteAllModal(false); setDeleteAllConfirmName(''); }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            >
              <div className="mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
                  {t('data_deletion.warning_title', 'Delete All Patient Data?')}
                </h2>
                <p className="text-text-muted text-[13px] text-center mb-4">
                  {t('data_deletion.confirm_description', "To confirm, type the patient's full name below:")}
                </p>
                <input
                  type="text"
                  className="input-field text-[14px]"
                  placeholder={t('data_deletion.confirm_placeholder', 'Type patient name to confirm')}
                  value={deleteAllConfirmName}
                  onChange={(e) => setDeleteAllConfirmName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowDeleteAllModal(false); setDeleteAllConfirmName(''); }}
                  className="btn-secondary"
                >
                  {t('data_deletion.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleDeleteAllPatientData}
                  disabled={deleteAllConfirmName !== patient?.name || deleteAllLoading}
                  className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 disabled:opacity-50"
                >
                  {deleteAllLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('data_deletion.delete_permanently', 'Delete Permanently')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVersionHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowVersionHistory(false);
                setSelectedSessionForHistory(null);
                setNoteVersions([]);
                setSelectedVersion(null);
                setDecryptedVersionNotes(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900">
                    {t('note_version.title', 'Note Version History')}
                  </h2>
                  <button
                    onClick={() => {
                      setShowVersionHistory(false);
                      setSelectedSessionForHistory(null);
                      setNoteVersions([]);
                      setSelectedVersion(null);
                      setDecryptedVersionNotes(null);
                    }}
                    className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface rounded-md transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {versionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-custom" />
                  <span className="ml-2 text-text-muted text-[14px]">{t('note_version.loading', 'Loading versions...')}</span>
                </div>
              ) : noteVersions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-10 h-10 text-border-custom mx-auto mb-3" />
                  <p className="text-text-muted text-[14px]">{t('note_version.no_versions', 'No version history available.')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {noteVersions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => handleSelectVersion(version)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedVersion?.id === version.id
                          ? 'border-primary-custom bg-primary-custom/5'
                          : 'border-border-custom hover:border-primary-custom/30 hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-text-main">
                          {t('note_version.version', 'Version')} {version.version}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          {format(new Date(version.createdAt), 'MMM d, yyyy HH:mm', { locale: dateLocale })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedVersion && (
                <div className="mt-4 pt-4 border-t border-border-custom">
                  <h3 className="text-[13px] font-bold text-text-main mb-2">
                    {t('note_version.version', 'Version')} {selectedVersion.version} — {t('note_version.created_at', 'Created At')}: {format(new Date(selectedVersion.createdAt), 'MMMM d, yyyy HH:mm', { locale: dateLocale })}
                  </h3>
                  {isUnlocked ? (
                    decryptedVersionNotes !== null ? (
                      <div className="bg-surface rounded-lg p-4 border border-border-custom">
                        <RichTextRenderer
                          content={decryptedVersionNotes}
                          className="!bg-transparent"
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary-custom" />
                      </div>
                    )
                  ) : (
                    <div className="bg-surface rounded-lg p-4 border border-border-custom text-center">
                      <Lock className="w-5 h-5 text-text-muted mx-auto mb-2" />
                      <p className="text-text-muted text-[13px]">{t('note_version.unlock_required', 'Unlock encryption to view version content.')}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end mt-4 pt-4 border-t border-border-custom">
                <button
                  onClick={() => {
                    setShowVersionHistory(false);
                    setSelectedSessionForHistory(null);
                    setNoteVersions([]);
                    setSelectedVersion(null);
                    setDecryptedVersionNotes(null);
                  }}
                  className="btn-secondary"
                >
                  {t('note_version.close', 'Close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
