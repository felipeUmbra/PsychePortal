import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Privacy() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-bg py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-8 font-bold text-[14px]"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('privacy_page.back')}
        </button>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-border-custom p-8 sm:p-10 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border-custom">
            <div className="w-12 h-12 bg-success-custom/10 rounded-xl flex items-center justify-center text-success-custom shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-main">
                {t('privacy_page.title')}
              </h1>
              <p className="text-[12px] text-text-muted font-semibold uppercase tracking-wider mt-1">
                {t('privacy_page.subtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-8 text-[15px] text-text-muted leading-relaxed">
            <p className="text-lg text-text-main font-medium">
              {t('privacy_page.intro')}
            </p>

            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.data_storage_title')}
              </h2>
              <p>
                {t('privacy_page.data_storage_text')}
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.google_data_title')}
              </h2>
              <p>
                {t('privacy_page.google_data_text')}
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <span className="font-semibold text-text-main">Google Calendar:</span> {t('privacy_page.scope_calendar')}
                </li>
                <li>
                  <span className="font-semibold text-text-main">Google Drive:</span> {t('privacy_page.scope_drive')}
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.data_sharing_title')}
              </h2>
              <p>
                {t('privacy_page.data_sharing_text')}
              </p>
            </div>

            <div className="bg-primary-custom/5 border border-primary-custom/10 p-6 rounded-xl">
              <h2 className="text-text-main font-bold text-base mb-2">
                {t('privacy_page.limited_use_title')}
              </h2>
              <p className="text-sm font-medium text-text-main">
                {t('privacy_page.limited_use_text')}
              </p>
            </div>


            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.consent_title')}
              </h2>
              <p>
                {t('privacy_page.consent_text')}
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.dpo_title')}
              </h2>
              <p>
                {t('privacy_page.dpo_text')}
              </p>
            </div>

            <div className="bg-primary-custom/5 border border-primary-custom/10 p-6 rounded-xl">
              <h2 className="text-text-main font-bold text-base mb-2">
                {t('privacy_page.encryption_details')}
              </h2>
              <p className="text-sm text-text-muted">
                {t('privacy_page.encryption_details')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
