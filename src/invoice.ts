import { jsPDF } from 'jspdf';
import { StudentRegistration } from './types';
import { formatCurrency } from './format';

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

const invoiceFileName = (registration: StudentRegistration) =>
  `temp-invoice-${registration.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;

const renderInvoicePdf = (
  registration: StudentRegistration,
  logoImg: HTMLImageElement | null,
  confirmedTransactionId?: string | null
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const isManual = registration.paymentMethod === 'manual';
  const amountPaid = registration.minTokenFee;
  const remainingBalance = Math.max(0, registration.finalPayable - amountPaid);
  const txnDate = registration.submittedAt
    ? new Date(registration.submittedAt).toLocaleDateString()
    : new Date().toLocaleDateString();

  pdf.setFillColor(60, 77, 115);
  pdf.rect(0, 0, 210, 8, 'F');

  if (logoImg) {
    pdf.addImage(logoImg, 'PNG', 15, 15, 45, 18);
  } else {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(60, 77, 115);
    pdf.text('DV DATA AND ANALYTICS', 15, 25);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(17, 24, 39);
  pdf.text('TEMPORARY INVOICE', 195, 24, { align: 'right' });

  pdf.setFontSize(8.5);
  pdf.setTextColor(107, 114, 128);
  pdf.text(isManual ? 'MANUAL / OFFICE PAYMENT RECEIPT' : 'CASHFREE VERIFIED PAYMENT RECEIPT', 195, 30, { align: 'right' });

  pdf.setDrawColor(229, 231, 235);
  pdf.line(15, 38, 195, 38);

  pdf.setFontSize(9);
  pdf.setTextColor(156, 163, 175);
  pdf.text('STUDENT DETAILS', 15, 48);

  pdf.setFontSize(13);
  pdf.setTextColor(17, 24, 39);
  pdf.text(registration.name, 15, 55);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(75, 85, 99);
  pdf.text(`Email: ${registration.email}`, 15, 61);
  pdf.text(`Phone: ${registration.phone}`, 15, 66);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(156, 163, 175);
  pdf.text('PAYMENT INFORMATION', 120, 48);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  pdf.text(`Date of Payment: ${txnDate}`, 120, 55);
  const transactionId = registration.transactionId || confirmedTransactionId;
  pdf.text(transactionId ? `Transaction ID: ${transactionId}` : 'Reference: Manual office entry', 120, 61);
  pdf.text(`Payment Mode: ${isManual ? 'MANUAL / OFFICE' : 'CASHFREE'}`, 120, 66);

  pdf.setFillColor(243, 244, 246);
  pdf.rect(15, 76, 180, 10, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(75, 85, 99);
  pdf.text('COURSE ENROLLED', 20, 82);
  pdf.text('BATCH START DATE', 90, 82);
  pdf.text('PAYMENT STATUS', 150, 82);

  pdf.setTextColor(17, 24, 39);
  pdf.text(registration.courseKey, 20, 94);
  pdf.text(formatBatchDate(registration.batchDate), 90, 94);
  pdf.text('PAID', 150, 94);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  pdf.text('Base tuition fee:', 120, 112);
  pdf.text('Scholarship / Discount:', 120, 119);
  pdf.text('Registration amount paid:', 120, 126);
  pdf.text('Remaining balance:', 120, 133);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text(formatCurrency(registration.baseFee), 195, 112, { align: 'right' });
  pdf.text(`- ${formatCurrency(registration.discount)}`, 195, 119, { align: 'right' });
  pdf.setTextColor(60, 77, 115);
  pdf.text(formatCurrency(amountPaid), 195, 126, { align: 'right' });
  pdf.setTextColor(17, 24, 39);
  pdf.text(formatCurrency(remainingBalance), 195, 133, { align: 'right' });

  let receiptBoxY = 148;

  if (registration.adminNote) {
    const noteLines = pdf.splitTextToSize(registration.adminNote, 170);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175);
    pdf.text('ADMIN NOTE', 20, receiptBoxY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text(noteLines, 20, receiptBoxY + 6);
    receiptBoxY += Math.min(32, noteLines.length * 5 + 14);
  }

  pdf.setFillColor(240, 253, 244);
  pdf.setDrawColor(187, 247, 208);
  pdf.rect(15, receiptBoxY, 180, 24, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(21, 128, 61);
  pdf.text(isManual ? 'PAYMENT RECORDED BY OFFICE' : 'PAYMENT VERIFIED BY CASHFREE', 20, receiptBoxY + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(22, 101, 52);
  pdf.text(
    isManual
      ? 'This temporary receipt confirms your registration amount payment has been recorded by the office.'
      : 'This temporary receipt confirms your registration amount payment has been verified by the payment gateway.',
    20,
    receiptBoxY + 14
  );
  pdf.text('The official onboarding tax invoice and course materials will be delivered to your email shortly.', 20, receiptBoxY + 19);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(156, 163, 175);
  pdf.text('DV DATA AND ANALYTICS PRIVATE LIMITED - TID NO. 68126530', 15, 275);
  pdf.setFont('helvetica', 'normal');
  pdf.text('For any queries, please get in touch with your assigned Counselor.', 15, 280);
  pdf.text('Generated via DV Admissions Portal', 195, 275, { align: 'right' });

  pdf.save(invoiceFileName(registration));
};

export const downloadTemporaryInvoice = (
  registration: StudentRegistration,
  confirmedTransactionId?: string | null,
  onDone?: () => void
) => {
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  logoImg.src = '/Logo/DV-Logo.png';

  logoImg.onload = () => {
    renderInvoicePdf(registration, logoImg, confirmedTransactionId);
    onDone?.();
  };
  logoImg.onerror = () => {
    renderInvoicePdf(registration, null, confirmedTransactionId);
    onDone?.();
  };
};
