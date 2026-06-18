import { collection, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { sha256, computeEntityHashAsync, computeRecordHash } from './crypto';
import { AuditLog, AuditAction, AuditEntity } from '../types';

let lastHashCache: string | null = null;
let lastHashPromise: Promise<string> | null = null;

/**
 * Gets the hash of the most recent audit log for Merkle chaining.
 * Uses caching to avoid repeated Firestore reads.
 */
export async function getLastAuditHash(): Promise<string> {
  if (lastHashCache) return lastHashCache;
  if (lastHashPromise) return lastHashPromise;

  lastHashPromise = (async () => {
    try {
      const q = query(
        collection(db, 'audit_logs'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.size > 0) {
        const lastLog = snapshot.docs[0].data() as AuditLog;
        lastHashCache = lastLog.hash || '';
        return lastHashCache;
      }
      lastHashCache = '0'.repeat(64); // Genesis hash
      return lastHashCache;
    } catch (error) {
      console.error('Failed to get last audit hash:', error);
      lastHashCache = '0'.repeat(64);
      return lastHashCache;
    }
  })();
  return lastHashPromise;
}

/**
 * Clears the last hash cache (call after writing a new audit log).
 */
export function clearLastHashCache(): void {
  lastHashCache = null;
  lastHashPromise = null;
}
 

/**
 * Logs an audit event to Firestore with Merkle chain integrity.
 */
export async function logEvent(event: {
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  sessionId?: string;
  beforeData?: any;
  afterData?: any;
  ipHint?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const prevHash = await getLastAuditHash();
    const beforeHash = event.beforeData ? await computeEntityHashAsync(event.beforeData) : undefined;
    const afterHash = event.afterData ? await computeEntityHashAsync(event.afterData) : undefined;
    const timestamp = new Date().toISOString();
    const payloadData = {
      actorId: event.actorId,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId,
      timestamp,
      sessionId: event.sessionId,
      beforeHash,
      afterHash,
      ipHint: event.ipHint,
      userAgent: event.userAgent,
      prevHash
    };
    const payload = JSON.stringify(payloadData);
    const hash = await computeRecordHash(payload, prevHash);
    const auditLog: AuditLog = {
      id: uuidv4(),
      ...payloadData,
      hash
    };
    await addDoc(collection(db, 'audit_logs'), auditLog);
    clearLastHashCache();
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Convenience function for logging view events (read operations).
 */
export async function logView(
  actorId: string,
  entity: AuditEntity,
  entityId: string,
  sessionId?: string
): Promise<void> {
  await logEvent({
    actorId,
    action: 'view',
    entity,
    entityId,
    sessionId,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  });
}

/**
 * Convenience function for logging create events.
 */
export async function logCreate(
  actorId: string,
  entity: AuditEntity,
  entityId: string,
  afterData: any,
  sessionId?: string
): Promise<void> {
  await logEvent({
    actorId,
    action: 'create',
    entity,
    entityId,
    sessionId,
    afterData,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  });
}

/**
 * Convenience function for logging update events.
 */
export async function logUpdate(
  actorId: string,
  entity: AuditEntity,
  entityId: string,
  beforeData: any,
  afterData: any,
  sessionId?: string
): Promise<void> {
  await logEvent({
    actorId,
    action: 'update',
    entity,
    entityId,
    sessionId,
    beforeData,
    afterData,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  });
}

/**
 * Convenience function for logging delete events.
 */
export async function logDelete(
  actorId: string,
  entity: AuditEntity,
  entityId: string,
  beforeData: any,
  sessionId?: string
): Promise<void> {
  await logEvent({
    actorId,
    action: 'delete',
    entity,
    entityId,
    sessionId,
    beforeData,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  });
}

/**
 * Convenience function for logging export events.
 */
export async function logExport(
  actorId: string,
  entity: AuditEntity,
  entityIds: string[],
  exportType: string,
  sessionId?: string
): Promise<void> {
  await logEvent({
    actorId,
    action: 'export',
    entity,
    entityId: entityIds.join(','),
    sessionId,
    afterData: { exportType, count: entityIds.length },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  });
}

/**
 * Convenience function for logging auth events.
 */
export async function logAuth(
  actorId: string,
  action: 'login' | 'logout'
): Promise<void> {
  await logEvent({
    actorId,
    action,
    entity: 'psychologist',
    entityId: actorId,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  });
}

export { sha256, computeEntityHashAsync, computeRecordHash } from './crypto';
