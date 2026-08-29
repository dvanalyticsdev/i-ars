import React, { useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { AppSettings, Counselor, DEFAULT_POST_REGISTRATION_PAYMENT_TYPE, POST_REGISTRATION_PAYMENT_TYPES, PostRegistrationPaymentType, StudentRegistration, UserSession, COURSES, CourseKey, OnboardingTemplate } from '../types';
import { 
  Users, 
  FileCheck, 
  PlusCircle, 
  ToggleLeft, 
  ToggleRight, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  LogOut,
  X,
  Search,
  Eye,
  Check,
  KeyRound,
  Trash2,
  IndianRupee,
  Save,
  Eraser,
  Download,
  CalendarDays,
  Send,
  Pencil,
  FileText,
  Menu
} from 'lucide-react';
import { downloadTemporaryInvoice as downloadInvoicePdf } from '../invoice';
import { formatCourseLabel, formatCurrency } from '../format';
import { MultiSelectFilter } from './MultiSelectFilter';

interface AdminDashboardProps {
  session: UserSession;
  onLogout: () => void;
  settings: AppSettings;
  counselors: Counselor[];
  registrations: StudentRegistration[];
  onboardingTemplates: OnboardingTemplate[];
  onDataChange: () => Promise<void>;
}

interface RichHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeightClass?: string;
}

