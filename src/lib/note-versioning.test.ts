import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveNoteVersion,
  saveNextNoteVersion,
  getNoteVersions,
  getLatestVersionNumber,
  type NoteVersion,
} from './note-versioning';

import {
  createMockDocSnapshot,
  createMockQuerySnapshot,
  createMockCollectionRef,
  createMockQuery,
  createMockWhere,
  createMockOrderBy,
  createMockLimit,
} from '../test/test-utils';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
}));

import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';

describe('note-versioning', () => {
  const mockSessionId = 'session-123';
  const mockPsychologistId = 'psych-123';
  const mockNotes = 'Encrypted session notes';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collection).mockReturnValue(createMockCollectionRef('note_versions'));
    vi.mocked(query).mockReturnValue(createMockQuery());
    vi.mocked(where).mockReturnValue(createMockWhere('sessionId', '==', mockSessionId));
    vi.mocked(orderBy).mockReturnValue(createMockOrderBy('version', 'desc'));
    vi.mocked(limit).mockReturnValue(createMockLimit(1));
    vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));
    vi.mocked(addDoc).mockResolvedValue({ id: 'version-doc-id' });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getLatestVersionNumber', () => {
    it('returns 0 when no versions exist', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const result = await getLatestVersionNumber(mockSessionId, mockPsychologistId);

      expect(result).toBe(0);
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'note_versions');
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('sessionId', '==', mockSessionId);
      expect(where).toHaveBeenCalledWith('psychologistId', '==', mockPsychologistId);
      expect(orderBy).toHaveBeenCalledWith('version', 'desc');
      expect(limit).toHaveBeenCalledWith(1);
    });

    it('returns latest version number', async () => {
      const mockVersionDoc = createMockDocSnapshot('v1', { version: 5 });
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([mockVersionDoc]));

      const result = await getLatestVersionNumber(mockSessionId, mockPsychologistId);

      expect(result).toBe(5);
    });
  });

  describe('saveNoteVersion', () => {
    it('saves version with all fields', async () => {
      const docId = await saveNoteVersion(mockSessionId, mockPsychologistId, mockNotes, 3);

      expect(docId).toBe('version-doc-id');
      expect(addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        sessionId: mockSessionId,
        psychologistId: mockPsychologistId,
        notes: mockNotes,
        version: 3,
        createdAt: expect.any(String),
      }));
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'note_versions');
    });

    it('saves version with ISO timestamp', async () => {
      await saveNoteVersion(mockSessionId, mockPsychologistId, mockNotes, 1);

      const callArgs = vi.mocked(addDoc).mock.calls[0][1];
      expect(callArgs.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('saveNextNoteVersion', () => {
    it('gets next version and saves', async () => {
      const mockVersionDoc = createMockDocSnapshot('v1', { version: 2 });
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([mockVersionDoc]));

      const docId = await saveNextNoteVersion(mockSessionId, mockPsychologistId, mockNotes);

      expect(docId).toBe('version-doc-id');
      expect(getDocs).toHaveBeenCalled();
      expect(addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        version: 3,
      }));
    });

    it('starts at version 1 when no existing versions', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const docId = await saveNextNoteVersion(mockSessionId, mockPsychologistId, mockNotes);

      expect(docId).toBe('version-doc-id');
      expect(addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        version: 1,
      }));
    });
  });

  describe('getNoteVersions', () => {
    it('returns all versions ordered by version desc', async () => {
      const mockVersions = [
        createMockDocSnapshot('v3', { sessionId: mockSessionId, psychologistId: mockPsychologistId, notes: 'notes 3', version: 3, createdAt: '2024-01-15T10:00:00Z' }),
        createMockDocSnapshot('v2', { sessionId: mockSessionId, psychologistId: mockPsychologistId, notes: 'notes 2', version: 2, createdAt: '2024-01-14T10:00:00Z' }),
        createMockDocSnapshot('v1', { sessionId: mockSessionId, psychologistId: mockPsychologistId, notes: 'notes 1', version: 1, createdAt: '2024-01-13T10:00:00Z' }),
      ];
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot(mockVersions));

      const result = await getNoteVersions(mockSessionId, mockPsychologistId);

      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
      expect(result[1].version).toBe(2);
      expect(result[2].version).toBe(1);
      expect(result[0].id).toBe('v3');
    });

    it('returns empty array when no versions', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      const result = await getNoteVersions(mockSessionId, mockPsychologistId);

      expect(result).toEqual([]);
    });

    it('queries with correct constraints', async () => {
      vi.mocked(getDocs).mockResolvedValue(createMockQuerySnapshot([]));

      await getNoteVersions(mockSessionId, mockPsychologistId);

      expect(collection).toHaveBeenCalledWith(expect.anything(), 'note_versions');
      expect(where).toHaveBeenCalledWith('sessionId', '==', mockSessionId);
      expect(where).toHaveBeenCalledWith('psychologistId', '==', mockPsychologistId);
      expect(orderBy).toHaveBeenCalledWith('version', 'desc');
    });
  });
});