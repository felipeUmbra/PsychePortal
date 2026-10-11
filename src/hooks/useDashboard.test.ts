// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

import {
  createMockUser,
  createMockAuthStateChanged,
} from '../test/test-utils';

vi.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('react-firebase-hooks/auth', () => ({
  useAuthState: vi.fn(() => [createMockUser('test-uid-123'), false]),
}));

vi.mock('../lib/error-handler', () => ({
  handleFirestoreError: vi.fn(),
  OperationType: { LIST: 'LIST' },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
}));

import { useDashboard } from './useDashboard';
import * as firestore from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';

describe('useDashboard', () => {
    const mockCollection = vi.fn();
    const mockQuery = vi.fn();
    const mockWhere = vi.fn();
    const mockGetDocs = vi.fn();
    const mockLimit = vi.fn();
    const mockOrderBy = vi.fn();
    const mockOnSnapshot = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(useAuthState).mockReturnValue([createMockUser('test-uid-123'), false]);

      vi.mocked(firestore.collection).mockImplementation(mockCollection);
      vi.mocked(firestore.query).mockImplementation(mockQuery);
      vi.mocked(firestore.where).mockImplementation(mockWhere);
      vi.mocked(firestore.getDocs).mockImplementation(mockGetDocs);
      vi.mocked(firestore.limit).mockImplementation(mockLimit);
      vi.mocked(firestore.orderBy).mockImplementation(mockOrderBy);
      vi.mocked(firestore.onSnapshot).mockImplementation(mockOnSnapshot);

      // Default mock implementations
      mockCollection.mockReturnValue({ path: 'patients' });
      mockQuery.mockReturnValue({ path: 'patients', conditions: [] });
      mockWhere.mockReturnValue({ type: 'where' });
      mockLimit.mockReturnValue({ type: 'limit' });
      mockOrderBy.mockReturnValue({ type: 'orderBy' });
            mockGetDocs.mockImplementation(() => Promise.resolve({ size: 0, docs: [] }));
      mockOnSnapshot.mockImplementation((q, callback) => {
              // Call callback synchronously for tests
              callback({ docs: [] });
        return vi.fn();
      });
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('initializes with loading state', async () => {
      const { result } = renderHook(() => useDashboard());
      expect(result.current.loading).toBe(true);
    
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('sets loading to false when no user', async () => {
      vi.mocked(useAuthState).mockReturnValue([null, false]);

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual({
        patients: 0,
        sessions: 0,
        scheduled: 0,
        growth: '0%',
      });
    });

    it('fetches stats when user is authenticated', async () => {
      const mockPatientsSnap = { size: 5, docs: [] };
      const mockSessionsSnap = { size: 10, docs: [] };
      const mockScheduledSnap = { size: 3, docs: [] };

      mockGetDocs
        .mockResolvedValueOnce(mockPatientsSnap)
        .mockResolvedValueOnce(mockSessionsSnap)
        .mockResolvedValueOnce(mockScheduledSnap);

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.stats.patients).toBe(5);
      expect(result.current.stats.sessions).toBe(10);
      expect(result.current.stats.scheduled).toBe(3);
    });

  it('calculates growth percentage correctly', async () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const mockSessionsSnap = {
      size: 10,
      docs: [
        { data: () => ({ date: new Date(currentYear, currentMonth, 15) }) },
        { data: () => ({ date: new Date(currentYear, currentMonth, 20) }) },
        { data: () => ({ date: new Date(previousYear, previousMonth, 10) }) },
      ],
    };

    mockGetDocs
      .mockResolvedValueOnce({ size: 5, docs: [] }) // patients
      .mockResolvedValueOnce(mockSessionsSnap) // sessions
      .mockResolvedValueOnce({ size: 0, docs: [] }); // scheduled

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 2 current month, 1 previous month = 100% growth
    expect(result.current.stats.growth).toBe('+100%');
  });

  it('handles zero previous month sessions', async () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const mockSessionsSnap = {
      size: 10,
      docs: [
        { data: () => ({ date: new Date(currentYear, currentMonth, 15) }) },
        { data: () => ({ date: new Date(currentYear, currentMonth, 20) }) },
      ],
    };

    mockGetDocs
      .mockResolvedValueOnce({ size: 5, docs: [] })
      .mockResolvedValueOnce(mockSessionsSnap)
      .mockResolvedValueOnce({ size: 0, docs: [] });

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.growth).toBe('+100%');
  });

  it('handles error in fetchStats', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should still have default stats
    expect(result.current.stats).toEqual({
      patients: 0,
      sessions: 0,
      scheduled: 0,
      growth: '0%',
    });
  });

  it('sets up today sessions listener', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(firestore.onSnapshot).toHaveBeenCalled();
    expect(firestore.query).toHaveBeenCalled();
    expect(firestore.where).toHaveBeenCalled();
    expect(firestore.orderBy).toHaveBeenCalled();
  });

  it('sets up recent sessions listener', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(firestore.onSnapshot).toHaveBeenCalledTimes(2); // today + recent
  });

  it('cleans up listeners on unmount', async () => {
    const unsubscribeToday = vi.fn();
    const unsubscribeSessions = vi.fn();
    mockOnSnapshot
      .mockReturnValueOnce(unsubscribeToday)
      .mockReturnValueOnce(unsubscribeSessions);

    const { result, unmount } = renderHook(() => useDashboard());

      // Wait for the hook to initialize (loading becomes false)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      unmount();

      expect(unsubscribeToday).toHaveBeenCalled();
      expect(unsubscribeSessions).toHaveBeenCalled();
    }, 15000);

  it('updates scheduled count dynamically from today sessions', async () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 3600000); // 1 hour from now
    const pastDate = new Date(now.getTime() - 3600000); // 1 hour ago

    const mockTodaySessions = {
      docs: [
        { id: '1', data: () => ({ date: futureDate, status: 'scheduled' }) },
        { id: '2', data: () => ({ date: pastDate, status: 'scheduled' }) },
        { id: '3', data: () => ({ date: futureDate, status: 'completed' }) },
      ],
    };

    mockOnSnapshot
      .mockImplementationOnce((q, callback) => {
        callback(mockTodaySessions);
        return vi.fn();
      })
      .mockImplementationOnce((q, callback) => {
        callback({ docs: [] });
        return vi.fn();
      });

    mockGetDocs
      .mockResolvedValueOnce({ size: 5, docs: [] })
      .mockResolvedValueOnce({ size: 10, docs: [] })
      .mockResolvedValueOnce({ size: 0, docs: [] });

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have 1 upcoming session (futureDate, scheduled)
    expect(result.current.stats.scheduled).toBe(1);
  });
});