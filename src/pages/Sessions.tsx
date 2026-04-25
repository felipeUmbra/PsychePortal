import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  History, 
  Search, 
  Filter,
  FileText,
  Calendar,
  Clock,
  User,
  ChevronRight,
  Edit3,
  X,
  Paperclip,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import MDEditor from '@uiw/react-md-editor';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';

export default function Sessions() {
  const [user] = useAuthState(auth);
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<string[]>([]);
  
  const [sessionForm, setSessionForm] = useState({
    notes: '',
    type: 'individual',
    status: 'completed',
    attachments: [] as { name: string; url: string; size: number }[]
  });

  const toggleSessionNotes = (sessionId: string) => {
    setExpandedSessions(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId) 
        : [...prev, sessionId]
    );
  };

  useEffect(() => {
    if (!user) return;

    // Fetch patients to map IDs to names
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

    const q = query(
      collection(db, 'sessions'),
      where('psychologistId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sessions'));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (editingSessionId) {
      localStorage.setItem(`draft_edit_${editingSessionId}`, JSON.stringify(sessionForm));
    }
  }, [sessionForm, editingSessionId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !editingSessionId) return;

    // 40MB limit
    if (file.size > 40 * 1024 * 1024) {
      alert('File size exceeds 40MB limit.');
      return;
    }

    try {
      setIsUploading(true);
      const storageRef = ref(storage, `sessions/${editingSessionId}/${file.name}`);
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
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleEditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSessionId) return;

    try {
      const session = sessions.find(s => s.id === editingSessionId);
      
      await updateDoc(doc(db, 'sessions', editingSessionId), {
        notes: sessionForm.notes,
        type: sessionForm.type,
        status: sessionForm.status,
        attachments: sessionForm.attachments
      });

      // Handle cancel event in google calendar if status changed to cancelled explicitly here
      if (session && session.status !== 'cancelled' && sessionForm.status === 'cancelled' && session.googleEventId) {
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

      localStorage.removeItem(`draft_edit_${editingSessionId}`);
      setEditingSessionId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${editingSessionId}`);
    }
  };

  const openEditForm = (session: any) => {
    const draft = localStorage.getItem(`draft_edit_${session.id}`);
    if (draft) {
      try {
        setSessionForm(JSON.parse(draft));
      } catch (e) {
        setSessionForm({ notes: session.notes || '', type: session.type || 'individual', status: session.status || 'completed', attachments: session.attachments || [] });
      }
    } else {
      setSessionForm({
        notes: session.notes || '',
        type: session.type || 'individual',
        status: session.status || 'completed',
        attachments: session.attachments || []
      });
    }
    setEditingSessionId(session.id);
  };

  const filteredSessions = sessions.filter(s => {
    if (s.status === 'scheduled') return false; // Hide future scheduled sessions
    const patientName = patients[s.patientId]?.name || '';
    const notes = s.notes || '';
    return patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           notes.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('sessions.title')}</h1>
        <p className="text-text-muted text-[14px]">{t('sessions.subtitle')}</p>
      </header>

      <div className="flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('sessions.search_placeholder')}
            className="input-field pl-10 text-[14px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-secondary flex items-center gap-2 text-[14px]">
          <Filter className="w-4 h-4" />
          {t('patients.filters')}
        </button>
      </div>

      <div className="space-y-4">
        {filteredSessions.map((session, i) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-0 overflow-hidden bg-[#fafbfc] hover:border-primary-custom/20 transition-all group"
          >
            <div className="px-6 py-4 bg-surface border-b border-border-custom flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent-custom border border-border-custom rounded-lg flex items-center justify-center text-primary-custom font-bold">
                  {patients[session.patientId]?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-text-main">{patients[session.patientId]?.name || 'Unknown Patient'}</span>
                    <span className="text-border-custom">•</span>
                    <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">{t(`patient_detail.types.${session.type || 'individual'}`)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted font-bold uppercase tracking-wider mt-0.5">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {format(session.date?.toDate ? session.date.toDate() : new Date(session.date), 'MMM d, yyyy - HH:mm')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      1 hour
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={cn(
                  "status-badge",
                  session.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                  session.status === 'no_show' ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
                )}>
                  {t(`session_status.${session.status}`)}
                </span>
                <button 
                  onClick={() => openEditForm(session)}
                  className="btn-secondary py-1.5 px-3 text-[12px] flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {t('common.edit')}
                </button>
                <Link 
                  to={`/patients/${session.patientId}`}
                  className="btn-secondary py-1.5 px-4 text-[12px] flex items-center gap-1.5 group-hover:bg-primary-custom group-hover:text-white group-hover:border-primary-custom transition-all"
                >
                  {t('sessions.view_patient')}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
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
          </motion.div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="text-center py-24 bg-bg rounded-2xl border border-dashed border-border-custom">
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <History className="text-text-muted w-8 h-8 opacity-30" />
            </div>
            <h3 className="text-[16px] font-bold text-text-main">{t('sessions.no_sessions')}</h3>
            <p className="text-text-muted text-[14px] mt-1">{t('sessions.no_sessions_hint')}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingSessionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSessionId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">{t('session_action.edit_notes')}</h2>
                <button onClick={() => setEditingSessionId(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleEditSession} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('patient_detail.session_type')}</label>
                    <select 
                      className="input-field"
                      value={sessionForm.type}
                      onChange={(e) => setSessionForm({...sessionForm, type: e.target.value})}
                    >
                      <option value="individual">{t('patient_detail.types.individual')}</option>
                      <option value="couples">{t('patient_detail.types.couples')}</option>
                      <option value="family">{t('patient_detail.types.family')}</option>
                      <option value="group">{t('patient_detail.types.group')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('patient_detail.status')}</label>
                    <select 
                      className="input-field"
                      value={sessionForm.status}
                      onChange={(e) => setSessionForm({...sessionForm, status: e.target.value})}
                    >
                      <option value="completed">{t('session_status.completed')}</option>
                      <option value="no_show">{t('session_status.no_show')}</option>
                      <option value="scheduled">{t('session_status.scheduled')}</option>
                    </select>
                  </div>
                </div>
                
                <div data-color-mode="light">
                  <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('patient_detail.observations')}</label>
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

                <div className="flex gap-3 pt-4 border-t border-border-custom">
                  <button 
                    type="button"
                    onClick={() => setEditingSessionId(null)}
                    className="flex-1 btn-secondary"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary"
                    disabled={isUploading}
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
