/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Data Subject Request (DSR) module - generates a signed JSON bundle
 * containing all data for a specific patient, suitable for GDPR/LGPD
 * data portability requests.
 */

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logEvent } from './audit';
import { sha256 } from './crypto';
import { getKeyRecord, base64Decode, deriveKeyFromPassphrase, decryptNote } from './note-crypto';

export interface DataBundle {
  metadata: {
    exportedAt: string;
    exportedBy: string;
    patientId: string;
    version: string;
  };
  patient: object | null;
  sessions: object[];
  consents: object[];
  integrity: {
    algorithm: string;
    hash: string;
  };
}

async function tryDecryptNote(encryptedPayload: any, psychologistId: string, passphrase?: string): Promise<{ plaintext: string | null; encrypted: boolean }> {
  if (!encryptedPayload || typeof encryptedPayload !== 'object') {
    return { plaintext: null, encrypted: false };
  }
  if (!encryptedPayload.ciphertext || !encryptedPayload.iv) {
    return { plaintext: String(encryptedPayload), encrypted: false };
  }
  if (!passphrase) {
    return { plaintext: null, encrypted: true };
  }
  try {
    const record = await getKeyRecord(psychologistId);
    if (!record) return { plaintext: null, encrypted: true };
    const salt = base64Decode(record.salt);
    const key = await deriveKeyFromPassphrase(passphrase, salt);
    const plaintext = await decryptNote(encryptedPayload, key);
    return { plaintext, encrypted: false };
  } catch {
    return { plaintext: null, encrypted: true };
  }
}

export async function generateDataBundle(patientId: string, psychologistId: string, passphrase?: string): Promise<DataBundle> {
  const patientDoc = await getDoc(doc(db, 'patients', patientId));
  const patient = patientDoc.exists() ? { id: patientDoc.id, ...patientDoc.data() } : null;
  const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('patientId', '==', patientId)));
  const sessions: object[] = [];
  for (const d of sessionsSnap.docs) {
    const data: any = { id: d.id, ...d.data() };
    if (data.notes) {
      const result = await tryDecryptNote(data.notes, psychologistId, passphrase);
      if (result.plaintext) {
        data.notes = result.plaintext;
        data._notesDecrypted = true;
      } else {
        data._notesDecrypted = false;
        if (result.encrypted) data._notesEncrypted = true;
      }
    }
    sessions.push(data);
  }
  const consentsSnap = await getDocs(query(collection(db, 'patient_consents'), where('patientId', '==', patientId)));
  const consents = consentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const bundle: DataBundle = {
    metadata: { exportedAt: new Date().toISOString(), exportedBy: psychologistId, patientId, version: '1.0' },
    patient, sessions, consents,
    integrity: { algorithm: 'SHA-256', hash: '' }
  };
  const canonical = JSON.stringify(bundle.patient) + JSON.stringify(bundle.sessions) + JSON.stringify(bundle.consents);
  bundle.integrity.hash = await sha256(canonical);
  await logEvent({
    actorId: psychologistId, action: 'export', entity: 'patient', entityId: patientId,
    afterData: { exportType: 'data_subject_request', sessionCount: sessions.length, consentCount: consents.length, bundleHash: bundle.integrity.hash }
  });
  return bundle;
}

export function downloadBundleAsFile(bundle: DataBundle, patientName?: string): void {
  const name = (patientName || bundle.metadata.patientId).replace(/[^a-zA-Z0-9]/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  const fileName = 'data-export-' + name + '-' + date + '.json';
  const content = JSON.stringify(bundle, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
