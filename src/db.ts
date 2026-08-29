import { useCallback, useEffect, useState } from 'react';
import { AppSettings, Counselor, CourseKey, PostRegistrationPaymentType, StudentRegistration, UserSession } from './types';

interface AppState {
  settings: AppSettings;
  counselors: Counselor[];
  registrations: StudentRegistration[];
}

const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.');
  }

  return payload as T;
};

export const initializeDB = async () => {
  await apiRequest<AppState>('/api/state');
};

export const db = {
  getState: () => apiRequest<AppState>('/api/state'),

  login: (email: string, password: string) =>
    apiRequest<UserSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  reset: () => apiRequest<AppState>('/api/reset', { method: 'POST' }),

  updateTokenAmount: (tokenAmount: number) =>
    apiRequest<AppSettings>('/api/settings/token', {
      method: 'PATCH',
      body: JSON.stringify({ tokenAmount })
    }),

  addCounselor: (name: string, email: string, password: string) =>
    apiRequest<Counselor>('/api/counselors', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    }),

  toggleCounselorStatus: (id: string) =>
    apiRequest<Counselor>(`/api/counselors/${encodeURIComponent(id)}/status`, {
      method: 'PATCH'
    }),

  updateCounselorPassword: (id: string, password: string) =>
    apiRequest<Counselor>(`/api/counselors/${encodeURIComponent(id)}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password })
    }),

  updateCounselorLinkGeneration: (id: string, blocked: boolean, note?: string | null) =>
    apiRequest<Counselor>(`/api/counselors/${encodeURIComponent(id)}/link-generation`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked, note })
    }),

  deleteCounselor: (id: string) =>
    apiRequest<{ ok: true }>(`/api/counselors/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  deleteUnusedRegistration: (id: string) =>
    apiRequest<{ ok: true }>(`/api/registrations/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  updateRegistrationBatchDate: (id: string, batchDate: string) =>
    apiRequest<StudentRegistration>(`/api/registrations/${encodeURIComponent(id)}/batch-date`, {
      method: 'PATCH',
      body: JSON.stringify({ batchDate })
    }),

  addRegistration: (
    name: string,
    phone: string,
    email: string,
    courseKey: CourseKey,
    baseFee: number,
    discount: number,
    batchDate: string,
    counselorId: string,
    counselorName: string,
    postRegistrationPaymentType: PostRegistrationPaymentType,
    adminNote?: string | null,
    createdByAdmin?: boolean,
    transactionId?: string | null,
    screenshotUrl?: string | null
  ) =>
    apiRequest<StudentRegistration>('/api/registrations', {
      method: 'POST',
      body: JSON.stringify({
        name,
        phone,
        email,
        courseKey,
        baseFee,
        discount,
        batchDate,
        counselorId,
        counselorName,
        postRegistrationPaymentType,
        adminNote,
        createdByAdmin,
        transactionId,
        screenshotUrl
      })
    }),

  submitPayment: (id: string, paymentMethod: 'cashfree' | 'manual', transactionId?: string | null, screenshotUrl?: string | null, adminNote?: string | null) =>
    apiRequest<StudentRegistration>(`/api/registrations/${encodeURIComponent(id)}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentMethod, transactionId, screenshotUrl, adminNote })
    }),

  verifyRegistration: (id: string, adminEmail: string) =>
    apiRequest<StudentRegistration>(`/api/registrations/${encodeURIComponent(id)}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ adminEmail })
    }),

  markRegistrationDropout: (id: string, adminEmail: string) =>
    apiRequest<StudentRegistration>(`/api/registrations/${encodeURIComponent(id)}/dropout`, {
      method: 'PATCH',
      body: JSON.stringify({ adminEmail })
    }),

  clearRegistrations: (key: string) =>
    apiRequest<{ ok: true; deletedCount: number }>('/api/registrations/clear', {
      method: 'POST',
      body: JSON.stringify({ key })
    })
};

export const useLiveDB = () => {
  const [settings, setSettings] = useState<AppSettings>({ tokenAmount: 5000, updatedAt: new Date().toISOString() });
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [registrations, setRegistrations] = useState<StudentRegistration[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const state = await db.getState();
      setSettings(state.settings);
      setCounselors(state.counselors);
      setRegistrations(state.registrations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load application data.');
    }
  }, []);

  useEffect(() => {
    reload();
    const intervalId = window.setInterval(reload, 5000);
    return () => window.clearInterval(intervalId);
  }, [reload]);

  return {
    settings,
    counselors,
    registrations,
    reload,
    error
  };
};
