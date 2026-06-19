<<<<<<< Updated upstream
﻿/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf?: string;
  dateOfBirth: string;
  gender: string;
  address?: {
    country: string;
    zipCode: string;
    city: string;
    state: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
  };
  education?: string;
  ethnicity?: string;
  financialPlan?: string;
  financialValue?: string;
  anamnesis?: {
    chiefComplaint: string;
    medicalHistory: string;
    psychiatricHistory: string;
    familyHistory: string;
    medications: string;
    substanceUse: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  patientId: string;
  psychologistId: string;
  date: string;
  duration: number; // in minutes
  type: 'individual' | 'group' | 'family' | 'couple';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  attachments?: { name: string; url: string; size: number }[];
  googleEventId?: string;
  paymentStatus?: string;
  createdAt?: any;
}

export interface PsychologistAttestation {
  crpValid: boolean;
  patientsInformed: boolean;
  recoveryCodeSafe: boolean;
  cfpAware: boolean;
  retentionPolicy: boolean;
  dsrAware: boolean;
  updatedAt: string;
}

export interface Psychologist {
  id: string;
  name: string;
  email: string;
  specialization: string[];
  bio: string;
  avatarUrl?: string;
  consentText?: string;
  consentVersion?: string;
  retentionPolicy?: string;
  crpNumber?: string;
  crpRegion?: string;
  attestation?: PsychologistAttestation;
  createdAt?: string;
  updatedAt?: string;
}

// Audit Trail Types
export type AuditAction = 'view' | 'create' | 'update' | 'delete' | 'export' | 'login' | 'logout' | 'consent_accept' | 'consent_revoke';
export type AuditEntity = 'session' | 'patient' | 'attachment' | 'psychologist' | 'consent';

export interface AuditLog {
  id: string;
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  timestamp: string; // ISO 8601
  ipHint?: string;
  userAgent?: string;
  beforeHash?: string; // SHA-256 of entity state before change
  afterHash?: string;  // SHA-256 of entity state after change
  sessionId?: string;  // For session-scoped operations
  prevHash?: string;   // Merkle chain: hash of previous audit log
  hash?: string;       // This record's hash (prevHash + payload)
}

export interface PatientConsent {
  id: string;
  patientId: string;
  version: string;        // e.g. "1.0"
  text: string;           // the full consent text shown
  acceptedAt: string;     // ISO 8601
  acceptedFrom: string;   // "patient" | "guardian"
  ipHint?: string;        // truncated IP or placeholder
  signature: string;      // free-text name of signatory
  revokedAt?: string;      // ISO 8601, present only when revoked
}
=======
﻿/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf?: string;
  dateOfBirth: string;
  gender: string;
  address?: {
    country: string;
    zipCode: string;
    city: string;
    state: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
  };
  education?: string;
  ethnicity?: string;
  financialPlan?: string;
  financialValue?: string;
  anamnesis?: {
    chiefComplaint: string;
    medicalHistory: string;
    psychiatricHistory: string;
    familyHistory: string;
    medications: string;
    substanceUse: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  patientId: string;
  psychologistId: string;
  date: string;
  duration: number; // in minutes
  type: 'individual' | 'group' | 'family' | 'couple';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  attachments?: { name: string; url: string; size: number }[];
  googleEventId?: string;
  paymentStatus?: string;
  createdAt?: any;
}

export interface PsychologistAttestation {
  crpValid: boolean;
  patientsInformed: boolean;
  recoveryCodeSafe: boolean;
  cfpAware: boolean;
  retentionPolicy: boolean;
  dsrAware: boolean;
  updatedAt: string;
}

export interface Psychologist {
  id: string;
  name: string;
  email: string;
  specialization: string[];
  bio: string;
  avatarUrl?: string;
  consentText?: string;
  consentVersion?: string;
  retentionPolicy?: string;
  attestation?: PsychologistAttestation;
  createdAt?: string;
  updatedAt?: string;
}

// Audit Trail Types
export type AuditAction = 'view' | 'create' | 'update' | 'delete' | 'export' | 'login' | 'logout' | 'consent_accept' | 'consent_revoke';
export type AuditEntity = 'session' | 'patient' | 'attachment' | 'psychologist' | 'consent';

export interface AuditLog {
  id: string;
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  timestamp: string; // ISO 8601
  ipHint?: string;
  userAgent?: string;
  beforeHash?: string; // SHA-256 of entity state before change
  afterHash?: string;  // SHA-256 of entity state after change
  sessionId?: string;  // For session-scoped operations
  prevHash?: string;   // Merkle chain: hash of previous audit log
  hash?: string;       // This record's hash (prevHash + payload)
}

export interface PatientConsent {
  id: string;
  patientId: string;
  version: string;        // e.g. "1.0"
  text: string;           // the full consent text shown
  acceptedAt: string;     // ISO 8601
  acceptedFrom: string;   // "patient" | "guardian"
  ipHint?: string;        // truncated IP or placeholder
  signature: string;      // free-text name of signatory
  revokedAt?: string;      // ISO 8601, present only when revoked
}
>>>>>>> Stashed changes
