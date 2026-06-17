import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, PenLine, XCircle, AlertTriangle } from 'lucide-react';
import { PatientConsent as PatientConsentType } from '../../types';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { cn } from '../../lib/utils';

interface PatientConsentProps {
  consentText: string;
  consentVersion: string;
  currentConsent?: PatientConsentType;
  hasActiveConsent: boolean;
  onAccept: (data: {
    signature: string;
    acceptedAt: string;
    acceptedFrom: string;
    text: string;
    version: string;
  }) => Promise<void>;
  onRevoke: () => Promise<void>;
  loading?: boolean;
}

export function PatientConsent({
  consentText,
  consentVersion,
  currentConsent,
  hasActiveConsent,
  onAccept,
  onRevoke,
  loading
}: PatientConsentProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('pt') ? ptBR : enUS;
  const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!signature.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onAccept({
        signature: signature.trim(),
        acceptedAt: new Date().toISOString(),
        acceptedFrom: 'patient',
        text: consentText,
        version: consentVersion
      });
      setSignature('');
    } catch (err: any) {
      setError(err.message || t('consent.accept_error', 'Failed to record consent.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onRevoke();
      setShowRevokeConfirm(false);
    } catch (err: any) {
      setError(err.message || t('consent.revoke_error', 'Failed to revoke consent.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return format(new Date(iso), 'MMMM d, yyyy HH:mm', { locale: dateLocale });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn(
        'p-4 rounded-xl border flex items-start gap-3',
        hasActiveConsent
          ? 'bg-success-custom/10 border-success-custom/20'
          : 'bg-amber-50 border-amber-200'
      )}>
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          hasActiveConsent ? 'bg-success-custom/20' : 'bg-amber-100'
        )}>
          {hasActiveConsent ? (
            <ShieldCheck className="w-5 h-5 text-success-custom" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          )}
        </div>
        <div>
          <p className={cn(
            'font-bold text-[14px]',
            hasActiveConsent ? 'text-success-custom' : 'text-amber-700'
          )}>
            {hasActiveConsent
              ? t('consent.active_title', 'Consent Active')
              : t('consent.inactive_title', 'No Active Consent')
            }
          </p>
          {currentConsent && !currentConsent.revokedAt ? (
            <p className="text-[13px] text-text-muted mt-1">
              {t('consent.accepted_on', 'Accepted on')} {formatDate(currentConsent.acceptedAt)}
              {currentConsent.signature && ` — ${currentConsent.signature}`}
            </p>
          ) : currentConsent?.revokedAt ? (
            <p className="text-[13px] text-text-muted mt-1">
              {t('consent.revoked_on', 'Revoked on')} {formatDate(currentConsent.revokedAt)}
            </p>
          ) : (
            <p className="text-[13px] text-text-muted mt-1">
              {t('consent.no_consent', 'No consent on file. Session records cannot be saved until consent is accepted.')}
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border-custom">
          <PenLine className="w-4 h-4 text-primary-custom" />
          <h3 className="text-[14px] font-bold text-text-main">
            {t('consent.text_label', 'Consent Text')} — {t('consent.version_label', 'Version')} {consentVersion}
          </h3>
        </div>
        <div className="max-h-64 overflow-y-auto p-4 bg-bg rounded-xl border border-border-custom text-[14px] text-text-muted leading-relaxed whitespace-pre-wrap">
          {consentText}
        </div>
      </div>

      {!hasActiveConsent && (
        <div className="card">
          <h3 className="text-[14px] font-bold text-text-main mb-4">
            {t('consent.accept_title', 'Accept Consent')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                {t('consent.signature_label', 'Full Name')}
              </label>
              <input
                type="text"
                className="input-field text-[14px]"
                placeholder={t('consent.signature_placeholder', 'Type your full name to sign')}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p className="text-[13px] text-red-600 font-medium">{error}</p>
            )}
            <button
              onClick={handleAccept}
              disabled={!signature.trim() || isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 text-[14px] disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {t('consent.accept_button', 'I Accept')}
            </button>
          </div>
        </div>
      )}

      {hasActiveConsent && (
        <div className="card border-red-200">
          <h3 className="text-[14px] font-bold text-red-600 mb-2">
            {t('consent.revoke_section', 'Revoke Consent')}
          </h3>
          <p className="text-[13px] text-text-muted mb-4">
            {t('consent.revoke_warning', 'Revoking consent will prevent any new session records from being saved. Existing records will be preserved.')}
          </p>
          <button
            onClick={() => setShowRevokeConfirm(true)}
            disabled={isSubmitting}
            className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center gap-2 text-[13px]"
          >
            <XCircle className="w-4 h-4" />
            {t('consent.revoke_button', 'Revoke Consent')}
          </button>
        </div>
      )}

      <AnimatePresence>
        {showRevokeConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRevokeConfirm(false)}
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
                  {t('consent.revoke_confirm_title', 'Revoke Consent?')}
                </h2>
                <p className="text-text-muted text-[14px] text-center">
                  {t('consent.revoke_confirm_message', 'Revoking consent will prevent any new session records from being saved. This action cannot be undone.')}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowRevokeConfirm(false)}
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={isSubmitting}
                  className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {t('consent.revoke_button', 'Revoke Consent')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