const RichHtmlEditor: React.FC<RichHtmlEditorProps> = ({ value, onChange, minHeightClass = 'min-h-[420px]' }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (!editorRef.current || lastValueRef.current === value) {
      return;
    }

    editorRef.current.innerHTML = value || '<p><br></p>';
    lastValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '<p><br></p>';
    }
  }, []);

  const handleInput = () => {
    const nextValue = editorRef.current?.innerHTML || '';
    lastValueRef.current = nextValue;
    onChange(nextValue);
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={handleInput}
      className={`prose max-w-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#485d8b] ${minHeightClass}`}
    />
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  session, 
  onLogout,
  settings,
  counselors,
  registrations,
  onboardingTemplates,
  onDataChange
}) => {
  const [activeTab, setActiveTab] = useState<'registrations' | 'counselors' | 'templates'>('registrations');
  const [tokenAmount, setTokenAmount] = useState(settings.tokenAmount);
  const [tokenSaving, setTokenSaving] = useState(false);
  const [clearingRegistrations, setClearingRegistrations] = useState(false);
  
  // Counselor Management Form States
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cError, setCError] = useState<string | null>(null);
  const [cSuccess, setCSuccess] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [activePasswordEditor, setActivePasswordEditor] = useState<string | null>(null);
  const [profileDrafts, setProfileDrafts] = useState<Record<string, { name: string; email: string }>>({});
  const [activeProfileEditor, setActiveProfileEditor] = useState<string | null>(null);

  // Admin Registration Form States
  const [adminCounselorId, setAdminCounselorId] = useState('');
  const [adminStudentName, setAdminStudentName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminCourseKey, setAdminCourseKey] = useState<CourseKey>('APIDS');
  const [adminBatchDate, setAdminBatchDate] = useState('');
  const [adminPostRegistrationPaymentType, setAdminPostRegistrationPaymentType] = useState<PostRegistrationPaymentType | ''>('');
  const [adminBaseFee, setAdminBaseFee] = useState(COURSES.APIDS.defaultFee);
  const [adminDiscount, setAdminDiscount] = useState(0);
  const [adminTransactionId, setAdminTransactionId] = useState('');
  const [adminScreenshotUrl, setAdminScreenshotUrl] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [adminRegistrationError, setAdminRegistrationError] = useState<string | null>(null);
  const [adminRegistrationSuccess, setAdminRegistrationSuccess] = useState<string | null>(null);
  const [adminRegistrationSaving, setAdminRegistrationSaving] = useState(false);

  // Filter States
  const [regFilters, setRegFilters] = useState<Array<'pending_payment' | 'paid' | 'verified' | 'dropout'>>([]);
  const [batchFilters, setBatchFilters] = useState<string[]>([]);
  const [courseFilters, setCourseFilters] = useState<string[]>([]);
  const [counselorFilters, setCounselorFilters] = useState<string[]>([]);
  const [mailStatusFilters, setMailStatusFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Registration for Verification Modal
  const [selectedReg, setSelectedReg] = useState<StudentRegistration | null>(null);
  const [manualTransactionId, setManualTransactionId] = useState('');
  const [manualScreenshotUrl, setManualScreenshotUrl] = useState<string | null>(null);
  const [manualPaymentNote, setManualPaymentNote] = useState('');
  const [manualPaymentError, setManualPaymentError] = useState<string | null>(null);
  const [manualPaymentSaving, setManualPaymentSaving] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchDrafts, setBatchDrafts] = useState<Record<string, string>>({});
  const [batchSavingId, setBatchSavingId] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<{
    registration: StudentRegistration;
    to: string;
    cc: string[];
    subject: string;
    html: string;
  } | null>(null);
  const [emailPreviewLoadingId, setEmailPreviewLoadingId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [selectedTemplateCourse, setSelectedTemplateCourse] = useState<CourseKey>('APIDS');
  const [templateSubjectDrafts, setTemplateSubjectDrafts] = useState<Record<string, string>>({});
  const [templateBodyDrafts, setTemplateBodyDrafts] = useState<Record<string, string>>({});
  const [templateSavingCourse, setTemplateSavingCourse] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const getTemplate = (courseKey: CourseKey) =>
    onboardingTemplates.find(template => template.courseKey === courseKey) || null;

  const selectedTemplate = getTemplate(selectedTemplateCourse);
  const templateSubjectDraft = templateSubjectDrafts[selectedTemplateCourse] ?? selectedTemplate?.subjectTemplate ?? '';
  const templateBodyDraft = templateBodyDrafts[selectedTemplateCourse] ?? selectedTemplate?.bodyHtml ?? '';

  React.useEffect(() => {
    setTokenAmount(settings.tokenAmount);
  }, [settings.tokenAmount]);

  React.useEffect(() => {
    setManualTransactionId('');
    setManualScreenshotUrl(null);
    setManualPaymentNote('');
    setManualPaymentError(null);
    setManualPaymentSaving(false);
  }, [selectedReg?.id]);

  React.useEffect(() => {
    setTemplateSubjectDrafts(current => {
      const next = { ...current };
      for (const template of onboardingTemplates) {
        if (next[template.courseKey] === undefined) {
          next[template.courseKey] = template.subjectTemplate;
        }
      }
      return next;
    });
    setTemplateBodyDrafts(current => {
      const next = { ...current };
      for (const template of onboardingTemplates) {
        if (next[template.courseKey] === undefined) {
          next[template.courseKey] = template.bodyHtml;
        }
      }
      return next;
    });
  }, [onboardingTemplates]);

  React.useEffect(() => {
    if (!adminCounselorId && counselors.length > 0) {
      const activeCounselor = counselors.find(counselor => counselor.status === 'active') || counselors[0];
      setAdminCounselorId(activeCounselor.id);
    }
  }, [adminCounselorId, counselors]);

  React.useEffect(() => {
    if (!openActionMenuId) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-action-menu-root]')) {
        setOpenActionMenuId(null);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [openActionMenuId]);

  const handleUpdateTokenAmount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
      alert('Registration amount must be greater than 0.');
      return;
    }

    try {
      setTokenSaving(true);
      await db.updateTokenAmount(tokenAmount);
      await onDataChange();
      alert('Registration amount updated for new registration links.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update registration amount.');
    } finally {
      setTokenSaving(false);
    }
  };

  const handleClearRegistrations = async () => {
    const key = prompt('Enter clear key to remove all registrations.');

    if (key === null) {
      return;
    }

    if (key !== '2817') {
      alert('Clear key is incorrect.');
      return;
    }

    if (!confirm('This will permanently clear all student registrations from this project. Continue?')) {
      return;
    }

    try {
      setClearingRegistrations(true);
      const result = await db.clearRegistrations(key);
      await onDataChange();
      alert(`Cleared ${result.deletedCount} registration(s).`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to clear registrations.');
    } finally {
      setClearingRegistrations(false);
    }
  };

  // Form Submit for Creating Counselor
  const handleCreateCounselor = async (e: React.FormEvent) => {
    e.preventDefault();
    setCError(null);
    setCSuccess(null);

    if (!cName.trim() || !cEmail.trim() || !cPassword.trim()) {
      setCError('Please fill out all fields.');
      return;
    }

    try {
      const result = await db.addCounselor(cName, cEmail, cPassword);
      setCSuccess(`Counselor ${result.name} created successfully.`);
      setCName('');
      setCEmail('');
      setCPassword('');
      await onDataChange();
      // Auto clear success message after 5 seconds
      setTimeout(() => setCSuccess(null), 5000);
    } catch (error) {
      setCError(error instanceof Error ? error.message : 'Unable to create counselor.');
    }
  };

  const handleAdminCourseChange = (courseKey: CourseKey) => {
    setAdminCourseKey(courseKey);
    setAdminBaseFee(COURSES[courseKey].defaultFee);
  };

  const handleAdminScreenshotChange = (file: File | null) => {
    setAdminRegistrationError(null);
    setAdminScreenshotUrl(null);

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAdminRegistrationError('Please upload an image screenshot.');
      return;
    }

    if (file.size > 650_000) {
      setAdminRegistrationError('Screenshot is too large. Please upload an image under 650 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAdminScreenshotUrl(String(reader.result || ''));
    reader.onerror = () => setAdminRegistrationError('Unable to read this screenshot. Please try another image.');
    reader.readAsDataURL(file);
  };

  const handleCreateAdminRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminRegistrationError(null);
    setAdminRegistrationSuccess(null);

    const counselor = counselors.find(item => item.id === adminCounselorId);
    const baseFee = Number(adminBaseFee) || 0;
    const discount = Number(adminDiscount) || 0;

    if (!counselor) {
      setAdminRegistrationError('Please select a counselor.');
      return;
    }

    if (!adminStudentName.trim() || !adminPhone.trim() || !adminEmail.trim() || !adminBatchDate) {
      setAdminRegistrationError('Please fill student name, phone, email, and batch date.');
      return;
    }

    if (!adminPostRegistrationPaymentType) {
      setAdminRegistrationError('Please select the post registration payment proceeding type.');
      return;
    }

    if (baseFee <= 0 || discount < 0 || discount > baseFee) {
      setAdminRegistrationError('Please check the fee and discount values.');
      return;
    }

    if (!adminNote.trim() && !adminScreenshotUrl && !adminTransactionId.trim()) {
      setAdminRegistrationError('Add an admin note, payment screenshot, or transaction/UTR detail.');
      return;
    }

    try {
      setAdminRegistrationSaving(true);
      const created = await db.addRegistration(
        adminStudentName.trim(),
        adminPhone.trim(),
        adminEmail.trim(),
        adminCourseKey,
        baseFee,
        discount,
        adminBatchDate,
        counselor.id,
        counselor.name,
        adminPostRegistrationPaymentType,
        adminNote.trim() || null,
        true,
        adminTransactionId.trim() || null,
        adminScreenshotUrl
      );

      setAdminStudentName('');
      setAdminPhone('');
      setAdminEmail('');
      setAdminBatchDate('');
      setAdminPostRegistrationPaymentType('');
      setAdminBaseFee(COURSES[adminCourseKey].defaultFee);
      setAdminDiscount(0);
      setAdminTransactionId('');
      setAdminScreenshotUrl(null);
      setAdminNote('');
      setSelectedReg(created);
      setAdminRegistrationSuccess(`Manual registration created for ${created.name}.`);
      await onDataChange();
      setTimeout(() => setAdminRegistrationSuccess(null), 5000);
    } catch (error) {
      setAdminRegistrationError(error instanceof Error ? error.message : 'Unable to create registration.');
    } finally {
      setAdminRegistrationSaving(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await db.toggleCounselorStatus(id);
      await onDataChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update counselor status.');
    }
  };

  const handleChangePassword = async (id: string) => {
    const nextPassword = (passwordDrafts[id] || '').trim();

    if (nextPassword.length < 6) {
      alert('Counselor password must be at least 6 characters.');
      return;
    }

    try {
      await db.updateCounselorPassword(id, nextPassword);
      setPasswordDrafts(current => ({ ...current, [id]: '' }));
      setActivePasswordEditor(null);
      await onDataChange();
      alert('Counselor password updated.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update counselor password.');
    }
  };

  const handleStartProfileEdit = (counselor: Counselor) => {
    setActiveProfileEditor(activeProfileEditor === counselor.id ? null : counselor.id);
    setActivePasswordEditor(null);
    setProfileDrafts(current => ({
      ...current,
      [counselor.id]: current[counselor.id] || { name: counselor.name, email: counselor.email }
    }));
  };

  const handleUpdateCounselorProfile = async (id: string) => {
    const draft = profileDrafts[id];
    const name = (draft?.name || '').trim();
    const email = (draft?.email || '').trim().toLowerCase();

    if (!name || !email) {
      alert('Counselor name and email are required.');
      return;
    }

    try {
      await db.updateCounselorProfile(id, name, email);
      setActiveProfileEditor(null);
      await onDataChange();
      alert('Counselor details updated.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update counselor details.');
    }
  };

  const handleSaveTemplate = async () => {
    const subjectTemplate = templateSubjectDraft.trim();
    const bodyHtml = templateBodyDraft.trim();

    if (!subjectTemplate || !bodyHtml) {
      alert('Template subject and body are required.');
      return;
    }

    try {
      setTemplateSavingCourse(selectedTemplateCourse);
      const updated = await db.updateOnboardingTemplate(selectedTemplateCourse, subjectTemplate, bodyHtml);
      setTemplateSubjectDrafts(current => ({ ...current, [selectedTemplateCourse]: updated.subjectTemplate }));
      setTemplateBodyDrafts(current => ({ ...current, [selectedTemplateCourse]: updated.bodyHtml }));
      await onDataChange();
      alert('Template saved.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save template.');
    } finally {
      setTemplateSavingCourse(null);
    }
  };

  const handleResetTemplateDraft = () => {
    setTemplateSubjectDrafts(current => ({
      ...current,
      [selectedTemplateCourse]: selectedTemplate?.subjectTemplate || ''
    }));
    setTemplateBodyDrafts(current => ({
      ...current,
      [selectedTemplateCourse]: selectedTemplate?.bodyHtml || ''
    }));
  };

  const handleToggleLinkGeneration = async (counselor: Counselor) => {
    const isBlocked = Boolean(counselor.linkGenerationBlocked);
    let note: string | null = null;

    if (!isBlocked) {
      note = prompt(`Write the note ${counselor.name} should see when trying to generate a link.`);
      if (note === null) {
        return;
      }
      note = note.trim();
      if (!note) {
        alert('Please add a note before stopping link generation.');
        return;
      }
    } else if (!confirm(`Allow ${counselor.name} to generate registration links again?`)) {
      return;
    }

    try {
      await db.updateCounselorLinkGeneration(counselor.id, !isBlocked, note);
      await onDataChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update link generation permission.');
    }
  };

  const handleDeleteCounselor = async (id: string, name: string) => {
    if (!confirm(`Remove counselor account for ${name}? Existing student registrations will remain in records.`)) {
      return;
    }

    try {
      await db.deleteCounselor(id);
      await onDataChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to remove counselor.');
    }
  };

  const handleDeletePendingRegistration = async (registration: StudentRegistration) => {
    if (!confirm(`Delete the pending payment registration link for ${registration.name}? This should only be used when payment has not been received.`)) {
      return;
    }

    try {
      await db.deleteUnusedRegistration(registration.id);
      if (selectedReg?.id === registration.id) {
        setSelectedReg(null);
      }
      await onDataChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to delete this pending registration.');
    }
  };

  const handleVerifyPayment = async (id: string) => {
    try {
      const updated = await db.verifyRegistration(id, session.email);
      if (selectedReg && selectedReg.id === id) {
        setSelectedReg(updated);
      }
      await onDataChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to approve this enrollment.');
    }
  };

  const canSendOnboardingEmail = (registration: StudentRegistration) =>
    registration.status === 'verified'
    && Boolean(getTemplate(registration.courseKey))
    && registration.onboardingEmailStatus !== 'sent'
    && !registration.onboardingEmailSentAt;

  const handlePreviewOnboardingEmail = async (registration: StudentRegistration) => {
    try {
      setEmailPreviewLoadingId(registration.id);
      const preview = await db.previewOnboardingEmail(registration.id);
      setEmailPreview({ registration, ...preview });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to prepare onboarding email preview.');
    } finally {
      setEmailPreviewLoadingId(null);
    }
  };

  const handleSendOnboardingEmail = async (registration: StudentRegistration, editedEmail?: { subject: string; html: string }) => {
    if (!confirm(`Send onboarding email to ${registration.name}?`)) {
      return;
    }

    try {
      setSendingEmailId(registration.id);
      const updated = await db.sendOnboardingEmail(registration.id, session.email, editedEmail?.subject, editedEmail?.html);
      if (selectedReg?.id === registration.id) {
        setSelectedReg(updated);
      }
      if (emailPreview?.registration.id === registration.id) {
        setEmailPreview(null);
      }
      await onDataChange();
      alert('Onboarding email sent.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to send onboarding email.');
      await onDataChange();
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleMarkDropout = async (registration: StudentRegistration) => {
    if (!confirm(`Mark ${registration.name} as dropout? This will remove this lead from tracker admissions and generated revenue.`)) {
      return;
    }

    try {
      const updated = await db.markRegistrationDropout(registration.id, session.email);
      if (selectedReg && selectedReg.id === registration.id) {
        setSelectedReg(updated);
      }
      await onDataChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to mark this registration as dropout.');
    }
  };

  const canDownloadInvoice = (registration: StudentRegistration) =>
    registration.status === 'paid' || registration.status === 'verified';

  const handleDownloadInvoice = (registration: StudentRegistration) => {
    downloadInvoicePdf(registration);
  };

  const handleStartBatchEdit = (registration: StudentRegistration) => {
    setEditingBatchId(registration.id);
    setBatchDrafts(prev => ({ ...prev, [registration.id]: registration.batchDate }));
  };

  const handleCancelBatchEdit = (id: string) => {
    setEditingBatchId(null);
    setBatchDrafts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleUpdateBatchDate = async (registration: StudentRegistration) => {
    const nextBatchDate = (batchDrafts[registration.id] || '').trim();

    if (!nextBatchDate) {
      alert('Please select a batch date.');
      return;
    }

    try {
      setBatchSavingId(registration.id);
      const updated = await db.updateRegistrationBatchDate(registration.id, nextBatchDate);
      if (selectedReg?.id === registration.id) {
        setSelectedReg(updated);
      }
      await onDataChange();
      setEditingBatchId(null);
      setBatchDrafts(prev => {
        const next = { ...prev };
        delete next[registration.id];
        return next;
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to update batch date.');
    } finally {
      setBatchSavingId(null);
    }
  };

  const handleManualScreenshotChange = (file: File | null) => {
    setManualPaymentError(null);
    setManualScreenshotUrl(null);

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setManualPaymentError('Please upload an image screenshot.');
      return;
    }

    if (file.size > 650_000) {
      setManualPaymentError('Screenshot is too large. Please upload an image under 650 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setManualScreenshotUrl(String(reader.result || ''));
    reader.onerror = () => setManualPaymentError('Unable to read this screenshot. Please try another image.');
    reader.readAsDataURL(file);
  };

  const handleManualPayment = async () => {
    if (!selectedReg) return;

    if (!manualPaymentNote.trim() && !manualScreenshotUrl && !manualTransactionId.trim()) {
      setManualPaymentError('Add an admin note, payment screenshot, or transaction/UTR detail.');
      return;
    }

    try {
      setManualPaymentSaving(true);
      setManualPaymentError(null);
      const updated = await db.submitPayment(selectedReg.id, 'manual', manualTransactionId.trim(), manualScreenshotUrl, manualPaymentNote.trim() || null);
      setSelectedReg(updated);
      await onDataChange();
    } catch (error) {
      setManualPaymentError(error instanceof Error ? error.message : 'Unable to add manual payment.');
    } finally {
      setManualPaymentSaving(false);
    }
  };

  // Helper to format date safely and handle invalid dates
  const formatBatchDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      return dateStr;
    }
    return dateObj.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get unique batches across all student registrations
  const uniqueBatches = Array.from(new Set(registrations.map(r => r.batchDate))).sort();
  const statusOptions: Array<{ value: 'pending_payment' | 'paid' | 'verified' | 'dropout'; label: string }> = [
    { value: 'pending_payment', label: 'Pending Payment' },
    { value: 'paid', label: 'Unverified Payment' },
    { value: 'verified', label: 'Verified' },
    { value: 'dropout', label: 'Dropout' }
  ];
  const mailStatusOptions = [
    { value: 'sent', label: 'Mail Sent' },
    { value: 'not_sent', label: 'Mail Not Sent' }
  ];

  // Filtered registrations
  const filteredRegs = registrations.filter(reg => {
    const query = searchQuery.trim().toLowerCase();
    const matchesFilter = regFilters.length === 0 || regFilters.includes(reg.status);
    const matchesBatch = batchFilters.length === 0 || batchFilters.includes(reg.batchDate);
    const matchesCourse = courseFilters.length === 0 || courseFilters.includes(reg.courseKey);
    const matchesCounselor = counselorFilters.length === 0 || counselorFilters.includes(reg.generatedByCounselorId);
    const mailStatus = reg.onboardingEmailStatus === 'sent' ? 'sent' : 'not_sent';
    const matchesMailStatus = mailStatusFilters.length === 0 || mailStatusFilters.includes(mailStatus);
    const matchesSearch = 
      !query ||
      reg.name.toLowerCase().includes(query) ||
      reg.email.toLowerCase().includes(query) ||
      reg.phone.toLowerCase().includes(query) ||
      reg.generatedByCounselorName.toLowerCase().includes(query) ||
      (reg.transactionId && reg.transactionId.toLowerCase().includes(query)) ||
      reg.courseKey.toLowerCase().includes(query);
    return matchesFilter && matchesBatch && matchesCourse && matchesCounselor && matchesMailStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <img src="/Logo/DV-Logo.png" alt="Logo" className="h-10 w-auto" onError={(e) => {
                e.currentTarget.src = 'https://placehold.co/100x40/485d8b/ffffff?text=DV';
              }} />
              <div className="h-6 w-px bg-gray-200"></div>
              <span className="text-lg font-bold text-gray-800">Admin Control Panel</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-700">{session.name}</p>
                <p className="text-xs text-gray-400">{session.email}</p>
              </div>
              <button 
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-8 bg-white p-1 rounded-xl shadow-sm">
          <button
            onClick={() => setActiveTab('registrations')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'registrations'
                ? 'bg-[#485d8b] text-white shadow-md'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Student Registrations</span>
            {registrations.filter(r => r.status === 'paid').length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full pulse-ring">
                {registrations.filter(r => r.status === 'paid').length} new
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('counselors')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'counselors'
                ? 'bg-[#485d8b] text-white shadow-md'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Counselor Accounts</span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'templates'
                ? 'bg-[#485d8b] text-white shadow-md'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Templates</span>
          </button>
        </div>

        {activeTab === 'registrations' ? (
          /* REGISTRATIONS TAB */
          <div className="space-y-5">
          <form onSubmit={handleUpdateTokenAmount} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <IndianRupee className="h-4 w-4 text-[#485d8b]" />
                <span>Registration Amount</span>
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                New counselor-generated links will use this amount. Existing links keep their saved registration amount.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative flex-1 sm:w-44">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-gray-400">₹</span>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-7 pr-3 text-sm font-bold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={tokenAmount || ''}
                  onChange={(e) => setTokenAmount(Number(e.target.value))}
                />
              </div>
              <button
                type="submit"
                disabled={tokenSaving}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#485d8b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3c4d73] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{tokenSaving ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={handleClearRegistrations}
                disabled={clearingRegistrations}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-60"
              >
                <Eraser className="h-4 w-4" />
                <span>{clearingRegistrations ? 'Clearing...' : 'Clear Registrations'}</span>
              </button>
            </div>
          </form>

          <form onSubmit={handleCreateAdminRegistration} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <PlusCircle className="h-5 w-5 text-[#485d8b]" />
                  <span>Create Registration</span>
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Admin can enter the lead, assign counselor, set fees, and record an offline/manual registration.
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-right">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Remaining After Registration Amount</p>
                <p className="text-sm font-bold text-gray-900">
                  {formatCurrency(Math.max(0, (Number(adminBaseFee) || 0) - (Number(adminDiscount) || 0) - settings.tokenAmount))}
                </p>
              </div>
            </div>

            {adminRegistrationError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-150 bg-red-50 p-3 text-xs font-medium text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{adminRegistrationError}</span>
              </div>
            )}

            {adminRegistrationSuccess && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-150 bg-green-50 p-3 text-xs font-medium text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{adminRegistrationSuccess}</span>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Counselor</label>
                <select
                  required
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={adminCounselorId}
                  onChange={(e) => setAdminCounselorId(e.target.value)}
                >
                  <option value="">Select counselor</option>
                  {counselors.map(counselor => (
                    <option key={counselor.id} value={counselor.id}>
                      {counselor.name} {counselor.status === 'inactive' ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Student name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={adminStudentName}
                  onChange={(e) => setAdminStudentName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit number"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="student@email.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Course</label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={adminCourseKey}
                  onChange={(e) => handleAdminCourseChange(e.target.value as CourseKey)}
                >
                  {(Object.keys(COURSES) as CourseKey[]).map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Batch Start Date</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={adminBatchDate}
                  onChange={(e) => setAdminBatchDate(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Post Registration Payment Proceeding Type</label>
                <select
                  required
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={adminPostRegistrationPaymentType}
                  onChange={(e) => setAdminPostRegistrationPaymentType(e.target.value as PostRegistrationPaymentType)}
                >
                  <option value="">Select proceeding type</option>
                  {POST_REGISTRATION_PAYMENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Base Fee</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-gray-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full rounded-lg border border-gray-200 py-2 pl-7 pr-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                    value={adminBaseFee || ''}
                    onChange={(e) => setAdminBaseFee(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Scholarship / Discount</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-lg border border-gray-200 py-2 pl-7 pr-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                    value={adminDiscount || ''}
                    onChange={(e) => setAdminDiscount(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-200 pt-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Transaction ID / UTR Number (Optional)</label>
                <input
                  type="text"
                  placeholder="Enter transaction ID or UTR"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  value={adminTransactionId}
                  onChange={(e) => setAdminTransactionId(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Payment Screenshot (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#485d8b] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  onChange={(e) => handleAdminScreenshotChange(e.target.files?.[0] || null)}
                />
              </div>

              <button
                type="submit"
                disabled={adminRegistrationSaving || counselors.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#485d8b] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#3c4d73] disabled:opacity-60"
              >
                <PlusCircle className="h-4 w-4" />
                <span>{adminRegistrationSaving ? 'Creating...' : 'Create Registration'}</span>
              </button>
            </div>

            {adminScreenshotUrl && (
              <a
                href={adminScreenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-xs font-semibold text-[#485d8b] hover:text-[#3c4d73]"
              >
                View selected screenshot
              </a>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Admin Note</label>
              <textarea
                rows={2}
                placeholder="Example: Paid by cash, collected at office, follow-up detail..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
            {/* Header / Filters */}
            <div className="space-y-4 border-b border-gray-200 bg-gray-50/50 p-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRegFilters([])}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                    regFilters.length === 0
                      ? 'bg-[#485d8b] text-white shadow-sm'
                      : 'border border-gray-250 bg-white text-gray-500 shadow-sm hover:text-gray-800'
                  }`}
                >
                  All ({registrations.length})
                </button>
                {statusOptions.map(status => {
                  const active = regFilters.includes(status.value);
                  const count = registrations.filter(r => r.status === status.value).length;
                  return (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => setRegFilters(active ? regFilters.filter(item => item !== status.value) : [...regFilters, status.value])}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                        active
                          ? 'bg-[#485d8b] text-white shadow-sm'
                          : 'border border-gray-250 bg-white text-gray-500 shadow-sm hover:text-gray-800'
                      }`}
                    >
                      {status.label} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_170px_170px_170px_170px]">
                <div className="relative md:col-span-2 xl:col-span-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search student, email, phone, counselor, txn..."
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <MultiSelectFilter
                  label="Courses"
                  allLabel="All Courses"
                  selected={courseFilters}
                  onChange={setCourseFilters}
                  options={Object.keys(COURSES).map(key => ({ value: key, label: key }))}
                />
                <MultiSelectFilter
                  label="Batches"
                  allLabel="All Batches"
                  selected={batchFilters}
                  onChange={setBatchFilters}
                  options={uniqueBatches.map(batch => ({ value: batch, label: formatBatchDate(batch) }))}
                />
                <MultiSelectFilter
                  label="Counselors"
                  allLabel="All Counselors"
                  selected={counselorFilters}
                  onChange={setCounselorFilters}
                  options={counselors.map(counselor => ({ value: counselor.id, label: counselor.name }))}
                />
                <MultiSelectFilter
                  label="Statuses"
                  allLabel="All Statuses"
                  selected={regFilters}
                  onChange={(values) => setRegFilters(values as Array<'pending_payment' | 'paid' | 'verified' | 'dropout'>)}
                  options={statusOptions}
                />
                <MultiSelectFilter
                  label="Mail Status"
                  allLabel="All Mail"
                  selected={mailStatusFilters}
                  onChange={setMailStatusFilters}
                  options={mailStatusOptions}
                />
              </div>
            </div>

            {/* List Table */}
            <div className={`overflow-x-auto ${openActionMenuId ? 'pb-56' : ''}`}>
              {filteredRegs.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-255">
                  <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Student Details</th>
                      <th className="px-6 py-4">Course Info</th>
                      <th className="px-6 py-4">Batch Date</th>
                      <th className="px-6 py-4">Payment Summary</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-sm text-gray-700">
                    {filteredRegs.map((reg) => (
                      <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-semibold text-gray-900">{reg.name}</div>
                            <div className="text-xs text-gray-500">{reg.email} • {reg.phone}</div>
                            <div className="mt-1 text-[11px] font-semibold text-gray-400">
                              Counselor: {reg.generatedByCounselorName}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#e4e8f0] text-[#3c4d73]">
                              {reg.courseKey}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingBatchId === reg.id ? (
                            <div className="flex min-w-[220px] items-center gap-2">
                              <input
                                type="date"
                                value={batchDrafts[reg.id] || reg.batchDate}
                                onChange={(event) => setBatchDrafts(prev => ({ ...prev, [reg.id]: event.target.value }))}
                                className="h-9 rounded-lg border border-gray-200 px-2 text-sm font-semibold text-gray-800 outline-none focus:border-[#485d8b] focus:ring-2 focus:ring-[#485d8b]/15"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateBatchDate(reg)}
                                disabled={batchSavingId === reg.id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#485d8b] text-white shadow-sm transition-colors hover:bg-[#3c4d73] disabled:opacity-60"
                                title="Save batch date"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelBatchEdit(reg.id)}
                                disabled={batchSavingId === reg.id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 disabled:opacity-60"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartBatchEdit(reg)}
                              className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left font-semibold text-gray-805 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-[#485d8b]"
                              title="Change batch date"
                            >
                              <span>{formatBatchDate(reg.batchDate)}</span>
                              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-semibold text-gray-900">{formatCurrency(reg.finalPayable)}</div>
                            <div className="text-xs text-gray-500">Registration Amount: {formatCurrency(reg.minTokenFee)}</div>
                            <div className="text-xs font-semibold text-gray-600">
                              Remaining: {formatCurrency(Math.max(0, reg.finalPayable - reg.minTokenFee))}
                            </div>
                            {reg.transactionId && (
                              <div className="mt-1 max-w-[180px] truncate text-[11px] font-semibold text-[#485d8b]" title={reg.transactionId}>
                                Transaction ID: {reg.transactionId}
                              </div>
                            )}
                            {reg.adminNote && (
                              <div className="mt-1 max-w-[220px] truncate text-[11px] font-medium text-gray-500" title={reg.adminNote}>
                                Note: {reg.adminNote}
                              </div>
                            )}
                            <div className="mt-1 text-[11px] font-medium text-gray-500">
                              Proceeding: {reg.postRegistrationPaymentType || DEFAULT_POST_REGISTRATION_PAYMENT_TYPE}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {reg.status === 'verified' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Verified</span>
                            </span>
                          )}
                          {reg.status === 'paid' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Paid (Review Required)</span>
                            </span>
                          )}
                          {reg.status === 'pending_payment' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Pending Payment</span>
                            </span>
                          )}
                          {reg.status === 'dropout' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Dropout</span>
                            </span>
                          )}
                        </td>
                        <td className="relative px-6 py-4 whitespace-nowrap text-right" data-action-menu-root>
                          <button
                            type="button"
                            onClick={() => setOpenActionMenuId(openActionMenuId === reg.id ? null : reg.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-all hover:border-[#485d8b] hover:text-[#485d8b]"
                            title="Open actions"
                          >
                            <Menu className="h-4 w-4" />
                          </button>

                          {openActionMenuId === reg.id && (
                            <div className="absolute right-6 top-14 z-40 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 text-left shadow-xl">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReg(reg);
                                  setOpenActionMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                {reg.status === 'pending_payment' ? <IndianRupee className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                <span>
                                  {reg.status === 'pending_payment'
                                    ? 'Add Payment'
                                    : reg.status === 'paid'
                                      ? 'Review Payment'
                                      : 'View Details'}
                                </span>
                              </button>

                              {canDownloadInvoice(reg) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDownloadInvoice(reg);
                                    setOpenActionMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                  <Download className="h-4 w-4" />
                                  <span>Invoice</span>
                                </button>
                              )}

                              {canSendOnboardingEmail(reg) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handlePreviewOnboardingEmail(reg);
                                      setOpenActionMenuId(null);
                                    }}
                                    disabled={emailPreviewLoadingId === reg.id}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#485d8b] hover:bg-indigo-50 disabled:opacity-60"
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span>{emailPreviewLoadingId === reg.id ? 'Loading Mail...' : 'Preview Mail'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSendOnboardingEmail(reg);
                                      setOpenActionMenuId(null);
                                    }}
                                    disabled={sendingEmailId === reg.id}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
                                  >
                                    <Send className="h-4 w-4" />
                                    <span>{sendingEmailId === reg.id ? 'Sending...' : 'Send Mail'}</span>
                                  </button>
                                </>
                              )}

                              {reg.onboardingEmailStatus === 'sent' && (
                                <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-green-700">
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Mail Sent</span>
                                </div>
                              )}

                              {reg.status !== 'dropout' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleMarkDropout(reg);
                                    setOpenActionMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                                >
                                  <AlertCircle className="h-4 w-4" />
                                  <span>Dropout</span>
                                </button>
                              )}

                              {reg.status === 'pending_payment' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeletePendingRegistration(reg);
                                    setOpenActionMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No registrations found matching the filters.</p>
                  <p className="mt-2 text-xs text-gray-400">
                    Create one here as admin, or let a counselor generate a registration link.
                  </p>
                </div>
              )}
            </div>
          </div>
          </div>
        ) : activeTab === 'counselors' ? (
          /* COUNSELORS TAB */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Counselor Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <PlusCircle className="w-5 h-5 text-[#485d8b]" />
                <span>Create Counselor Account</span>
              </h3>

              {cError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-150 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cError}</span>
                </div>
              )}
              {cSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-lg border border-green-150 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateCounselor} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Counselor Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter counselor's full name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="counselor@dv.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Set counselor password"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                    value={cPassword}
                    onChange={(e) => setCPassword(e.target.value)}
                  />
                  <p className="mt-1 text-[10px] font-medium text-gray-400">Minimum 6 characters.</p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#485d8b] hover:bg-[#3c4d73] text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
                >
                  Create Account
                </button>
              </form>
            </div>

            {/* Counselors List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden lg:col-span-2">
              <div className="p-5 border-b border-gray-200 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-805">Active Counselor Accounts</h3>
              </div>

              <div className="divide-y divide-gray-200">
                {counselors.length > 0 ? (
                  counselors.map((counselor) => (
                    <div key={counselor.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{counselor.name}</h4>
                          <p className="text-xs text-gray-500">{counselor.email}</p>
                          <p className="text-[10px] text-gray-400 mt-1">Created: {new Date(counselor.createdAt).toLocaleDateString()}</p>
                          {counselor.linkGenerationBlocked && (
                            <p className="mt-1 max-w-md text-[11px] font-medium text-red-600">
                              Link generation stopped: {counselor.linkGenerationNote}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            counselor.status === 'active' 
                              ? 'bg-green-50 text-green-700 border border-green-200' 
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {counselor.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                          
                          <button
                            onClick={() => handleToggleStatus(counselor.id)}
                            className="text-gray-400 hover:text-[#485d8b] focus:outline-none transition-colors"
                            title={counselor.status === 'active' ? 'Deactivate Counselor' : 'Activate Counselor'}
                          >
                            {counselor.status === 'active' ? (
                              <ToggleRight className="w-9 h-9 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-9 h-9 text-gray-300" />
                            )}
                          </button>

                          <button
                            onClick={() => handleToggleLinkGeneration(counselor)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                              counselor.linkGenerationBlocked
                                ? 'border-green-100 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title={counselor.linkGenerationBlocked ? 'Allow Link Generation' : 'Stop Link Generation'}
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>{counselor.linkGenerationBlocked ? 'Allow Links' : 'Stop Links'}</span>
                          </button>

                          <button
                            onClick={() => handleStartProfileEdit(counselor)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition-all hover:border-[#485d8b] hover:text-[#485d8b]"
                            title="Edit counselor details"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => setActivePasswordEditor(activePasswordEditor === counselor.id ? null : counselor.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition-all hover:border-[#485d8b] hover:text-[#485d8b]"
                            title="Change Password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>Password</span>
                          </button>

                          <button
                            onClick={() => handleDeleteCounselor(counselor.id, counselor.name)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-all hover:bg-red-100"
                            title="Remove Counselor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>

                      {activeProfileEditor === counselor.id && (
                        <div className="mt-4 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              Counselor Name
                            </label>
                            <input
                              type="text"
                              placeholder="Counselor name"
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                              value={profileDrafts[counselor.id]?.name || ''}
                              onChange={(e) => setProfileDrafts(current => ({
                                ...current,
                                [counselor.id]: {
                                  name: e.target.value,
                                  email: current[counselor.id]?.email || counselor.email
                                }
                              }))}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              Email Address
                            </label>
                            <input
                              type="email"
                              placeholder="counselor@example.com"
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                              value={profileDrafts[counselor.id]?.email || ''}
                              onChange={(e) => setProfileDrafts(current => ({
                                ...current,
                                [counselor.id]: {
                                  name: current[counselor.id]?.name || counselor.name,
                                  email: e.target.value
                                }
                              }))}
                            />
                          </div>
                          <button
                            onClick={() => handleUpdateCounselorProfile(counselor.id)}
                            className="rounded-lg bg-[#485d8b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3c4d73]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setActiveProfileEditor(null)}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {activePasswordEditor === counselor.id && (
                        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-end">
                          <div className="flex-1">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              New Password
                            </label>
                            <input
                              type="password"
                              minLength={6}
                              placeholder="Enter new password"
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                              value={passwordDrafts[counselor.id] || ''}
                              onChange={(e) => setPasswordDrafts(current => ({ ...current, [counselor.id]: e.target.value }))}
                            />
                          </div>
                          <button
                            onClick={() => handleChangePassword(counselor.id)}
                            className="rounded-lg bg-[#485d8b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3c4d73]"
                          >
                            Save Password
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-550">
                    No counselor accounts registered yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TEMPLATES TAB */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <FileText className="h-5 w-5 text-[#485d8b]" />
                <span>Course Templates</span>
              </h3>
              <div className="mt-4 space-y-2">
                {(Object.keys(COURSES) as CourseKey[]).map(courseKey => {
                  const hasTemplate = Boolean(getTemplate(courseKey));
                  return (
                    <button
                      key={courseKey}
                      type="button"
                      onClick={() => setSelectedTemplateCourse(courseKey)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-all ${
                        selectedTemplateCourse === courseKey
                          ? 'border-[#485d8b] bg-[#485d8b] text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-[#485d8b] hover:text-[#485d8b]'
                      }`}
                    >
                      <span>{courseKey}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                        selectedTemplateCourse === courseKey
                          ? 'bg-white/15 text-white'
                          : hasTemplate
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}>
                        {hasTemplate ? 'Ready' : 'No template'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50/60 p-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Mail Template</p>
                  <h3 className="mt-1 text-xl font-black text-gray-900">{selectedTemplateCourse}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Changes here update the master template. Editing inside mail preview before Send will affect only that one email.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleResetTemplateDraft}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-100"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={templateSavingCourse === selectedTemplateCourse}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#485d8b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3c4d73] disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    <span>{templateSavingCourse === selectedTemplateCourse ? 'Saving...' : 'Save Template'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-5">
                {!selectedTemplate && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                    No saved template exists for {selectedTemplateCourse}. Add subject and body below, then save it to enable onboarding mail for this course.
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Subject Template
                  </label>
                  <input
                    type="text"
                    value={templateSubjectDraft}
                    onChange={(event) => setTemplateSubjectDrafts(current => ({
                      ...current,
                      [selectedTemplateCourse]: event.target.value
                    }))}
                    placeholder="Welcome to DV Data & Analytics - {{courseKey}} Batch {{batchCode}}"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Email Body
                  </label>
                  <RichHtmlEditor
                    key={`template-editor-${selectedTemplateCourse}-${selectedTemplate?.updatedAt || 'new'}`}
                    value={templateBodyDraft || '<p>Dear {{studentName}},</p>'}
                    onChange={(nextHtml) => setTemplateBodyDrafts(current => ({
                      ...current,
                      [selectedTemplateCourse]: nextHtml
                    }))}
                  />
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Available Placeholders</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      'studentName',
                      'courseKey',
                      'courseName',
                      'courseFullName',
                      'batchCode',
                      'batchDate',
                      'baseFee',
                      'discount',
                      'finalPayable',
                      'registrationAmount',
                      'remainingBalance',
                      'paymentProceedingType',
                      'courseFeeLine',
                      'paymentSchedule'
                    ].map(placeholder => (
                      <button
                        key={placeholder}
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(`{{${placeholder}}}`)}
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:border-[#485d8b] hover:text-[#485d8b]"
                        title="Copy placeholder"
                      >
                        {`{{${placeholder}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Verification Modal */}
      {selectedReg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-100 animate-scaleUp">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-start bg-gray-50">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-450">Registration Verification</span>
                <h3 className="text-xl font-bold text-gray-900 mt-0.5">{selectedReg.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedReg(null)}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-800 border-b pb-1.5 uppercase tracking-wide">Candidate & Course Details</h4>
                <div className="space-y-2.5 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">Email Address</span>
                    <span className="font-medium text-gray-800">{selectedReg.email}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Phone Number</span>
                    <span className="font-medium text-gray-800">{selectedReg.phone}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Course Selected</span>
                    <span className="font-medium text-gray-800">{formatCourseLabel(selectedReg.courseName, selectedReg.courseKey)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Batch Start Date</span>
                    <span className="font-bold text-[#3c4d73]">
                      {new Date(selectedReg.batchDate).toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: 'numeric'})}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Payment Proceeding Type</span>
                    <span className="font-medium text-gray-800">{selectedReg.postRegistrationPaymentType || DEFAULT_POST_REGISTRATION_PAYMENT_TYPE}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Link Generated By</span>
                    <span className="font-medium text-gray-800">{selectedReg.generatedByCounselorName}</span>
                  </div>
                  {selectedReg.adminNote && (
                    <div>
                      <span className="text-xs text-gray-400 block">Admin Note</span>
                      <span className="font-medium text-gray-800">{selectedReg.adminNote}</span>
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-bold text-gray-805 border-b pb-1.5 uppercase tracking-wide pt-2">Financial Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Base Course Fee:</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(selectedReg.baseFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-550">Scholarship/Discount:</span>
                    <span className="font-semibold text-green-600">-{formatCurrency(selectedReg.discount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="font-semibold text-gray-700">Final Payable:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(selectedReg.finalPayable)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-xs text-gray-400">Registration Amount:</span>
                    <span className="text-xs font-semibold text-gray-600">{formatCurrency(selectedReg.minTokenFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Remaining Balance:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(Math.max(0, selectedReg.finalPayable - selectedReg.minTokenFee))}</span>
                  </div>
                </div>
              </div>

              {/* Payment Receipt Side */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-800 border-b pb-1.5 uppercase tracking-wide">Payment Verification</h4>
                
                {selectedReg.status === 'pending_payment' ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-5 text-center">
                      <Clock className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-550">Payment is not marked as completed yet.</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h5 className="text-sm font-bold text-gray-900">Add Manual Payment</h5>
                      <p className="mt-1 text-xs text-gray-500">
                        Use this when payment was collected outside Cashfree or needs to be recorded manually.
                      </p>

                      {manualPaymentError && (
                        <div className="mt-3 rounded-lg border border-red-150 bg-red-50 p-3 text-xs font-medium text-red-700">
                          {manualPaymentError}
                        </div>
                      )}

                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                            Transaction ID / UTR Number (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Enter transaction ID or UTR"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                            value={manualTransactionId}
                            onChange={(e) => setManualTransactionId(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                            Payment Screenshot (Optional)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#485d8b] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                            onChange={(e) => handleManualScreenshotChange(e.target.files?.[0] || null)}
                          />
                        </div>

                        {manualScreenshotUrl && (
                          <a
                            href={manualScreenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                          >
                            <img src={manualScreenshotUrl} alt="Manual payment screenshot preview" className="max-h-40 w-full object-contain" />
                          </a>
                        )}

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                            Admin Note
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Example: Paid by cash, collected at office, follow-up detail..."
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                            value={manualPaymentNote}
                            onChange={(e) => setManualPaymentNote(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1.5 border border-gray-200">
                      <div><span className="text-gray-400">Payment Method:</span> <span className="font-semibold text-gray-800 uppercase">{selectedReg.paymentMethod}</span></div>
                      {selectedReg.transactionId && (
                        <div><span className="text-gray-400">Transaction ID:</span> <span className="font-semibold text-gray-850 break-all">{selectedReg.transactionId}</span></div>
                      )}
                      {selectedReg.submittedAt && (
                        <div><span className="text-gray-400">Submitted:</span> <span className="text-gray-650">{new Date(selectedReg.submittedAt).toLocaleString()}</span></div>
                      )}
                      {selectedReg.adminNote && (
                        <div><span className="text-gray-400">Admin Note:</span> <span className="font-medium text-gray-800">{selectedReg.adminNote}</span></div>
                      )}
                      {selectedReg.status === 'verified' && selectedReg.verifiedAt && (
                        <div className="text-green-700 mt-1 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Verified on {new Date(selectedReg.verifiedAt).toLocaleDateString()} by {selectedReg.verifiedByAdminEmail}</span>
                        </div>
                      )}
                      {selectedReg.onboardingEmailStatus && (
                        <div>
                          <span className="text-gray-400">Onboarding Email:</span>{' '}
                          <span className={`font-semibold ${
                            selectedReg.onboardingEmailStatus === 'sent'
                              ? 'text-green-700'
                              : selectedReg.onboardingEmailStatus === 'failed'
                                ? 'text-red-600'
                                : 'text-gray-600'
                          }`}>
                            {selectedReg.onboardingEmailStatus === 'sent'
                              ? `Sent${selectedReg.onboardingEmailSentAt ? ` on ${new Date(selectedReg.onboardingEmailSentAt).toLocaleString()}` : ''}`
                              : selectedReg.onboardingEmailStatus === 'skipped'
                                ? 'Skipped for this course'
                                : 'Failed'}
                          </span>
                          {selectedReg.onboardingEmailSentByAdminEmail && (
                            <div className="mt-1 text-gray-500">Sent by {selectedReg.onboardingEmailSentByAdminEmail}</div>
                          )}
                          {selectedReg.onboardingEmailError && (
                            <div className="mt-1 text-red-600">{selectedReg.onboardingEmailError}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedReg.screenshotUrl && (
                      <a
                        href={selectedReg.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                      >
                        <img src={selectedReg.screenshotUrl} alt="Payment screenshot" className="max-h-64 w-full object-contain" />
                      </a>
                    )}

                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-800">
                      {selectedReg.paymentMethod === 'manual'
                        ? 'This registration amount payment was added manually by the admin.'
                        : 'Cashfree has marked this registration amount payment as paid. No manual screenshot review is required.'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setSelectedReg(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-650 hover:bg-gray-150 transition-colors"
              >
                Close
              </button>

              {canDownloadInvoice(selectedReg) && (
                <button
                  type="button"
                  onClick={() => handleDownloadInvoice(selectedReg)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 border border-gray-200 bg-white text-gray-700 hover:border-[#485d8b] hover:text-[#485d8b] font-semibold rounded-lg text-sm transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Invoice</span>
                </button>
              )}

              {canSendOnboardingEmail(selectedReg) && (
                <>
                  <button
                    type="button"
                    onClick={() => handlePreviewOnboardingEmail(selectedReg)}
                    disabled={emailPreviewLoadingId === selectedReg.id}
                    className="inline-flex items-center gap-1.5 px-5 py-2 border border-indigo-100 bg-indigo-50 text-[#485d8b] hover:bg-indigo-100 font-semibold rounded-lg text-sm transition-colors shadow-sm disabled:opacity-60"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{emailPreviewLoadingId === selectedReg.id ? 'Loading...' : 'Preview Mail'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendOnboardingEmail(selectedReg)}
                    disabled={sendingEmailId === selectedReg.id}
                    className="inline-flex items-center gap-1.5 px-5 py-2 border border-green-100 bg-green-50 text-green-700 hover:bg-green-100 font-semibold rounded-lg text-sm transition-colors shadow-sm disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{sendingEmailId === selectedReg.id ? 'Sending...' : 'Send Mail'}</span>
                  </button>
                </>
              )}

              {selectedReg.status !== 'dropout' && (
                <button
                  type="button"
                  onClick={() => handleMarkDropout(selectedReg)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg text-sm transition-colors shadow-sm"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Mark Dropout</span>
                </button>
              )}

              {selectedReg.status === 'pending_payment' && (
                <button
                  onClick={handleManualPayment}
                  disabled={manualPaymentSaving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#485d8b] hover:bg-[#3c4d73] text-white font-semibold rounded-lg text-sm transition-colors shadow-md disabled:opacity-60"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{manualPaymentSaving ? 'Saving...' : 'Add Manual Payment'}</span>
                </button>
              )}
              
              {selectedReg.status === 'paid' && (
                <button
                  onClick={() => handleVerifyPayment(selectedReg.id)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-md shadow-green-100"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve Enrollment</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {emailPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Onboarding Email Preview</p>
                <h3 className="mt-1 text-xl font-black text-gray-900">{emailPreview.registration.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEmailPreview(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 border-b border-gray-200 bg-gray-50 p-5 text-sm">
              <div><span className="font-semibold text-gray-500">To:</span> <span className="text-gray-900">{emailPreview.to}</span></div>
              {emailPreview.cc.length > 0 && (
                <div><span className="font-semibold text-gray-500">CC:</span> <span className="text-gray-900">{emailPreview.cc.join(', ')}</span></div>
              )}
              <div><span className="font-semibold text-gray-500">Attachment:</span> <span className="text-gray-900">DV Admission and Consent Form.pdf</span></div>
            </div>

            <div className="flex-1 space-y-4 overflow-auto bg-white p-5">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={emailPreview.subject}
                    onChange={(event) => setEmailPreview(current => current ? { ...current, subject: event.target.value } : current)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Mail Body
                  </label>
                  <RichHtmlEditor
                    key={`preview-editor-${emailPreview.registration.id}`}
                    value={emailPreview.html}
                    onChange={(nextHtml) => setEmailPreview(current => current ? { ...current, html: nextHtml } : current)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 p-5">
              <button
                type="button"
                onClick={() => setEmailPreview(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-650 transition-colors hover:bg-gray-150"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleSendOnboardingEmail(emailPreview.registration, {
                  subject: emailPreview.subject,
                  html: emailPreview.html
                })}
                disabled={sendingEmailId === emailPreview.registration.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-green-100 transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                <span>{sendingEmailId === emailPreview.registration.id ? 'Sending...' : 'Send Mail'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
