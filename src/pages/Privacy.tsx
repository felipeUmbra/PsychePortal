import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function Privacy() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user] = useAuthState(auth);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'psychologists', user.uid));
        if (snap.exists()) {
          setProfile(snap.data());
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    })();
  }, [user]);

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
                {t('privacy_page.dpo_text', {
                  dpoName: profile?.dpoName || profile?.name || '[A ser preenchido pelo psicólogo implantador]',
                  dpoEmail: profile?.dpoEmail || profile?.email || 'dpo@example.com — placeholder'
                })}
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.legal_basis_title', '7. Base Legal para o Tratamento (Art. 7 LGPD)')}
              </h2>
              <p>
                {t('privacy_page.legal_basis_text', 'O tratamento de dados clínicos realizado por esta plataforma fundamenta-se nas seguintes bases legais da LGPD: (i) execução de contrato ou de procedimentos preliminares relacionados a contrato do qual seja parte o titular (Art. 7º, V) — a relação terapêutica; (ii) exercício regular de direitos em processo judicial, administrativo ou arbitral (Art. 7º, VI); (iii) proteção da vida ou da incolumidade física do titular ou de terceiro (Art. 7º, VII); (iv) tutela da saúde, em procedimento realizado por profissionais de saúde (Art. 7º, VIII). O consentimento do paciente (Art. 7º, I) é obtido eletronicamente antes de qualquer registro de sessão clínica.')}
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.patient_rights_title', '8. Direitos do Titular (Art. 18 LGPD)')}
              </h2>
              <p>
                {t('privacy_page.patient_rights_text', 'Em conformidade com o Art. 18 da LGPD, o paciente (titular dos dados) tem o direito de: (a) confirmar a existência de tratamento de seus dados; (b) acessar seus dados clínicos; (c) corrigir dados incompletos, inexatos ou desatualizados; (d) solicitar a anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade; (e) solicitar a portabilidade de seus dados; (f) eliminar dados tratados com seu consentimento; (g) obter informação sobre as entidades com as quais seus dados foram compartilhados; (h) revogar seu consentimento a qualquer momento. Para exercer esses direitos, solicite ao seu psicólogo através da funcionalidade de Solicitação de Titular de Dados (DSR) disponível no painel de Conformidade.')}
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.retention_title', '9. Prazo de Retenção de Dados')}
              </h2>
              <p>
                {t('privacy_page.retention_text', 'Os registros clínicos são retidos pelo período configurado pelo psicólogo (padrão: 5 anos), conforme exigido pelo CFP 09/2024 e legislação aplicável. Após o término do período de retenção, os dados são eliminados automaticamente. O paciente pode solicitar a eliminação antecipada de seus dados a qualquer momento, ressalvadas as hipóteses de obrigação legal de manutenção de registros.')}
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-text-main font-bold text-lg">
                {t('privacy_page.international_transfer_title', '10. Transferência Internacional de Dados')}
              </h2>
              <p>
                {t('privacy_page.international_transfer_text', 'Esta plataforma utiliza os serviços do Google (Google Drive e Google Calendar), cujos servidores podem estar localizados fora do Brasil. A Google LLC mantém certificações de segurança internacionais (ISO 27001, SOC 2) e participa de frameworks de proteção de dados. O tratamento realizado por esta plataforma está em conformidade com os requisitos da LGPD para transferência internacional de dados (Art. 33), incluindo a adoção de cláusulas contratuais padrão e a garantia de nível adequado de proteção.')}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl">
              <h2 className="text-text-main font-bold text-base mb-2">
                {t('privacy_page.anpd_title', '11. Autoridade Nacional de Proteção de Dados (ANPD)')}
              </h2>
              <p className="text-sm text-amber-800">
                {t('privacy_page.anpd_text', 'A ANPD é o órgão da administração pública federal responsável por zelar pela proteção de dados pessoais e por regulamentar, implementar e fiscalizar o cumprimento da LGPD. Para dúvidas, reclamações ou denúncias sobre tratamento de dados, entre em contato: Site: www.gov.br/anpd | E-mail: ascom@anpd.gov.br | Endereço: SCS Quadra 6, Bloco A, Edifício Brasília Shopping, 2º andar, Brasília-DF, CEP 70300-915.')}
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
