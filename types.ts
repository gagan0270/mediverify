
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

export type Language = 'en' | 'hi' | 'es' | 'kn';

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

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  type?: 'Tablet' | 'Syrup' | 'Injection' | 'Cream' | 'Drops' | 'Other';
}

export interface PrescriptionData {
  id: string;
  doctorName: string;
  clinicName: string;
  date: string;
  medicines: PrescriptionMedicine[];
}

export interface TabletData {
  name: string;
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
  pharmacologyClass?: string;
  mechanismOfAction?: string;
  isMatch?: boolean;
  matchStatus?: 'PERFECT' | 'PARTIAL' | 'MISMATCH' | 'UNKNOWN';
  matchSeverity?: AlertSeverity;
  discrepancyDetails?: string;
  colorContrastWarning?: string;
  identityScore?: number;
  posologyScore?: number;
  chronologyScore?: number;
  scoreExplanation?: string;
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
  allPrescriptions?: PrescriptionData[];
  identifiedTablets: TabletData[];
  matchStats: {
    matchedCount: number;
    unmatchedCount: number;
    totalPrescribed: number;
  };
}
