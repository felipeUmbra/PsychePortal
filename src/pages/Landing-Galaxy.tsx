import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  Calendar, 
  FileText, 
  DollarSign, 
  Languages, 
  ArrowRight, 
  HardDrive, 
  CalendarDays, 
  Lock, 
  Brain,
  ShieldCheck
} from 'lucide-react';
import { changeLanguage } from '../i18n';

export default function Landing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toggleLanguage = async () => {
    const newLang = i18n.language.startsWith('pt') ? 'en' : 'pt';
    await changeLanguage(newLang);
  };

  const features = [
    {
      icon: Users,
      title: t('landing_page.feature_patients_title'),
      desc: t('landing_page.feature_patients_desc'),
      color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    },
    {
      icon: Calendar,
      title: t('landing_page.feature_calendar_title'),
      desc: t('landing_page.feature_calendar_desc'),
      color: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
    },
    {
      icon: FileText,
      title: t('landing_page.feature_notes_title'),
      desc: t('landing_page.feature_notes_desc'),
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    },
    {
      icon: DollarSign,
      title: t('landing_page.feature_finance_title'),
      desc: t('landing_page.feature_finance_desc'),
      color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-text-main font-sans selection:bg-primary-custom/10">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-surface/80 backdrop-blur-md border-b border-border-custom z-50 transition-all">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-custom rounded-xl flex items-center justify-center shadow-md shadow-primary-custom/15">
              <Brain className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-text-main tracking-tight">Portal Psis</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-text-muted hover:bg-bg text-[13px] font-semibold transition-all cursor-pointer"
            >
              <Languages className="w-4 h-4" />
              {i18n.language.startsWith('pt') ? 'EN' : 'PT'}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="bg-primary-custom text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer"
            >
              {t('landing_page.cta_start')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.100),theme(colors.transparent))]" />
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-custom border border-primary-custom/25 text-primary-custom text-[11px] font-bold uppercase tracking-wider mb-6"
          >
            <Lock className="w-3.5 h-3.5" />
            {t('landing_page.security_badge')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-extrabold text-text-main tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto"
          >
            {t('landing_page.hero_title')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-text-muted leading-relaxed max-w-3xl mx-auto mb-10"
          >
            {t('landing_page.hero_subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-3.5 bg-primary-custom hover:bg-primary-custom/95 text-white font-bold rounded-lg shadow-lg shadow-primary-custom/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {t('landing_page.cta_start')}
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-3.5 bg-surface hover:bg-bg border border-border-custom text-text-main font-bold rounded-lg transition-all flex items-center justify-center"
            >
              {t('landing_page.cta_learn_more')}
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-surface border-y border-border-custom px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-text-main tracking-tight">
              {t('landing_page.features_title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-bg/50 rounded-2xl border border-border-custom p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-6 ${feat.color}`}>
                  <feat.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-text-main mb-3">{feat.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed flex-1">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Google Integration & Privacy Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-bg to-accent-custom/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-text-main tracking-tight mb-4">
              {t('landing_page.google_section_title')}
            </h2>
            <p className="text-text-muted leading-relaxed">
              {t('landing_page.google_section_subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            <motion.div
              initial={{ opacity: 0, x: -25 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-surface border border-border-custom rounded-2xl p-8 shadow-sm flex gap-6"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main mb-3">
                  {t('landing_page.google_drive_title')}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {t('landing_page.google_drive_desc')}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 25 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-surface border border-border-custom rounded-2xl p-8 shadow-sm flex gap-6"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 shrink-0">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main mb-3">
                  {t('landing_page.google_calendar_title')}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {t('landing_page.google_calendar_desc')}
                </p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 p-6 bg-surface border border-border-custom rounded-2xl shadow-sm text-center max-w-3xl mx-auto"
          >
            <div className="flex justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-success-custom" />
            </div>
            <p className="text-sm font-semibold text-text-main mb-2">
              Google API Limited Use Policy Compliance
            </p>
            <p className="text-text-muted text-[13px] leading-relaxed">
              We strictly adhere to the Google API Services User Data Policy. All data requests are completed locally in your browser. We never sell, transmit, or share your data with any external service or third party.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface border-t border-border-custom py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-custom rounded-lg flex items-center justify-center shadow-sm">
              <Brain className="text-white w-4 h-4" />
            </div>
            <span className="text-[15px] font-bold text-text-main tracking-tight">Portal Psis</span>
          </div>

          <div className="flex items-center gap-6 text-[13px] font-semibold text-text-muted">
            <Link to="/terms" className="hover:text-text-main hover:underline transition-colors">
              {t('landing_page.footer_terms')}
            </Link>
            <Link to="/privacy" className="hover:text-text-main hover:underline transition-colors">
              {t('landing_page.footer_privacy')}
            </Link>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-success-custom animate-pulse" />
            System Operational
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-border-custom text-center text-[12px] text-text-muted">
          &copy; {new Date().getFullYear()} Portal Psis. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
