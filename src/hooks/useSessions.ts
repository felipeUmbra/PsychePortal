import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage, deleteObject, setDriveToken as setMockToken } from '../lib/firestore-mock'; // Import from mock
import { db, auth } from '../firebase'; // Remove 'storage' import
import { useAuthState } from 'react-firebase-hooks/auth';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Session } from '../types';
import { useGoogleAuth } from '../context/GoogleAuthContext';

export function useSessions(patientId?: string) {
  const [user] = useAuthState(auth);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const { driveToken, calendarToken } = useGoogleAuth();
  const { t } = useTranslation();

  // Sync context token with mock module variable
  useEffect(() => {
    if (driveToken) {
      setMockToken(driveToken);
    }
  }, [driveToken]);

  useEffect(() => {
    if (!patientId || !user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'sessions'),
      where('patientId', '==', patientId),
      where('psychologistId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      setSessions(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Session)));
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientId, user]);

  const addSession = async (sessionData: Omit<Session, 'id' | 'psychologistId' | 'patientId' | 'createdAt'>) => {
    if (!user || !patientId) throw new Error('Unauthenticated or missing patient ID');
    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        ...sessionData,
        patientId,
        psychologistId: user.uid,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessions');
      throw error;
    }
  };

  const updateSession = async (sessionId: string, updates: Partial<Session>) => {
    if (!user) throw new Error('Unauthenticated');
    try {
      const session = sessions.find(s => s.id === sessionId);
      const googleEventId = updates.googleEventId || session?.googleEventId;

      await updateDoc(doc(db, 'sessions', sessionId), updates);

      // Sincronização com Google Calendar se a data mudou e existe um evento vinculado
      if (googleEventId && updates.date && calendarToken) {
        const startTime = new Date(updates.date);
        const endTime = new Date(startTime.getTime() + 3600000); // Padrão 1h

        const eventUpdate = {
          start: { dateTime: startTime.toISOString() },
          end: { dateTime: endTime.toISOString() },
          summary: `${t('layout.workspace')}: ${updates.type || session?.type || ''}`
        };

        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${calendarToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventUpdate)
        });

        window.dispatchEvent(new CustomEvent('google-auth-success'));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
      throw error;
    }
  };

  const cancelSession = async (session: Session) => {
    try {
      await updateSession(session.id, { status: 'cancelled' });

      if (session.googleEventId) {
        const token = calendarToken;
        if (token) {
          const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${session.googleEventId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (res.status === 401 || res.status === 403) {
            const errorData = await res.json().catch(() => ({}));
            window.dispatchEvent(new CustomEvent('google-auth-error', {
              detail: {
                status: res.status,
                service: 'calendar',
                message: errorData.error?.message || res.statusText
              }
            }));
          } else if (res.ok) {
            window.dispatchEvent(new CustomEvent('google-auth-success'));
          }
        }
      }
    } catch (error) {
      console.error("Failed to cancel session:", error);
    }
  };

  const uploadFile = async (file: File, sessionId: string) => {
    if (!user) throw new Error('Unauthenticated');

    // 40MB limit
    if (file.size > 40 * 1024 * 1024) {
      throw new Error('File size exceeds 40MB limit.');
    }

    try {
      setIsUploading(true);
      const storageRef = ref(getStorage(), `sessions/${sessionId}/${Date.now()}_${file.name}`); // Use getStorage() from mock
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return { name: file.name, url, size: file.size };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (url: string, sessionId: string) => {
    if (!user) throw new Error('Unauthenticated');
    try {
      const storageRef = { path: url.split('attachment:')[1] || url };
      await deleteObject(storageRef);
    } catch (error) {
      console.error('File deletion failed:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!user) throw new Error('Unauthenticated');
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sessions/${sessionId}`);
      throw error;
    }
  };

  return {
    sessions,
    loading,
    addSession,
    updateSession,
    cancelSession,
    deleteSession,
    uploadFile,
    deleteFile,
    isUploading
  };
}
