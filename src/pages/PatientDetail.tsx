import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  FileText, 
  Plus,
  History,
  X,
  CheckCircle2,
  Edit3,
  Paperclip,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isPast } from 'date-fns';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import MDEditor from '@uiw/react-md-editor';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { NewSessionModal } from '../components/NewSessionModal';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user] = useAuthState(auth);
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [registeringSessionId, setRegisteringSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);
  const [sessionForm, setSessionForm] = useState({
    notes: '',
    type: 'individual',
    status: 'completed',
    attachments: [] as { name: string; url: string; size: number }[]
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editPatientForm, setEditPatientForm] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'Other',
    notes: '',
    address: {
      country: '',
      zipCode: '',
      city: '',
      state: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: ''
    },
    education: '',
    ethnicity: '',
    financialPlan: 'per_session',
    financialValue: '',
    anamnesis: {
      chiefComplaint: '',
      medicalHistory: '',
      psychiatricHistory: '',
      familyHistory: '',
      medications: '',
      substanceUse: ''
    }
  });

  useEffect(() => {
    if (!id || !user) return;

    const fetchPatient = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'patients', id));
        if (docSnap.exists()) {
          setPatient({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `patients/${id}`);
      }
    };

    fetchPatient();

    const q = query(
      collection(db, 'sessions'),
      where('patientId', '==', id),
      where('psychologistId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sessions'));

    return () => unsubscribe();
  }, [id, user]);

  useEffect(() => {
    if (isAddingSession && id) {
      localStorage.setItem(`draft_adding_${id}`, JSON.stringify(sessionForm));
    } else if (registeringSessionId) {
      localStorage.setItem(`draft_register_${registeringSessionId}`, JSON.stringify(sessionForm));
    } else if (editingSessionId) {
      localStorage.setItem(`draft_edit_${editingSessionId}`, JSON.stringify(sessionForm));
    }
  }, [sessionForm, isAddingSession, registeringSessionId, editingSessionId, id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetSessionId = editingSessionId || registeringSessionId || id; // Fallback to patient id directory if new session
    if (!file || !user || !targetSessionId) return;

    // 40MB limit
    if (file.size > 40 * 1024 * 1024) {
      alert('File size exceeds 40MB limit.');
      return;
    }

    try {
      setIsUploading(true);
      const storageRef = ref(storage, `sessions/${targetSessionId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      setSessionForm(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), { name: file.name, url, size: file.size }]
      }));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload file.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setSessionForm(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    try {
      await addDoc(collection(db, 'sessions'), {
        ...sessionForm,
        patientId: id,
        psychologistId: user.uid,
        date: new Date(),
        paymentStatus: 'pending',
        createdAt: new Date()
      });
      localStorage.removeItem(`draft_adding_${id}`);
      setIsAddingSession(false);
      setSessionForm({ notes: '', type: 'individual', status: 'completed', attachments: [] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessions');
    }
  };

  const handleUpdateSession = async (e: React.FormEvent, sessionId: string) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        notes: sessionForm.notes,
        status: sessionForm.status,
        type: sessionForm.type,
        attachments: sessionForm.attachments
      });
      
      if (editingSessionId === sessionId) localStorage.removeItem(`draft_edit_${sessionId}`);
      if (registeringSessionId === sessionId) localStorage.removeItem(`draft_register_${sessionId}`);
      
      setEditingSessionId(null);
      setRegisteringSessionId(null);
      setSessionForm({ notes: '', type: 'individual', status: 'completed', attachments: [] });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
    }
  };

  const handleEditPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    try {
      await updateDoc(doc(db, 'patients', id), {
        ...editPatientForm,
        updatedAt: new Date().toISOString()
      });
      setPatient({ ...patient, ...editPatientForm });
      setIsEditModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${id}`);
    }
  };

  const toggleSessionNotes = (sessionId: string) => {
    setExpandedSessions(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId) 
        : [...prev, sessionId]
    );
  };

  const cancelSession = async (session: any) => {
    try {
      await updateDoc(doc(db, 'sessions', session.id), {
        status: 'cancelled'
      });

      if (session.googleEventId) {
        const token = localStorage.getItem('google_oauth_token');
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

  const openRegisterForm = (session: any) => {
    const draft = localStorage.getItem(`draft_register_${session.id}`);
    if (draft) {
      try {
        setSessionForm(JSON.parse(draft));
      } catch (e) {
        setSessionForm({ notes: session.notes || '', type: session.type || 'individual', status: 'completed', attachments: session.attachments || [] });
      }
    } else {
      setSessionForm({
        notes: session.notes || '',
        type: session.type || 'individual',
        status: 'completed',
        attachments: session.attachments || []
      });
    }
    setRegisteringSessionId(session.id);
  };

  const openEditForm = (session: any) => {
    const draft = localStorage.getItem(`draft_edit_${session.id}`);
    if (draft) {
      try {
        setSessionForm(JSON.parse(draft));
      } catch (e) {
        setSessionForm({ notes: session.notes || '', type: session.type || 'individual', status: session.status, attachments: session.attachments || [] });
      }
    } else {
      setSessionForm({
        notes: session.notes || '',
        type: session.type || 'individual',
        status: session.status,
        attachments: session.attachments || []
      });
    }
    setEditingSessionId(session.id);
  };

  if (!patient) return null;

  const upcomingSessions = sessions.filter(s => s.status === 'scheduled' && !isPast(s.date?.toDate ? s.date.toDate() : new Date(s.date)));
  const pastSessions = sessions.filter(s => s.status !== 'scheduled' || isPast(s.date?.toDate ? s.date.toDate() : new Date(s.date)));

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/patients')}
            className="p-2 hover:bg-surface rounded-lg text-text-muted transition-colors border border-transparent hover:border-border-custom"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">{patient.name}</h1>
            <p className="text-text-muted text-[14px]">{t('patient_detail.id')}: {patient.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setEditPatientForm({
                name: patient.name || '',
                email: patient.email || '',
                phone: patient.phone || '',
                dateOfBirth: patient.dateOfBirth || '',
                gender: patient.gender || 'Other',
                notes: patient.notes || '',
                address: patient.address || {
                  country: '',
                  zipCode: '',
                  city: '',
                  state: '',
                  street: '',
                  number: '',
                  complement: '',
                  neighborhood: ''
                },
                education: patient.education || '',
                ethnicity: patient.ethnicity || '',
                financialPlan: patient.financialPlan || 'per_session',
                financialValue: patient.financialValue || '',
                anamnesis: patient.anamnesis || {
                  chiefComplaint: '',
                  medicalHistory: '',
                  psychiatricHistory: '',
                  familyHistory: '',
                  medications: '',
                  substanceUse: ''
                }
              });
              setIsEditModalOpen(true);
            }}
            className="btn-secondary flex items-center gap-2 text-[14px]"
          >
            <FileText className="w-4 h-4" />
            {t('patient_detail.edit_profile')}
          </button>
          <button 
            onClick={() => setIsScheduleModalOpen(true)}
            className="btn-secondary flex items-center gap-2 text-[14px]"
          >
            <Calendar className="w-4 h-4" />
            {t('calendar.schedule_session', 'Schedule Appointment')}
          </button>
          <button 
            onClick={() => {
              const draft = localStorage.getItem(`draft_adding_${id}`);
              if (draft) {
                try {
                  setSessionForm(JSON.parse(draft));
                } catch (e) {
                  setSessionForm({ notes: '', type: 'individual', status: 'completed', attachments: [] });
                }
              } else {
                setSessionForm({ notes: '', type: 'individual', status: 'completed', attachments: [] });
              }
              setIsAddingSession(true);
            }}
            className="btn-primary flex items-center gap-2 text-[14px]"
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
        patients={[patient].filter(Boolean)}
        preselectedPatientId={patient?.id}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <section className="card">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 bg-accent-custom border border-border-custom rounded-2xl flex items-center justify-center text-primary-custom font-bold text-3xl mb-4 shadow-sm">
                {patient.name.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-text-main">{patient.name}</h2>
              <p className="text-text-muted text-[13px] font-medium uppercase tracking-wider mt-1">{patient.gender} • {patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'yyyy') : 'N/A'}</p>
            </div>

            <div className="space-y-4 border-t border-border-custom pt-6">
              <div className="property-group">
                <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.email')}</p>
                <p className="text-[14px] font-medium text-text-main flex items-center gap-2">
                  <Mail className="w-4 h-4 text-text-muted" />
                  {patient.email || 'N/A'}
                </p>
              </div>
              <div className="property-group">
                <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.phone')}</p>
                <p className="text-[14px] font-medium text-text-main flex items-center gap-2">
                  <Phone className="w-4 h-4 text-text-muted" />
                  {patient.phone || 'N/A'}
                </p>
              </div>
              <div className="property-group">
                <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.dob')}</p>
                <p className="text-[14px] font-medium text-text-main flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  {patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'MMM d, yyyy') : 'N/A'}
                </p>
              </div>
            </div>

            {/* Address Section */}
            {patient.address && (patient.address.city || patient.address.state || patient.address.street) && (
              <div className="space-y-4 border-t border-border-custom pt-6 mt-6">
                <h3 className="text-[13px] font-bold text-text-main uppercase tracking-wider">{t('patients.address.title')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {patient.address.street && (
                    <div className="property-group col-span-2">
                      <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.address.street')}</p>
                      <p className="text-[14px] font-medium text-text-main">{patient.address.street}{patient.address.number ? `, ${patient.address.number}` : ''}</p>
                    </div>
                  )}
                  {patient.address.neighborhood && (
                    <div className="property-group">
                      <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.address.neighborhood')}</p>
                      <p className="text-[14px] font-medium text-text-main">{patient.address.neighborhood}</p>
                    </div>
                  )}
                  {patient.address.city && (
                    <div className="property-group">
                      <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.address.city')}</p>
                      <p className="text-[14px] font-medium text-text-main">{patient.address.city}{patient.address.state ? ` - ${patient.address.state}` : ''}</p>
                    </div>
                  )}
                  {patient.address.zipCode && (
                    <div className="property-group">
                      <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.address.zipCode')}</p>
                      <p className="text-[14px] font-medium text-text-main">{patient.address.zipCode}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Data Section */}
            {(patient.education || patient.ethnicity) && (
              <div className="space-y-4 border-t border-border-custom pt-6 mt-6">
                <h3 className="text-[13px] font-bold text-text-main uppercase tracking-wider">{t('patients.additional_data.title')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {patient.education && (
                    <div className="property-group">
                      <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.additional_data.education')}</p>
                      <p className="text-[14px] font-medium text-text-main">{t(`patients.additional_data.education_levels.${patient.education}`)}</p>
                    </div>
                  )}
                  {patient.ethnicity && (
                    <div className="property-group">
                      <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.additional_data.ethnicity')}</p>
                      <p className="text-[14px] font-medium text-text-main">{t(`patients.additional_data.ethnicities.${patient.ethnicity}`)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Financial Plan Section */}
            {patient.financialPlan && (
              <div className="space-y-4 border-t border-border-custom pt-6 mt-6">
                <h3 className="text-[13px] font-bold text-text-main uppercase tracking-wider">{t('patients.financial.title')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="property-group">
                    <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.financial.plan')}</p>
                    <p className="text-[14px] font-medium text-text-main">{t(`patients.financial.plans.${patient.financialPlan}`)}</p>
                  </div>
                  {(patient.financialPlan === 'per_session' || patient.financialPlan === 'monthly') && patient.financialValue && (
                    <div className="property-group">
                      <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">
                        {patient.financialPlan === 'per_session' ? t('patients.financial.session_value') : t('patients.financial.monthly_value')}
                      </p>
                      <p className="text-[14px] font-medium text-text-main">
                        {new Intl.NumberFormat(t('common.locale', 'pt-BR'), { style: 'currency', currency: 'BRL' }).format(Number(patient.financialValue))}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-2 space-y-6">
          
          {upcomingSessions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[18px] font-bold text-text-main mb-4">{t('dashboard.upcoming_appts')}</h2>
              <div className="space-y-3">
                {upcomingSessions.map(session => (
                  <div key={session.id} className="card p-4 flex items-center justify-between bg-accent-custom/50 border-primary-custom/20">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg border border-border-custom">
                        <Calendar className="w-4 h-4 text-primary-custom" />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-text-main">{format(session.date?.toDate ? session.date.toDate() : new Date(session.date), 'MMMM d, yyyy - HH:mm')}</p>
                        <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          1 hour • {t(`session_status.${session.status}`)}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => cancelSession(session)}
                      className="btn-secondary text-[12px] text-red-600 hover:bg-red-50 hover:border-red-200"
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
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card bg-accent-custom border-primary-custom/20"
            >
              <h3 className="text-[16px] font-bold text-text-main mb-6">{t('patient_detail.log_new_title')}</h3>
              <form onSubmit={handleAddSession} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('patient_detail.session_type')}</label>
                    <select 
                      className="input-field text-[14px]"
                      value={sessionForm.type}
                      onChange={(e) => setSessionForm({...sessionForm, type: e.target.value})}
                    >
                      <option value="individual">{t('patient_detail.types.individual')}</option>
                      <option value="group">{t('patient_detail.types.group')}</option>
                      <option value="family">{t('patient_detail.types.family')}</option>
                      <option value="couple">{t('patient_detail.types.couple')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('common.status')}</label>
                    <select 
                      className="input-field text-[14px]"
                      value={sessionForm.status}
                      onChange={(e) => setSessionForm({...sessionForm, status: e.target.value})}
                    >
                      <option value="completed">{t('session_status.completed')}</option>
                      <option value="no_show">{t('session_status.no_show')}</option>
                    </select>
                  </div>
                </div>
                <div data-color-mode="light">
                  <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                    {t('patient_detail.observations')}
                  </label>
                  <MDEditor
                    value={sessionForm.notes}
                    onChange={(val) => setSessionForm({...sessionForm, notes: val || ''})}
                    preview="edit"
                    height={300}
                    className="border border-border-custom rounded-xl overflow-hidden"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Attachments (Max 40MB)</label>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {sessionForm.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border-custom rounded-lg text-[12px]">
                        <Paperclip className="w-3.5 h-3.5 text-text-muted" />
                        <span className="font-medium text-text-main truncate max-w-[150px]">{att.name}</span>
                        <button 
                          type="button" 
                          onClick={() => removeAttachment(idx)}
                          className="ml-1 text-text-muted hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="btn-secondary cursor-pointer flex items-center gap-2">
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      {isUploading ? 'Uploading...' : 'Add File'}
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsAddingSession(false)}
                    className="btn-secondary text-[13px]"
                  >
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn-primary text-[13px]" disabled={isUploading}>
                    {t('patient_detail.save_record')}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          <div className="space-y-4">
            {pastSessions.length > 0 ? (
              pastSessions.map((session) => (
                <div key={session.id} className="card p-0 overflow-hidden bg-[#fafbfc] hover:border-primary-custom/20 transition-all">
                  {(editingSessionId === session.id || registeringSessionId === session.id) ? (
                    <div className="p-6 bg-white">
                      <h3 className="text-[16px] font-bold text-text-main mb-6">
                        {registeringSessionId === session.id ? t('session_action.register') : t('session_action.edit_notes')}
                      </h3>
                      <form onSubmit={(e) => handleUpdateSession(e, session.id)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('patient_detail.session_type')}</label>
                            <select 
                              className="input-field text-[14px]"
                              value={sessionForm.type}
                              onChange={(e) => setSessionForm({...sessionForm, type: e.target.value})}
                            >
                              <option value="individual">{t('patient_detail.types.individual')}</option>
                              <option value="group">{t('patient_detail.types.group')}</option>
                              <option value="family">{t('patient_detail.types.family')}</option>
                              <option value="couple">{t('patient_detail.types.couple')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('common.status')}</label>
                            <select 
                              className="input-field text-[14px]"
                              value={sessionForm.status}
                              onChange={(e) => setSessionForm({...sessionForm, status: e.target.value})}
                            >
                              <option value="completed">{t('session_status.completed')}</option>
                              <option value="no_show">{t('session_status.no_show')}</option>
                              <option value="cancelled">{t('session_status.cancelled')}</option>
                            </select>
                          </div>
                        </div>
                        <div data-color-mode="light">
                          <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                            {t('patient_detail.observations')}
                          </label>
                          <MDEditor
                            value={sessionForm.notes}
                            onChange={(val) => setSessionForm({...sessionForm, notes: val || ''})}
                            preview="edit"
                            height={300}
                            className="border border-border-custom rounded-xl overflow-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Attachments (Max 40MB)</label>
                          <div className="flex flex-wrap gap-3 mb-3">
                            {sessionForm.attachments.map((att, idx) => (
                              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border-custom rounded-lg text-[12px]">
                                <Paperclip className="w-3.5 h-3.5 text-text-muted" />
                                <span className="font-medium text-text-main truncate max-w-[150px]">{att.name}</span>
                                <button 
                                  type="button" 
                                  onClick={() => removeAttachment(idx)}
                                  className="ml-1 text-text-muted hover:text-red-500"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="btn-secondary cursor-pointer flex items-center gap-2">
                              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                              {isUploading ? 'Uploading...' : 'Add File'}
                              <input 
                                type="file" 
                                className="hidden" 
                                onChange={handleFileUpload}
                                disabled={isUploading}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setEditingSessionId(null);
                              setRegisteringSessionId(null);
                            }}
                            className="btn-secondary text-[13px]"
                          >
                            {t('common.cancel')}
                          </button>
                          <button type="submit" className="btn-primary text-[13px]" disabled={isUploading}>
                            {t('common.save')}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <>
                      <div className="px-6 py-4 bg-surface border-b border-border-custom flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-accent-custom rounded-lg border border-border-custom">
                            <FileText className="w-4 h-4 text-primary-custom" />
                          </div>
                          <div>
                            <p className="text-[14px] font-bold text-text-main">{format(session.date?.toDate ? session.date.toDate() : new Date(session.date), 'MMMM d, yyyy - HH:mm')}</p>
                            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              1 hour • {t(`patient_detail.types.${session.type || 'individual'}`)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
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
                              onClick={() => openRegisterForm(session)}
                              className="btn-primary py-1 px-3 text-[12px]"
                            >
                              {t('session_action.register')}
                            </button>
                          ) : (
                            <button 
                              onClick={() => openEditForm(session)}
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
                                  <MDEditor.Markdown source={session.notes} className="!bg-[#fafbfc]" style={{ fontSize: '14px' }} />
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
                                      className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border-custom rounded-lg text-[12px] hover:bg-bg transition-colors"
                                    >
                                      <Paperclip className="w-3.5 h-3.5 text-text-muted" />
                                      <span className="font-medium text-text-main truncate max-w-[150px]">{att.name}</span>
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
              <div className="text-center py-20 bg-bg rounded-2xl border border-dashed border-border-custom">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <History className="text-text-muted w-8 h-8 opacity-40" />
                </div>
                <h3 className="text-[16px] font-bold text-text-main">{t('patient_detail.no_records')}</h3>
                <p className="text-text-muted text-[14px] mt-1">{t('patient_detail.no_records_hint', { name: patient.name })}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{t('patient_detail.edit_profile')}</h2>
              <form onSubmit={handleEditPatient} className="space-y-6">
                
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">Informações Básicas</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.full_name')} *</label>
                    <input 
                      required
                      type="text" 
                      className="input-field" 
                      value={editPatientForm.name}
                      onChange={(e) => setEditPatientForm({...editPatientForm, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.email')}</label>
                      <input 
                        type="email" 
                        className="input-field" 
                        value={editPatientForm.email}
                        onChange={(e) => setEditPatientForm({...editPatientForm, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.phone')}</label>
                      <input 
                        type="tel" 
                        className="input-field" 
                        value={editPatientForm.phone}
                        onChange={(e) => setEditPatientForm({...editPatientForm, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.dob')}</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={editPatientForm.dateOfBirth}
                        onChange={(e) => setEditPatientForm({...editPatientForm, dateOfBirth: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.gender')}</label>
                      <select 
                        className="input-field"
                        value={editPatientForm.gender}
                        onChange={(e) => setEditPatientForm({...editPatientForm, gender: e.target.value})}
                      >
                        <option value="Male">{t('patients.genders.male')}</option>
                        <option value="Female">{t('patients.genders.female')}</option>
                        <option value="Non-binary">{t('patients.genders.non_binary')}</option>
                        <option value="Other">{t('patients.genders.other')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('patients.address.title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.country')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={editPatientForm.address?.country || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, address: {...editPatientForm.address, country: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.zipCode')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={editPatientForm.address?.zipCode || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                          setEditPatientForm({...editPatientForm, address: {...editPatientForm.address, zipCode: val}});
                        }}
                        placeholder="00000000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.state')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={editPatientForm.address?.state || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, address: {...editPatientForm.address, state: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.city')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={editPatientForm.address?.city || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, address: {...editPatientForm.address, city: e.target.value}})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.neighborhood')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={editPatientForm.address?.neighborhood || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, address: {...editPatientForm.address, neighborhood: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.street')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={editPatientForm.address?.street || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, address: {...editPatientForm.address, street: e.target.value}})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.number')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={editPatientForm.address?.number || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, address: {...editPatientForm.address, number: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.complement')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={editPatientForm.address?.complement || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, address: {...editPatientForm.address, complement: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Data */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('patients.additional_data.title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.additional_data.education')}</label>
                      <select 
                        className="input-field"
                        value={editPatientForm.education || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, education: e.target.value})}
                      >
                        <option value="">Selecione...</option>
                        <option value="infantil">{t('patients.additional_data.education_levels.infantil')}</option>
                        <option value="fundamental_inc">{t('patients.additional_data.education_levels.fundamental_inc')}</option>
                        <option value="fundamental_comp">{t('patients.additional_data.education_levels.fundamental_comp')}</option>
                        <option value="medio_inc">{t('patients.additional_data.education_levels.medio_inc')}</option>
                        <option value="medio_comp">{t('patients.additional_data.education_levels.medio_comp')}</option>
                        <option value="superior_inc">{t('patients.additional_data.education_levels.superior_inc')}</option>
                        <option value="superior_comp">{t('patients.additional_data.education_levels.superior_comp')}</option>
                        <option value="pos_grad">{t('patients.additional_data.education_levels.pos_grad')}</option>
                        <option value="mestrado">{t('patients.additional_data.education_levels.mestrado')}</option>
                        <option value="doutorado">{t('patients.additional_data.education_levels.doutorado')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.additional_data.ethnicity')}</label>
                      <select 
                        className="input-field"
                        value={editPatientForm.ethnicity || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, ethnicity: e.target.value})}
                      >
                        <option value="">Selecione...</option>
                        <option value="branco">{t('patients.additional_data.ethnicities.branco')}</option>
                        <option value="preto">{t('patients.additional_data.ethnicities.preto')}</option>
                        <option value="pardo">{t('patients.additional_data.ethnicities.pardo')}</option>
                        <option value="indigena">{t('patients.additional_data.ethnicities.indigena')}</option>
                        <option value="amarelo">{t('patients.additional_data.ethnicities.amarelo')}</option>
                        <option value="outro">{t('patients.additional_data.ethnicities.outro')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Financial Plan */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('patients.financial.title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.financial.plan')}</label>
                      <select 
                        className="input-field"
                        value={editPatientForm.financialPlan || 'per_session'}
                        onChange={(e) => setEditPatientForm({...editPatientForm, financialPlan: e.target.value})}
                      >
                        <option value="per_session">{t('patients.financial.plans.per_session')}</option>
                        <option value="monthly">{t('patients.financial.plans.monthly')}</option>
                        <option value="health_insurance">{t('patients.financial.plans.health_insurance')}</option>
                        <option value="exempt">{t('patients.financial.plans.exempt')}</option>
                      </select>
                    </div>
                    {(editPatientForm.financialPlan === 'per_session' || editPatientForm.financialPlan === 'monthly') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {editPatientForm.financialPlan === 'per_session' ? t('patients.financial.session_value') : t('patients.financial.monthly_value')}
                        </label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="input-field" 
                          value={editPatientForm.financialValue || ''}
                          onChange={(e) => setEditPatientForm({...editPatientForm, financialValue: e.target.value})}
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Anamnesis */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('anamnesis.title')}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.chief_complaint')}</label>
                      <textarea 
                        className="input-field h-20 resize-none" 
                        value={editPatientForm.anamnesis?.chiefComplaint || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, anamnesis: {...editPatientForm.anamnesis, chiefComplaint: e.target.value}})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.medical_history')}</label>
                        <textarea 
                          className="input-field h-20 resize-none" 
                          value={editPatientForm.anamnesis?.medicalHistory || ''}
                          onChange={(e) => setEditPatientForm({...editPatientForm, anamnesis: {...editPatientForm.anamnesis, medicalHistory: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.psychiatric_history')}</label>
                        <textarea 
                          className="input-field h-20 resize-none" 
                          value={editPatientForm.anamnesis?.psychiatricHistory || ''}
                          onChange={(e) => setEditPatientForm({...editPatientForm, anamnesis: {...editPatientForm.anamnesis, psychiatricHistory: e.target.value}})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.family_history')}</label>
                        <textarea 
                          className="input-field h-20 resize-none" 
                          value={editPatientForm.anamnesis?.familyHistory || ''}
                          onChange={(e) => setEditPatientForm({...editPatientForm, anamnesis: {...editPatientForm.anamnesis, familyHistory: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.medications')}</label>
                        <textarea 
                          className="input-field h-20 resize-none" 
                          value={editPatientForm.anamnesis?.medications || ''}
                          onChange={(e) => setEditPatientForm({...editPatientForm, anamnesis: {...editPatientForm.anamnesis, medications: e.target.value}})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.substance_use')}</label>
                      <textarea 
                        className="input-field h-20 resize-none" 
                        value={editPatientForm.anamnesis?.substanceUse || ''}
                        onChange={(e) => setEditPatientForm({...editPatientForm, anamnesis: {...editPatientForm.anamnesis, substanceUse: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.notes')}</label>
                  <textarea 
                    className="input-field h-24 resize-none" 
                    value={editPatientForm.notes}
                    onChange={(e) => setEditPatientForm({...editPatientForm, notes: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 btn-secondary"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
