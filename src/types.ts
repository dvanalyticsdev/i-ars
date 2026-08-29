export type CourseKey = 'APIDS' | 'APIDA' | 'DA' | 'FDE' | 'AIML' | 'APCS' | '7 Days GenAI';

export interface CourseInfo {
  key: CourseKey;
  name: string;
  defaultFee: number;
}

export const COURSES: Record<CourseKey, CourseInfo> = {
  'APIDS': { key: 'APIDS', name: 'APIDS', defaultFee: 75000 },
  'APIDA': { key: 'APIDA', name: 'APIDA', defaultFee: 65000 },
  'DA': { key: 'DA', name: 'DA', defaultFee: 50000 },
  'FDE': { key: 'FDE', name: 'FDE', defaultFee: 80000 },
  'AIML': { key: 'AIML', name: 'AIML', defaultFee: 90000 },
  'APCS': { key: 'APCS', name: 'APCS', defaultFee: 85000 },
  '7 Days GenAI': { key: '7 Days GenAI', name: '7 Days GenAI', defaultFee: 15000 }
};

export interface Counselor {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  linkGenerationBlocked?: boolean;
  linkGenerationNote?: string | null;
  createdAt: string;
}

export interface AppSettings {
  tokenAmount: number;
  updatedAt: string;
}

export interface StudentRegistration {
  id: string;
  name: string;
  phone: string;
  email: string;
  courseKey: CourseKey;
  courseName: string;
  baseFee: number;
  discount: number;
  finalPayable: number;
  minTokenFee: number;
  batchDate: string; // ISO date string (YYYY-MM-DD) or selected cohort date
  
  // Status:
  // - 'pending_payment': Counselor generated the link, student has not paid yet
  // - 'paid': Cashfree verified that the student completed payment
  // - 'verified': Admin verified the payment
  // - 'dropout': Admin marked the lead as dropped/refunded
  status: 'pending_payment' | 'paid' | 'verified' | 'dropout';
  
  paymentMethod: 'cashfree' | 'manual' | null;
  transactionId: string | null;
  screenshotUrl: string | null; // Base64 mock screenshot or file upload data url
  adminNote: string | null;
  createdByAdmin?: boolean;
  
  generatedByCounselorId: string;
  generatedByCounselorName: string;
  
  createdAt: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedByAdminEmail: string | null;
  dropoutAt?: string | null;
  dropoutByAdminEmail?: string | null;
}

export interface UserSession {
  email: string;
  role: 'admin' | 'counselor';
  name: string;
  counselorId?: string;
}
