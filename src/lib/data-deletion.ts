/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Data Deletion module - implements the Right to Erasure (GDPR/LGPD Article 18).
 * Deletes all patient data: patient document, sessions, consents, and Drive attachments.
 * Every deletion is logged to the tamper-evident audit trail.
 */

import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logDelete } from './audit';
import { deleteObject } from './firestore-mock';

export interface DeletionResult {
  patientDeleted: boolean;
  sessionsDeleted: number;
  consentsDeleted: number;
  attachmentsDeleted: number;
  executedAt: string;
}

export async function deleteAllPatientData(
  patientId: string,
  psychologistId: string
): Promise<DeletionResult> {
  const result: DeletionResult = {
    patientDeleted: false,
    sessionsDeleted: 0,
    consentsDeleted: 0,
    attachmentsDeleted: 0,
    executedAt: new Date().toISOString(),
  };

  // 1. Fetch all sessions first (we need attachment refs before deleting sessions)
  const sessionsSnap = await getDocs(
    query(collection(db, 'sessions'), where('patientId', '==', patientId))
  );
  const sessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // 2. Delete all attachments from Google Drive
  for (const session of sessions) {
    const attachments = (session as any).attachments;
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        try {
          // Use stored storagePath if available (new format), otherwise reconstruct from legacy pattern
          const storagePath = (att as any).storagePath
            || `patients/${psychologistId}/${session.id}/${att.name}`;
          await deleteObject({ path: storagePath });
          result.attachmentsDeleted++;
        } catch (err) {
          console.error(`Failed to delete attachment ${att.name} from session ${session.id}:`, err);
        }
      }
    }
  }

  // Log attachment deletion to audit trail (bulk count)
  if (result.attachmentsDeleted > 0) {
    await logDelete(psychologistId, 'attachment', patientId, {
      count: result.attachmentsDeleted,
      context: 'erasure_request',
    });
  }

  // 3. Delete the patient document
  try {
    await deleteDoc(doc(db, 'patients', patientId));
    result.patientDeleted = true;
    await logDelete(psychologistId, 'patient', patientId, {
      context: 'erasure_request',
      sessionsCount: sessions.length,
    });
  } catch (err) {
    console.error('Failed to delete patient document:', err);
  }

  // 4. Delete all sessions
  for (const session of sessions) {
    try {
      await deleteDoc(doc(db, 'sessions', session.id));
      result.sessionsDeleted++;
    } catch (err) {
      console.error(`Failed to delete session ${session.id}:`, err);
    }
  }
  if (result.sessionsDeleted > 0) {
    await logDelete(psychologistId, 'session', patientId, {
      count: result.sessionsDeleted,
      context: 'erasure_request',
    });
  }

  // 5. Delete all consents
  const consentsSnap = await getDocs(
    query(collection(db, 'patient_consents'), where('patientId', '==', patientId))
  );
  for (const consentDoc of consentsSnap.docs) {
    try {
      await deleteDoc(doc(db, 'patient_consents', consentDoc.id));
      result.consentsDeleted++;
    } catch (err) {
      console.error(`Failed to delete consent ${consentDoc.id}:`, err);
    }
  }
  if (result.consentsDeleted > 0) {
    await logDelete(psychologistId, 'consent', patientId, {
      count: result.consentsDeleted,
      context: 'erasure_request',
    });
  }

  return result;
}
