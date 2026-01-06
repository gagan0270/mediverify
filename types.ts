

export enum MatchStatus {
  PERFECT_MATCH = 'PERFECT_MATCH',
  PARTIAL_MATCH = 'PARTIAL_MATCH',
  NO_MATCH = 'NO_MATCH',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW'
}

export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  MAJOR_WARNING = 'MAJOR_WARNING',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export enum ReportSeverity {
  DANGER = 'DANGER',
  WARNING = 'WARNING',
  NORMAL = 'NORMAL'
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
  // Added dosage and frequency to support identified pill properties
  dosage?: string;
  frequency?: string;
  color: string;
  shape: string;
  imprint: string;
  confidence: number;
  imageUrl?: string;
  description?: string;
  uses?: string;
  genericName?: string;
  sideEffects?: string;
  specialWarnings?: string;
  isMatch?: boolean;
  matchStatus?: 'PERFECT' | 'PARTIAL' | 'MISMATCH' | 'UNKNOWN';
  discrepancyDetails?: string;
  colorContrastWarning?: string;
  // Categorical matching scores (0-1)
  identityScore?: number;
  posologyScore?: number; // Dosage strength matching
  chronologyScore?: number; // Frequency matching
}

export interface ReportComponent {
  name: string;
  value: string;
  range: string;
  status: 'HIGH' | 'LOW' | 'NORMAL' | 'CRITICAL';
  problemSimplified: string;
  majorDiseaseRisk: string;
  suggestedSolution: string;
}

export interface ReportAnalysis {
  id: string;
  reportType: string;
  doctorName: string;
  patientName: string;
  date: string;
  severity: ReportSeverity;
  overallHealthGrade: string;
  simpleSummary: string;
  highFindings: ReportComponent[];
  lowFindings: ReportComponent[];
  normalFindings: ReportComponent[];
  top3Risks: string[];
  immediateSteps: string[];
  imageUrl?: string;
  mimeType?: string;
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