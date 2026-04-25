import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Users, Search, Plus, Filter, MoreVertical, Mail, Phone, Calendar, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePatients } from '../hooks/usePatients';
import { PatientForm } from '../components/patients/PatientForm';

export default function Patients() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { patients, loading, addPatient } = usePatients();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(searchParams.get('action') === 'add');

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-custom/30 border-t-primary-custom rounded-full animate-spin"></div>
        </div>
      ) : (
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
                to={`/app/patients/${patient.id}`}
                className="w-full btn-secondary flex items-center justify-center gap-2 text-[13px] group-hover:bg-primary-custom group-hover:text-white group-hover:border-primary-custom transition-all"
              >
                {t('patients.view_profile')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <PatientForm 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={addPatient}
        title={t('patients.add_modal_title')}
      />
    </div>
  );
}
