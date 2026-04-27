import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Mail, Phone, Calendar } from 'lucide-react';
import { Patient } from '../../types';

interface PatientInfoCardProps {
  patient: Patient;
}

export function PatientInfoCard({ patient }: PatientInfoCardProps) {
  const { t } = useTranslation();

  return (
    <section className="card">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-20 h-20 bg-accent-custom border border-border-custom rounded-2xl flex items-center justify-center text-primary-custom font-bold text-3xl mb-4 shadow-sm">
          {patient.name.charAt(0)}
        </div>
        <h2 className="text-xl font-bold text-text-main">{patient.name}</h2>
        <p className="text-text-muted text-[13px] font-medium uppercase tracking-wider mt-1">
          {patient.gender} • {patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'yyyy') : 'N/A'}
        </p>
      </div>

      <div className="space-y-4 border-t border-border-custom pt-6">
        <div className="property-group">
          <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.email')}</p>
          <p className="text-[14px] font-medium text-text-main flex items-center gap-2">
            <Mail className="w-4 h-4 text-text-muted" />
            {patient.email ? (
              <a href={`mailto:${patient.email}`} className="text-primary-custom hover:underline">
                {patient.email}
              </a>
            ) : 'N/A'}
          </p>
        </div>
        <div className="property-group">
          <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">{t('patients.phone')}</p>
          <p className="text-[14px] font-medium text-text-main flex items-center gap-2">
            <Phone className="w-4 h-4 text-text-muted" />
            {patient.phone ? (
              <a href={`tel:${patient.phone.replace(/\D/g, '')}`} className="text-primary-custom hover:underline">
                {patient.phone}
              </a>
            ) : 'N/A'}
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
  );
}
