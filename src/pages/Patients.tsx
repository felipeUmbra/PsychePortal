import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  Users, 
  Search, 
  Plus, 
  Filter,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';

export default function Patients() {
  const [user] = useAuthState(auth);
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(searchParams.get('action') === 'add');
  const [newPatient, setNewPatient] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'Other',
    notes: '',
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
      substanceUse: ''
    }
  });

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'patients'),
      where('psychologistId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patients'));

    return () => unsubscribe();
  }, [user]);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'patients'), {
        ...newPatient,
        psychologistId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsAddModalOpen(false);
      setNewPatient({ 
        name: '', email: '', phone: '', dateOfBirth: '', gender: 'Other', notes: '',
        address: { country: '', zipCode: '', city: '', state: '', street: '', number: '', complement: '', neighborhood: '' },
        education: '', ethnicity: '', financialPlan: 'per_session', financialValue: '',
        anamnesis: { chiefComplaint: '', medicalHistory: '', psychiatricHistory: '', familyHistory: '', medications: '', substanceUse: '' }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patients');
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'all' || p.financialPlan === filterPlan;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('patients.title')}</h1>
          <p className="text-text-muted text-[14px]">{t('patients.subtitle')}</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2 text-[14px]"
        >
          <Plus className="w-4 h-4" />
          {t('patients.add_new')}
        </button>
      </header>

      <div className="flex gap-4 mb-6 relative">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('patients.search_placeholder')}
            className="input-field pl-10 text-[14px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
            className="btn-secondary flex items-center gap-2 text-[14px] h-full"
          >
            <Filter className={cn("w-4 h-4", filterPlan !== 'all' ? "text-primary-custom" : "")} />
            {t('patients.filters')}
          </button>
          
          {isFilterMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsFilterMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-border-custom rounded-xl shadow-lg z-50 p-2">
                <div className="px-3 py-2 text-[11px] font-bold uppercase text-text-muted">
                  {t('patients.financial.title', 'Financial Plan')}
                </div>
                <button
                  onClick={() => { setFilterPlan('all'); setIsFilterMenuOpen(false); }}
                  className={cn("w-full text-left px-3 py-2 text-[13px] rounded-lg hover:bg-bg transition-colors", filterPlan === 'all' && "bg-bg text-primary-custom font-bold")}
                >
                  {t('common.all', 'Todos')}
                </button>
                <button
                  onClick={() => { setFilterPlan('per_session'); setIsFilterMenuOpen(false); }}
                  className={cn("w-full text-left px-3 py-2 text-[13px] rounded-lg hover:bg-bg transition-colors", filterPlan === 'per_session' && "bg-bg text-primary-custom font-bold")}
                >
                  {t('patients.financial.plans.per_session', 'Por Sessão')}
                </button>
                <button
                  onClick={() => { setFilterPlan('monthly'); setIsFilterMenuOpen(false); }}
                  className={cn("w-full text-left px-3 py-2 text-[13px] rounded-lg hover:bg-bg transition-colors", filterPlan === 'monthly' && "bg-bg text-primary-custom font-bold")}
                >
                  {t('patients.financial.plans.monthly', 'Mensalidade')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map((patient, i) => (
          <motion.div
            key={patient.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="card bg-[#fafbfc] hover:border-primary-custom/30 transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-accent-custom border border-border-custom rounded-lg flex items-center justify-center text-primary-custom font-bold text-lg">
                {patient.name.charAt(0)}
              </div>
              <button className="text-text-muted hover:text-text-main">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <h3 className="text-[16px] font-bold text-text-main mb-1">{patient.name}</h3>
            <p className="text-[12px] text-text-muted mb-4 font-medium uppercase tracking-wider">{t('patients.patient_since', { date: format(new Date(patient.createdAt), 'MMM yyyy') })}</p>
            
            <div className="space-y-2.5 mb-6">
              <div className="flex items-center gap-2 text-[13px] text-text-main">
                <Mail className="w-4 h-4 text-text-muted" />
                {patient.email}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-text-main">
                <Phone className="w-4 h-4 text-text-muted" />
                {patient.phone || t('common.na', 'N/A')}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-text-main">
                <Calendar className="w-4 h-4 text-text-muted" />
                {t('patients.dob')}: {patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'MMM d, yyyy') : t('common.na', 'N/A')}
              </div>
            </div>

            <Link 
              to={`/patients/${patient.id}`}
              className="w-full btn-secondary flex items-center justify-center gap-2 text-[13px] group-hover:bg-primary-custom group-hover:text-white group-hover:border-primary-custom transition-all"
            >
              {t('patients.view_profile')}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{t('patients.add_modal_title')}</h2>
              <form onSubmit={handleAddPatient} className="space-y-6">
                
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">Informações Básicas</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.full_name')} *</label>
                    <input 
                      required
                      type="text" 
                      className="input-field" 
                      value={newPatient.name}
                      onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.email')}</label>
                      <input 
                        type="email" 
                        className="input-field" 
                        value={newPatient.email}
                        onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.phone')}</label>
                      <input 
                        type="tel" 
                        className="input-field" 
                        value={newPatient.phone}
                        onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.dob')}</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={newPatient.dateOfBirth}
                        onChange={(e) => setNewPatient({...newPatient, dateOfBirth: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.gender')}</label>
                      <select 
                        className="input-field"
                        value={newPatient.gender}
                        onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})}
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.country')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={newPatient.address.country}
                        onChange={(e) => setNewPatient({...newPatient, address: {...newPatient.address, country: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.zipCode')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={newPatient.address.zipCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                          setNewPatient({...newPatient, address: {...newPatient.address, zipCode: val}});
                        }}
                        placeholder="00000000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.state')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={newPatient.address.state}
                        onChange={(e) => setNewPatient({...newPatient, address: {...newPatient.address, state: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.city')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={newPatient.address.city}
                        onChange={(e) => setNewPatient({...newPatient, address: {...newPatient.address, city: e.target.value}})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.neighborhood')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={newPatient.address.neighborhood}
                        onChange={(e) => setNewPatient({...newPatient, address: {...newPatient.address, neighborhood: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.street')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={newPatient.address.street}
                        onChange={(e) => setNewPatient({...newPatient, address: {...newPatient.address, street: e.target.value}})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.number')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={newPatient.address.number}
                        onChange={(e) => setNewPatient({...newPatient, address: {...newPatient.address, number: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.address.complement')}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={newPatient.address.complement}
                        onChange={(e) => setNewPatient({...newPatient, address: {...newPatient.address, complement: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Data */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('patients.additional_data.title')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.additional_data.education')}</label>
                      <select 
                        className="input-field"
                        value={newPatient.education}
                        onChange={(e) => setNewPatient({...newPatient, education: e.target.value})}
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.additional_data.ethnicity')}</label>
                      <select 
                        className="input-field"
                        value={newPatient.ethnicity}
                        onChange={(e) => setNewPatient({...newPatient, ethnicity: e.target.value})}
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.financial.plan')}</label>
                      <select 
                        className="input-field"
                        value={newPatient.financialPlan}
                        onChange={(e) => setNewPatient({...newPatient, financialPlan: e.target.value})}
                      >
                        <option value="per_session">{t('patients.financial.plans.per_session')}</option>
                        <option value="monthly">{t('patients.financial.plans.monthly')}</option>
                        <option value="health_insurance">{t('patients.financial.plans.health_insurance')}</option>
                        <option value="exempt">{t('patients.financial.plans.exempt')}</option>
                      </select>
                    </div>
                    {(newPatient.financialPlan === 'per_session' || newPatient.financialPlan === 'monthly') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {newPatient.financialPlan === 'per_session' ? t('patients.financial.session_value') : t('patients.financial.monthly_value')}
                        </label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="input-field" 
                          value={newPatient.financialValue}
                          onChange={(e) => setNewPatient({...newPatient, financialValue: e.target.value})}
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Anamnesis */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border-custom pb-2">{t('anamnesis.title')}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.chief_complaint')}</label>
                      <textarea 
                        className="input-field h-20 resize-none" 
                        value={newPatient.anamnesis.chiefComplaint}
                        onChange={(e) => setNewPatient({...newPatient, anamnesis: {...newPatient.anamnesis, chiefComplaint: e.target.value}})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.medical_history')}</label>
                        <textarea 
                          className="input-field h-20 resize-none" 
                          value={newPatient.anamnesis.medicalHistory}
                          onChange={(e) => setNewPatient({...newPatient, anamnesis: {...newPatient.anamnesis, medicalHistory: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.psychiatric_history')}</label>
                        <textarea 
                          className="input-field h-20 resize-none" 
                          value={newPatient.anamnesis.psychiatricHistory}
                          onChange={(e) => setNewPatient({...newPatient, anamnesis: {...newPatient.anamnesis, psychiatricHistory: e.target.value}})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.family_history')}</label>
                        <textarea 
                          className="input-field h-20 resize-none" 
                          value={newPatient.anamnesis.familyHistory}
                          onChange={(e) => setNewPatient({...newPatient, anamnesis: {...newPatient.anamnesis, familyHistory: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.medications')}</label>
                        <textarea 
                          className="input-field h-20 resize-none" 
                          value={newPatient.anamnesis.medications}
                          onChange={(e) => setNewPatient({...newPatient, anamnesis: {...newPatient.anamnesis, medications: e.target.value}})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('anamnesis.substance_use')}</label>
                      <textarea 
                        className="input-field h-20 resize-none" 
                        value={newPatient.anamnesis.substanceUse}
                        onChange={(e) => setNewPatient({...newPatient, anamnesis: {...newPatient.anamnesis, substanceUse: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('patients.notes')}</label>
                  <textarea 
                    className="input-field h-24 resize-none" 
                    value={newPatient.notes}
                    onChange={(e) => setNewPatient({...newPatient, notes: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 btn-secondary"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary"
                  >
                    {t('patients.create_button')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
