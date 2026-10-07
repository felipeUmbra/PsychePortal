import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  triggerFullBackup,
  getBackupHistory,
  buildBackupFileName,
  listBackupFiles,
  deleteDriveFile,
  uploadToDrive,
  pruneOldBackups,
  buildSnapshot,
} from './backup';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));

import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

describe('backup', () => {
  const mockPsychologistId = 'psych-123';
  const mockPrimaryToken = 'primary-token';
  const mockSecondaryToken = 'secondary-token';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collection).mockReturnValue({});
    vi.mocked(query).mockReturnValue({});
    vi.mocked(where).mockReturnValue({});
    vi.mocked(getDocs).mockResolvedValue({ docs: [] });
    
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete (global as any).fetch;
  });

  describe('buildBackupFileName', () => {
    it('generates correctly formatted filename', () => {
      const fileName = buildBackupFileName();
      expect(fileName).toMatch(/^workspace-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
    });
  });

  describe('listBackupFiles', () => {
    it('fetches and returns backup files', async () => {
      const mockFiles = [
        { id: 'f1', name: 'workspace-backup-2024-01-15-103000.json', createdTime: '2024-01-15T10:30:00Z' },
        { id: 'f2', name: 'workspace-backup-2024-01-14-103000.json', createdTime: '2024-01-14T10:30:00Z' },
      ];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: mockFiles }),
      });

      const result = await listBackupFiles(mockPrimaryToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('spaces=appDataFolder'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer primary-token' }) })
      );
      expect(result).toEqual(mockFiles);
    });

    it('throws on failed request', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 });

      await expect(listBackupFiles(mockPrimaryToken)).rejects.toThrow('Drive list failed: 403');
    });

    it('returns empty array when no files', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ files: [] }) });

      const result = await listBackupFiles(mockPrimaryToken);
      expect(result).toEqual([]);
    });
  });

  describe('deleteDriveFile', () => {
    it('deletes file successfully', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true });

      await deleteDriveFile('file-123', mockPrimaryToken);

      expect(fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/drive/v3/files/file-123',
        expect.objectContaining({ method: 'DELETE', headers: expect.objectContaining({ Authorization: 'Bearer primary-token' }) })
      );
    });
  });

  describe('uploadToDrive', () => {
    it('creates new file when not exists', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) }) // Search
        .mockResolvedValueOnce({ ok: true }); // Create

      await uploadToDrive('test.json', '{"data": "test"}', mockPrimaryToken);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('uploadType=multipart'), expect.anything());
    });

    it('updates existing file', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'existing-id' }] }) }) // Search
        .mockResolvedValueOnce({ ok: true }); // Update

      await uploadToDrive('test.json', '{"data": "test"}', mockPrimaryToken);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('existing-id'), expect.objectContaining({ method: 'PATCH' }));
    });

    it('throws on create failure', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(uploadToDrive('test.json', '{}', mockPrimaryToken)).rejects.toThrow('Drive create failed: 500');
    });

    it('throws on update failure', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'existing-id' }] }) })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(uploadToDrive('test.json', '{}', mockPrimaryToken)).rejects.toThrow('Drive update failed: 500');
    });
  });

  describe('pruneOldBackups', () => {
    it('deletes old backups when exceeding MAX_DAILY_SNAPSHOTS', async () => {
      const mockFiles: any[] = [];
      for (let i = 0; i < 35; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '-');
        mockFiles.push({
          id: `f${i}`,
          name: `workspace-backup-${dateStr}-103000.json`,
          createdTime: date.toISOString(),
        });
      }
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: mockFiles }) }) // list
        .mockResolvedValue({ ok: true }); // deletes

      const deleted = await pruneOldBackups(mockPrimaryToken);

      expect(deleted).toBe(5);
    });

    it('handles files without date pattern', async () => {
      const mockFiles = [
        { id: 'f1', name: 'workspace-backup-2024-01-15-103000.json', createdTime: '2024-01-15T10:30:00Z' },
        { id: 'f2', name: 'invalid-name.json', createdTime: '2024-01-14T10:30:00Z' },
      ];
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: mockFiles }) })
        .mockResolvedValue({ ok: true });

      const deleted = await pruneOldBackups(mockPrimaryToken);
      expect(deleted).toBe(0);
    });

    it('returns 0 when no files to prune', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ files: [] }) });

      const deleted = await pruneOldBackups(mockPrimaryToken);
      expect(deleted).toBe(0);
    });
  });

  describe('buildSnapshot', () => {
    it('builds complete snapshot', async () => {
      const mockPatients = [{ id: 'p1', data: () => ({ psychologistId: mockPsychologistId, name: 'Patient 1' }) }];
      const mockSessions = [{ id: 's1', data: () => ({ psychologistId: mockPsychologistId, type: 'individual' }) }];
      const mockAuditLogs = [{ id: 'a1', data: () => ({ actorId: mockPsychologistId, action: 'create' }) }];
      const mockPsychologists = [{ id: mockPsychologistId, data: () => ({ name: 'Dr. Test' }) }];

      vi.mocked(getDocs)
        .mockResolvedValueOnce({ docs: mockPatients }) // patients
        .mockResolvedValueOnce({ docs: mockSessions }) // sessions
        .mockResolvedValueOnce({ docs: mockAuditLogs }) // audit_logs
        .mockResolvedValueOnce({ docs: mockPsychologists }); // psychologists

      const snapshot = await buildSnapshot(mockPsychologistId);

      expect(snapshot).toHaveProperty('patients');
      expect(snapshot).toHaveProperty('sessions');
      expect(snapshot).toHaveProperty('audit_logs');
      expect(snapshot).toHaveProperty('psychologists');
      expect(snapshot).toHaveProperty('_meta');
      expect(snapshot._meta).toHaveProperty('exportedBy', mockPsychologistId);
      expect(snapshot._meta).toHaveProperty('version', '1.0');
    });
  });

  describe('triggerFullBackup', () => {
    it('uploads to primary and prunes', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) }) // list for prune
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) }) // search for upload
        .mockResolvedValueOnce({ ok: true }) // create upload
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'f1', name: 'backup.json' }] }) }); // list after prune

      const mockPatients = [{ id: 'p1', data: () => ({ psychologistId: mockPsychologistId }) }];
      vi.mocked(getDocs)
        .mockResolvedValueOnce({ docs: mockPatients })
        .mockResolvedValue({ docs: [] });

      const result = await triggerFullBackup(mockPrimaryToken, mockPsychologistId);

      expect(result.primary).toBe(true);
      expect(result.secondary).toBe(false);
      expect(result.fileName).toMatch(/^workspace-backup-/);
    });

    it('uploads to secondary when token provided', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) }) // list for prune
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) }) // search primary
        .mockResolvedValueOnce({ ok: true }) // create primary
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'f1' }] }) }) // list after prune
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) }) // search secondary
        .mockResolvedValueOnce({ ok: true }); // create secondary

      const mockPatients = [{ id: 'p1', data: () => ({ psychologistId: mockPsychologistId }) }];
      vi.mocked(getDocs)
        .mockResolvedValueOnce({ docs: mockPatients })
        .mockResolvedValue({ docs: [] });

      const result = await triggerFullBackup(mockPrimaryToken, mockPsychologistId, mockSecondaryToken);

      expect(result.primary).toBe(true);
      expect(result.secondary).toBe(true);
    });

    it('handles secondary backup failure gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [{ id: 'f1' }] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ files: [] }) })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const mockPatients = [{ id: 'p1', data: () => ({ psychologistId: mockPsychologistId }) }];
      vi.mocked(getDocs)
        .mockResolvedValueOnce({ docs: mockPatients })
        .mockResolvedValue({ docs: [] });

      const result = await triggerFullBackup(mockPrimaryToken, mockPsychologistId, mockSecondaryToken);

      expect(result.primary).toBe(true);
      expect(result.secondary).toBe(false);
      expect(result.secondaryError).toBeDefined();
    });
  });

  describe('getBackupHistory', () => {
    it('returns backup history', async () => {
      const mockFiles = [{ id: 'f1', name: 'workspace-backup-2024-01-15-103000.json', createdTime: '2024-01-15T10:30:00Z' }];
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({ files: mockFiles }) });

      const result = await getBackupHistory(mockPrimaryToken);

      expect(result).toEqual(mockFiles);
    });
  });
});