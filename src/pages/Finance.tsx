import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  DollarSign, 
  Search, 
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
  Calendar,
  Users
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, isSameDay, isSameWeek, isSameMonth, isSameYear, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';

export default function Finance() {
  const [user] = useAuthState(auth);
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');

  useEffect(() => {
    if (!user) return;

    // Fetch patients to map IDs to names
    const fetchPatients = async () => {
      const q = query(collection(db, 'patients'), where('psychologistId', '==', user.uid));
      const snap = await getDocs(q);
      const patientMap: Record<string, any> = {};
      snap.docs.forEach(doc => {
        patientMap[doc.id] = doc.data();
      });
      setPatients(patientMap);
    };
    fetchPatients();

    // Fetch all sessions to calculate preview and previous income
    const q = query(
      collection(db, 'sessions'),
      where('psychologistId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sessions'));

    return () => unsubscribe();
  }, [user]);

  const togglePaymentStatus = async (sessionId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
      await updateDoc(doc(db, 'sessions', sessionId), {
        paymentStatus: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
    }
  };

  const now = new Date();
  const isSessionInPeriod = (sessionDate: any) => {
    if (period === 'all') return true;
    const date = sessionDate?.toDate ? sessionDate.toDate() : new Date(sessionDate);
    if (!date || isNaN(date.getTime())) return false;
    
    if (period === 'day') return isSameDay(date, now);
    if (period === 'week') return isSameWeek(date, now, { weekStartsOn: 1 });
    if (period === 'month') return isSameMonth(date, now);
    if (period === 'year') return isSameYear(date, now);
    return true;
  };

  const periodSessions = sessions.filter(s => s.status !== 'cancelled' && isSessionInPeriod(s.date));

  let periodExpectedSessions = 0;
  let periodPaidSessions = 0;
  const [filterPatientId, setFilterPatientId] = useState<string>('all');

  const patientStats: Record<string, { expected: number, paid: number, pending: number, monthlyFee: number }> = {};

  // Initialize patient stats for all patients
  Object.values(patients).forEach(patient => {
    patientStats[patient.id] = {
      expected: 0,
      paid: 0,
      pending: 0,
      monthlyFee: patient.financialPlan === 'monthly' ? (Number(patient.financialValue) || 0) : 0
    };
  });

  periodSessions.forEach(s => {
    const patient = patients[s.patientId];
    if (patient) {
      if (patient.financialPlan === 'per_session' && patient.financialValue) {
        const val = Number(patient.financialValue) || 0;
        patientStats[patient.id].expected += val;
        
        // Update global period totals only if patient matches filter
        if (filterPatientId === 'all' || filterPatientId === patient.id) {
          periodExpectedSessions += val;
        }

        if (s.paymentStatus === 'paid') {
          patientStats[patient.id].paid += val;
          if (filterPatientId === 'all' || filterPatientId === patient.id) {
            periodPaidSessions += val;
          }
        } else {
          patientStats[patient.id].pending += val;
        }
      }
    }
  });

  let globalExpectedMonthly = 0;
  Object.values(patients).forEach(patient => {
    if (patient.financialPlan === 'monthly' && patient.financialValue) {
      if (filterPatientId === 'all' || filterPatientId === patient.id) {
        globalExpectedMonthly += Number(patient.financialValue) || 0;
      }
    }
  });

  const periodPendingPayments = periodExpectedSessions - periodPaidSessions;

  const filteredSessions = periodSessions.filter(s => {
    if (filterPatientId !== 'all' && s.patientId !== filterPatientId) return false;
    const patientName = patients[s.patientId]?.name || '';
    return patientName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getSessionValue = (patientId: string) => {
    const patient = patients[patientId];
    if (!patient) return 0;
    if (patient.financialPlan === 'per_session') {
      return Number(patient.financialValue) || 0;
    }
    return 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('finance.title')}</h1>
          <p className="text-text-muted text-[14px]">{t('finance.subtitle')}</p>
        </div>
        <div className="flex bg-surface border border-border-custom rounded-lg p-1">
          {(['day', 'week', 'month', 'year', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-1.5 text-[13px] font-bold rounded-md transition-all",
                period === p 
                  ? "bg-bg text-primary-custom shadow-sm" 
                  : "text-text-muted hover:text-text-main"
              )}
            >
              {t(`finance.period.${p}`, p.charAt(0).toUpperCase() + p.slice(1))}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card bg-surface border-border-custom">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-custom/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-primary-custom w-6 h-6" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider">{t('finance.expected_sessions')}</p>
              <h3 className="text-2xl font-bold text-text-main mt-1">{formatCurrency(periodExpectedSessions)}</h3>
            </div>
          </div>
        </div>
        <div className="card bg-surface border-border-custom">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-custom/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-primary-custom w-6 h-6" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider">{t('finance.expected_monthly')}</p>
              <h3 className="text-2xl font-bold text-text-main mt-1">{formatCurrency(globalExpectedMonthly)}</h3>
            </div>
          </div>
        </div>
        <div className="card bg-surface border-border-custom">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-success-custom/10 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="text-success-custom w-6 h-6" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider">{t('finance.total_paid')}</p>
              <h3 className="text-2xl font-bold text-text-main mt-1">{formatCurrency(periodPaidSessions)}</h3>
            </div>
          </div>
        </div>
        <div className="card bg-surface border-border-custom">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Clock className="text-amber-500 w-6 h-6" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider">{t('finance.pending_payments')}</p>
              <h3 className="text-2xl font-bold text-text-main mt-1">{formatCurrency(periodPendingPayments)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
              <input 
                type="text" 
                placeholder={t('common.search')}
                className="input-field pl-10 text-[14px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredSessions.map((session, i) => {
              const sessionValue = getSessionValue(session.patientId);
              const patient = patients[session.patientId];
              const isPerSession = patient?.financialPlan === 'per_session';

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card p-0 overflow-hidden bg-[#fafbfc] hover:border-primary-custom/20 transition-all flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-accent-custom border border-border-custom rounded-lg flex items-center justify-center text-primary-custom font-bold">
                      {patient?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-text-main">{patient?.name || 'Unknown Patient'}</span>
                        <span className="text-border-custom">•</span>
                        <span className="text-[12px] font-bold text-text-muted uppercase tracking-wider">{t(`session_status.${session.status}`)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-text-muted font-bold uppercase tracking-wider mt-0.5">
                        <span>{format(session.date?.toDate ? session.date.toDate() : new Date(session.date), 'MMM d, yyyy - HH:mm')}</span>
                        {patient?.financialPlan && (
                          <>
                            <span className="text-border-custom">•</span>
                            <span>{t(`patients.financial.plans.${patient.financialPlan}`, { defaultValue: patient.financialPlan })}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[15px] font-bold text-text-main">{isPerSession ? formatCurrency(sessionValue) : '-'}</div>
                      {isPerSession && (
                        <div className={cn(
                          "text-[11px] font-bold uppercase tracking-wider mt-0.5",
                          session.paymentStatus === 'paid' ? "text-success-custom" : "text-amber-500"
                        )}>
                          {session.paymentStatus === 'paid' ? t('finance.status.paid') : t('finance.status.pending')}
                        </div>
                      )}
                    </div>
                    {isPerSession && (
                      <button 
                        onClick={() => togglePaymentStatus(session.id, session.paymentStatus)}
                        className={cn(
                          "py-1.5 px-4 rounded-md text-[12px] font-bold transition-all",
                          session.paymentStatus === 'paid' 
                            ? "bg-bg text-text-muted hover:bg-border-custom" 
                            : "bg-success-custom/10 text-success-custom hover:bg-success-custom/20"
                        )}
                      >
                        {session.paymentStatus === 'paid' ? t('finance.mark_pending') : t('finance.mark_paid')}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {filteredSessions.length === 0 && (
              <div className="text-center py-24 bg-bg rounded-2xl border border-dashed border-border-custom">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <DollarSign className="text-text-muted w-8 h-8 opacity-30" />
                </div>
                <p className="text-text-muted text-[14px] mt-1">{t('finance.no_records')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card">
            <div className="flex flex-col gap-4 mb-6">
              <h3 className="text-[16px] font-bold text-text-main flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-custom" />
                {t('finance.patient_summary')} ({t(`finance.period.${period}`, { defaultValue: period })})
              </h3>
              <select 
                value={filterPatientId}
                onChange={(e) => setFilterPatientId(e.target.value)}
                className="input-field text-[13px] py-2 bg-surface"
              >
                <option value="all">{t('sidebar.patients', 'Pacientes')} (Todos)</option>
                {Object.values(patients).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-4">
              {(() => {
                const displayedStats = Object.entries(patientStats)
                  .filter(([patientId]) => filterPatientId === 'all' || patientId === filterPatientId)
                  .filter(([patientId, stats]) => {
                     if (filterPatientId !== 'all') return true;
                     if (period === 'all') return true;
                     return stats.expected > 0 || stats.paid > 0 || stats.pending > 0 || stats.monthlyFee > 0;
                  });
                
                if (displayedStats.length === 0) {
                  return <p className="text-text-muted text-[13px] text-center py-4">{t('finance.no_data_period')}</p>;
                }

                return displayedStats.map(([patientId, stats]) => {
                    const p = patients[patientId];
                    if (!p) return null;
                    const isMonthly = p.financialPlan === 'monthly';
                    return (
                      <div key={patientId} className="p-4 bg-[#fafbfc] border border-border-custom rounded-xl flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[14px] text-text-main">{p.name}</span>
                          <span className="text-[11px] font-bold text-text-muted uppercase">{t(`patients.financial.plans.${p.financialPlan}`, { defaultValue: p.financialPlan })}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[13px]">
                          <div className="flex flex-col">
                            <span className="text-text-muted text-[11px] uppercase font-bold">{t('finance.status.paid')}</span>
                            <span className="text-success-custom font-bold">{isMonthly ? '-' : formatCurrency(stats.paid)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-text-muted text-[11px] uppercase font-bold">{t('finance.status.pending')}</span>
                            <span className="text-amber-500 font-bold">{isMonthly ? '-' : formatCurrency(stats.pending)}</span>
                          </div>
                        </div>
                      </div>
                    );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
