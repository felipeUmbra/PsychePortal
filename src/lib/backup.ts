/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Backup module - handles Google Drive backup versioning and optional
 * secondary (off-site) account copy for geographic redundancy.
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
}

export interface BackupResult {
  primary: boolean;
  secondary: boolean;
  fileName: string;
  snapshotsKept: number;
  secondaryError?: string;
}

const BACKUP_PREFIX = 'workspace-backup-';
const MAX_DAILY_SNAPSHOTS = 30;
const APP_DATA_FOLDER = 'appDataFolder';

function buildBackupFileName(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
  return BACKUP_PREFIX + datePart + '-' + timePart + '.json';
}

async function listBackupFiles(token: string): Promise<BackupFile[]> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=' + APP_DATA_FOLDER + '&q=name contains "' + BACKUP_PREFIX + '" and trashed=false&fields=files(id,name,createdTime)&orderBy=createdTime desc',
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (!res.ok) throw new Error('Drive list failed: ' + res.status);
  const data = await res.json();
  return (data.files || []) as BackupFile[];
}

async function deleteDriveFile(fileId: string, token: string): Promise<void> {
  await fetch('https://www.googleapis.com/drive/v3/files/' + fileId, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token },
  });
}

async function uploadToDrive(fileName: string, content: string, token: string): Promise<void> {
  const metadata = { name: fileName, parents: [APP_DATA_FOLDER] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));
  const searchRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=' + APP_DATA_FOLDER + '&q=name=\"' + fileName + '\" and trashed=false&fields=files(id)',
    { headers: { Authorization: 'Bearer ' + token } },
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const fileId = searchData.files[0].id;
    const updateForm = new FormData();
    updateForm.append('metadata', new Blob([JSON.stringify({ name: fileName })], { type: 'application/json' }));
    updateForm.append('file', new Blob([content], { type: 'application/json' }));
    const patchRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=multipart',
      { method: 'PATCH', headers: { Authorization: 'Bearer ' + token }, body: updateForm },
    );
    if (!patchRes.ok) throw new Error('Drive update failed: ' + patchRes.status);
  } else {
    const postRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form },
    );
    if (!postRes.ok) throw new Error('Drive create failed: ' + postRes.status);
  }
}

async function pruneOldBackups(token: string): Promise<number> {
  const files = await listBackupFiles(token);
  const byDate = new Map<string, BackupFile[]>();
  for (const f of files) {
    const match = f.name.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) continue;
    const dateKey = match[1];
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(f);
  }
  const sortedDates = [...byDate.keys()].sort().reverse();
  const toKeep = new Set(sortedDates.slice(0, MAX_DAILY_SNAPSHOTS));
  let deleted = 0;
  for (const [dateKey, dateFiles] of byDate) {
    if (!toKeep.has(dateKey)) {
      for (const f of dateFiles) {
        await deleteDriveFile(f.id, token);
        deleted++;
      }
    }
  }
  return deleted;
}

async function buildSnapshot(psychologistId: string): Promise<object> {
  const patientsSnap = await getDocs(query(collection(db, 'patients'), where('psychologistId', '==', psychologistId)));
  const patients = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('psychologistId', '==', psychologistId)));
  const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const auditSnap = await getDocs(query(collection(db, 'audit_logs'), where('actorId', '==', psychologistId)));
  const audit_logs = auditSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const consentsSnap = await getDocs(collection(db, 'patient_consents'));
  const patientIds = new Set(patients.map((p: any) => p.id));
  const patient_consents = consentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((c: any) => patientIds.has(c.patientId));
  const psychSnap = await getDocs(query(collection(db, 'psychologists'), where('__name__', '==', psychologistId)));
  const psychologists = psychSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { patients, sessions, audit_logs, patient_consents, psychologists, _meta: { exportedAt: new Date().toISOString(), exportedBy: psychologistId, version: '1.0' } };
}

export async function triggerFullBackup(primaryToken: string, psychologistId: string, secondaryToken?: string): Promise<BackupResult> {
  const fileName = buildBackupFileName();
  const snapshot = await buildSnapshot(psychologistId);
  const content = JSON.stringify(snapshot, null, 2);
  await uploadToDrive(fileName, content, primaryToken);
  await pruneOldBackups(primaryToken);
  const remaining = await listBackupFiles(primaryToken);
  let secondary = false;
  let secondaryError: string | undefined;
  if (secondaryToken) {
    try {
      await uploadToDrive(fileName, content, secondaryToken);
      secondary = true;
    } catch (err: any) {
      secondaryError = err.message || 'Secondary backup failed';
    }
  }
  return { primary: true, secondary, fileName, snapshotsKept: remaining.length, secondaryError };
}

export async function getBackupHistory(token: string): Promise<BackupFile[]> {
  return listBackupFiles(token);
}
