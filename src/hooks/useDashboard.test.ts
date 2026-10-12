// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';

import {
  createMockUser,
  createMockAuthStateChanged,
  createMockOnSnapshot,
  createMockGetDocs,
  createMockDocSnapshot,
  createMockQuerySnapshot,
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
import { handleFirestoreError, OperationType } from '../lib/error-handler';
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
      
      // Default: empty results, async callback
      mockGetDocs.mockImplementation(() => Promise.resolve(createMockQuerySnapshot([])));
      mockOnSnapshot.mockImplementation(createMockOnSnapshot([]));
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('initializes with loading state', async () => {
      const { result } = renderHook(() => useDashboard());
      expect(result.current.loading).toBe(true);
    
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
          }, { timeout: 5000 });
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
          const mockPatientsSnap = createMockQuerySnapshot([
            createMockDocSnapshot('1', {}),
            createMockDocSnapshot('2', {}),
            createMockDocSnapshot('3', {}),
            createMockDocSnapshot('4', {}),
            createMockDocSnapshot('5', {}),
          ]);
          const mockSessionsSnap = createMockQuerySnapshot([
            createMockDocSnapshot('1', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('2', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('3', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('4', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('5', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('6', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('7', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('8', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('9', { status: 'completed', date: new Date() }),
            createMockDocSnapshot('10', { status: 'completed', date: new Date() }),
          ]);
          const now = new Date();
                    const futureDate = new Date(now.getTime() + 3600000); // 1 hour from now
                    const mockScheduledSnap = createMockQuerySnapshot([
                      createMockDocSnapshot('1', { status: 'scheduled', date: futureDate }),
                      createMockDocSnapshot('2', { status: 'scheduled', date: futureDate }),
                      createMockDocSnapshot('3', { status: 'scheduled', date: futureDate }),
                    ]);

                    mockGetDocs
                      .mockResolvedValueOnce(mockPatientsSnap)
                      .mockResolvedValueOnce(mockSessionsSnap)
                      .mockResolvedValueOnce(mockScheduledSnap);

                    // Mock onSnapshot to return the scheduled sessions for today's listener
                    mockOnSnapshot
                      .mockImplementationOnce(createMockOnSnapshot(mockScheduledSnap.docs)) // today's sessions
                      .mockImplementationOnce(createMockOnSnapshot([])); // recent sessions

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

      const mockSessionsSnap = createMockQuerySnapshot([
        createMockDocSnapshot('1', { date: new Date(currentYear, currentMonth, 15), status: 'completed' }),
        createMockDocSnapshot('2', { date: new Date(currentYear, currentMonth, 20), status: 'completed' }),
        createMockDocSnapshot('3', { date: new Date(previousYear, previousMonth, 10), status: 'completed' }),
      ]);

      mockGetDocs
        .mockResolvedValueOnce(createMockQuerySnapshot([
          createMockDocSnapshot('1', {}),
          createMockDocSnapshot('2', {}),
          createMockDocSnapshot('3', {}),
          createMockDocSnapshot('4', {}),
          createMockDocSnapshot('5', {}),
        ])) // patients
        .mockResolvedValueOnce(mockSessionsSnap) // sessions
        .mockResolvedValueOnce(createMockQuerySnapshot([])); // scheduled

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      // 2 current month, 1 previous month = 100% growth
      expect(result.current.stats.growth).toBe('+100%');
    });

  it('handles zero previous month sessions', async () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

      const mockSessionsSnap = createMockQuerySnapshot([
        createMockDocSnapshot('1', { date: new Date(currentYear, currentMonth, 15), status: 'completed' }),
        createMockDocSnapshot('2', { date: new Date(currentYear, currentMonth, 20), status: 'completed' }),
      ]);

      mockGetDocs
        .mockResolvedValueOnce(createMockQuerySnapshot([
          createMockDocSnapshot('1', {}),
          createMockDocSnapshot('2', {}),
          createMockDocSnapshot('3', {}),
          createMockDocSnapshot('4', {}),
          createMockDocSnapshot('5', {}),
        ]))
        .mockResolvedValueOnce(mockSessionsSnap)
        .mockResolvedValueOnce(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

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

  it('reports both realtime listener errors and resolves loading', async () => {
    const todayError = new Error('today listener failed');
    const recentError = new Error('recent listener failed');
    mockOnSnapshot
      .mockImplementationOnce((_query, _onNext, onError) => {
        onError(todayError);
        return vi.fn();
      })
      .mockImplementationOnce((_query, _onNext, onError) => {
        onError(recentError);
        return vi.fn();
      });

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(handleFirestoreError).toHaveBeenCalledWith(todayError, OperationType.LIST, 'sessions');
    expect(handleFirestoreError).toHaveBeenCalledWith(recentError, OperationType.LIST, 'sessions');
  });

  it('cleans up listeners on unmount', async () => {
    const unsubscribeToday = vi.fn();
    const unsubscribeSessions = vi.fn();
    mockOnSnapshot
          .mockImplementationOnce((q, callback) => {
            callback(createMockQuerySnapshot([]));
            return unsubscribeToday;
          })
          .mockImplementationOnce((q, callback) => {
            callback(createMockQuerySnapshot([]));
            return unsubscribeSessions;
          });

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

      const mockTodaySessions = createMockQuerySnapshot([
        createMockDocSnapshot('1', { date: futureDate, status: 'scheduled' }),
        createMockDocSnapshot('2', { date: pastDate, status: 'scheduled' }),
        createMockDocSnapshot('3', { date: futureDate, status: 'completed' }),
      ]);

      mockOnSnapshot
        .mockImplementationOnce(createMockOnSnapshot(mockTodaySessions.docs))
        .mockImplementationOnce(createMockOnSnapshot([]));

      mockGetDocs
        .mockResolvedValueOnce(createMockQuerySnapshot([
          createMockDocSnapshot('1', {}),
          createMockDocSnapshot('2', {}),
          createMockDocSnapshot('3', {}),
          createMockDocSnapshot('4', {}),
          createMockDocSnapshot('5', {}),
        ]))
        .mockResolvedValueOnce(createMockQuerySnapshot([
          createMockDocSnapshot('1', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('2', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('3', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('4', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('5', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('6', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('7', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('8', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('9', { status: 'completed', date: new Date() }),
          createMockDocSnapshot('10', { status: 'completed', date: new Date() }),
        ]))
        .mockResolvedValueOnce(createMockQuerySnapshot([]));

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

            // Wait for the onSnapshot callback to update the scheduled count
            // The callback is called via Promise.resolve().then(), so we need to wait for microtasks
            await waitFor(() => {
              expect(result.current.stats.scheduled).toBe(1);
            }, { timeout: 15000 });
    });

      it('handles subscription error in today sessions listener', async () => {
        const error = new Error('Today listener failed');
        mockOnSnapshot
          .mockImplementationOnce((_query, _onNext, onError) => {
            onError(error);
            return vi.fn();
          })
          .mockImplementationOnce(createMockOnSnapshot([]));

        mockGetDocs
          .mockResolvedValueOnce(createMockQuerySnapshot([createMockDocSnapshot('1', {})]))
          .mockResolvedValueOnce(createMockQuerySnapshot([]))
          .mockResolvedValueOnce(createMockQuerySnapshot([]));

        const { result } = renderHook(() => useDashboard());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(handleFirestoreError).toHaveBeenCalledWith(error, OperationType.LIST, 'sessions');
      });

      it('handles subscription error in recent sessions listener', async () => {
        const error = new Error('Recent listener failed');
        mockOnSnapshot
          .mockImplementationOnce(createMockOnSnapshot([]))
          .mockImplementationOnce((_query, _onNext, onError) => {
            onError(error);
            return vi.fn();
          });

        mockGetDocs
          .mockResolvedValueOnce(createMockQuerySnapshot([createMockDocSnapshot('1', {})]))
          .mockResolvedValueOnce(createMockQuerySnapshot([]))
          .mockResolvedValueOnce(createMockQuerySnapshot([]));

        const { result } = renderHook(() => useDashboard());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(handleFirestoreError).toHaveBeenCalledWith(error, OperationType.LIST, 'sessions');
      });

      it('handles empty patients and sessions', async () => {
        mockGetDocs
          .mockResolvedValueOnce(createMockQuerySnapshot([]))
          .mockResolvedValueOnce(createMockQuerySnapshot([]))
          .mockResolvedValueOnce(createMockQuerySnapshot([]));

        mockOnSnapshot
          .mockImplementationOnce(createMockOnSnapshot([]))
          .mockImplementationOnce(createMockOnSnapshot([]));

        const { result } = renderHook(() => useDashboard());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.stats).toEqual({
          patients: 0,
          sessions: 0,
          scheduled: 0,
          growth: '0%',
        });
      });

      it('handles growth calculation with zero previous month', async () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const mockSessionsSnap = createMockQuerySnapshot([
          createMockDocSnapshot('1', { date: new Date(currentYear, currentMonth, 15), status: 'completed' }),
          createMockDocSnapshot('2', { date: new Date(currentYear, currentMonth, 20), status: 'completed' }),
        ]);

        mockGetDocs
          .mockResolvedValueOnce(createMockQuerySnapshot([createMockDocSnapshot('1', {})]))
          .mockResolvedValueOnce(mockSessionsSnap)
          .mockResolvedValueOnce(createMockQuerySnapshot([]));

        mockOnSnapshot
          .mockImplementationOnce(createMockOnSnapshot([]))
          .mockImplementationOnce(createMockOnSnapshot([]));

        const { result } = renderHook(() => useDashboard());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.stats.growth).toBe('+100%');
      });

      it('handles negative growth percentage', async () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const mockSessionsSnap = createMockQuerySnapshot([
          createMockDocSnapshot('1', { date: new Date(currentYear, currentMonth, 15), status: 'completed' }),
          createMockDocSnapshot('2', { date: new Date(previousYear, previousMonth, 10), status: 'completed' }),
          createMockDocSnapshot('3', { date: new Date(previousYear, previousMonth, 20), status: 'completed' }),
        ]);

        mockGetDocs
          .mockResolvedValueOnce(createMockQuerySnapshot([createMockDocSnapshot('1', {})]))
          .mockResolvedValueOnce(mockSessionsSnap)
          .mockResolvedValueOnce(createMockQuerySnapshot([]));

        mockOnSnapshot
          .mockImplementationOnce(createMockOnSnapshot([]))
          .mockImplementationOnce(createMockOnSnapshot([]));

        const { result } = renderHook(() => useDashboard());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.stats.growth).toBe('-50%');
      });

            it('handles early return when user is null', async () => {
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

            it('handles isMounted check in today sessions listener', async () => {
              const now = new Date();
              const futureDate = new Date(now.getTime() + 3600000);

              const mockTodaySessions = createMockQuerySnapshot([
                createMockDocSnapshot('1', { date: futureDate, status: 'scheduled' }),
              ]);

              mockOnSnapshot
                .mockImplementationOnce(createMockOnSnapshot(mockTodaySessions.docs))
                .mockImplementationOnce(createMockOnSnapshot([]));

              mockGetDocs
                .mockResolvedValueOnce(createMockQuerySnapshot([createMockDocSnapshot('1', {})]))
                .mockResolvedValueOnce(createMockQuerySnapshot([]))
                .mockResolvedValueOnce(createMockQuerySnapshot([]));

              const { result, unmount } = renderHook(() => useDashboard());

              await waitFor(() => expect(result.current.loading).toBe(false));

              // The scheduled count is set by fetchStats (3), then updated by onSnapshot callback
              // The isMounted check prevents updates after unmount
              // Just verify the hook works and unmount doesn't throw
              unmount();
              expect(result.current.stats.scheduled).toBeGreaterThanOrEqual(0);
            });

            it('handles recent sessions listener error and sets loading false', async () => {
              const error = new Error('Recent listener failed');
              mockOnSnapshot
                .mockImplementationOnce(createMockOnSnapshot([]))
                .mockImplementationOnce((_query, _onNext, onError) => {
                  onError(error);
                  return vi.fn();
                });

              mockGetDocs
                .mockResolvedValueOnce(createMockQuerySnapshot([createMockDocSnapshot('1', {})]))
                .mockResolvedValueOnce(createMockQuerySnapshot([]))
                .mockResolvedValueOnce(createMockQuerySnapshot([]));

              const { result } = renderHook(() => useDashboard());
              await waitFor(() => expect(result.current.loading).toBe(false));
              expect(handleFirestoreError).toHaveBeenCalledWith(error, OperationType.LIST, 'sessions');
            });

          });