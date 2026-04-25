import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Session } from '../types';

export function useSessions(patientId?: string) {
  const [user] = useAuthState(auth);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
      setLoading(false);
    }, (error) => {
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
        createdAt: new Date()
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
      await updateDoc(doc(db, 'sessions', sessionId), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
      throw error;
    }
  };

  const cancelSession = async (session: Session) => {
    try {
      await updateSession(session.id, { status: 'cancelled' });

      if (session.googleEventId) {
        const token = localStorage.getItem('google_oauth_token');
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
      const storageRef = ref(storage, `sessions/${sessionId}/${Date.now()}_${file.name}`);
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

  return { 
    sessions, 
    loading, 
    addSession, 
    updateSession, 
    cancelSession,
    uploadFile,
    isUploading
  };
}
