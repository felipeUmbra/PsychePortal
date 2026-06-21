import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { PatientConsent } from '../types';
import { logEvent } from '../lib/audit';

export function usePatientConsent(patientId?: string) {
  const [user] = useAuthState(auth);
  const [consents, setConsents] = useState<PatientConsent[]>([]);
  const [loading, setLoading] = useState(true);

  const hasActiveConsent = consents.some(c => !c.revokedAt);

  useEffect(() => {
    if (!patientId || !user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'patient_consents'),
      where('patientId', '==', patientId),
      orderBy('acceptedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const loaded: PatientConsent[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));
      setConsents(loaded);
      setLoading(false);
    }, (error: any) => {
      console.error('Failed to load consents:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientId, user]);

  const acceptConsent = async (data: {
    signature: string;
    acceptedAt: string;
    acceptedFrom: string;
    text: string;
    version: string;
    isMinor?: boolean;
    guardianName?: string;
    guardianRelationship?: string;
    guardianCpf?: string;
  }) => {
    if (!user || !patientId) throw new Error('Unauthenticated or missing patient ID');
    try {
      let psychologistId: string | undefined;
      try {
        const patientSnap = await getDocs(query(collection(db, 'patients'), where('__name__', '==', patientId), limit(1)));
        if (patientSnap.docs.length > 0) {
          psychologistId = patientSnap.docs[0].data().psychologistId;
        }
      } catch { /* ignore */ }
      const docRef = await addDoc(collection(db, 'patient_consents'), {
        ...data,
        patientId,
        psychologistId,
        ipHint: 'client-side'
      });

      await logEvent({
        actorId: user.uid,
        action: 'consent_accept',
        entity: 'consent',
        entityId: docRef.id,
        afterData: { patientId, version: data.version, signature: data.signature }
      });

      return docRef.id;
    } catch (error) {
      console.error('Failed to accept consent:', error);
      throw error;
    }
  };

  const revokeConsent = async () => {
    if (!user || !patientId) throw new Error('Unauthenticated or missing patient ID');
    const activeConsent = consents.find(c => !c.revokedAt);
    if (!activeConsent) throw new Error('No active consent to revoke');
    try {
      await updateDoc(doc(db, 'patient_consents', activeConsent.id), {
        revokedAt: new Date().toISOString()
      });

      await logEvent({
        actorId: user.uid,
        action: 'consent_revoke',
        entity: 'consent',
        entityId: activeConsent.id,
        beforeData: { acceptedAt: activeConsent.acceptedAt, signature: activeConsent.signature },
        afterData: { revokedAt: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Failed to revoke consent:', error);
      throw error;
    }
  };

  const checkConsent = async (pid: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const q = query(
        collection(db, 'patient_consents'),
        where('patientId', '==', pid),
        orderBy('acceptedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const list: PatientConsent[] = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      return list.some(c => !c.revokedAt);
    } catch (error) {
      console.error('Failed to check consent:', error);
      return false;
    }
  };

  return {
    consents,
    loading,
    hasActiveConsent,
    acceptConsent,
    revokeConsent,
    checkConsent
  };
}
