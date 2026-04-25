import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Patient } from '../types';

export function usePatients() {
  const [user] = useAuthState(auth);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'patients'),
      where('psychologistId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'patients');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'psychologistId'>) => {
    if (!user) throw new Error('Unauthenticated');
    try {
      const docRef = await addDoc(collection(db, 'patients'), {
        ...patientData,
        psychologistId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patients');
      throw error;
    }
  };

  return { patients, loading, addPatient };
}

export function usePatient(id?: string) {
  const [user] = useAuthState(auth);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    const fetchPatient = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'patients', id));
        if (docSnap.exists()) {
          setPatient({ id: docSnap.id, ...docSnap.data() } as Patient);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `patients/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id, user]);

  const updatePatient = async (updates: Partial<Patient>) => {
    if (!id || !user) return;
    try {
      await updateDoc(doc(db, 'patients', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      setPatient(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${id}`);
      throw error;
    }
  };

  return { patient, loading, updatePatient };
}
