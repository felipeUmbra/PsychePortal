import { useState, useEffect, FormEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Lock } from 'lucide-react';
import { Patient } from '../../types';
import { useEncryption } from '../../hooks/useEncryption';

interface PatientFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'psychologistId'>) => Promise<any>;
  initialData?: Partial<Patient>;
  title: string;
}

// CPF validation utility for Brazil (11 digits with check digits)
const validateCPF = (cpf: string): boolean => {
  if (!cpf) return true; // CPF is optional
  
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Must have exactly 11 digits
  if (cleanCPF.length !== 11) return false;
  
  // All same digits is invalid
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  
  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleanCPF[9])) return false;
  
  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleanCPF[10])) return false;
  
  return true;
};

const formatCPF = (value: string): string => {
  const clean = value.replace(/\D/g, '').slice(0, 11);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
};

export function PatientForm({ isOpen, onClose, onSubmit, initialData, title }: PatientFormProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  
  // ESC key closes the form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Focus management for modal accessibility
  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the first focusable element in the modal
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    } else if (!isOpen && previousActiveElement.current) {
      // Restore focus to the element that opened the modal
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isOpen]);

  // Focus trap for modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modalRef.current!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: going backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: going forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modalRef.current.addEventListener('keydown', handleTabKey);
    return () => {
      modalRef.current?.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen]);
  
  const { isUnlocked } = useEncryption();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    dateOfBirth: '',
    gender: 'Other',
    address: {
      country: '',
      zipCode: '',
      city: '',
      state: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: ''
    },
    education: '',
    ethnicity: '',
    financialPlan: 'per_session',
    financialValue: '',
    anamnesis: {
      chiefComplaint: '',
      medicalHistory: '',
      psychiatricHistory: '',
      familyHistory: '',
      medications: '',
      substanceUse: '',
      familyStructure: '',
      workStudies: '',
      socialHabits: '',
      psychiatricHistoryDetailed: '',
      recurrentSymptoms: '',
      predominantEmotions: ''
    }
  });

  useEffect(() => {
    if (initialData && isOpen) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        dateOfBirth: initialData.dateOfBirth ? initialData.dateOfBirth.split('T')[0] : '',
        address: { ...prev.address, ...(initialData.address || {}) },
        anamnesis: { ...prev.anamnesis, ...(initialData.anamnesis || {}) }
      }));
    } else if (!isOpen && !initialData) {
      // Reset when closed for new creation
      setFormData({
        name: '', email: '', phone: '', cpf: '', dateOfBirth: '', gender: 'Other',
        address: { country: '', zipCode: '', city: '', state: '', street: '', number: '', complement: '', neighborhood: '' },
        education: '', ethnicity: '', financialPlan: 'per_session', financialValue: '',
        anamnesis: { chiefComplaint: '', medicalHistory: '', psychiatricHistory: '', familyHistory: '', medications: '', substanceUse: '',
          familyStructure: '', workStudies: '', socialHabits: '', psychiatricHistoryDetailed: '', recurrentSymptoms: '', predominantEmotions: '' }
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validate CPF before submission
    const cleanCPF = formData.cpf?.replace(/\D/g, '') || '';
    if (cleanCPF.length > 0 && cleanCPF.length < 11) {
      setCpfError(t('patients.cpf.error_length'));
      return;
    }
    if (cleanCPF.length === 11 && !validateCPF(cleanCPF)) {
      setCpfError(t('patients.cpf.error_invalid'));
      return;
    }
    
    try {
      setIsSubmitting(true);

      // Clean the data: remove internal IDs and metadata before sending to parent
      // to ensure we match the Omit<Patient, ...> type and don't pollute the DB body
      const { 
        id: _id, 
        createdAt: _c, 
        updatedAt: _u, 
        psychologistId: _p, 
        ...cleanData 
      } = formData as any;

      await onSubmit(cleanData);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-form-title"
          >
            <h2 id="patient-form-title" className="text-2xl font-bold text-slate-900 mb-6">{title}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('patients.basic_info')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-name" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.full_name')} *</label>
                    <input 
                      id="patient-name"
                      required
                      type="text" 
                      className="input-field" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label htmlFor="patient-cpf" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.cpf.label', 'CPF')}</label>
                    <input 
                      id="patient-cpf"
                      type="text" 
                      className={`input-field ${cpfError ? 'border-red-500 focus:ring-red-500' : ''}`} 
                      value={formData.cpf}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, '').slice(0, 11);
                        const formatted = formatCPF(rawValue);
                        setFormData({...formData, cpf: formatted});
                        // Show error if CPF is not empty but incomplete or invalid
                        if (rawValue.length > 0 && rawValue.length < 11) {
                          setCpfError(t('patients.cpf.error_length'));
                        } else if (rawValue.length === 11 && !validateCPF(rawValue)) {
                          setCpfError(t('patients.cpf.error_invalid'));
                        } else {
                          setCpfError(null);
                        }
                      }}
                      onBlur={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, '').slice(0, 11);
                        // Show error on blur if CPF is not empty but incomplete or invalid
                        if (rawValue.length > 0 && rawValue.length < 11) {
                          setCpfError(t('patients.cpf.error_length'));
                        } else if (rawValue.length === 11 && !validateCPF(rawValue)) {
                          setCpfError(t('patients.cpf.error_invalid'));
                        }
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      aria-describedby={cpfError ? "patient-cpf-error" : undefined}
                    />
                    {cpfError && (
                      <p id="patient-cpf-error" className="text-red-700 text-xs mt-1" role="alert">{cpfError}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-email" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.email')}</label>
                    <input 
                      id="patient-email"
                      type="email" 
                      className="input-field" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label htmlFor="patient-phone" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.phone')}</label>
                    <input 
                      id="patient-phone"
                      type="tel" 
                      className="input-field" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-dob" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.dob')}</label>
                    <input 
                      id="patient-dob"
                      type="date" 
                      className="input-field" 
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                    />
                  </div>
                  <div>
                    <label htmlFor="patient-gender" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.gender')}</label>
                    <select 
                      id="patient-gender"
                      className="input-field"
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    >
                      <option value="Male">{t('patients.genders.male')}</option>
                      <option value="Female">{t('patients.genders.female')}</option>
                      <option value="Non-binary">{t('patients.genders.non_binary')}</option>
                      <option value="Other">{t('patients.genders.other')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('patients.address.title')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-country" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.country')}</label>
                    <input 
                      id="patient-country"
                      type="text" 
                      className="input-field" 
                      value={formData.address.country}
                    onChange={(e) => setFormData(prev => ({...prev, address: {...prev.address, country: e.target.value}}))}
                    />
                  </div>
                  <div>
                    <label htmlFor="patient-zipcode" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.zipCode')}</label>
                    <input 
                      id="patient-zipcode"
                      type="text" 
                      className="input-field" 
                      value={formData.address.zipCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setFormData(prev => ({...prev, address: {...prev.address, zipCode: val}}));
                      }}
                      placeholder="00000000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-state" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.state')}</label>
                    <input 
                      id="patient-state"
                      type="text" 
                      className="input-field" 
                      value={formData.address.state}
                      onChange={(e) => setFormData(prev => ({...prev, address: {...prev.address, state: e.target.value}}))}
                    />
                  </div>
                  <div>
                    <label htmlFor="patient-city" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.city')}</label>
                    <input 
                      id="patient-city"
                      type="text" 
                      className="input-field" 
                      value={formData.address.city}
                      onChange={(e) => setFormData(prev => ({...prev, address: {...prev.address, city: e.target.value}}))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-neighborhood" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.neighborhood')}</label>
                    <input 
                      id="patient-neighborhood"
                      type="text" 
                      className="input-field" 
                      value={formData.address.neighborhood}
                      onChange={(e) => setFormData(prev => ({...prev, address: {...prev.address, neighborhood: e.target.value}}))}
                    />
                  </div>
                  <div>
                    <label htmlFor="patient-street" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.street')}</label>
                    <input 
                      id="patient-street"
                      type="text" 
                      className="input-field" 
                      value={formData.address.street}
                      onChange={(e) => setFormData(prev => ({...prev, address: {...prev.address, street: e.target.value}}))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-number" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.number')}</label>
                    <input 
                      id="patient-number"
                      type="text" 
                      className="input-field" 
                      value={formData.address.number}
                      onChange={(e) => setFormData(prev => ({...prev, address: {...prev.address, number: e.target.value}}))}
                    />
                  </div>
                  <div>
                    <label htmlFor="patient-complement" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.complement')}</label>
                    <input 
                      id="patient-complement"
                      type="text" 
                      className="input-field" 
                      value={formData.address.complement}
                      onChange={(e) => setFormData(prev => ({...prev, address: {...prev.address, complement: e.target.value}}))}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Data */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('patients.additional_data.title')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-education" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.additional_data.education')}</label>
                    <select 
                      id="patient-education"
                      className="input-field"
                      value={formData.education}
                      onChange={(e) => setFormData({...formData, education: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      <option value="infantil">{t('patients.additional_data.education_levels.infantil')}</option>
                      <option value="fundamental_inc">{t('patients.additional_data.education_levels.fundamental_inc')}</option>
                      <option value="fundamental_comp">{t('patients.additional_data.education_levels.fundamental_comp')}</option>
                      <option value="medio_inc">{t('patients.additional_data.education_levels.medio_inc')}</option>
                      <option value="medio_comp">{t('patients.additional_data.education_levels.medio_comp')}</option>
                      <option value="superior_inc">{t('patients.additional_data.education_levels.superior_inc')}</option>
                      <option value="superior_comp">{t('patients.additional_data.education_levels.superior_comp')}</option>
                      <option value="pos_grad">{t('patients.additional_data.education_levels.pos_grad')}</option>
                      <option value="mestrado">{t('patients.additional_data.education_levels.mestrado')}</option>
                      <option value="doutorado">{t('patients.additional_data.education_levels.doutorado')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="patient-ethnicity" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.additional_data.ethnicity')}</label>
                    <select 
                      id="patient-ethnicity"
                      className="input-field"
                      value={formData.ethnicity}
                      onChange={(e) => setFormData({...formData, ethnicity: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      <option value="branco">{t('patients.additional_data.ethnicities.branco')}</option>
                      <option value="preto">{t('patients.additional_data.ethnicities.preto')}</option>
                      <option value="pardo">{t('patients.additional_data.ethnicities.pardo')}</option>
                      <option value="indigena">{t('patients.additional_data.ethnicities.indigena')}</option>
                      <option value="amarelo">{t('patients.additional_data.ethnicities.amarelo')}</option>
                      <option value="outro">{t('patients.additional_data.ethnicities.outro')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Financial Plan */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('patients.financial.title')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="patient-financial-plan" className="block text-sm font-medium text-slate-700 mb-1">{t('patients.financial.plan')}</label>
                    <select 
                      id="patient-financial-plan"
                      className="input-field"
                      value={formData.financialPlan}
                      onChange={(e) => setFormData({...formData, financialPlan: e.target.value})}
                    >
                      <option value="per_session">{t('patients.financial.plans.per_session')}</option>
                      <option value="monthly">{t('patients.financial.plans.monthly')}</option>
                      <option value="health_insurance">{t('patients.financial.plans.health_insurance')}</option>
                      <option value="exempt">{t('patients.financial.plans.exempt')}</option>
                    </select>
                  </div>
                  {(formData.financialPlan === 'per_session' || formData.financialPlan === 'monthly') && (
                    <div>
                      <label htmlFor="patient-financial-value" className="block text-sm font-medium text-slate-700 mb-1">
                        {formData.financialPlan === 'per_session' ? t('patients.financial.session_value') : t('patients.financial.monthly_value')}
                      </label>
                      <input 
                        id="patient-financial-value"
                        type="number" 
                        step="0.01"
                        className="input-field" 
                        value={formData.financialValue}
                      onChange={(e) => setFormData(prev => ({...prev, financialValue: e.target.value}))}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Anamnesis */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('anamnesis.title')}</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="patient-chief-complaint" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.chief_complaint')}</label>
                    <textarea 
                      id="patient-chief-complaint"
                      className="input-field h-20 resize-none" 
                      value={formData.anamnesis.chiefComplaint}
                      onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, chiefComplaint: e.target.value}}))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="patient-medical-history" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.medical_history')}</label>
                      <textarea 
                        id="patient-medical-history"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.medicalHistory}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, medicalHistory: e.target.value}}))}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-psychiatric-history" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.psychiatric_history')}</label>
                      <textarea 
                        id="patient-psychiatric-history"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.psychiatricHistory}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, psychiatricHistory: e.target.value}}))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="patient-family-history" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.family_history')}</label>
                      <textarea 
                        id="patient-family-history"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.familyHistory}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, familyHistory: e.target.value}}))}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-medications" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.medications')}</label>
                      <textarea 
                        id="patient-medications"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.medications}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, medications: e.target.value}}))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="patient-substance-use" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.substance_use', 'Substance Use')}</label>
                      <textarea 
                        id="patient-substance-use"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.substanceUse || ''}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, substanceUse: e.target.value}}))}
                        placeholder={t('anamnesis.substance_use_placeholder', 'Alcohol, tobacco, illicit substances...')}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="patient-family-structure" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.family_structure')}</label>
                      <textarea 
                        id="patient-family-structure"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.familyStructure}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, familyStructure: e.target.value}}))}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-work-studies" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.work_studies')}</label>
                      <textarea 
                        id="patient-work-studies"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.workStudies}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, workStudies: e.target.value}}))}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-social-habits" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.social_habits')}</label>
                      <textarea 
                        id="patient-social-habits"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.socialHabits}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, socialHabits: e.target.value}}))}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-psychiatric-detailed" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.psychiatric_history_detailed')}</label>
                      <textarea 
                        id="patient-psychiatric-detailed"
                        className="input-field h-24 resize-none" 
                        value={formData.anamnesis.psychiatricHistoryDetailed}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, psychiatricHistoryDetailed: e.target.value}}))}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-recurrent-symptoms" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.recurrent_symptoms')}</label>
                      <textarea 
                        id="patient-recurrent-symptoms"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.recurrentSymptoms}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, recurrentSymptoms: e.target.value}}))}
                      />
                    </div>
                    <div>
                      <label htmlFor="patient-predominant-emotions" className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.predominant_emotions')}</label>
                      <textarea 
                        id="patient-predominant-emotions"
                        className="input-field h-20 resize-none" 
                        value={formData.anamnesis.predominantEmotions}
                        onChange={(e) => setFormData(prev => ({...prev, anamnesis: {...prev.anamnesis, predominantEmotions: e.target.value}}))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 btn-secondary"
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {t('common.save', 'Save')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
