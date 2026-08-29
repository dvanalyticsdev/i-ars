import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { StudentRegistration, CourseKey, COURSES, UserSession, Counselor } from '../types';
import { 
  Link, 
  Copy, 
  Check, 
  LogOut, 
  PlusCircle, 
  ExternalLink, 
  UserPlus,
  BookOpen,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  Trash2,
  Download
} from 'lucide-react';
import { downloadTemporaryInvoice as downloadInvoicePdf } from '../invoice';
import { formatCurrency } from '../format';
import { MultiSelectFilter } from './MultiSelectFilter';

interface CounselorDashboardProps {
  session: UserSession;
  onLogout: () => void;
  tokenAmount: number;
  registrations: StudentRegistration[];
  currentCounselor?: Counselor | null;
  onDataChange: () => Promise<void>;
}

export const CounselorDashboard: React.FC<CounselorDashboardProps> = ({ 
  session, 
  onLogout,
  tokenAmount,
  registrations,
  currentCounselor,
  onDataChange
}) => {
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [courseKey, setCourseKey] = useState<CourseKey>('APIDS');
  const [baseFee, setBaseFee] = useState<number>(COURSES['APIDS'].defaultFee);
  const [discount, setDiscount] = useState<number>(0);
  const [batchDate, setBatchDate] = useState<string>(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14); // 2 weeks from now
    return defaultDate.toISOString().split('T')[0];
  });

  // Link Generation State
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter state for counselor's registrations
  const [filterStatuses, setFilterStatuses] = useState<Array<'pending_payment' | 'paid' | 'verified' | 'dropout'>>([]);
  const [filterBatches, setFilterBatches] = useState<string[]>([]);
  const [filterCourses, setFilterCourses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter registrations created by this counselor
  const myRegistrations = registrations.filter(r => r.generatedByCounselorId === session.counselorId);

  // Auto populate base course fee on courseKey change
  useEffect(() => {
    setBaseFee(COURSES[courseKey].defaultFee);
  }, [courseKey]);

  const finalPayable = Math.max(0, baseFee - discount);
  const linkGenerationBlocked = Boolean(currentCounselor?.linkGenerationBlocked);
  const linkGenerationNote = currentCounselor?.linkGenerationNote || 'Link generation has been stopped for your account. Please contact the administrator.';
  const canDownloadInvoice = (registration: StudentRegistration) =>
    registration.status === 'paid' || registration.status === 'verified';

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratedLink(null);

    if (linkGenerationBlocked) {
      alert(linkGenerationNote);
      return;
    }

    if (!name.trim() || !phone.trim() || !email.trim()) {
      alert('Please fill out all personal details.');
      return;
    }

    if (!batchDate) {
      alert('Please select a batch start date.');
      return;
    }

    if (baseFee <= 0) {
      alert('Base course fee must be greater than 0.');
      return;
    }

    if (discount < 0 || discount > baseFee) {
      alert('Discount cannot be negative or exceed the base course fee.');
      return;
    }

    if (tokenAmount > finalPayable) {
      alert(`Final payable fee cannot be less than the registration amount of ${formatCurrency(tokenAmount)}.`);
      return;
    }

    try {
      const reg = await db.addRegistration(
      name,
      phone,
      email,
      courseKey,
      baseFee,
      discount,
      batchDate,
      session.counselorId || 'unknown',
      session.name
      );

      const studentLink = `${window.location.origin}/?studentId=${reg.id}`;
      setGeneratedLink(studentLink);
      await onDataChange();

      // Clear form fields
      setName('');
      setPhone('');
      setEmail('');
      setDiscount(0);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to generate registration link.');
    }
  };

  const copyToClipboard = (linkText: string, id: string) => {
    navigator.clipboard.writeText(linkText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteUnusedLink = async (reg: StudentRegistration) => {
    if (!confirm(`Delete the unused registration link for ${reg.name}?`)) {
      return;
    }

    try {
      await db.deleteUnusedRegistration(reg.id);
      await onDataChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to delete this registration link.');
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

  // Extract unique batch dates from counselor registrations
  const uniqueBatches = Array.from(new Set(myRegistrations.map(r => r.batchDate))).sort();
  const statusOptions: Array<{ value: 'pending_payment' | 'paid' | 'verified' | 'dropout'; label: string }> = [
    { value: 'pending_payment', label: 'Pending Payment' },
    { value: 'paid', label: 'Unverified Payment' },
    { value: 'verified', label: 'Verified' },
    { value: 'dropout', label: 'Dropout' }
  ];

  // Filtered Counselor registrations
  const filteredMyRegs = myRegistrations.filter(r => {
    const query = searchQuery.trim().toLowerCase();
    const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(r.status);
    const matchesBatch = filterBatches.length === 0 || filterBatches.includes(r.batchDate);
    const matchesCourse = filterCourses.length === 0 || filterCourses.includes(r.courseKey);
    const matchesSearch = !query
      || r.name.toLowerCase().includes(query)
      || r.email.toLowerCase().includes(query)
      || r.phone.toLowerCase().includes(query)
      || r.courseKey.toLowerCase().includes(query)
      || (r.transactionId || '').toLowerCase().includes(query);
    return matchesStatus && matchesBatch && matchesCourse && matchesSearch;
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
              <span className="text-lg font-bold text-gray-800">Counselor Workspace</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-700">{session.name}</p>
                <p className="text-xs text-gray-400">Counselor</p>
              </div>
              <button 
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-650 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {linkGenerationBlocked && (
          <div className="lg:col-span-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Registration link generation has been stopped by admin.</p>
                <p className="mt-1">{linkGenerationNote}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* LEFT: Generation Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-5 border-b pb-3">
              <UserPlus className="w-5 h-5 text-[#485d8b]" />
              <span>Register New Candidate</span>
            </h3>

            <form onSubmit={handleGenerateLink} className="space-y-4">
              {/* Personal Details */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Student Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Siddharth Verma"
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b] focus:bg-white"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit number"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b] focus:bg-white"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@gmail.com"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b] focus:bg-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Course Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> Selected Course
                </label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b] focus:bg-white"
                  value={courseKey}
                  onChange={(e) => setCourseKey(e.target.value as CourseKey)}
                >
                  {(Object.keys(COURSES) as CourseKey[]).map(key => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Date Option */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  Batch Start Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b] focus:bg-white font-semibold text-gray-800"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                />
              </div>

              {/* Financial Breakdown */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3.5">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  Financial Details
                </h4>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                      Base Fee
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 text-xs font-semibold">₹</span>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full pl-6 pr-2 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#485d8b]"
                        value={baseFee || ''}
                        onChange={(e) => setBaseFee(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                      Scholarship/Discount
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 text-xs font-semibold">₹</span>
                      <input
                        type="number"
                        min="0"
                        max={baseFee}
                        className="w-full pl-6 pr-2 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#485d8b]"
                        value={discount || ''}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5 border-t pt-3">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Final Payable</span>
                    <span className="text-sm font-bold text-[#3c4d73]">{formatCurrency(finalPayable)}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Registration Amount</span>
                    <span className="text-sm font-bold text-[#3c4d73]">{formatCurrency(tokenAmount)}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={linkGenerationBlocked}
                className="w-full py-2.5 bg-[#485d8b] hover:bg-[#3c4d73] text-white font-semibold rounded-lg text-sm transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
              >
                {linkGenerationBlocked ? (
                  <AlertCircle className="w-4.5 h-4.5" />
                ) : (
                  <PlusCircle className="w-4.5 h-4.5" />
                )}
                <span>{linkGenerationBlocked ? 'Link Generation Stopped' : 'Generate Registration Link'}</span>
              </button>
            </form>
          </div>

          {/* Generated Link Alert */}
          {generatedLink && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm animate-scaleUp">
              <h4 className="text-sm font-bold text-blue-900 flex items-center gap-1.5 mb-2">
                <Link className="w-4.5 h-4.5" /> Link Generated Successfully!
              </h4>
              <p className="text-xs text-blue-700 mb-3.5">Send this secure link to the student to review details and complete enrollment payment.</p>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-800 select-all focus:outline-none"
                  value={generatedLink}
                />
                
                <button
                  onClick={() => copyToClipboard(generatedLink, 'main')}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                >
                  {copiedId === 'main' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'main' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="mt-3 flex justify-end">
                <a 
                  href={generatedLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>Open Registration Screen</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Student Status Track List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
            <div className="space-y-4 border-b border-gray-200 bg-gray-50/50 p-5">
              <div>
                <h3 className="text-lg font-bold text-gray-805">Active Registrations ({myRegistrations.length})</h3>
                <p className="text-xs text-gray-400 mt-0.5">Real-time enrollment tracking for candidates registered by you</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]">
                <div className="relative sm:col-span-2 xl:col-span-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search student, email, phone, txn..."
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <MultiSelectFilter
                  label="Courses"
                  allLabel="All Courses"
                  selected={filterCourses}
                  onChange={setFilterCourses}
                  options={Object.keys(COURSES).map(key => ({ value: key, label: key }))}
                />
                <MultiSelectFilter
                  label="Statuses"
                  allLabel="All Statuses"
                  selected={filterStatuses}
                  onChange={(values) => setFilterStatuses(values as Array<'pending_payment' | 'paid' | 'verified' | 'dropout'>)}
                  options={statusOptions}
                />
                <MultiSelectFilter
                  label="Batches"
                  allLabel="All Batches"
                  selected={filterBatches}
                  onChange={setFilterBatches}
                  options={uniqueBatches.map(batch => ({ value: batch, label: formatBatchDate(batch) }))}
                />
              </div>
            </div>

            <div className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto">
              {filteredMyRegs.length > 0 ? (
                filteredMyRegs.map((reg) => {
                  const studentUrl = `${window.location.origin}/?studentId=${reg.id}`;
                  const isAdminManualRegistration = Boolean(reg.createdByAdmin && reg.paymentMethod === 'manual');
                  return (
                    <div key={reg.id} className="p-5 hover:bg-gray-50/50 transition-all">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{reg.name}</h4>
                          <p className="text-xs text-gray-500">{reg.email} • {reg.phone}</p>
                        </div>
                        
                        <div className="shrink-0">
                          {reg.status === 'verified' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verified</span>
                            </span>
                          )}
                          {reg.status === 'paid' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{reg.paymentMethod === 'manual' ? 'Manual Payment Added' : 'Paid via Cashfree'}</span>
                            </span>
                          )}
                          {reg.status === 'pending_payment' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Pending Payment</span>
                            </span>
                          )}
                          {reg.status === 'dropout' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Dropout</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-200/60">
                        <div>
                          <p className="text-gray-400 font-medium">Selected Course</p>
                          <p className="font-semibold text-gray-800">{reg.courseKey}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium">Batch Start Date</p>
                          <p className="font-semibold text-gray-800">
                            {formatBatchDate(reg.batchDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium">Fee Details</p>
                          <p className="font-semibold text-gray-855">
                            {formatCurrency(reg.finalPayable)} (Registration Amount: {formatCurrency(reg.minTokenFee)})
                          </p>
                          <p className="font-semibold text-gray-600">
                            Remaining: {formatCurrency(Math.max(0, reg.finalPayable - reg.minTokenFee))}
                          </p>
                          {reg.transactionId && (
                            <p className="mt-1 truncate font-semibold text-[#485d8b]" title={reg.transactionId}>
                              Transaction ID: {reg.transactionId}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1 text-[11px] text-gray-450">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Generated: {new Date(reg.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {reg.status === 'pending_payment' && !isAdminManualRegistration && (
                            <button
                              onClick={() => handleDeleteUnusedLink(reg)}
                              className="p-1.5 hover:bg-red-50 border border-red-100 rounded text-red-500 hover:text-red-700 transition-colors focus:outline-none flex items-center gap-1 text-xs font-semibold"
                              title="Delete unused registration link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                          {canDownloadInvoice(reg) && (
                            <button
                              type="button"
                              onClick={() => downloadInvoicePdf(reg)}
                              className="p-1.5 hover:bg-gray-100 border border-gray-200 rounded text-gray-500 hover:text-[#485d8b] transition-colors focus:outline-none flex items-center gap-1 text-xs font-semibold"
                              title="Download temporary invoice"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Invoice</span>
                            </button>
                          )}
                          {isAdminManualRegistration ? (
                            <span className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-500">
                              Added by Admin
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => copyToClipboard(studentUrl, reg.id)}
                                className="p-1.5 hover:bg-gray-100 border border-gray-200 rounded text-gray-500 hover:text-gray-800 transition-colors focus:outline-none flex items-center gap-1 text-xs"
                                title="Copy link to clipboard"
                              >
                                {copiedId === reg.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedId === reg.id ? 'Copied' : 'Copy URL'}</span>
                              </button>
                              <a
                                href={studentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-gray-100 border border-gray-200 rounded text-gray-500 hover:text-[#485d8b] transition-colors focus:outline-none flex items-center gap-1 text-xs font-semibold"
                                title="Open link in a new tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-gray-450 text-sm">
                  No registrations found for this filter.
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
