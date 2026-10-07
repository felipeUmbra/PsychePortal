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

import {
  createMockDocSnapshot,
  createMockQuerySnapshot,
} from '../test/test-utils';

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

// Mock global fetch for this test file
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createMockResponse<T>(data: T, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: 'default',
    url: '',
    clone: () => createMockResponse(data, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

describe('backup', () => {
  const mockPsychologistId = 'psych-123';
  const mockPrimaryToken = 'primary-token';
  const mockSecondaryToken = 'secondary-token';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collection).mockReturnValue({ type: 'collection', path: 'patients' });
    vi.mocked(query).mockReturnValue({ type: 'query', conditions: [] });
    vi.mocked(where).mockReturnValue({ type: 'where', field: 'psychologistId', op: '==', val: mockPsychologistId });
    vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));
    
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
    mockFetch.mockReset();
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
      mockFetch.mockResolvedValue(createMockResponse({ files: mockFiles }));

      const result = await listBackupFiles(mockPrimaryToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('spaces=appDataFolder'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer primary-token' }) })
      );
      expect(result).toEqual(mockFiles);
    });

    it('throws on failed request', async () => {
      mockFetch.mockResolvedValue(createMockResponse(null, false, 403));

      await expect(listBackupFiles(mockPrimaryToken)).rejects.toThrow('Drive list failed: 403');
    });

    it('returns empty array when no files', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ files: [] }));

      const result = await listBackupFiles(mockPrimaryToken);
      expect(result).toEqual([]);
    });
  });

  describe('deleteDriveFile', () => {
    it('deletes file successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(undefined));

      await deleteDriveFile('file-123', mockPrimaryToken);

      expect(fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/drive/v3/files/file-123',
        expect.objectContaining({ method: 'DELETE', headers: expect.objectContaining({ Authorization: 'Bearer primary-token' }) })
      );
    });
  });

  describe('uploadToDrive', () => {
    it('creates new file when not exists', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // Search
        .mockResolvedValueOnce(createMockResponse(undefined)); // Create

      await uploadToDrive('test.json', '{"data": "test"}', mockPrimaryToken);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('uploadType=multipart'), expect.anything());
    });

    it('updates existing file', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: [{ id: 'existing-id' }] })) // Search
        .mockResolvedValueOnce(createMockResponse(undefined)); // Update

      await uploadToDrive('test.json', '{"data": "test"}', mockPrimaryToken);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('existing-id'), expect.objectContaining({ method: 'PATCH' }));
    });

    it('throws on create failure', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: [] }))
        .mockResolvedValueOnce(createMockResponse(null, false, 500));

      await expect(uploadToDrive('test.json', '{}', mockPrimaryToken)).rejects.toThrow('Drive create failed: 500');
    });

    it('throws on update failure', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: [{ id: 'existing-id' }] }))
        .mockResolvedValueOnce(createMockResponse(null, false, 500));

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
      
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: mockFiles })) // list
        .mockResolvedValue(createMockResponse(undefined)); // deletes

      const deleted = await pruneOldBackups(mockPrimaryToken);

      expect(deleted).toBe(5);
    });

    it('handles files without date pattern', async () => {
      const mockFiles = [
        { id: 'f1', name: 'workspace-backup-2024-01-15-103000.json', createdTime: '2024-01-15T10:30:00Z' },
        { id: 'f2', name: 'invalid-name.json', createdTime: '2024-01-14T10:30:00Z' },
      ];
      
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: mockFiles }))
        .mockResolvedValue(createMockResponse(undefined));

      const deleted = await pruneOldBackups(mockPrimaryToken);
      expect(deleted).toBe(0);
    });

    it('returns 0 when no files to prune', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ files: [] }));

      const deleted = await pruneOldBackups(mockPrimaryToken);
      expect(deleted).toBe(0);
    });
  });

  describe('buildSnapshot', () => {
    it('builds complete snapshot', async () => {
      const mockPatients = [createMockDocSnapshot('p1', { psychologistId: mockPsychologistId, name: 'Patient 1' })];
      const mockSessions = [createMockDocSnapshot('s1', { psychologistId: mockPsychologistId, type: 'individual' })];
      const mockAuditLogs = [createMockDocSnapshot('a1', { actorId: mockPsychologistId, action: 'create' })];
      const mockPsychologists = [createMockDocSnapshot(mockPsychologistId, { name: 'Dr. Test' })];

      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(mockPatients)) // patients
        .mockResolvedValueOnce(createMockQuerySnapshot(mockSessions)) // sessions
        .mockResolvedValueOnce(createMockQuerySnapshot(mockAuditLogs)) // audit_logs
        .mockResolvedValueOnce(createMockQuerySnapshot(mockPsychologists)); // psychologists

      const snapshot = await buildSnapshot(mockPsychologistId);

      expect(snapshot).toHaveProperty('patients');
      expect(snapshot).toHaveProperty('sessions');
      expect(snapshot).toHaveProperty('audit_logs');
      expect(snapshot).toHaveProperty('psychologists');
      expect((snapshot as any)._meta).toHaveProperty('exportedBy', mockPsychologistId);
      expect((snapshot as any)._meta).toHaveProperty('version', '1.0');
    });
  });

  describe('triggerFullBackup', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });
    it('uploads to primary and prunes', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // search for upload
        .mockResolvedValueOnce(createMockResponse(undefined)) // create upload
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // list for prune
        .mockResolvedValueOnce(createMockResponse({ files: [{ id: 'f1', name: 'backup.json' }] })); // list after prune

      const mockPatients = [createMockDocSnapshot('p1', { psychologistId: mockPsychologistId })];
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(mockPatients))
        .mockResolvedValue(createMockQuerySnapshot([]));

      const result = await triggerFullBackup(mockPrimaryToken, mockPsychologistId);

      expect(result.primary).toBe(true);
      expect(result.secondary).toBe(false);
      expect(result.fileName).toMatch(/^workspace-backup-/);
    });

    it('uploads to secondary when token provided', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // search primary
        .mockResolvedValueOnce(createMockResponse(undefined)) // create primary
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // list for prune
        .mockResolvedValueOnce(createMockResponse({ files: [{ id: 'f1' }] })) // list after prune
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // search secondary
        .mockResolvedValueOnce(createMockResponse(undefined)); // create secondary

      const mockPatients = [createMockDocSnapshot('p1', { psychologistId: mockPsychologistId })];
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(mockPatients))
        .mockResolvedValue(createMockQuerySnapshot([]));

      const result = await triggerFullBackup(mockPrimaryToken, mockPsychologistId, mockSecondaryToken);

      expect(result.primary).toBe(true);
      expect(result.secondary).toBe(true);
    });

    it('handles secondary backup failure gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // search primary
        .mockResolvedValueOnce(createMockResponse(undefined)) // create primary
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // list for prune
        .mockResolvedValueOnce(createMockResponse({ files: [{ id: 'f1' }] })) // list after prune
        .mockResolvedValueOnce(createMockResponse({ files: [] })) // search secondary
        .mockResolvedValueOnce(createMockResponse(null, false, 500)); // create secondary failure

      const mockPatients = [createMockDocSnapshot('p1', { psychologistId: mockPsychologistId })];
      vi.mocked(getDocs)
        .mockResolvedValueOnce(createMockQuerySnapshot(mockPatients))
        .mockResolvedValue(createMockQuerySnapshot([]));

      const result = await triggerFullBackup(mockPrimaryToken, mockPsychologistId, mockSecondaryToken);

      expect(result.primary).toBe(true);
      expect(result.secondary).toBe(false);
      expect(result.secondaryError).toBeDefined();
    });
  });

  describe('getBackupHistory', () => {
    it('returns backup history', async () => {
      const mockFiles = [{ id: 'f1', name: 'workspace-backup-2024-01-15-103000.json', createdTime: '2024-01-15T10:30:00Z' }];
      mockFetch.mockResolvedValue(createMockResponse({ files: mockFiles }));

      const result = await getBackupHistory(mockPrimaryToken);

      expect(result).toEqual(mockFiles);
    });
  });
});