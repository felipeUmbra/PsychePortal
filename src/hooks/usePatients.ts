import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Patient } from '../types';
import { useEncryption } from './useEncryption';

export function usePatients() {
  const [user] = useAuthState(auth);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const { isUnlocked, encrypt, decrypt } = useEncryption();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'patients'),
      where('psychologistId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const loaded = snapshot.docs.map((doc: any) => {
        const pt: Patient = { id: doc.id, ...doc.data() };
        if (isUnlocked && pt.notes) { try { const pl = JSON.parse(pt.notes); if (pl.version && pl.ciphertext) { decrypt(pl).then((x) => setPatients((prev) => prev.map((y) => y.id === pt.id ? { ...y, notes: x } : y))).catch(() => {}); pt.notes = ''; } } catch {} }
        if (isUnlocked && pt.anamnesis) {
          for (const f of ['chiefComplaint','medicalHistory','psychiatricHistory','familyHistory','medications','substanceUse','familyStructure','workStudies','socialHabits','psychiatricHistoryDetailed','recurrentSymptoms','predominantEmotions']) {
            if (pt.anamnesis[f]) { try { const pl = JSON.parse(pt.anamnesis[f]); if (pl.version && pl.ciphertext) { const cid = pt.id; decrypt(pl).then((x) => setPatients((prev) => prev.map((y) => y.id === cid ? { ...y, anamnesis: { ...y.anamnesis, [f]: x } } : y))).catch(() => {}); pt.anamnesis[f] = ''; } } catch {} }
          }
        }
        return pt;
      });
      setPatients(loaded);
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'patients');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'psychologistId'>) => {
    if (!user) throw new Error('Unauthenticated');
    try {
      const dataToWrite = { ...patientData };
      if (isUnlocked) {
        if (dataToWrite.notes) dataToWrite.notes = JSON.stringify(await encrypt(dataToWrite.notes));
        if (dataToWrite.anamnesis) {
          for (const f of ['chiefComplaint','medicalHistory','psychiatricHistory','familyHistory','medications','substanceUse','familyStructure','workStudies','socialHabits','psychiatricHistoryDetailed','recurrentSymptoms','predominantEmotions']) {
            if (dataToWrite.anamnesis[f]) dataToWrite.anamnesis[f] = JSON.stringify(await encrypt(dataToWrite.anamnesis[f]));
          }
        }
      }
      const docRef = await addDoc(collection(db, 'patients'), { ...dataToWrite, psychologistId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patients');
      throw error;
    }
  };

  const updatePatient = async (id: string, updates: Partial<Patient>) => {
    if (!user) throw new Error('Unauthenticated');
    try {
      const uw = { ...updates };
      if (isUnlocked) {
        if (uw.notes) uw.notes = JSON.stringify(await encrypt(uw.notes));
        if (uw.anamnesis) {
          for (const f of ['chiefComplaint','medicalHistory','psychiatricHistory','familyHistory','medications','substanceUse','familyStructure','workStudies','socialHabits','psychiatricHistoryDetailed','recurrentSymptoms','predominantEmotions']) {
            if (uw.anamnesis[f]) uw.anamnesis[f] = JSON.stringify(await encrypt(uw.anamnesis[f]));
          }
        }
      }
      await updateDoc(doc(db, 'patients', id), { ...uw, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${id}`);
      throw error;
    }
  };

  const deletePatient = async (id: string) => {
    if (!user) throw new Error('Unauthenticated');
    try {
      await deleteDoc(doc(db, 'patients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `patients/${id}`);
      throw error;
    }
  };

  return { patients, loading, addPatient, updatePatient, deletePatient };
}

export function usePatient(id?: string) {
  const [user] = useAuthState(auth);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }

    const fetchPatient = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'patients', id));
        if (docSnap.exists()) {
          setPatient({ id: docSnap.id, ...docSnap.data() } as Patient);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `patients/${id}`);
        // Error logged but not re-thrown to avoid crashing React render
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
