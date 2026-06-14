import { useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { logView, logCreate, logUpdate, logDelete, logExport, logAuth } from './audit';
import { AuditEntity } from '../types';

export function useAuditLogger() {
  const [user] = useAuthState(auth);

  const getActorId = useCallback(() => user?.uid || 'anonymous', [user]);

  const logViewEvent = useCallback(async (
    entity: AuditEntity,
    entityId: string,
    sessionId?: string
  ) => {
    const actorId = getActorId();
    await logView(actorId, entity, entityId, sessionId);
  }, [getActorId]);

  const logCreateEvent = useCallback(async (
    entity: AuditEntity,
    entityId: string,
    afterData: any,
    sessionId?: string
  ) => {
    const actorId = getActorId();
    await logCreate(actorId, entity, entityId, afterData, sessionId);
  }, [getActorId]);

  const logUpdateEvent = useCallback(async (
    entity: AuditEntity,
    entityId: string,
    beforeData: any,
    afterData: any,
    sessionId?: string
  ) => {
    const actorId = getActorId();
    await logUpdate(actorId, entity, entityId, beforeData, afterData, sessionId);
  }, [getActorId]);

  const logDeleteEvent = useCallback(async (
    entity: AuditEntity,
    entityId: string,
    beforeData: any,
    sessionId?: string
  ) => {
    const actorId = getActorId();
    await logDelete(actorId, entity, entityId, beforeData, sessionId);
  }, [getActorId]);

  const logExportEvent = useCallback(async (
    entity: AuditEntity,
    entityIds: string[],
    exportType: string,
    sessionId?: string
  ) => {
    const actorId = getActorId();
    await logExport(actorId, entity, entityIds, exportType, sessionId);
  }, [getActorId]);

  const logAuthEvent = useCallback(async (
    action: 'login' | 'logout'
  ) => {
    const actorId = getActorId();
    await logAuth(actorId, action);
  }, [getActorId]);

  return {
    logView: logViewEvent,
    logCreate: logCreateEvent,
    logUpdate: logUpdateEvent,
    logDelete: logDeleteEvent,
    logExport: logExportEvent,
    logAuth: logAuthEvent,
  };
}
 
