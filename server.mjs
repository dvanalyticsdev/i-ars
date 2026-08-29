import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const envPath = join(__dirname, '.env');

const loadEnvFile = async () => {
  if (!existsSync(envPath)) return;

  const content = await readFile(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

await loadEnvFile();

const distDir = join(__dirname, 'dist');
const logoDir = join(__dirname, 'Logo');
const consentFormPath = join(__dirname, 'attachments', 'DV Admission and Consent Form.pdf');
const port = Number(process.env.PORT || 3600);
const defaultTokenAmount = 5000;
const apiVersion = '2025-01-01';
const cashfreeEnv = process.env.CASHFREE_ENV === 'sandbox' ? 'sandbox' : 'production';
const cashfreeBaseUrl = cashfreeEnv === 'sandbox' ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg';
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const mongoDbName = process.env.MONGODB_DB_NAME || 'i-ars';
const formatCurrency = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const formatRs = amount => `Rs ${Number(amount || 0).toLocaleString('en-IN')}`;

const createPasswordFields = password => {
  const passwordSalt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, passwordSalt, 64).toString('hex');
  return { passwordHash, passwordSalt };
};

const verifyPassword = (password, counselor) => {
  if (!counselor?.passwordHash || !counselor?.passwordSalt) {
    return false;
  }

  const expected = Buffer.from(counselor.passwordHash, 'hex');
  const actual = scryptSync(password, counselor.passwordSalt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const DEFAULT_COUNSELORS = [
  {
    id: 'c1',
    name: 'Neha Sharma',
    email: 'neha@dv.com',
    status: 'active',
    linkGenerationBlocked: false,
    linkGenerationNote: null,
    createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    ...createPasswordFields('password123')
  },
  {
    id: 'c2',
    name: 'Raj Malhotra',
    email: 'raj@dv.com',
    status: 'active',
    linkGenerationBlocked: false,
    linkGenerationNote: null,
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    ...createPasswordFields('password123')
  },
  {
    id: 'c3',
    name: 'Siddharth Roy',
    email: 'siddharth@dv.com',
    status: 'inactive',
    linkGenerationBlocked: false,
    linkGenerationNote: null,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    ...createPasswordFields('password123')
  }
];

const COURSES = {
  APIDA: { key: 'APIDA', name: 'APIDA', defaultFee: 65000 },
  APIDS: { key: 'APIDS', name: 'APIDS', defaultFee: 75000 },
  DAS: { key: 'DAS', name: 'DAS', defaultFee: 50000 },
  FDE: { key: 'FDE', name: 'FDE', defaultFee: 80000 }
};
const POST_REGISTRATION_PAYMENT_TYPES = ['Loan', 'Internal EMI', 'Will decide later'];
const defaultPostRegistrationPaymentType = 'Will decide later';
const microsoftMailTokenKey = 'microsoft-mail-token';
const microsoftAuthStateKey = 'microsoft-mail-auth-state';
const graphScopes = ['offline_access', 'Mail.Send', 'User.Read'];

const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const addMonths = (dateStr, months) => {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
};

const ordinalDay = day => {
  if (day > 3 && day < 21) return `${day}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th';
  return `${day}${suffix}`;
};

const formatMailDate = dateStr => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr || '';
  return `${ordinalDay(date.getDate())} ${date.toLocaleString('en-IN', { month: 'short', year: 'numeric' })}`;
};

const batchCode = dateStr => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const courseMailConfig = {
  APIDA: {
    fullName: 'Advanced Program in Data Analytics (APIDA)',
    welcomeName: batch => `APIDA Batch - ${batch}`,
    videoDashboard: 'Watch and download training videos.',
    ram: '8GB or more'
  },
  APIDS: {
    fullName: 'Advanced Program in Industrial Data Science (APIDS)',
    welcomeName: batch => `APIDS Batch - ${batch}`,
    videoDashboard: 'Watch class videos and download study materials and assignments.',
    ram: '16GB or more'
  },
  FDE: {
    fullName: 'Master AI Forward Deployment Engineer Program (FDE)',
    welcomeName: batch => `Master AI Forward Deployment Engineer Program FDE Batch - ${batch}`,
    videoDashboard: 'Watch class videos and download study materials and assignments.',
    ram: '16GB or more'
  }
};

const defaultOnboardingTemplateForCourse = courseKey => {
  const config = courseMailConfig[courseKey];
  if (!config) return null;

  return {
    courseKey,
    subjectTemplate: 'Welcome to DV Data & Analytics - {{courseKey}} Batch {{batchCode}}',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.55; font-size: 15px;">
        <p><strong>Dear {{studentName}},</strong></p>
        <p>Welcome to <strong>DV Data & Analytics</strong>! We are thrilled to have you join India's pioneering career-based industrial Data Science training program. On behalf of the entire DV team, we extend a warm welcome to <strong>${escapeHtml(config.welcomeName('{{batchCode}}'))}</strong>.</p>
        <p>You are about to embark on an exciting learning journey that will elevate your skills and expertise in Data Science. Our <strong>Training & Development team</strong> is dedicated to ensuring a seamless and enriching learning experience for you.</p>

        <h3>Onboarding Details</h3>
        <h4>1. Required Documents</h4>
        <p><strong>Attached:</strong> Consent Form</p>
        <p><strong>Action Required:</strong> Kindly sign and submit the form within <strong>2 days</strong> from the date of this email to receive access to our <strong>Learning Management System (LMS)</strong>.</p>

        <h4>2. LMS Access Information</h4>
        <p>Upon enrollment, you will gain access to:</p>
        <ul>
          <li><strong>Video Dashboard</strong> - ${escapeHtml(config.videoDashboard)}</li>
          <li><strong>Study Materials</strong> - Comprehensive learning resources.</li>
          <li><strong>Student Mentorship</strong> - Personalized guidance from industry experts.</li>
          <li><strong>WhatsApp Support Group</strong> - Access provided one day before program commencement.</li>
        </ul>
        <p><strong>LMS Access Duration:</strong></p>
        <ul>
          <li><strong>Batch-wise access:</strong> 12 months from the date of enrollment.</li>
          <li><strong>Self-paced review access:</strong> Additional 12 months after batch completion.</li>
        </ul>
        <p><strong>To activate LMS access:</strong></p>
        <ol>
          <li>Log in to the DV Analytics Registration Portal.</li>
          <li>Complete the admission process.</li>
          <li>Approve the Consent Form.</li>
        </ol>

        <h4>3. System Requirements</h4>
        <p>For an optimal learning experience, ensure your system meets the following specifications:</p>
        <ul>
          <li><strong>Operating System:</strong> Windows 10 or above</li>
          <li><strong>Processor:</strong> Intel i3 or higher</li>
          <li><strong>RAM:</strong> ${escapeHtml(config.ram)}</li>
          <li><strong>Storage:</strong> 512GB SSD/HDD or higher</li>
        </ul>

        <h4>4. Course Fees & Payment Schedule</h4>
        <p>{{courseFeeLine}}</p>
        {{paymentSchedule}}

        <p><strong>Bank Details for Fee Payment:</strong></p>
        <ul>
          <li><strong>Account Name:</strong> DV DATA & ANALYTICS Pvt Ltd.</li>
          <li><strong>Account Type:</strong> Current</li>
          <li><strong>Account Number:</strong> 343505001332</li>
          <li><strong>Bank:</strong> ICICI</li>
          <li><strong>Branch:</strong> Mallesh Palya Main Road</li>
          <li><strong>IFSC Code:</strong> ICIC0003435</li>
        </ul>
        <p><strong>Payment Link:</strong> <a href="https://dvanalyticsmds.com/payment">https://dvanalyticsmds.com/payment</a></p>

        <h4>5. Contact Information</h4>
        <p>For any assistance or inquiries, please reach out to the respective support teams:</p>
        <ul>
          <li><strong>Finance & LMS Access:</strong> Mr. Sajid - 8431424165</li>
          <li><strong>Student Mentorship:</strong> Mrs. Lakshmi - 7907991738</li>
          <li><strong>Escalations:</strong> Mr. Ajith - 9916000655</li>
          <li><strong>Class Schedules:</strong> Ms. Sanjana - 9611276828</li>
        </ul>

        <p>If you have any questions or require further assistance, please do not hesitate to contact us. We are excited to support you on your journey to becoming a <strong>Data Science & AI expert</strong>!</p>
        <p><strong>Best Regards,</strong><br/>DV Data & Analytics Team</p>
        <p><strong>Email:</strong> support@dvdataanalytics.com | md.sajid@dvdataanalytics.com<br/>
        <strong>Contact:</strong> +91 8431424165 | 9611276828<br/>
        <strong>Website:</strong> <a href="https://www.dvanalyticsmds.com">www.dvanalyticsmds.com</a></p>
      </div>
    `.trim(),
    updatedAt: new Date().toISOString()
  };
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const client = new MongoClient(mongoUri);
await client.connect();
const database = client.db(mongoDbName);
const settingsCollection = database.collection('settings');
const counselorsCollection = database.collection('counselors');
const registrationsCollection = database.collection('registrations');
const onboardingTemplatesCollection = database.collection('onboardingTemplates');
await settingsCollection.createIndex({ key: 1 }, { unique: true });
await counselorsCollection.createIndex({ email: 1 }, { unique: true });
await registrationsCollection.createIndex({ id: 1 }, { unique: true });
await registrationsCollection.createIndex({ generatedByCounselorId: 1 });
await registrationsCollection.createIndex({ status: 1 });
await onboardingTemplatesCollection.createIndex({ courseKey: 1 }, { unique: true });

const ensureSeedData = async () => {
  await settingsCollection.updateOne(
    { key: 'app' },
    {
      $setOnInsert: {
        key: 'app',
        tokenAmount: defaultTokenAmount,
        updatedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  );

  const counselorCount = await counselorsCollection.countDocuments();
  if (counselorCount === 0) {
    await counselorsCollection.insertMany(DEFAULT_COUNSELORS);
  }

  const counselorsWithoutPasswords = await counselorsCollection.find({ passwordHash: { $exists: false } }).toArray();
  for (const counselor of counselorsWithoutPasswords) {
    await counselorsCollection.updateOne(
      { id: counselor.id },
      { $set: createPasswordFields('password123') }
    );
  }

  await counselorsCollection.updateMany(
    { linkGenerationBlocked: { $exists: false } },
    { $set: { linkGenerationBlocked: false, linkGenerationNote: null } }
  );

  await registrationsCollection.updateMany(
    { postRegistrationPaymentType: { $exists: false } },
    { $set: { postRegistrationPaymentType: defaultPostRegistrationPaymentType } }
  );

  for (const courseKey of Object.keys(courseMailConfig)) {
    const template = defaultOnboardingTemplateForCourse(courseKey);
    await onboardingTemplatesCollection.updateOne(
      { courseKey },
      { $setOnInsert: { ...template, createdAt: new Date().toISOString() } },
      { upsert: true }
    );
  }
};

await ensureSeedData();

const sanitize = document => {
  if (!document) return null;
  const { _id, passwordHash, passwordSalt, ...rest } = document;
  return rest;
};

const getSettings = async () => {
  await ensureSeedData();
  const settings = await settingsCollection.findOne({ key: 'app' }, { projection: { _id: 0, key: 0 } });
  return settings || { tokenAmount: defaultTokenAmount, updatedAt: new Date().toISOString() };
};

const normalizeRegistration = registration => ({
  ...registration,
  postRegistrationPaymentType: POST_REGISTRATION_PAYMENT_TYPES.includes(registration.postRegistrationPaymentType)
    ? registration.postRegistrationPaymentType
    : defaultPostRegistrationPaymentType
});

const getAppState = async () => ({
  settings: await getSettings(),
  counselors: (await counselorsCollection.find({}, { projection: { _id: 0, passwordHash: 0, passwordSalt: 0 } }).sort({ createdAt: 1 }).toArray()),
  registrations: (await registrationsCollection.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()).map(normalizeRegistration),
  onboardingTemplates: await onboardingTemplatesCollection.find({}, { projection: { _id: 0 } }).sort({ courseKey: 1 }).toArray()
});

const microsoftConfig = () => {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const senderEmail = process.env.MICROSOFT_SENDER_EMAIL;
  const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;

  if (!tenantId || !clientId || !clientSecret || !senderEmail) {
    throw new Error('Microsoft Graph mail is not configured. Set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_SENDER_EMAIL.');
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    senderEmail,
    redirectUri: `${appBaseUrl.replace(/\/$/, '')}/api/microsoft/callback`
  };
};

const microsoftTokenUrl = tenantId => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

const saveMicrosoftToken = async tokenPayload => {
  const expiresIn = Number(tokenPayload.expires_in || 3600);
  const token = {
    key: microsoftMailTokenKey,
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token,
    expiresAt: new Date(Date.now() + Math.max(60, expiresIn - 120) * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };

  await settingsCollection.updateOne(
    { key: microsoftMailTokenKey },
    { $set: token },
    { upsert: true }
  );

  return token;
};

const requestMicrosoftToken = async form => {
  const { tenantId } = microsoftConfig();
  const response = await fetch(microsoftTokenUrl(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Microsoft token request failed.');
  }

  return payload;
};

const exchangeMicrosoftCode = async code => {
  const config = microsoftConfig();
  const form = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    scope: graphScopes.join(' ')
  });
  return saveMicrosoftToken(await requestMicrosoftToken(form));
};

const getMicrosoftAccessToken = async () => {
  const config = microsoftConfig();
  const saved = await settingsCollection.findOne({ key: microsoftMailTokenKey });

  if (!saved?.refreshToken) {
    throw new Error('Microsoft mailbox is not connected. Open /api/microsoft/auth and sign in once.');
  }

  if (saved.accessToken && saved.expiresAt && new Date(saved.expiresAt).getTime() > Date.now()) {
    return saved.accessToken;
  }

  const form = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: saved.refreshToken,
    grant_type: 'refresh_token',
    scope: graphScopes.join(' ')
  });
  const refreshed = await requestMicrosoftToken(form);
  return (await saveMicrosoftToken({
    ...refreshed,
    refresh_token: refreshed.refresh_token || saved.refreshToken
  })).accessToken;
};

const onboardingCcRecipients = async registration => {
  const configuredCc = String(process.env.ONBOARDING_CC || '')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
  const counselor = registration.generatedByCounselorId
    ? await counselorsCollection.findOne({ id: registration.generatedByCounselorId })
    : null;
  const all = [...configuredCc, counselor?.email].filter(Boolean);
  return Array.from(new Set(all.map(email => email.toLowerCase()))).map(address => ({
    emailAddress: { address }
  }));
};

const buildPaymentScheduleHtml = registration => {
  const proceedingType = registration.postRegistrationPaymentType || defaultPostRegistrationPaymentType;
  const balance = Math.max(0, Number(registration.finalPayable || 0) - Number(registration.minTokenFee || 0));

  if (proceedingType === 'Loan') {
    return `
      <p><strong>Payment Schedule:</strong></p>
      <p>${formatRs(registration.minTokenFee)} - Paid at the time of registration. The balance amount of ${formatRs(balance)} needs to be paid by Loan on or before ${escapeHtml(formatMailDate(registration.batchDate))}.</p>
    `;
  }

  if (proceedingType === 'Internal EMI') {
    const first = Math.floor(balance / 3);
    const second = Math.floor(balance / 3);
    const third = balance - first - second;
    return `
      <p><strong>Payment Schedule:</strong></p>
      <p>${formatRs(registration.minTokenFee)} - Paid at the time of Registration. Balance ${formatRs(balance)} needs to be paid by the following instalments:</p>
      <ul>
        <li>${formatRs(first)} is due to pay by ${escapeHtml(formatMailDate(registration.batchDate))}</li>
        <li>${formatRs(second)} is due to pay by ${escapeHtml(formatMailDate(addMonths(registration.batchDate, 1)))}</li>
        <li>${formatRs(third)} is due to pay by ${escapeHtml(formatMailDate(addMonths(registration.batchDate, 2)))}</li>
      </ul>
    `;
  }

  return `
    <p><strong>Payment Schedule:</strong></p>
    <p>${formatRs(registration.minTokenFee)} - Paid at the time of registration. The remaining balance of ${formatRs(balance)} is pending, and the admissions team will coordinate with you to finalize whether it will be completed through Loan or Internal EMI.</p>
  `;
};

const templateValuesForRegistration = registration => {
  const discountSentence = Number(registration.discount || 0) > 0
    ? ` and you have received a discount of ${formatRs(registration.discount)}`
    : '';
  const courseConfig = courseMailConfig[registration.courseKey];
  const courseFullName = courseConfig?.fullName || registration.courseName || registration.courseKey;
  const remainingBalance = Math.max(0, Number(registration.finalPayable || 0) - Number(registration.minTokenFee || 0));

  return {
    studentName: escapeHtml(registration.name),
    courseKey: escapeHtml(registration.courseKey),
    courseName: escapeHtml(registration.courseName || registration.courseKey),
    courseFullName: escapeHtml(courseFullName),
    batchCode: escapeHtml(batchCode(registration.batchDate)),
    batchDate: escapeHtml(formatMailDate(registration.batchDate)),
    baseFee: escapeHtml(formatRs(registration.baseFee)),
    discount: escapeHtml(formatRs(registration.discount)),
    finalPayable: escapeHtml(formatRs(registration.finalPayable)),
    registrationAmount: escapeHtml(formatRs(registration.minTokenFee)),
    remainingBalance: escapeHtml(formatRs(remainingBalance)),
    paymentProceedingType: escapeHtml(registration.postRegistrationPaymentType || defaultPostRegistrationPaymentType),
    courseFeeLine: `The total fee for the <strong>${escapeHtml(courseFullName)}</strong> is <strong>${formatRs(registration.baseFee)}</strong>${discountSentence}. The final committed fees that you need to pay is <strong>${formatRs(registration.finalPayable)}</strong>.`,
    paymentSchedule: buildPaymentScheduleHtml(registration)
  };
};

const renderOnboardingTemplate = (template, registration) => {
  const values = templateValuesForRegistration(registration);
  const render = value => String(value || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? '');

  return {
    subject: render(template.subjectTemplate),
    html: render(template.bodyHtml)
  };
};

const getOnboardingTemplate = async courseKey => {
  const template = await onboardingTemplatesCollection.findOne({ courseKey }, { projection: { _id: 0 } });
  if (!template?.subjectTemplate || !template?.bodyHtml) {
    throw new Error('Onboarding email is not configured for this course.');
  }
  return template;
};

const buildOnboardingEmail = async registration => {
  const template = await getOnboardingTemplate(registration.courseKey);
  return renderOnboardingTemplate(template, registration);
};

const sendOnboardingEmail = async (registration, emailOverride = null) => {
  const normalized = normalizeRegistration(registration);

  if (normalized.onboardingEmailStatus === 'sent' || normalized.onboardingEmailSentAt) {
    return { status: 'sent', sentAt: normalized.onboardingEmailSentAt };
  }

  const accessToken = await getMicrosoftAccessToken();
  const email = emailOverride || await buildOnboardingEmail(normalized);
  const consentForm = await readFile(consentFormPath);
  const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        subject: email.subject,
        body: {
          contentType: 'HTML',
          content: email.html
        },
        toRecipients: [
          { emailAddress: { address: normalized.email } }
        ],
        ccRecipients: await onboardingCcRecipients(normalized),
        attachments: [
          {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: 'DV Admission and Consent Form.pdf',
            contentType: 'application/pdf',
            contentBytes: consentForm.toString('base64')
          }
        ]
      },
      saveToSentItems: true
    })
  });

  if (!graphResponse.ok) {
    const payload = await graphResponse.json().catch(() => null);
    throw new Error(payload?.error?.message || 'Microsoft Graph could not send onboarding email.');
  }

  return { status: 'sent', sentAt: new Date().toISOString() };
};

