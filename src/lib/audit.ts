import { collection, query, where, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { sha256, computeEntityHashAsync, computeRecordHash } from './crypto';
import { AuditLog, AuditAction, AuditEntity } from '../types';
import { getIpHint } from './ip-hint';

let lastHashCache: Record<string, string> = {};
let lastHashPromise: Record<string, Promise<string>> = {};

/**
 * Gets the hash of the most recent audit log FOR THE GIVEN ACTOR for Merkle
 * chaining. SECURITY (CWE-353): the chain is scoped per actor end-to-end so
 * that construction (this function) and verification (verifyAuditChain,
 * which filters by actorId and starts from genesis) agree. Previously the
 * newest hash across ALL actors was used, guaranteeing broken verification
 * whenever more than one psychologist wrote audit events.
 * Uses caching to avoid repeated Firestore reads.
 */
export async function getLastAuditHash(actorId: string): Promise<string> {
  if (!actorId) return '0'.repeat(64); // Genesis hash
  if (lastHashCache[actorId]) return lastHashCache[actorId];
  if (lastHashPromise[actorId]) return lastHashPromise[actorId];

  lastHashPromise[actorId] = (async () => {
    try {
      const q = query(
        collection(db, 'audit_logs'),
        where('actorId', '==', actorId),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.size > 0) {
        const lastLog = snapshot.docs[0].data() as AuditLog;
        lastHashCache[actorId] = lastLog.hash || '';
        return lastHashCache[actorId];
      }
      lastHashCache[actorId] = '0'.repeat(64); // Genesis hash
      return lastHashCache[actorId];
    } catch (error) {
      console.error('Failed to get last audit hash:', error);
      lastHashCache[actorId] = '0'.repeat(64);
      return lastHashCache[actorId];
    } finally {
      delete lastHashPromise[actorId];
    }
  })();
  return lastHashPromise[actorId];
}

/**
 * Clears the per-actor last hash cache (call after writing a new audit log).
 */
export function clearLastHashCache(actorId?: string): void {
  if (actorId) {
    delete lastHashCache[actorId];
    delete lastHashPromise[actorId];
  } else {
    lastHashCache = {};
    lastHashPromise = {};
  }
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
    // Fire IP hint capture non-blocking (don't await before writing audit log)
    const ipHintPromise = getIpHint();
    let capturedIpHint: string | undefined;
    ipHintPromise.then(hint => { capturedIpHint = hint; });

    const prevHash = await getLastAuditHash(event.actorId);
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
      ipHint: event.ipHint ?? capturedIpHint,
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
    clearLastHashCache(event.actorId);
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
 * Convenience function for logging edit attempts on completed sessions.
 */
export async function logEditCompleted(
  actorId: string,
  entityId: string,
  sessionId?: string,
  justification?: string
): Promise<void> {
  await logEvent({
    actorId,
    action: 'update',
    entity: 'session',
    entityId,
    sessionId,
    afterData: { warning: 'edit_completed_session', justification: justification || undefined },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
  });
}

/**
 * Verifies the integrity of the Merkle chain for a given actor's audit logs.
 * Returns whether the chain is valid, the first invalid record ID (if any), and total records checked.
 */
export async function verifyAuditChain(actorId: string): Promise<{ valid: boolean; firstInvalidId?: string; totalRecords: number }> {
  try {
    const q = query(
      collection(db, 'audit_logs'),
      where('actorId', '==', actorId),
      orderBy('timestamp', 'asc')
    );
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));

    if (logs.length === 0) {
      return { valid: true, totalRecords: 0 };
    }

    let expectedPrevHash = '0'.repeat(64); // Genesis hash

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Verify prevHash linkage
      if (log.prevHash !== expectedPrevHash) {
        return { valid: false, firstInvalidId: log.id, totalRecords: i + 1 };
      }

      // Recompute the hash from payload
      const payloadData = {
        actorId: log.actorId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        timestamp: log.timestamp,
        sessionId: log.sessionId,
        beforeHash: log.beforeHash,
        afterHash: log.afterHash,
        ipHint: log.ipHint,
        userAgent: log.userAgent,
        prevHash: log.prevHash
      };
      const payload = JSON.stringify(payloadData);
      const recomputedHash = await computeRecordHash(payload, log.prevHash || '');

      if (recomputedHash !== log.hash) {
        return { valid: false, firstInvalidId: log.id, totalRecords: i + 1 };
      }

      expectedPrevHash = log.hash || '';
    }

    return { valid: true, totalRecords: logs.length };
  } catch (error) {
    console.error('Failed to verify audit chain:', error);
    return { valid: false, firstInvalidId: undefined, totalRecords: 0 };
  }
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
