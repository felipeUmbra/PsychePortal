import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  User, 
  Mail, 
  Award, 
  BookOpen, 
  Save,
  CheckCircle2,
  CalendarDays,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Papa from 'papaparse';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function Settings() {
  const [user] = useAuthState(auth);
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportOption, setExportOption] = useState('all_patients_period');
  const [isExporting, setIsExporting] = useState(false);
  
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [isReauthorizingDrive, setIsReauthorizingDrive] = useState(false);
  
  const googleCalendarToken = localStorage.getItem('google_calendar_token');

  const handleConnectCalendar = async () => {
    if (isConnectingCalendar) return;
    setIsConnectingCalendar(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_calendar_token', credential.accessToken);
        // Also update health check for drive
        localStorage.setItem('google_oauth_token', credential.accessToken);
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Calendar connect failed', err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        alert(t('settings.calendar_error', 'Failed to connect to Google Calendar.'));
      }
    } finally {
      setIsConnectingCalendar(false);
    }
  };

  const handleReauthorizeDrive = async () => {
    if (isReauthorizingDrive) return;
    setIsReauthorizingDrive(true);
    try {
      localStorage.removeItem('google_oauth_token');
      const { googleScopes } = await import('./Login');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'consent' });
      googleScopes.forEach(scope => provider.addScope(scope));
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_oauth_token', credential.accessToken);
        setProfile(null);
        const mock = await import('firebase/firestore') as any;
        if (mock.forceSync) {
          await mock.forceSync();
          await fetchProfile();
        } else {
          window.location.reload();
        }
        alert(t('settings.reauth_success', 'Drive re-authorization complete!'));
      }
    } catch (err: any) {
      console.error('Re-auth failed', err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        alert(t('settings.reauth_error', 'Drive re-authorization failed.'));
      }
    } finally {
      setIsReauthorizingDrive(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const docRef = doc(db, 'psychologists', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      } else {
        // If profile doesn't exist in mock, create it automatically
        const newProfile = {
          id: user.uid,
          name: user.displayName || 'New Psychologist',
          email: user.email,
          specialization: [],
          bio: '',
          avatarUrl: user.photoURL || '',
          createdAt: new Date().toISOString()
        };
        // Use setDoc for initial creation in mock
        const mock = await import('firebase/firestore') as any;
        const mockSetDoc = mock.setDoc;
        await mockSetDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Fallback profile to prevent blank screen
      setProfile({
        id: user.uid,
        name: user.displayName || 'Psychologist',
        email: user.email,
        specialization: [],
        bio: '',
        avatarUrl: user.photoURL || ''
      });
      handleFirestoreError(error, OperationType.GET, `psychologists/${user.uid}`);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'psychologists', user.uid), {
        ...profile,
        updatedAt: new Date().toISOString()
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `psychologists/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsExporting(true);

    try {
      const qPatients = query(collection(db, 'patients'), where('psychologistId', '==', user.uid));
      const patientsSnapshot = await getDocs(qPatients);
      const allPatients = patientsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      let exportData: any[] = [];
      const startDate = exportStartDate ? new Date(exportStartDate).getTime() : 0;
      const endDate = exportEndDate ? new Date(exportEndDate).getTime() : Infinity;

      if (exportOption === 'all_patients_period') {
        exportData = allPatients.filter(p => {
          const createdAt = new Date(p.createdAt || Date.now()).getTime();
          return createdAt >= startDate && createdAt <= endDate;
        }).map(p => ({
          [t('patients.full_name', 'Nome')]: p.name,
          [t('patients.email', 'E-mail')]: p.email,
          [t('patients.phone', 'Telefone')]: p.phone,
          [t('patients.dob', 'Nascimento')]: p.dateOfBirth,
          [t('patients.gender', 'Gênero')]: p.gender,
          [t('common.date', 'Data de Cadastro')]: p.createdAt
        }));
      } else if (exportOption === 'patient_info') {
        exportData = allPatients.map(p => ({
          [t('patients.full_name', 'Nome')]: p.name,
          [t('patients.email', 'E-mail')]: p.email,
          [t('patients.phone', 'Telefone')]: p.phone,
          [t('patients.dob', 'Nascimento')]: p.dateOfBirth,
          [t('patients.gender', 'Gênero')]: p.gender,
          [t('patients.address', 'Endereço')]: `${p.address?.street || ''}, ${p.address?.city || ''}`,
          [t('patients.financial_plan', 'Plano Financeiro')]: p.financialPlan,
          [t('patients.education', 'Escolaridade')]: p.education
        }));
      } else if (exportOption === 'patient_info_sessions') {
        const qSessions = query(collection(db, 'sessions'), where('psychologistId', '==', user.uid));
        const sessionsSnapshot = await getDocs(qSessions);
        const allSessions = sessionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

        allPatients.forEach(p => {
          const patientSessions = allSessions.filter(s => {
             const sDateObj = s.date?.toDate ? s.date.toDate() : new Date(s.date);
             const sTime = sDateObj.getTime();
             return s.patientId === p.id && sTime >= startDate && sTime <= endDate;
          });
          patientSessions.forEach(s => {
            exportData.push({
              [t('patients.full_name', 'Paciente')]: p.name,
              [t('patients.email', 'E-mail')]: p.email,
              [t('common.date', 'Data da Sessão')]: format(s.date?.toDate ? s.date.toDate() : new Date(s.date), 'yyyy-MM-dd HH:mm'),
              [t('common.status', 'Status da Sessão')]: t(`session_status.${s.status}`, s.status),
              [t('sessions.type', 'Tipo')]: t(`session_types.${s.type}`, s.type),
              [t('sessions.payment_status', 'Status Financeiro')]: s.paymentStatus
            });
          });
        });
      }

      if (exportData.length === 0) {
        alert(t('settings.no_export_data', 'Nenhum dado encontrado para as opções selecionadas.'));
        setIsExporting(false);
        return;
      }

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `export_${exportOption}_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Export failed', error);
      alert(t('settings.export_failed', 'Falha ao exportar os dados'));
    } finally {
      setIsExporting(false);
    }
  };

  if (!user) return (
    <div className="flex items-center justify-center p-20">
      <div className="w-8 h-8 border-4 border-primary-custom/30 border-t-primary-custom rounded-full animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="max-w-4xl mx-auto space-y-8 animate-pulse p-10">
      <div className="h-8 bg-slate-200 rounded w-1/4" />
      <div className="h-40 bg-slate-100 rounded-3xl" />
      <div className="h-40 bg-slate-100 rounded-3xl" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('settings.title')}</h1>
        <p className="text-text-muted text-[14px]">{t('settings.subtitle')}</p>
      </header>

      <form onSubmit={handleSave} className="space-y-8">
        <section className="card">
          <h2 className="text-[16px] font-bold text-text-main mb-8 flex items-center gap-2 border-b border-border-custom pb-4">
            <User className="w-5 h-5 text-primary-custom" />
            {t('settings.profile_section')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.full_name')}</label>
                <input 
                  type="text" 
                  className="input-field text-[14px]" 
                  value={profile.name}
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                  <input 
                    disabled
                    type="email" 
                    className="input-field pl-10 bg-bg cursor-not-allowed text-[14px]" 
                    value={profile.email}
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-2 font-medium">{t('settings.email_hint')}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-8 bg-bg rounded-2xl border border-dashed border-border-custom">
              <div className="w-24 h-24 bg-accent-custom border border-border-custom rounded-3xl flex items-center justify-center text-primary-custom font-bold text-3xl mb-4 overflow-hidden shadow-sm">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  profile.name.charAt(0)
                )}
              </div>
              <button type="button" className="text-[13px] font-bold text-primary-custom hover:underline">{t('settings.change_photo')}</button>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="text-[16px] font-bold text-text-main mb-8 flex items-center gap-2 border-b border-border-custom pb-4">
            <Award className="w-5 h-5 text-primary-custom" />
            {t('settings.expertise_section')}
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.specializations')}</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-3 text-text-muted w-4 h-4" />
                <textarea 
                  className="input-field pl-10 h-24 resize-none text-[14px] leading-relaxed" 
                  placeholder={t('settings.specializations_placeholder')}
                  value={Array.isArray(profile.specialization) ? profile.specialization.join(', ') : ''}
                  onChange={(e) => setProfile({...profile, specialization: e.target.value.split(',').map(s => s.trim())})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.bio')}</label>
              <textarea 
                className="input-field h-40 resize-none text-[14px] leading-relaxed" 
                placeholder={t('settings.bio_placeholder')}
                value={profile.bio}
                onChange={(e) => setProfile({...profile, bio: e.target.value})}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="text-[16px] font-bold text-text-main mb-8 flex items-center gap-2 border-b border-border-custom pb-4">
            <CalendarDays className="w-5 h-5 text-primary-custom" />
            {t('settings.integrations', 'Integrações')}
          </h2>
          
          <div className="flex items-center justify-between p-4 bg-surface border border-border-custom rounded-xl">
            <div>
              <h3 className="font-bold text-text-main text-[14px]">Google Calendar</h3>
              <p className="text-text-muted text-[13px] mt-1">
                {t('settings.calendar_sync_desc', 'Sync your clinical sessions with Google Calendar.')}
              </p>
            </div>
            <div>
              {googleCalendarToken ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success-custom/10 text-success-custom rounded-lg text-[13px] font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('settings.connected', 'Connected')}
                </span>
              ) : (
                <button 
                  type="button"
                  onClick={handleConnectCalendar}
                  disabled={isConnectingCalendar}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-custom text-white hover:bg-primary-custom/90 transition-colors rounded-lg text-[13px] font-bold disabled:opacity-50"
                >
                  {isConnectingCalendar ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings.connect', 'Connect')}
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-surface border border-border-custom rounded-xl mt-4">
            <div>
              <h3 className="font-bold text-text-main text-[14px]">Google Drive (Persistência)</h3>
              <p className="text-text-muted text-[13px] mt-1">
                {t('settings.drive_sync_desc', 'Sincroniza seus dados com uma pasta oculta no seu Google Drive.')}
              </p>
            </div>
            <div className="flex items-center gap-3">
               <button 
                  type="button"
                  onClick={async () => {
                    setProfile(null);
                    const mock = await import('firebase/firestore') as any;
                    if (mock.forceSync) {
                      await mock.forceSync();
                      await fetchProfile();
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="btn-secondary text-[12px] h-9"
               >
                 {t('settings.force_reload', 'Forçar Recarregamento')}
               </button>
                <button 
                  type="button"
                  onClick={handleReauthorizeDrive}
                  disabled={isReauthorizingDrive}
                  className="btn-primary text-[12px] h-9 min-w-[120px] flex items-center justify-center"
                >
                  {isReauthorizingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings.reauthorize_drive', 'Re-autorizar Drive')}
                </button>
            </div>

          </div>
        </section>

        <section className="card">
          <h2 className="text-[16px] font-bold text-text-main mb-8 flex items-center gap-2 border-b border-border-custom pb-4">
            <Save className="w-5 h-5 text-primary-custom" />
            {t('settings.export_data')}
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.start_date')}</label>
                <input 
                  type="date"
                  className="input-field text-[14px]"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.end_date')}</label>
                <input 
                  type="date"
                  className="input-field text-[14px]"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                />
              </div>
            </div>

            <div>
               <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.export_options', 'Opções de Exportação')}</label>
               <select 
                 className="input-field text-[14px]"
                 value={exportOption}
                 onChange={(e) => setExportOption(e.target.value)}
               >
                 <option value="all_patients_period">{t('settings.export_all_patients_period')}</option>
                 <option value="patient_info">{t('settings.export_patient_info')}</option>
                 <option value="patient_info_sessions">{t('settings.export_patient_info_session')}</option>
               </select>
            </div>

            <div className="flex justify-end pt-2">
               <button 
                 type="button" 
                 onClick={handleExportData}
                 disabled={isExporting}
                 className="btn-secondary flex items-center gap-2 text-[14px]"
               >
                 {isExporting ? <div className="w-4 h-4 border-2 border-primary-custom/30 border-t-primary-custom rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                 {t('settings.export_button', 'Export CSV')}
               </button>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-success-custom font-bold text-[13px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t('settings.save_success')}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <button 
            type="submit" 
            disabled={isSaving}
            className="btn-primary flex items-center gap-2 min-w-[160px] justify-center text-[14px]"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('settings.save_button')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