const onboardingEmailPreview = async registration => {
  const normalized = normalizeRegistration(registration);
  const email = await buildOnboardingEmail(normalized);
  const ccRecipients = await onboardingCcRecipients(normalized);

  return {
    to: normalized.email,
    cc: ccRecipients.map(recipient => recipient.emailAddress.address),
    subject: email.subject,
    html: email.html
  };
};

const json = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
};

const html = (response, statusCode, markup) => {
  response.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(markup);
};

const microsoftConnectionPage = (title, message) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #f8fafc; color: #111827; }
        main { width: min(560px, calc(100% - 32px)); border: 1px solid #dfe5ef; border-radius: 8px; background: #fff; padding: 28px; box-shadow: 0 10px 30px rgba(15, 23, 42, .08); }
        h1 { margin: 0 0 12px; font-size: 24px; }
        p { margin: 0; color: #475569; line-height: 1.55; }
      </style>
    </head>
    <body>
      <main>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
      </main>
    </body>
  </html>
`;

const readJsonBody = async request =>
  new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    request.on('error', reject);
  });

const cashfreeHeaders = () => {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Cashfree API keys are not configured on the server.');
  }

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-api-version': apiVersion,
    'x-client-id': clientId,
    'x-client-secret': clientSecret
  };
};

const handleApi = async (request, response, url) => {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json(response, 200, { ok: true, database: mongoDbName, cashfreeEnv });
  }

  if (request.method === 'GET' && url.pathname === '/api/state') {
    await ensureSeedData();
    return json(response, 200, await getAppState());
  }

  if (request.method === 'GET' && url.pathname === '/api/microsoft/auth') {
    try {
      const config = microsoftConfig();
      const state = randomUUID();
      await settingsCollection.updateOne(
        { key: microsoftAuthStateKey },
        { $set: { key: microsoftAuthStateKey, state, createdAt: new Date().toISOString() } },
        { upsert: true }
      );

      const authUrl = new URL(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`);
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('response_mode', 'query');
      authUrl.searchParams.set('scope', graphScopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('prompt', 'consent');

      response.writeHead(302, { Location: authUrl.toString() });
      return response.end();
    } catch (error) {
      return html(response, 500, microsoftConnectionPage('Microsoft Mail Not Configured', error.message));
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/microsoft/callback') {
    const error = url.searchParams.get('error');
    if (error) {
      return html(
        response,
        400,
        microsoftConnectionPage('Microsoft Mail Connection Failed', url.searchParams.get('error_description') || error)
      );
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const savedState = await settingsCollection.findOne({ key: microsoftAuthStateKey });

    if (!code || !state || state !== savedState?.state) {
      return html(response, 400, microsoftConnectionPage('Microsoft Mail Connection Failed', 'The sign-in response did not match this server request. Please open the connect link again.'));
    }

    try {
      await exchangeMicrosoftCode(code);
      await settingsCollection.deleteOne({ key: microsoftAuthStateKey });
      return html(response, 200, microsoftConnectionPage('Microsoft Mail Connected', 'Onboarding emails can now be sent when admin previews and clicks Send Mail after verification.'));
    } catch (tokenError) {
      return html(response, 500, microsoftConnectionPage('Microsoft Mail Connection Failed', tokenError.message));
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    await ensureSeedData();
    const body = await readJsonBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (email === 'admin@dv.com' && password === 'DvA@2026!rK9#Pq72') {
      return json(response, 200, {
        email: 'admin@dv.com',
        role: 'admin',
        name: 'System Administrator'
      });
    }

    const counselor = await counselorsCollection.findOne({ email });

    if (!counselor || !verifyPassword(password, counselor)) {
      return json(response, 401, { message: 'Invalid email or password. Please try again.' });
    }

    if (counselor.status === 'inactive') {
      return json(response, 403, { message: 'Your account has been deactivated. Please contact the administrator.' });
    }

    return json(response, 200, {
      email: counselor.email,
      role: 'counselor',
      name: counselor.name,
      counselorId: counselor.id
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/reset') {
    await registrationsCollection.deleteMany({});
    await counselorsCollection.deleteMany({});
    await onboardingTemplatesCollection.deleteMany({});
    await counselorsCollection.insertMany(DEFAULT_COUNSELORS);
    return json(response, 200, await getAppState());
  }

  if (request.method === 'PATCH' && url.pathname === '/api/settings/token') {
    const body = await readJsonBody(request);
    const tokenAmount = Number(body.tokenAmount);

    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
      return json(response, 400, { message: 'Registration amount must be greater than 0.' });
    }

    const updatedAt = new Date().toISOString();
    await settingsCollection.updateOne(
      { key: 'app' },
      { $set: { tokenAmount, updatedAt } },
      { upsert: true }
    );

    return json(response, 200, { tokenAmount, updatedAt });
  }

  if (request.method === 'POST' && url.pathname === '/api/counselors') {
    const body = await readJsonBody(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || !password) {
      return json(response, 400, { message: 'Counselor name, email, and password are required.' });
    }

    if (password.length < 6) {
      return json(response, 400, { message: 'Counselor password must be at least 6 characters.' });
    }

    const counselor = {
      id: `c-${randomUUID()}`,
      name,
      email,
      status: 'active',
      linkGenerationBlocked: false,
      linkGenerationNote: null,
      createdAt: new Date().toISOString(),
      ...createPasswordFields(password)
    };

    try {
      await counselorsCollection.insertOne(counselor);
      return json(response, 200, sanitize(counselor));
    } catch (error) {
      if (error?.code === 11000) {
        return json(response, 409, { message: 'Email address is already in use by another counselor.' });
      }
      throw error;
    }
  }

  const counselorDeleteMatch = url.pathname.match(/^\/api\/counselors\/([^/]+)$/);
  if (request.method === 'DELETE' && counselorDeleteMatch) {
    const id = decodeURIComponent(counselorDeleteMatch[1]);
    const result = await counselorsCollection.deleteOne({ id });

    if (!result.deletedCount) {
      return json(response, 404, { message: 'Counselor was not found.' });
    }

    return json(response, 200, { ok: true });
  }

  const counselorProfileMatch = url.pathname.match(/^\/api\/counselors\/([^/]+)\/profile$/);
  if (request.method === 'PATCH' && counselorProfileMatch) {
    const id = decodeURIComponent(counselorProfileMatch[1]);
    const body = await readJsonBody(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!name || !email) {
      return json(response, 400, { message: 'Counselor name and email are required.' });
    }

    const counselor = await counselorsCollection.findOne({ id });
    if (!counselor) {
      return json(response, 404, { message: 'Counselor was not found.' });
    }

    try {
      const updatedAt = new Date().toISOString();
      await counselorsCollection.updateOne({ id }, { $set: { name, email, updatedAt } });
      await registrationsCollection.updateMany(
        { generatedByCounselorId: id },
        { $set: { generatedByCounselorName: name } }
      );

      return json(response, 200, { ...sanitize(counselor), name, email, updatedAt });
    } catch (error) {
      if (error?.code === 11000) {
        return json(response, 409, { message: 'Email address is already in use by another counselor.' });
      }
      throw error;
    }
  }

  const counselorStatusMatch = url.pathname.match(/^\/api\/counselors\/([^/]+)\/status$/);
  if (request.method === 'PATCH' && counselorStatusMatch) {
    const id = decodeURIComponent(counselorStatusMatch[1]);
    const counselor = await counselorsCollection.findOne({ id });

    if (!counselor) {
      return json(response, 404, { message: 'Counselor was not found.' });
    }

    const status = counselor.status === 'active' ? 'inactive' : 'active';
    await counselorsCollection.updateOne({ id }, { $set: { status } });
    return json(response, 200, { ...sanitize(counselor), status });
  }

  const counselorPasswordMatch = url.pathname.match(/^\/api\/counselors\/([^/]+)\/password$/);
  if (request.method === 'PATCH' && counselorPasswordMatch) {
    const id = decodeURIComponent(counselorPasswordMatch[1]);
    const body = await readJsonBody(request);
    const password = String(body.password || '');

    if (password.length < 6) {
      return json(response, 400, { message: 'Counselor password must be at least 6 characters.' });
    }

    const counselor = await counselorsCollection.findOne({ id });
    if (!counselor) {
      return json(response, 404, { message: 'Counselor was not found.' });
    }

    await counselorsCollection.updateOne({ id }, { $set: createPasswordFields(password) });
    return json(response, 200, sanitize(counselor));
  }

  const counselorLinkGenerationMatch = url.pathname.match(/^\/api\/counselors\/([^/]+)\/link-generation$/);
  if (request.method === 'PATCH' && counselorLinkGenerationMatch) {
    const id = decodeURIComponent(counselorLinkGenerationMatch[1]);
    const body = await readJsonBody(request);
    const blocked = Boolean(body.blocked);
    const note = String(body.note || '').trim();

    const counselor = await counselorsCollection.findOne({ id });
    if (!counselor) {
      return json(response, 404, { message: 'Counselor was not found.' });
    }

    if (blocked && !note) {
      return json(response, 400, { message: 'Please add a note before stopping link generation.' });
    }

    const update = {
      linkGenerationBlocked: blocked,
      linkGenerationNote: blocked ? note : null
    };
    await counselorsCollection.updateOne({ id }, { $set: update });
    return json(response, 200, { ...sanitize(counselor), ...update });
  }

  const onboardingTemplateMatch = url.pathname.match(/^\/api\/onboarding-templates\/([^/]+)$/);
  if (request.method === 'PUT' && onboardingTemplateMatch) {
    const courseKey = decodeURIComponent(onboardingTemplateMatch[1]).toUpperCase();
    const body = await readJsonBody(request);
    const subjectTemplate = String(body.subjectTemplate || '').trim();
    const bodyHtml = String(body.bodyHtml || '').trim();

    if (!COURSES[courseKey]) {
      return json(response, 400, { message: 'Please select a valid course.' });
    }

    if (!subjectTemplate || !bodyHtml) {
      return json(response, 400, { message: 'Subject and email template are required.' });
    }

    const updatedAt = new Date().toISOString();
    await onboardingTemplatesCollection.updateOne(
      { courseKey },
      {
        $set: { courseKey, subjectTemplate, bodyHtml, updatedAt },
        $setOnInsert: { createdAt: updatedAt }
      },
      { upsert: true }
    );

    const template = await onboardingTemplatesCollection.findOne({ courseKey }, { projection: { _id: 0 } });
    return json(response, 200, template);
  }

  if (request.method === 'POST' && url.pathname === '/api/registrations') {
    const body = await readJsonBody(request);
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const courseKey = String(body.courseKey || '');
    const baseFee = Number(body.baseFee);
    const discount = Number(body.discount || 0);
    const batchDate = String(body.batchDate || '').trim();
    const counselorId = String(body.counselorId || 'unknown');
    const counselorName = String(body.counselorName || 'Unknown Counselor');
    const postRegistrationPaymentType = String(body.postRegistrationPaymentType || '').trim();
    const adminNote = String(body.adminNote || '').trim();
    const createdByAdmin = Boolean(body.createdByAdmin);
    const transactionId = String(body.transactionId || '').trim();
    const screenshotUrl = typeof body.screenshotUrl === 'string' ? body.screenshotUrl : null;

    if (!name || !phone || !email || !batchDate || !COURSES[courseKey]) {
      return json(response, 400, { message: 'Student details, course, and batch date are required.' });
    }

    if (!POST_REGISTRATION_PAYMENT_TYPES.includes(postRegistrationPaymentType)) {
      return json(response, 400, { message: 'Post registration payment proceeding type is required.' });
    }

    if (!Number.isFinite(baseFee) || baseFee <= 0 || discount < 0 || discount > baseFee) {
      return json(response, 400, { message: 'Fee details are invalid.' });
    }

    const counselor = await counselorsCollection.findOne({ id: counselorId });
    if (!createdByAdmin && counselor?.linkGenerationBlocked) {
      return json(response, 403, {
        message: counselor.linkGenerationNote || 'Link generation has been stopped for your account. Please contact the administrator.'
      });
    }

    const { tokenAmount } = await getSettings();
    const finalPayable = Math.max(0, baseFee - discount);
    if (tokenAmount > finalPayable) {
      return json(response, 400, { message: `Final payable fee cannot be less than ${formatCurrency(tokenAmount)}.` });
    }

    if (createdByAdmin && !adminNote && !screenshotUrl && !transactionId) {
      return json(response, 400, { message: 'Add an admin note, payment screenshot, or transaction/UTR detail for manual registration.' });
    }

    if (screenshotUrl && screenshotUrl.length > 900_000) {
      return json(response, 400, { message: 'Payment screenshot is too large. Please upload a smaller image.' });
    }

    const now = new Date().toISOString();

    const registration = {
      id: `student-${randomUUID()}`,
      name,
      phone,
      email,
      courseKey,
      courseName: COURSES[courseKey].name,
      baseFee,
      discount,
      finalPayable,
      minTokenFee: tokenAmount,
      batchDate,
      status: createdByAdmin ? 'paid' : 'pending_payment',
      paymentMethod: createdByAdmin ? 'manual' : null,
      transactionId: transactionId || null,
      screenshotUrl: createdByAdmin ? screenshotUrl : null,
      adminNote: adminNote || null,
      postRegistrationPaymentType,
      createdByAdmin,
      generatedByCounselorId: counselorId,
      generatedByCounselorName: counselorName,
      createdAt: now,
      submittedAt: createdByAdmin ? now : null,
      verifiedAt: null,
      verifiedByAdminEmail: null
    };

    await registrationsCollection.insertOne(registration);
    return json(response, 200, normalizeRegistration(registration));
  }

  const registrationDeleteMatch = url.pathname.match(/^\/api\/registrations\/([^/]+)$/);
  if (request.method === 'DELETE' && registrationDeleteMatch) {
    const id = decodeURIComponent(registrationDeleteMatch[1]);
    const registration = await registrationsCollection.findOne({ id });

    if (!registration) {
      return json(response, 404, { message: 'Registration link was not found.' });
    }

    if (registration.status !== 'pending_payment') {
      return json(response, 409, { message: 'This link cannot be deleted because payment has already been submitted.' });
    }

    await registrationsCollection.deleteOne({ id });
    return json(response, 200, { ok: true });
  }

  if (request.method === 'POST' && url.pathname === '/api/registrations/clear') {
    const body = await readJsonBody(request);

    if (String(body.key || '') !== '2817') {
      return json(response, 403, { message: 'Clear key is incorrect.' });
    }

    const result = await registrationsCollection.deleteMany({});
    return json(response, 200, { ok: true, deletedCount: result.deletedCount });
  }

  const registrationBatchDateMatch = url.pathname.match(/^\/api\/registrations\/([^/]+)\/batch-date$/);
  if (request.method === 'PATCH' && registrationBatchDateMatch) {
    const id = decodeURIComponent(registrationBatchDateMatch[1]);
    const body = await readJsonBody(request);
    const batchDate = String(body.batchDate || '').trim();

    if (!batchDate) {
      return json(response, 400, { message: 'Batch date is required.' });
    }

    const parsedBatchDate = new Date(batchDate);
    if (isNaN(parsedBatchDate.getTime())) {
      return json(response, 400, { message: 'Batch date is invalid.' });
    }

    const result = await registrationsCollection.findOneAndUpdate(
      { id },
      { $set: { batchDate } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    if (!result) {
      return json(response, 404, { message: 'Registration was not found.' });
    }

    return json(response, 200, normalizeRegistration(result));
  }

  const registrationPaymentMatch = url.pathname.match(/^\/api\/registrations\/([^/]+)\/payment$/);
  if (request.method === 'PATCH' && registrationPaymentMatch) {
    const id = decodeURIComponent(registrationPaymentMatch[1]);
    const body = await readJsonBody(request);
    const paymentMethod = String(body.paymentMethod || '').trim();
    const transactionId = String(body.transactionId || '').trim();
    const screenshotUrl = typeof body.screenshotUrl === 'string' ? body.screenshotUrl : null;
    const adminNote = String(body.adminNote || '').trim();

    if (!['cashfree', 'manual'].includes(paymentMethod)) {
      return json(response, 400, { message: 'Payment method is required.' });
    }

    if (paymentMethod === 'cashfree' && !transactionId) {
      return json(response, 400, { message: 'Transaction ID is required for Cashfree payment.' });
    }

    if (paymentMethod === 'manual' && !adminNote && !screenshotUrl && !transactionId) {
      return json(response, 400, { message: 'Add an admin note, payment screenshot, or transaction/UTR detail for manual payment.' });
    }

    if (screenshotUrl && screenshotUrl.length > 900_000) {
      return json(response, 400, { message: 'Payment screenshot is too large. Please upload a smaller image.' });
    }

    const submittedAt = new Date().toISOString();
    const result = await registrationsCollection.findOneAndUpdate(
      { id },
      {
        $set: {
          status: 'paid',
          paymentMethod,
          transactionId: transactionId || null,
          screenshotUrl: paymentMethod === 'manual' ? screenshotUrl : null,
          ...(adminNote ? { adminNote } : {}),
          submittedAt
        }
      },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    if (!result) {
      return json(response, 404, { message: 'Registration was not found.' });
    }

    return json(response, 200, normalizeRegistration(result));
  }

  const registrationVerifyMatch = url.pathname.match(/^\/api\/registrations\/([^/]+)\/verify$/);
  if (request.method === 'PATCH' && registrationVerifyMatch) {
    const id = decodeURIComponent(registrationVerifyMatch[1]);
    const body = await readJsonBody(request);
    const adminEmail = String(body.adminEmail || '').trim().toLowerCase();

    if (!adminEmail) {
      return json(response, 400, { message: 'Admin email is required.' });
    }

    const verifiedAt = new Date().toISOString();
    const result = await registrationsCollection.findOneAndUpdate(
      { id },
      {
        $set: {
          status: 'verified',
          verifiedAt,
          verifiedByAdminEmail: adminEmail
        }
      },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    if (!result) {
      return json(response, 404, { message: 'Registration was not found.' });
    }

    return json(response, 200, normalizeRegistration(result));
  }

  const registrationOnboardingPreviewMatch = url.pathname.match(/^\/api\/registrations\/([^/]+)\/onboarding-email$/);
  if (request.method === 'GET' && registrationOnboardingPreviewMatch) {
    const id = decodeURIComponent(registrationOnboardingPreviewMatch[1]);
    const registration = await registrationsCollection.findOne({ id }, { projection: { _id: 0 } });

    if (!registration) {
      return json(response, 404, { message: 'Registration was not found.' });
    }

    const normalized = normalizeRegistration(registration);

    if (normalized.status !== 'verified') {
      return json(response, 400, { message: 'Onboarding email can be previewed only after admin verifies the payment.' });
    }

    if (normalized.onboardingEmailStatus === 'sent' || normalized.onboardingEmailSentAt) {
      return json(response, 400, { message: 'Onboarding email has already been sent for this registration.' });
    }

    try {
      return json(response, 200, await onboardingEmailPreview(normalized));
    } catch (error) {
      return json(response, 400, { message: error instanceof Error ? error.message : 'Unable to prepare onboarding email.' });
    }
  }

  const registrationOnboardingSendMatch = url.pathname.match(/^\/api\/registrations\/([^/]+)\/onboarding-email\/send$/);
  if (request.method === 'POST' && registrationOnboardingSendMatch) {
    const id = decodeURIComponent(registrationOnboardingSendMatch[1]);
    const body = await readJsonBody(request);
    const adminEmail = String(body.adminEmail || '').trim().toLowerCase();

    if (!adminEmail) {
      return json(response, 400, { message: 'Admin email is required.' });
    }

    const registration = await registrationsCollection.findOne({ id }, { projection: { _id: 0 } });

    if (!registration) {
      return json(response, 404, { message: 'Registration was not found.' });
    }

    const normalized = normalizeRegistration(registration);

    if (normalized.status !== 'verified') {
      return json(response, 400, { message: 'Onboarding email can be sent only after admin verifies the payment.' });
    }

    if (normalized.onboardingEmailStatus === 'sent' || normalized.onboardingEmailSentAt) {
      return json(response, 400, { message: 'Onboarding email has already been sent for this registration.' });
    }

    const subject = String(body.subject || '').trim();
    const editedHtml = String(body.html || '').trim();
    const attemptedAt = new Date().toISOString();
    try {
      const emailResult = await sendOnboardingEmail(
        normalized,
        subject && editedHtml ? { subject, html: editedHtml } : null
      );
      const emailUpdate = {
        onboardingEmailStatus: emailResult.status,
        onboardingEmailAttemptedAt: attemptedAt,
        onboardingEmailError: emailResult.error || null,
        onboardingEmailSentByAdminEmail: adminEmail,
        ...(emailResult.sentAt ? { onboardingEmailSentAt: emailResult.sentAt } : {})
      };
      await registrationsCollection.updateOne({ id }, { $set: emailUpdate });
      return json(response, 200, { ...normalized, ...emailUpdate });
    } catch (error) {
      const emailUpdate = {
        onboardingEmailStatus: 'failed',
        onboardingEmailAttemptedAt: attemptedAt,
        onboardingEmailError: error instanceof Error ? error.message : 'Unable to send onboarding email.'
      };
      await registrationsCollection.updateOne({ id }, { $set: emailUpdate });
      return json(response, 500, { message: emailUpdate.onboardingEmailError });
    }
  }

  const registrationDropoutMatch = url.pathname.match(/^\/api\/registrations\/([^/]+)\/dropout$/);
  if (request.method === 'PATCH' && registrationDropoutMatch) {
    const id = decodeURIComponent(registrationDropoutMatch[1]);
    const body = await readJsonBody(request);
    const adminEmail = String(body.adminEmail || '').trim().toLowerCase();

    if (!adminEmail) {
      return json(response, 400, { message: 'Admin email is required.' });
    }

    const dropoutAt = new Date().toISOString();
    const result = await registrationsCollection.findOneAndUpdate(
      { id },
      {
        $set: {
          status: 'dropout',
          dropoutAt,
          dropoutByAdminEmail: adminEmail
        }
      },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    if (!result) {
      return json(response, 404, { message: 'Registration was not found.' });
    }

    return json(response, 200, normalizeRegistration(result));
  }

  if (request.method === 'POST' && url.pathname === '/api/cashfree/create-order') {
    const body = await readJsonBody(request);
    const customer = body.customer || {};

    if (!body.registrationId || !customer.name || !customer.email || !customer.phone) {
      return json(response, 400, { message: 'Student name, email, phone, and registration ID are required.' });
    }

    const registration = await registrationsCollection.findOne({ id: String(body.registrationId) });
    if (!registration) {
      return json(response, 404, { message: 'Registration was not found.' });
    }

    if (registration.status !== 'pending_payment') {
      return json(response, 409, { message: 'This registration is no longer open for payment.' });
    }

    const tokenAmount = Number(registration.minTokenFee || defaultTokenAmount);
    if (Number(body.amount) !== tokenAmount) {
      return json(response, 400, { message: `Registration payment amount must be exactly ${formatCurrency(tokenAmount)}.` });
    }

    const orderId = `dv_${body.registrationId}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const origin = process.env.APP_BASE_URL || `http://localhost:${port}`;
    const orderMeta = origin.startsWith('https://')
      ? {
          return_url: `${origin}/?studentId=${encodeURIComponent(body.registrationId)}&order_id=${encodeURIComponent(orderId)}`
        }
      : undefined;

    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
      method: 'POST',
      headers: cashfreeHeaders(),
      body: JSON.stringify({
        order_id: orderId,
        order_amount: tokenAmount,
        order_currency: 'INR',
        customer_details: {
          customer_id: String(body.registrationId),
          customer_name: String(customer.name),
          customer_email: String(customer.email),
          customer_phone: String(customer.phone)
        },
        ...(orderMeta ? { order_meta: orderMeta } : {}),
        order_note: 'DV Admissions registration amount'
      })
    });

    const payload = await cashfreeResponse.json();
    if (!cashfreeResponse.ok) {
      return json(response, cashfreeResponse.status, { message: payload.message || 'Cashfree could not create the payment order.' });
    }

    return json(response, 200, {
      orderId: payload.order_id,
      paymentSessionId: payload.payment_session_id
    });
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/cashfree/verify-order/')) {
    const orderId = decodeURIComponent(url.pathname.replace('/api/cashfree/verify-order/', ''));
    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders/${encodeURIComponent(orderId)}`, {
      headers: cashfreeHeaders()
    });

    const payload = await cashfreeResponse.json();
    if (!cashfreeResponse.ok) {
      return json(response, cashfreeResponse.status, { message: payload.message || 'Cashfree could not verify the order.' });
    }

    let transactionId = payload.cf_order_id ? String(payload.cf_order_id) : payload.order_id;

    if (payload.order_status === 'PAID') {
      const paymentsResponse = await fetch(`${cashfreeBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
        headers: cashfreeHeaders()
      });
      const paymentsPayload = await paymentsResponse.json();

      if (paymentsResponse.ok && Array.isArray(paymentsPayload)) {
        const paidPayment = paymentsPayload.find(payment => payment.payment_status === 'SUCCESS') || paymentsPayload[0];
        transactionId = String(
          paidPayment?.cf_payment_id ||
          paidPayment?.bank_reference ||
          transactionId
        );
      }

      const registrationId = String(payload.customer_details?.customer_id || '').trim();
      if (registrationId) {
        await registrationsCollection.updateOne(
          { id: registrationId, status: 'pending_payment' },
          {
            $set: {
              status: 'paid',
              paymentMethod: 'cashfree',
              transactionId,
              screenshotUrl: null,
              submittedAt: new Date().toISOString()
            }
          }
        );
      }
    }

    return json(response, 200, {
      paid: payload.order_status === 'PAID',
      orderStatus: payload.order_status,
      transactionId
    });
  }

  return json(response, 404, { message: 'API route was not found.' });
};

const serveStatic = async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const isLogoAsset = requestedPath.startsWith('/Logo/');
  const assetRoot = isLogoAsset ? logoDir : distDir;
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const staticPath = requestedPath === '/' ? 'index.html' : normalizedPath.replace(/^[/\\]/, '').replace(/^Logo[/\\]/, '');
  let filePath = join(assetRoot, staticPath);

  if (!filePath.startsWith(assetRoot) || !existsSync(filePath)) {
    if (isLogoAsset) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    filePath = join(distDir, 'index.html');
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
};

createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(request, response, url);
    }

    if (request.method === 'GET') {
      return await serveStatic(request, response);
    }

    response.writeHead(405);
    response.end('Method not allowed');
  } catch (error) {
    console.error(error);
    return json(response, 500, { message: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
}).listen(port, () => {
  console.log(`i-ars server running at http://localhost:${port}`);
  console.log(`MongoDB database: ${mongoDbName}`);
  console.log(`Cashfree mode: ${cashfreeEnv}`);
});
