/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
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

export interface Psychologist {
  id: string;
  name: string;
  email: string;
  specialization: string[];
  bio: string;
  avatarUrl?: string;
}
