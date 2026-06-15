/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * First-run encryption setup wizard modal.
 */

import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Eye, EyeOff, Copy, Check, AlertTriangle, Lock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isPassphraseValid } from '../lib/note-crypto';

interface EncryptionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (passphrase: string) => Promise<void>;
  onSkip: () => void;
}

type Step = 'welcome' | 'passphrase' | 'recovery' | 'skip-warning';

export function EncryptionSetupModal({
  isOpen,
  onClose,
  onComplete,
  onSkip,
}: EncryptionSetupModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('welcome');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [savedRecovery, setSavedRecovery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setStep('welcome');
    setPassphrase('');
    setConfirmPassphrase('');
    setShowPassphrase(false);
    setRecoveryPhrase('');
    setSavedRecovery(false);
    setIsSubmitting(false);
    setError(null);
    setCopied(false);
  };

  const handlePassphraseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isPassphraseValid(passphrase)) {
      setError(t('encryption.passphrase_too_short', 'Passphrase must be at least 12 characters.'));
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError(t('encryption.passphrase_mismatch', 'Passphrases do not match.'));
      return;
    }
    setIsSubmitting(true);
    try {
      const { generateRecoveryPhrase } = await import('../lib/note-crypto');
      const phrase = generateRecoveryPhrase();
      setRecoveryPhrase(phrase);
      setStep('recovery');
    } catch {
      setError('Failed to generate recovery phrase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoveryConfirm = async () => {
    if (!savedRecovery) return;
    setIsSubmitting(true);
    try {
      await onComplete(passphrase);
      reset();
    } catch {
      setError('Failed to set up encryption. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryPhrase);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = recoveryPhrase;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => { reset(); onClose(); };
  const handleSkip = () => setStep('skip-warning');
  const handleSkipConfirm = () => { reset(); onSkip(); };
  const handleWelcomeNext = () => setStep('passphrase');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
          aria-label={t('common.close', 'Close')}
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary-custom/10 rounded-2xl flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-primary-custom" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {t('encryption.setup_title', 'Setup Note Encryption')}
                </h2>
                <p className="text-slate-500 mt-2 text-[14px] leading-relaxed max-w-sm">
                  {t(
                    'encryption.setup_desc',
                    'Your session and patient notes will be encrypted with AES-256-GCM before being stored. This protects your data even if the storage is compromised.',
                  )}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[13px] text-amber-800">
                    <p className="font-bold mb-1">
                      {t('encryption.loss_warning_title', 'Important: Passphrase Recovery')}
                    </p>
                    <p>
                      {t(
                        'encryption.loss_warning',
                        'If you lose your passphrase, your notes cannot be decrypted. Save the recovery phrase in a safe place.',
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleWelcomeNext}
                  className="w-full btn-primary py-3 text-[14px] font-bold"
                >
                  {t('encryption.setup_button', 'Setup Encryption')}
                </button>
                <button
                  onClick={handleSkip}
                  className="w-full btn-secondary py-2.5 text-[13px] text-slate-500"
                >
                  {t('encryption.skip_button', 'Skip for now')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'passphrase' && (
            <motion.div
              key="passphrase"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900">
                  {t('encryption.passphrase_title', 'Create Passphrase')}
                </h2>
                <p className="text-slate-500 mt-1 text-[13px]">
                  {t('encryption.passphrase_desc', 'Choose a strong passphrase at least 12 characters long.')}
                </p>
              </div>

              <form onSubmit={handlePassphraseSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    {t('encryption.passphrase_label', 'Passphrase')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      className="input-field pl-10 pr-10 text-[14px]"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder={t('encryption.passphrase_placeholder', 'Enter passphrase...')}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    {t('encryption.confirm_label', 'Confirm Passphrase')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      className="input-field pl-10 text-[14px]"
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      placeholder={t('encryption.confirm_placeholder', 'Re-enter passphrase...')}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-[13px] font-medium">{error}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('welcome')}
                    className="flex-1 btn-secondary py-2.5 text-[13px]"
                  >
                    {t('common.back', 'Back')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !passphrase || !confirmPassphrase}
                    className="flex-1 btn-primary py-2.5 text-[13px] font-bold disabled:opacity-50"
                  >
                    {isSubmitting
                      ? t('common.loading', 'Loading...')
                      : t('encryption.continue_button', 'Continue')}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'recovery' && (
            <motion.div
              key="recovery"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900">
                  {t('encryption.recovery_title', 'Save Recovery Phrase')}
                </h2>
                <p className="text-slate-500 mt-1 text-[13px]">
                  {t(
                    'encryption.recovery_desc',
                    'Write down or copy this phrase. It is the ONLY way to recover your notes if you forget your passphrase.',
                  )}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative">
                <p className="font-mono text-[13px] text-slate-800 leading-relaxed select-all">
                  {recoveryPhrase}
                </p>
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 p-2 hover:bg-slate-200 rounded-lg transition-colors"
                  title={t('common.copy', 'Copy')}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savedRecovery}
                  onChange={(e) => setSavedRecovery(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-custom focus:ring-primary-custom"
                />
                <span className="text-[13px] text-slate-700">
                  {t(
                    'encryption.saved_checkbox',
                    'I have saved my recovery phrase in a safe place.',
                  )}
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('passphrase')}
                  className="flex-1 btn-secondary py-2.5 text-[13px]"
                >
                  {t('common.back', 'Back')}
                </button>
                <button
                  onClick={handleRecoveryConfirm}
                  disabled={!savedRecovery || isSubmitting}
                  className="flex-1 btn-primary py-2.5 text-[13px] font-bold disabled:opacity-50"
                >
                  {isSubmitting
                    ? t('common.loading', 'Loading...')
                    : t('encryption.finish_button', 'Finish Setup')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'skip-warning' && (
            <motion.div
              key="skip-warning"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {t('encryption.skip_warning_title', 'Skip Encryption?')}
                </h2>
                <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-[13px] text-red-700 font-medium">
                    {t(
                      'encryption.skip_warning_msg',
                      'Notes will not be encrypted at rest — not CFP 09/2024 compliant. Your sensitive patient data will be stored in plain text.',
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('welcome')}
                  className="flex-1 btn-secondary py-2.5 text-[13px]"
                >
                  {t('encryption.go_back_setup', 'Go back & setup encryption')}
                </button>
                <button
                  onClick={handleSkipConfirm}
                  className="flex-1 btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 py-2.5 text-[13px] font-bold"
                >
                  {t('encryption.skip_confirm', 'Skip anyway')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}