import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Session } from '../types';

export function useDashboard() {
  const [user] = useAuthState(auth);
  const [stats, setStats] = useState({ patients: 0, sessions: 0, scheduled: 0, growth: '0%' });
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchStats = async () => {
      try {
        const patientsSnap = await getDocs(query(collection(db, 'patients'), where('psychologistId', '==', user.uid)));
        const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('psychologistId', '==', user.uid), where('status', 'in', ['completed', 'no_show'])));
        const scheduledSnap = await getDocs(query(collection(db, 'sessions'), where('psychologistId', '==', user.uid), where('status', '==', 'scheduled')));
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        let currentMonthSessions = 0;
        let prevMonthSessions = 0;

        sessionsSnap.docs.forEach(doc => {
          const data = doc.data();
          const d = data.date?.toDate ? data.date.toDate() : new Date(data.date);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) currentMonthSessions++;
          if (d.getMonth() === previousMonth && d.getFullYear() === previousYear) prevMonthSessions++;
        });

        let growthPercentage = 0;
        if (prevMonthSessions === 0) {
          growthPercentage = currentMonthSessions > 0 ? 100 : 0;
        } else {
          growthPercentage = Math.round(((currentMonthSessions - prevMonthSessions) / prevMonthSessions) * 100);
        }

        const growthString = growthPercentage > 0 ? `+${growthPercentage}%` : `${growthPercentage}%`;

        if (isMounted) {
          setStats({
            patients: patientsSnap.size,
            sessions: sessionsSnap.size,
            scheduled: scheduledSnap.size,
            growth: growthString
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'stats');
      }
    };

    fetchStats();

    // Listen for today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const qToday = query(
      collection(db, 'sessions'),
      where('psychologistId', '==', user.uid),
      where('date', '>=', today),
      where('date', '<', tomorrow),
      orderBy('date', 'asc')
    );

    const unsubscribeToday = onSnapshot(qToday, (snapshot) => {
      if (isMounted) setTodaySessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sessions'));

    // Listen for recent sessions
    const qSessions = query(
      collection(db, 'sessions'),
      where('psychologistId', '==', user.uid),
      where('status', 'in', ['completed', 'no_show']),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
      if (isMounted) {
        setRecentSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribeToday();
      unsubscribeSessions();
    };
  }, [user]);

  return { stats, todaySessions, recentSessions, loading };
}
