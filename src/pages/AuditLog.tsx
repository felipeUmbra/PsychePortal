import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Shield,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AuditLog, AuditAction, AuditEntity } from '../types';

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const [user] = useAuthState(auth);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('pt') ? ptBR : enUS;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);

  const [filters, setFilters] = useState({
    entity: '',
    action: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });
 
  const fetchLogs = async (reset = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const conditions: any[] = [
        where('actorId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE + 1)
      ];

      if (filters.entity) conditions.push(where('entity', '==', filters.entity));
      if (filters.action) conditions.push(where('action', '==', filters.action));
      if (filters.dateFrom) conditions.push(where('timestamp', '>=', filters.dateFrom));
      if (filters.dateTo) conditions.push(where('timestamp', '<=', filters.dateTo + 'T23:59:59.999Z'));

      const q = query(collection(db, 'audit_logs'), ...conditions);
      const snapshot = await getDocs(q);

      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));

      if (reset) {
        setLogs(docs.slice(0, PAGE_SIZE));
        setLastDoc(docs[PAGE_SIZE - 1] || null);
        setHasMore(docs.length > PAGE_SIZE);
        setPage(0);
      } else {
        setLogs(prev => [...prev, ...docs.slice(0, PAGE_SIZE)]);
        setLastDoc(docs[PAGE_SIZE - 1] || null);
        setHasMore(docs.length > PAGE_SIZE);
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [user, filters.entity, filters.action, filters.dateFrom, filters.dateTo]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    fetchLogs(true);
  };

  const handleLoadMore = () => {
    fetchLogs(false);
  };

  const handlePrevPage = () => {
    if (page > 0) {
      setPage(prev => prev - 1);
      fetchLogs(true);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      handleLoadMore();
    }
  };

  const formatAction = (action: AuditAction) => t(`audit.actions.${action}`);
  const formatEntity = (entity: AuditEntity) => t(`audit.entities.${entity}`);

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return format(date, i18n.language.startsWith('pt') ? "dd/MM/yyyy HH:mm:ss" : "MM/dd/yyyy HH:mm:ss", { locale: dateLocale });
  };

  const truncateHash = (hash?: string) => {
    if (!hash) return '-';
    return hash.length > 16 ? hash.substring(0, 16) + '...' : hash;
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">{t('audit.title')}</h1>
        <p className="text-text-muted text-[14px]">{t('audit.subtitle')}</p>
      </header>

      <section className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('audit.filters.entity')}</label>
            <select className="input-field text-[14px]" value={filters.entity} onChange={e => handleFilterChange('entity', e.target.value)}>
              <option value="">{t('audit.filters.all_entities')}</option>
              <option value="session">{t('audit.entities.session')}</option>
              <option value="patient">{t('audit.entities.patient')}</option>
              <option value="attachment">{t('audit.entities.attachment')}</option>
              <option value="psychologist">{t('audit.entities.psychologist')}</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('audit.filters.action')}</label>
            <select className="input-field text-[14px]" value={filters.action} onChange={e => handleFilterChange('action', e.target.value)}>
              <option value="">{t('audit.filters.all_actions')}</option>
              <option value="view">{t('audit.actions.view')}</option>
              <option value="create">{t('audit.actions.create')}</option>
              <option value="update">{t('audit.actions.update')}</option>
              <option value="delete">{t('audit.actions.delete')}</option>
              <option value="export">{t('audit.actions.export')}</option>
              <option value="login">{t('audit.actions.login')}</option>
              <option value="logout">{t('audit.actions.logout')}</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('audit.filters.date_from')}</label>
            <input type="date" className="input-field text-[14px]" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('audit.filters.date_to')}</label>
            <input type="date" className="input-field text-[14px]" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={handleSearch} className="btn-primary w-full flex items-center justify-center gap-2">
              <Search className="w-4 h-4" />
              {t('audit.filters.search')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-muted border-b border-border-custom">
                <th className="pb-2 font-bold">{t('audit.table.timestamp')}</th>
                <th className="pb-2 font-bold">{t('audit.table.action')}</th>
                <th className="pb-2 font-bold">{t('audit.table.entity')}</th>
                <th className="pb-2 font-bold">{t('audit.table.entity_id')}</th>
                <th className="pb-2 font-bold">{t('audit.table.before_hash')}</th>
                <th className="pb-2 font-bold">{t('audit.table.after_hash')}</th>
                <th className="pb-2 font-bold">{t('audit.table.prev_hash')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-custom" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-text-muted">{t('audit.no_records')}</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border-custom/50 hover:bg-bg transition-colors">
                    <td className="py-3 font-mono text-[11px] text-text-muted">{formatTimestamp(log.timestamp)}</td>
                    <td className="py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        log.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                        log.action === 'update' ? 'bg-primary-100 text-primary-700' :
                        log.action === 'delete' ? 'bg-red-100 text-red-700' :
                        log.action === 'view' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'export' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      )}>{formatAction(log.action)}</span>
                    </td>
                    <td className="py-3 text-text-main">{formatEntity(log.entity)}</td>
                    <td className="py-3 font-mono text-[11px] text-text-muted">{log.entityId.substring(0, 8)}...</td>
                    <td className="py-3 font-mono text-[10px] text-text-muted">{truncateHash(log.beforeHash)}</td>
                    <td className="py-3 font-mono text-[10px] text-text-muted">{truncateHash(log.afterHash)}</td>
                    <td className="py-3 font-mono text-[10px] text-text-muted">{truncateHash(log.prevHash)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-custom">
          <span className="text-[13px] text-text-muted">
            {t('audit.pagination.page', { current: page + 1 })}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 0 || loading}
              className="btn-secondary p-2 disabled:opacity-50"
              aria-label={t('audit.pagination.previous')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="btn-secondary p-2 disabled:opacity-50"
              aria-label={t('audit.pagination.next')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
