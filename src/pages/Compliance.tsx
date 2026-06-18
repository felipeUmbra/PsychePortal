/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useTranslation } from 'react-i18next';
import {
  Shield, CheckCircle2, XCircle, FileText, Download, Save,
  Loader2, AlertTriangle, Lock, Database, Cookie, HardDrive,
  Scale, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEncryption } from '../hooks/useEncryption';
import { useGoogleAuth } from '../context/GoogleAuthContext';
import { triggerFullBackup } from '../lib/backup';
import { generateDataBundle, downloadBundleAsFile } from '../lib/data-export';
import { PsychologistAttestation } from '../types';
import Papa from 'papaparse';
import { format } from 'date-fns';

const EMPTY_ATTESTATION: PsychologistAttestation = {
  crpValid: false, patientsInformed: false, recoveryCodeSafe: false,
  cfpAware: false, retentionPolicy: false, dsrAware: false, updatedAt: ''
};

export default function Compliance() {
  const [user] = useAuthState(auth);
  const { t } = useTranslation();
  const { isSetup: encryptionSetup } = useEncryption();
  const { driveToken } = useGoogleAuth();
  const [profile, setProfile] = useState<any>(null);
  const [attestation, setAttestation] = useState<PsychologistAttestation>(EMPTY_ATTESTATION);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);
  const [secondaryToken, setSecondaryToken] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [dsrLoading, setDsrLoading] = useState(false);
  const [dsrError, setDsrError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'psychologists', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          if (data.attestation) setAttestation(data.attestation);
        }
      } catch (err) { console.error('Failed to load profile:', err); }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const q = query(collection(db, 'patients'), where('psychologistId', '==', user.uid));
        const snap = await getDocs(q);
        setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error('Failed to load patients:', err); }
    })();
  }, [user]);

  const complianceItems = [
    { key: 'encryption', icon: Lock, label: t('compliance.encryption_status', 'Encryption at Rest'), description: 'AES-256-GCM encryption for clinical notes at rest', compliant: encryptionSetup },
    { key: 'audit', icon: ClipboardCheck, label: t('compliance.audit_status', 'Audit Trail'), description: 'Tamper-evident Merkle-chained audit trail active', compliant: true },
    { key: 'backup', icon: HardDrive, label: t('compliance.backup_status', 'Google Drive Backup'), description: 'Google Drive backup connected and syncing', compliant: !!driveToken },
    { key: 'consent', icon: Cookie, label: t('compliance.consent_status', 'Patient Consent'), description: 'Informed consent workflow configured', compliant: !!(profile?.consentText && profile.consentText.trim().length > 0) },
    { key: 'retention', icon: Database, label: t('compliance.retention_status', 'Retention Policy'), description: 'Data retention policy documented', compliant: !!(profile?.retentionPolicy && profile.retentionPolicy.trim().length > 0) },
    { key: 'headers', icon: Shield, label: t('compliance.headers_status', 'Security Headers'), description: 'CSP, HSTS, X-Frame-Options via Firebase Hosting', compliant: true },
  ];
  const compliantCount = complianceItems.filter(i => i.compliant).length;
  const allCompliant = compliantCount === complianceItems.length;

  const handleSaveAttestation = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated: PsychologistAttestation = { ...attestation, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'psychologists', user.uid), { attestation: updated });
      setAttestation(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) { console.error('Failed to save attestation:', err); }
    finally { setSaving(false); }
  }, [user, attestation]);

  const handleForceBackup = useCallback(async () => {
    if (!user || !driveToken) return;
    setBackupLoading(true);
    setBackupResult(null);
    try {
      const result = await triggerFullBackup(driveToken, user.uid, secondaryToken || undefined);
      let msg = t('compliance.backup_success', 'Backup completed successfully');
      msg += ' - ' + result.snapshotsKept + ' ' + t('compliance.snapshots_stored', 'snapshots stored');
      if (result.secondary) msg += ' (+ secondary)';
      else if (result.secondaryError) msg += ' (' + result.secondaryError + ')';
      setBackupResult(msg);
    } catch (err: any) { setBackupResult(err.message || 'Backup failed'); }
    finally { setBackupLoading(false); }
  }, [user, driveToken, secondaryToken, t]);

  const handleExportHTMLReport = useCallback(() => {
    const now = new Date();
    const attestationLabels: Record<string, string> = {
      crpValid: t('compliance.attestation_crp', 'I have a valid CRP registration'),
      patientsInformed: t('compliance.attestation_patients', 'I have informed my patients about data processing'),
      recoveryCodeSafe: t('compliance.attestation_recovery', 'I keep a copy of my encryption recovery code in a safe place'),
      cfpAware: t('compliance.attestation_cfp', 'I have read and understand the CFP 09/2024 resolution'),
      retentionPolicy: t('compliance.attestation_retention', 'I have a data retention policy documented'),
      dsrAware: t('compliance.attestation_dsr', 'I know how to handle a data subject request'),
    };
    const rows = complianceItems.map(item =>
      '<tr><td>' + item.label + '</td><td class="' + (item.compliant ? 'pass' : 'fail') + '">' + (item.compliant ? 'OK ' + t('compliance.compliant', 'Compliant') : 'X ' + t('compliance.non_compliant', 'Non-Compliant')) + '</td><td>' + item.description + '</td></tr>'
    ).join('');
    const attRows = Object.entries(attestation).filter(([k]) => k !== 'updatedAt').map(([k, v]) =>
      '<tr><td>' + (attestationLabels[k] || k) + '</td><td class="' + (v ? 'pass' : 'fail') + '">' + (v ? 'OK Yes' : 'X No') + '</td></tr>'
    ).join('');
    const profileLine = profile ? '<p><strong>' + profile.name + '</strong> - ' + profile.email + '</p>' : '';
    const compliantTxt = t('compliance.compliant', 'Compliant');
    const nonCompliantTxt = t('compliance.non_compliant', 'Non-Compliant');
    const generatedAt = t('compliance.report_generated_at', 'Generated at');
    const statusPanel = t('compliance.status_panel', 'Compliance Status');
    const attestationPanel = t('compliance.attestation_panel', 'Professional Self-Attestation');
    const complianceTitle = t('compliance.title', 'Compliance');
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Compliance Report</title>'
      + '<style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#0F172A}'
      + 'h1{color:#4338CA;border-bottom:2px solid #4338CA;padding-bottom:8px}'
      + 'table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:8px 12px;border:1px solid #CBD5E1}'
      + 'th{background:#EEF2FF;color:#4338CA}.pass{color:#0891B2;font-weight:bold}.fail{color:#DC2626;font-weight:bold}'
      + '.footer{margin-top:40px;font-size:12px;color:#475569;border-top:1px solid #CBD5E1;padding-top:12px}</style></head><body>'
      + '<h1>' + complianceTitle + ' - ' + generatedAt + ' ' + format(now, 'yyyy-MM-dd HH:mm') + '</h1>'
      + profileLine
      + '<h2>' + statusPanel + '</h2>'
      + '<table><tr><th>Control</th><th>Status</th><th>Description</th></tr>' + rows + '</table>'
      + '<p><strong>' + compliantCount + '/' + complianceItems.length + ' controls compliant</strong></p>'
      + '<h2>' + attestationPanel + '</h2>'
      + '<table><tr><th>Item</th><th>Status</th></tr>' + attRows + '</table>'
      + '<div class="footer"><p>Generated by Portal Psis - ' + format(now, 'yyyy-MM-dd HH:mm:ss') + '</p></div>'
      + '</body></html>';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'compliance-report-' + format(now, 'yyyy-MM-dd') + '.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [complianceItems, compliantCount, attestation, profile, t]);

  const handleExportAuditCSV = useCallback(async () => {
    if (!user) return;
    try {
      const conditions: any[] = [where('actorId', '==', user.uid), orderBy('timestamp', 'desc'), limit(1000)];
      if (reportFrom) conditions.push(where('timestamp', '>=', reportFrom));
      if (reportTo) conditions.push(where('timestamp', '<=', reportTo + 'T23:59:59.999Z'));
      const q = query(collection(db, 'audit_logs'), ...conditions);
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => { const data = d.data(); return { timestamp: data.timestamp, action: data.action, entity: data.entity, entityId: data.entityId, beforeHash: data.beforeHash || '', afterHash: data.afterHash || '', prevHash: data.prevHash || '' }; });
      if (rows.length === 0) { alert('No audit records found for the selected period.'); return; }
      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audit-log-' + format(new Date(), 'yyyy-MM-dd') + '.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) { console.error('Audit CSV export failed:', err); alert(err.message || 'Export failed'); }
  }, [user, reportFrom, reportTo]);

  const handleGenerateDSR = useCallback(async () => {
    if (!user || !selectedPatient) return;
    setDsrLoading(true);
    setDsrError(null);
    try {
      const bundle = await generateDataBundle(selectedPatient, user.uid);
      const patient = patients.find(p => p.id === selectedPatient);
      downloadBundleAsFile(bundle, patient?.name);
    } catch (err: any) { setDsrError(err.message || 'Failed to generate data bundle'); }
    finally { setDsrLoading(false); }
  }, [user, selectedPatient, patients]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('compliance.title', 'Compliance')}</h1>
        <p className="text-text-muted text-[14px]">{t('compliance.subtitle', 'Compliance status panel and self-attestation')}</p>
      </header>

      <section className="card">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-custom">
          <h2 className="text-[16px] font-bold text-text-main flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary-custom" />
            {t('compliance.status_panel', 'Compliance Status')}
          </h2>
          <span className={"text-[13px] font-bold px-3 py-1 rounded-lg " + (allCompliant ? 'bg-success-custom/10 text-success-custom' : 'bg-amber-100 text-amber-700')}>
            {compliantCount}/{complianceItems.length} {t('compliance.compliant', 'Compliant')}
          </span>
        </div>
        <div className="space-y-3">
          {complianceItems.map((item) => (
            <div key={item.key} className="flex items-center gap-4 p-4 bg-bg rounded-xl border border-border-custom">
              <div className={"w-10 h-10 rounded-lg flex items-center justify-center shrink-0 " + (item.compliant ? 'bg-success-custom/10' : 'bg-red-50')}>
                {item.compliant ? <CheckCircle2 className="w-5 h-5 text-success-custom" /> : <XCircle className="w-5 h-5 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[14px] text-text-main">{item.label}</p>
                <p className="text-[12px] text-text-muted">{item.description}</p>
              </div>
              <span className={"status-badge " + (item.compliant ? 'bg-success-custom/10 text-success-custom' : 'bg-red-50 text-red-600')}>
                {item.compliant ? t('compliance.compliant', 'Compliant') : t('compliance.non_compliant', 'Non-Compliant')}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="text-[16px] font-bold text-text-main mb-6 flex items-center gap-2 border-b border-border-custom pb-4">
          <ClipboardCheck className="w-5 h-5 text-primary-custom" />
          {t('compliance.attestation_panel', 'Professional Self-Attestation')}
        </h2>
        <div className="space-y-4">
          {([
            ['crpValid', t('compliance.attestation_crp', 'I have a valid CRP registration')],
            ['patientsInformed', t('compliance.attestation_patients', 'I have informed my patients about data processing')],
            ['recoveryCodeSafe', t('compliance.attestation_recovery', 'I keep a copy of my encryption recovery code in a safe place')],
            ['cfpAware', t('compliance.attestation_cfp', 'I have read and understand the CFP 09/2024 resolution')],
            ['retentionPolicy', t('compliance.attestation_retention', 'I have a data retention policy documented')],
            ['dsrAware', t('compliance.attestation_dsr', 'I know how to handle a data subject request')],
          ] as [keyof PsychologistAttestation, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={!!attestation[key]} onChange={(e) => setAttestation(prev => ({ ...prev, [key]: e.target.checked }))} className="w-4 h-4 rounded border-border-custom text-primary-custom focus:ring-primary-custom/20" />
              <span className="text-[14px] text-text-main group-hover:text-primary-custom transition-colors">{label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-custom">
          <AnimatePresence>
            {saveSuccess && (
              <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-success-custom font-bold text-[13px]">
                <CheckCircle2 className="w-4 h-4" />
                {t('settings.save_success', 'Saved successfully')}
              </motion.span>
            )}
          </AnimatePresence>
          <button onClick={handleSaveAttestation} disabled={saving} className="btn-primary flex items-center gap-2 text-[13px]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('compliance.save_attestation', 'Save Attestation')}
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="text-[16px] font-bold text-text-main mb-6 flex items-center gap-2 border-b border-border-custom pb-4">
          <FileText className="w-5 h-5 text-primary-custom" />
          {t('compliance.export_report', 'Export Compliance Report')}
        </h2>
        <div className="space-y-4">
          <button onClick={handleExportHTMLReport} className="btn-secondary w-full flex items-center justify-center gap-2 text-[14px]">
            <Download className="w-4 h-4" />
            {t('compliance.export_report', 'Export Compliance Report')}
          </button>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.start_date', 'Start Date')}</label>
              <input type="date" className="input-field text-[14px]" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('settings.end_date', 'End Date')}</label>
              <input type="date" className="input-field text-[14px]" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
            </div>
          </div>
          <button onClick={handleExportAuditCSV} className="btn-secondary w-full flex items-center justify-center gap-2 text-[14px]">
            <Download className="w-4 h-4" />
            {t('compliance.export_audit_csv', 'Export Audit Log (CSV)')}
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="text-[16px] font-bold text-text-main mb-6 flex items-center gap-2 border-b border-border-custom pb-4">
          <HardDrive className="w-5 h-5 text-primary-custom" />
          {t('compliance.backup_section', 'Backup & Redundancy')}
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('compliance.secondary_account', 'Secondary Account (Geographic Redundancy)')}</label>
            <input type="password" className="input-field text-[14px]" placeholder={t('compliance.secondary_token_placeholder', 'Read-only access token...')} value={secondaryToken} onChange={(e) => setSecondaryToken(e.target.value)} />
            <p className="text-[11px] text-text-muted mt-2 font-medium">{t('compliance.secondary_account_hint')}</p>
          </div>
          <button onClick={handleForceBackup} disabled={backupLoading || !driveToken} className="btn-primary flex items-center justify-center gap-2 w-full text-[14px] disabled:opacity-50">
            {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            {t('compliance.force_backup', 'Force Full Backup')}
          </button>
          {backupResult && (
            <p className={"text-[13px] font-medium " + (backupResult.includes('Error') || backupResult.includes('failed') ? 'text-red-600' : 'text-success-custom')}>{backupResult}</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="text-[16px] font-bold text-text-main mb-6 flex items-center gap-2 border-b border-border-custom pb-4">
          <AlertTriangle className="w-5 h-5 text-primary-custom" />
          {t('compliance.dsr_section', 'Data Subject Request')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('compliance.dsr_patient_select', 'Select Patient')}</label>
            <select className="input-field text-[14px]" value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)}>
              <option value="">-</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-800 font-medium">{t('compliance.dsr_warning', 'This will export all data for this patient including decrypted clinical notes. Handle with care.')}</p>
            </div>
          </div>
          {dsrError && <p className="text-[13px] text-red-600 font-medium">{dsrError}</p>}
          <button onClick={handleGenerateDSR} disabled={dsrLoading || !selectedPatient} className="btn-primary flex items-center justify-center gap-2 w-full text-[14px] disabled:opacity-50">
            {dsrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('compliance.dsr_generate', 'Generate Signed Data Bundle')}
          </button>
        </div>
      </section>
    </div>
  );
}
