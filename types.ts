
export enum MatchStatus {
  PERFECT_MATCH = 'PERFECT_MATCH',
  PARTIAL_MATCH = 'PARTIAL_MATCH',
  NO_MATCH = 'NO_MATCH',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW'
}

export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export type Language = 'en' | 'hi' | 'es';

export interface UserProfile {
  fullName: string;
  dob: string;
  gender: string;
  bloodType: string;
  allergies: string[];
  medicalConditions: string[];
  currentMedications: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface PrescriptionData {
  doctorName: string;
  clinicName: string;
  date: string;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    instructions: string;
  }>;
}

export interface TabletData {
  name: string;
  color: string;
  shape: string;
  imprint: string;
  confidence: number;
  imageUrl?: string;
  description?: string;
  uses?: string;
  isMatch?: boolean;
}

export interface MedicineRate {
  name: string;
  estimatedPrice: string;
  description: string;
  imageUrl?: string;
}

export interface VerificationResult {
  id: string;
  status: MatchStatus;
  timestamp: string;
  matchScore: number;
  matchedMedicineName?: string;
  alerts: Array<{
    type: AlertSeverity;
    title: string;
    description: string;
  }>;
  prescription: PrescriptionData;
  identifiedTablets: TabletData[];
  matchStats: {
    matchedCount: number;
    unmatchedCount: number;
    totalPrescribed: number;
  };
}
