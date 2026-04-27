import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Terms() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-bg p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-8 font-bold text-[14px]"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('terms_page.back')}
        </button>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-3xl border border-border-custom p-10 shadow-sm"
        >
          <h1 className="text-3xl font-bold text-text-main mb-6 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-primary" />
            {t('terms_page.title')}
          </h1>
          <div className="space-y-6 text-[15px] text-text-muted leading-relaxed">
            <p className="text-lg text-text-main font-medium">{t('terms_page.content_1')}</p>
            
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 font-medium">
              {t('terms_page.content_2')}
            </div>
            
            <p>{t('terms_page.content_3')}</p>
            
            <p>{t('terms_page.content_4')}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
