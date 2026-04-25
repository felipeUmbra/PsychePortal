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
  address: string;
  emergencyContact: string;
  notes: string;
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
  notes: string;
  summary?: string;
  plan?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  psychologistId: string;
  start: string;
  end: string;
  title: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface Psychologist {
  id: string;
  name: string;
  email: string;
  specialization: string[];
  bio: string;
  avatarUrl?: string;
}
