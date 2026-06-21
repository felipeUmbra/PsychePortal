import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function logDataExport(
  psychologistId: string,
  patientId: string,
  exportType: string,
  recordCount: number
): Promise<void> {
  try {
    await addDoc(collection(db, 'data_export_logs'), {
      psychologistId,
      patientId,
      exportType,
      recordCount,
      exportedAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to log data export:', error);
  }
}
