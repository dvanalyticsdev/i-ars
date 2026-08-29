import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { StudentRegistration } from '../types';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { downloadTemporaryInvoice as downloadInvoicePdf } from '../invoice';
import { formatCurrency } from '../format';

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'sandbox' | 'production' }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: '_self' | '_blank' | '_top' | '_modal' | HTMLElement;
      }) => Promise<{
        error?: unknown;
        redirect?: boolean;
        paymentDetails?: {
          paymentMessage?: string;
        };
      }>;
    };
  }
}

interface StudentPortalProps {
  studentId: string;
  registrations: StudentRegistration[];
  onDataChange: () => Promise<void>;
}

interface CashfreeOrderResponse {
  orderId: string;
  paymentSessionId: string;
}

interface CashfreeVerifyResponse {
  paid: boolean;
  orderStatus?: string;
  transactionId?: string;
  message?: string;
}

const CASHFREE_MODE = (import.meta.env.VITE_CASHFREE_MODE === 'sandbox' ? 'sandbox' : 'production') as
  | 'sandbox'
  | 'production';

export const StudentPortal: React.FC<StudentPortalProps> = ({ studentId, registrations, onDataChange }) => {
  const registration = registrations.find(r => r.id === studentId);
  const [step, setStep] = useState<'review' | 'payment' | 'confirmation'>('review');
  const [cashfreeOrderId, setCashfreeOrderId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmedTransactionId, setConfirmedTransactionId] = useState<string | null>(null);

  useEffect(() => {
    if (registration?.status === 'paid' || registration?.status === 'verified') {
      setStep('confirmation');
      setConfirmedTransactionId(registration.transactionId);
    }
  }, [registration]);

  useEffect(() => {
    if (!registration || registration.status !== 'pending_payment') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const returnedStudentId = params.get('studentId');
    const returnedOrderId = params.get('order_id');

    if (!returnedOrderId || returnedStudentId !== registration.id || cashfreeOrderId === returnedOrderId) {
      return;
    }

    const verifyReturnedOrder = async () => {
      setPaymentError(null);
      setLoading(true);
      setCashfreeOrderId(returnedOrderId);

      try {
        const response = await fetch(`/api/cashfree/verify-order/${encodeURIComponent(returnedOrderId)}`);
        const payload: CashfreeVerifyResponse = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || 'Unable to verify payment with Cashfree.');
        }

        if (!payload.paid) {
          throw new Error(`Cashfree has not marked this payment as paid yet. Current status: ${payload.orderStatus || 'unknown'}.`);
        }

        const transactionId = payload.transactionId || returnedOrderId;
        await onDataChange();
        setConfirmedTransactionId(transactionId);
        triggerConfetti();
        setStep('confirmation');
      } catch (error) {
        setPaymentError(error instanceof Error ? error.message : 'Unable to verify payment with Cashfree.');
        setStep('payment');
      } finally {
        setLoading(false);
      }
    };

    verifyReturnedOrder();
  }, [registration, cashfreeOrderId, onDataChange]);

  if (!registration) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-150 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">Invalid Registration Link</h3>
          <p className="text-sm text-gray-500 mt-2">
            The registration link you clicked is invalid or has expired. Please check with your academic counselor.
          </p>
        </div>
      </div>
    );
  }

  if (registration.status === 'dropout') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-150 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">Registration Closed</h3>
          <p className="text-sm text-gray-500 mt-2">
            This registration is no longer active. Please contact your academic counselor for assistance.
          </p>
        </div>
      </div>
    );
  }

  const amountToPay = registration.minTokenFee;
  const remainingBalance = Math.max(0, registration.finalPayable - amountToPay);

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#485d8b', '#5c76a6', '#cdd5e4', '#10b981']
    });
  };

  const createCashfreeOrder = async (): Promise<CashfreeOrderResponse> => {
    const response = await fetch('/api/cashfree/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: registration.id,
        amount: amountToPay,
        customer: {
          name: registration.name,
          email: registration.email,
          phone: registration.phone
        }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Unable to create Cashfree payment order.');
    }

    return payload;
  };

  const verifyCashfreePayment = async (orderId: string) => {
    setPaymentError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/cashfree/verify-order/${encodeURIComponent(orderId)}`);
      const payload: CashfreeVerifyResponse = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Unable to verify payment with Cashfree.');
      }

      if (!payload.paid) {
        throw new Error(`Cashfree has not marked this payment as paid yet. Current status: ${payload.orderStatus || 'unknown'}.`);
      }

      const transactionId = payload.transactionId || orderId;
      await db.submitPayment(registration.id, 'cashfree', transactionId);
      await onDataChange();
      setConfirmedTransactionId(transactionId);
      triggerConfetti();
      setStep('confirmation');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to verify payment with Cashfree.');
    } finally {
      setLoading(false);
    }
  };

  const handleCashfreePayment = async () => {
    setPaymentError(null);
    setLoading(true);

    try {
      if (!window.Cashfree) {
        throw new Error('Cashfree checkout script is not loaded. Please refresh and try again.');
      }

      const order = await createCashfreeOrder();
      setCashfreeOrderId(order.orderId);

      const cashfree = window.Cashfree({ mode: CASHFREE_MODE });
      const result = await cashfree.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: '_modal'
      });

      if (result.redirect) {
        setPaymentError('Payment window redirected. Please return here and click Check Payment Status.');
        return;
      }

      await verifyCashfreePayment(order.orderId);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Cashfree payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatBatchDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    return dateObj.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDownloadTemporaryInvoice = () => {
    setDownloadingPdf(true);
    downloadInvoicePdf(registration, confirmedTransactionId, () => setDownloadingPdf(false));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-xl border border-gray-150 overflow-hidden transition-all duration-300">
        <div className="bg-[#485d8b] text-white p-6 relative">
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Registration</span>
          </div>

          <img
            src="/Logo/DV-Logo.png"
            alt="DV Logo"
            className="h-10 w-auto brightness-0 invert mb-3"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h2 className="text-xl sm:text-2xl font-bold">Student Enrollment Portal</h2>
          <p className="text-xs sm:text-sm text-gray-200 mt-1">
            Review details, pay the registration amount, and finalize your registration.
          </p>
        </div>

        {step === 'review' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#485d8b] text-white text-xs font-bold">1</span>
                <span>Review Candidate & Program Information</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4 text-sm">
                <div>
                  <span className="text-xs text-gray-400 block font-bold uppercase tracking-wider">Candidate Full Name</span>
                  <span className="text-gray-800 font-semibold">{registration.name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-bold uppercase tracking-wider">Selected Course Program</span>
                  <span className="text-[#3c4d73] font-bold">{registration.courseKey}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-bold uppercase tracking-wider">Batch Start Date</span>
                  <span className="text-gray-800 font-semibold">{formatBatchDate(registration.batchDate)}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-bold uppercase tracking-wider">Phone Number</span>
                  <span className="text-gray-800 font-semibold">{registration.phone}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block font-bold uppercase tracking-wider">Email Address</span>
                  <span className="text-gray-800 font-semibold">{registration.email}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Financial Details Summary</h4>
              <div className="space-y-2.5 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Base Program Tuition Fee:</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(registration.baseFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Applicable Discount / Scholarship:</span>
                  <span className="font-semibold text-green-600">-{formatCurrency(registration.discount)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="font-bold text-gray-800 text-base">Total Final Course Payable:</span>
                  <span className="font-extrabold text-[#3c4d73] text-base">{formatCurrency(registration.finalPayable)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-3 text-xs text-gray-550 italic">
                  <span>Registration Amount Payable Now:</span>
                  <span className="font-semibold">{formatCurrency(amountToPay)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-800">Remaining Balance After Registration Amount:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(remainingBalance)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('payment')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#485d8b] hover:bg-[#3c4d73] text-white font-bold rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              <span>Confirm Details & Proceed to Payment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#485d8b] text-white text-xs font-bold">2</span>
              <span>Pay Registration Amount</span>
            </h3>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Registration Amount</span>
                <span className="text-3xl font-black text-gray-850 block mt-1">{formatCurrency(amountToPay)}</span>
              </div>
              <span className="text-xs font-semibold text-gray-500 bg-white border px-3 py-1.5 rounded-lg shadow-sm w-fit">
                Cashfree Secure Checkout
              </span>
            </div>

            {paymentError && (
              <div className="bg-red-50 border border-red-150 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="border border-gray-200 rounded-xl p-6 text-center bg-white">
              <CreditCard className="w-12 h-12 text-[#485d8b] mx-auto mb-3" />
              <h4 className="font-bold text-gray-900">Complete Payment with Cashfree</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Cashfree will collect the payment securely and this portal will verify the order status automatically.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep('review')}
                disabled={loading}
                className="w-1/3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-650 hover:bg-gray-100 font-bold transition-all text-center disabled:opacity-60"
              >
                Back
              </button>

              <button
                type="button"
                onClick={cashfreeOrderId ? () => verifyCashfreePayment(cashfreeOrderId) : handleCashfreePayment}
                disabled={loading}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition-all shadow-md shadow-green-100 flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking Payment...</span>
                  </>
                ) : cashfreeOrderId ? (
                  <span>Check Payment Status</span>
                ) : (
                  <span>Pay {formatCurrency(amountToPay)} Now</span>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 pulse-slow">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-gray-900">Payment Verified!</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                Thank you, <span className="font-semibold text-gray-800">{registration.name}</span>.{' '}
                {registration.paymentMethod === 'manual'
                  ? 'Your registration amount payment has been recorded by the office.'
                  : 'Your registration amount payment has been verified by Cashfree.'}
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 max-w-md mx-auto text-left space-y-3.5">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-1.5">Enrollment Summary</h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Transaction ID:</span>
                <span className="font-mono text-gray-700 font-bold text-xs">{registration.transactionId || confirmedTransactionId}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Amount Paid:</span>
                <span className="font-semibold text-gray-800">{formatCurrency(amountToPay)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Remaining Balance:</span>
                <span className="font-semibold text-gray-800">{formatCurrency(remainingBalance)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Course Selected:</span>
                <span className="font-semibold text-gray-800">{registration.courseKey}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Batch Start Date:</span>
                <span className="font-semibold text-gray-800">{formatBatchDate(registration.batchDate)}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t pt-3">
                <span className="text-gray-500">Registration Status:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Paid</span>
                </span>
              </div>
            </div>

            <div className="max-w-md mx-auto">
              <button
                type="button"
                onClick={handleDownloadTemporaryInvoice}
                disabled={downloadingPdf}
                className="w-full py-3 bg-[#485d8b] hover:bg-[#3c4d73] text-white font-bold rounded-lg text-sm transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating PDF Invoice...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4.5 h-4.5" />
                    <span>Download Temporary Invoice (PDF)</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center font-medium">
                {registration.paymentMethod === 'manual'
                  ? 'This invoice is generated after the office records the manual payment.'
                  : 'This invoice is generated after Cashfree confirms the payment status.'}
              </p>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <p className="text-xs text-gray-550 max-w-sm mx-auto leading-normal">
                Your onboarding instructions, course details, and credentials will be sent to your registered email:{' '}
                <span className="font-semibold text-gray-700">{registration.email}</span> shortly.
              </p>
            </div>

            {registration.status === 'verified' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-800 text-left max-w-md mx-auto flex items-start gap-2.5 shadow-sm">
                <Sparkles className="w-5 h-5 shrink-0 text-green-600 mt-0.5" />
                <div>
                  <span className="font-bold">Onboarding Instructions Triggered!</span>
                  <p className="text-green-700 mt-0.5">
                    Your registration has been fully approved by the administration. Check your email for further onboarding details.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
