/**
 * Sync Status Component
 * Shows real-time sync status with Google Drive
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Cloud, 
  CloudOff, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  MoreHorizontal
} from 'lucide-react';
import { isOfflineMode, getSyncStatus, forceSync } from '../lib/firestore-mock';

type SyncStatusType = 'synced' | 'pending' | 'syncing' | 'error' | 'offline';

interface SyncStatusData {
  status: SyncStatusType;
  pendingCount: number;
  lastSynced: number | null;
  error?: string;
}

export function SyncStatus() {
  const { t } = useTranslation();
  const [syncData, setSyncData] = useState<SyncStatusData>({
    status: 'offline',
    pendingCount: 0,
    lastSynced: null,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initial load
  useEffect(() => {
    loadSyncStatus();
  }, []);

  // Listen for sync status changes
  useEffect(() => {
    const handleSyncStatusChange = (e: CustomEvent<SyncStatusData>) => {
      setSyncData(e.detail);
    };

    window.addEventListener('sync-status-changed', handleSyncStatusChange as EventListener);
    return () => {
      window.removeEventListener('sync-status-changed', handleSyncStatusChange as EventListener);
    };
  }, []);

  const loadSyncStatus = async () => {
    try {
      const offline = isOfflineMode();
      const meta = await getSyncStatus();
      
      let status: SyncStatusType = 'offline';
      if (offline) {
        status = 'offline';
      } else if (meta.pendingOperations > 0) {
        status = 'pending';
      } else if (meta.lastSynced) {
        status = 'synced';
      } else {
        status = 'pending';
      }

      setSyncData({
        status,
        pendingCount: meta.pendingOperations,
        lastSynced: meta.lastSynced,
      });
    } catch (err) {
      console.error('Failed to load sync status:', err);
      setSyncData({
        status: 'error',
        pendingCount: 0,
        lastSynced: null,
        error: 'Failed to load sync status',
      });
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      await forceSync();
      await loadSyncStatus();
    } catch (err) {
      console.error('Force sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSynced = (timestamp: number | null) => {
    if (!timestamp) return t('sync.never_synced', 'Never synced');
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('sync.just_now', 'Just now');
    if (diffMins < 60) return t('sync.minutes_ago', '{{count}} min ago', { count: diffMins });
    if (diffHours < 24) return t('sync.hours_ago', '{{count}} hours ago', { count: diffHours });
    return t('sync.days_ago', '{{count}} days ago', { count: diffDays });
  };

  const getStatusConfig = () => {
    switch (syncData.status) {
      case 'synced':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          label: t('sync.synced', 'Synced'),
          tooltip: t('sync.all_changes_synced', 'All changes synced to Google Drive'),
        };
      case 'pending':
        return {
          icon: Cloud,
          color: 'text-amber-500',
          bgColor: 'bg-amber-100',
          label: t('sync.pending', 'Pending'),
          tooltip: t('sync.pending_changes', '{{count}} changes pending sync', { count: syncData.pendingCount }),
        };
      case 'syncing':
        return {
          icon: Loader2,
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          label: t('sync.syncing', 'Syncing...'),
          tooltip: t('sync.sync_in_progress', 'Sync in progress...'),
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          label: t('sync.error', 'Error'),
          tooltip: syncData.error || t('sync.sync_failed', 'Sync failed'),
        };
      case 'offline':
      default:
        return {
          icon: CloudOff,
          color: 'text-slate-500',
          bgColor: 'bg-slate-100',
          label: t('sync.offline', 'Offline'),
          tooltip: t('sync.changes_saved_locally', 'Changes saved locally (no Drive connection)'),
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="relative">
      {/* Main indicator button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg transition-colors"
        aria-label={t('sync.status', 'Sync status')}
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.color}`} aria-hidden="true" />
        </div>
        <span className="hidden sm:block text-[12px] font-medium text-text-muted">
          {config.label}
        </span>
        {syncData.status === 'syncing' && (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" aria-hidden="true" />
        )}
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white border border-border-custom rounded-xl shadow-lg z-50 p-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 p-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`}>
                <Icon className={`w-4 h-4 ${config.color}`} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-text-main">{config.label}</p>
                <p className="text-[11px] text-text-muted">{config.tooltip}</p>
              </div>
            </div>

            <div className="border-t border-border-custom my-2" />

            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-text-muted">{t('sync.last_sync', 'Last sync')}</span>
                <span className="font-medium text-text-main">{formatLastSynced(syncData.lastSynced)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t('sync.pending_changes', 'Pending changes')}</span>
                <span className="font-medium text-text-main">{syncData.pendingCount}</span>
              </div>
              {syncData.error && (
                <div className="text-red-600 text-[11px] p-2 bg-red-50 rounded-lg">
                  {syncData.error}
                </div>
              )}
            </div>

            <div className="border-t border-border-custom my-2" />

            <button
              onClick={handleForceSync}
              disabled={isSyncing || syncData.status === 'offline'}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] text-primary-custom hover:bg-primary-custom/10 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isSyncing ? t('sync.syncing', 'Syncing...') : t('sync.force_sync', 'Force sync now')}
            </button>

            <div className="border-t border-border-custom my-2" />

            <button
              onClick={() => setIsMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] text-text-muted hover:bg-bg rounded-lg transition-colors font-medium"
            >
              <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
              {t('sync.view_details', 'View sync details')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}