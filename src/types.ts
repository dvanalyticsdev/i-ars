export type CourseKey = 'APIDA' | 'APIDS' | 'DAS' | 'FDE';
export type PostRegistrationPaymentType = 'Loan' | 'Internal EMI' | 'Will decide later';

export const POST_REGISTRATION_PAYMENT_TYPES: PostRegistrationPaymentType[] = [
  'Loan',
  'Internal EMI',
  'Will decide later'
];

export const DEFAULT_POST_REGISTRATION_PAYMENT_TYPE: PostRegistrationPaymentType = 'Will decide later';

export interface CourseInfo {
  key: CourseKey;
  name: string;
  defaultFee: number;
}

export const COURSES: Record<CourseKey, CourseInfo> = {
  'APIDA': { key: 'APIDA', name: 'APIDA', defaultFee: 65000 },
  'APIDS': { key: 'APIDS', name: 'APIDS', defaultFee: 75000 },
  'DAS': { key: 'DAS', name: 'DAS', defaultFee: 50000 },
  'FDE': { key: 'FDE', name: 'FDE', defaultFee: 80000 }
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
  postRegistrationPaymentType?: PostRegistrationPaymentType;
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
