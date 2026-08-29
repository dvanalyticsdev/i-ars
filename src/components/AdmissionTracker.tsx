import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  IndianRupee,
  ListFilter,
  Search,
  TrendingUp,
  Users
} from 'lucide-react';
import { COURSES, StudentRegistration } from '../types';
import { formatCurrency } from '../format';
import { MultiSelectFilter } from './MultiSelectFilter';

interface AdmissionTrackerProps {
  registrations: StudentRegistration[];
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'N/A';
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr;
  return dateObj.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const isCollected = (registration: StudentRegistration) =>
  registration.status === 'paid' || registration.status === 'verified';

const paymentDate = (registration: StudentRegistration) =>
  registration.submittedAt || registration.verifiedAt || registration.createdAt;

const shortRef = (value: string | null) => {
  if (!value) return 'N/A';
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

const percent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

const aggregateBy = <T extends string>(
  items: StudentRegistration[],
  getKey: (item: StudentRegistration) => T
) => {
  const map = new Map<T, { key: T; total: number; admissions: number; verified: number; unverified: number; dropout: number; revenue: number }>();

  items.forEach(item => {
    const key = getKey(item);
    const current = map.get(key) || { key, total: 0, admissions: 0, verified: 0, unverified: 0, dropout: 0, revenue: 0 };
    current.total += 1;

    if (item.status === 'dropout') {
      current.dropout += 1;
    } else if (item.status === 'verified') {
      current.admissions += 1;
      current.verified += 1;
      current.revenue += item.finalPayable;
    } else if (item.status === 'paid') {
      current.admissions += 1;
      current.unverified += 1;
      current.revenue += item.finalPayable;
    }

    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => b.admissions - a.admissions || b.revenue - a.revenue);
};

const TrendLine: React.FC<{ points: Array<{ label: string; count: number; revenue: number }> }> = ({ points }) => {
  const width = 560;
  const height = 180;
  const padding = 24;
  const maxCount = Math.max(1, ...points.map(point => point.count));

  const coords = points.map((point, index) => {
    const x = points.length === 1
      ? width / 2
      : padding + (index * (width - padding * 2)) / (points.length - 1);
    const y = height - padding - (point.count / maxCount) * (height - padding * 2);
    return { ...point, x, y };
  });

  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="h-64 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">Admission Trend</p>
          <p className="text-xs text-gray-500">Collected payments by date</p>
        </div>
        <TrendingUp className="h-5 w-5 text-[#485d8b]" />
      </div>

      {coords.length > 0 ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" />
          <path d={path} fill="none" stroke="#485d8b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map(point => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="5" fill="#16a34a" stroke="white" strokeWidth="2" />
              <text x={point.x} y={height - 6} textAnchor="middle" fontSize="10" fill="#6b7280">
                {point.label}
              </text>
              <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#111827">
                {point.count}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <div className="flex h-44 items-center justify-center text-sm text-gray-400">
          No collected payments yet.
        </div>
      )}
    </div>
  );
};

export const AdmissionTracker: React.FC<AdmissionTrackerProps> = ({ registrations }) => {
  const [courseFilters, setCourseFilters] = useState<string[]>([]);
  const [batchFilters, setBatchFilters] = useState<string[]>([]);
  const [counselorFilters, setCounselorFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const batches = useMemo(
    () => Array.from(new Set(registrations.map(reg => reg.batchDate))).sort(),
    [registrations]
  );
  const counselorOptions = useMemo(
    () => Array.from(new Map(registrations.map(reg => [
      reg.generatedByCounselorId,
      reg.generatedByCounselorName || 'Unassigned'
    ]))).map(([value, label]) => ({ value, label })),
    [registrations]
  );

  const filteredRegistrations = useMemo(() => registrations.filter(registration => {
    const matchesCourse = courseFilters.length === 0 || courseFilters.includes(registration.courseKey);
    const matchesBatch = batchFilters.length === 0 || batchFilters.includes(registration.batchDate);
    const matchesCounselor = counselorFilters.length === 0 || counselorFilters.includes(registration.generatedByCounselorId);
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query
      || registration.name.toLowerCase().includes(query)
      || registration.generatedByCounselorName.toLowerCase().includes(query)
      || registration.courseKey.toLowerCase().includes(query)
      || (registration.transactionId || '').toLowerCase().includes(query);

    return matchesCourse && matchesBatch && matchesCounselor && matchesSearch;
  }), [batchFilters, counselorFilters, courseFilters, registrations, searchQuery]);

  const dropoutRegistrations = filteredRegistrations.filter(registration => registration.status === 'dropout');
  const activeRegistrations = filteredRegistrations.filter(registration => registration.status !== 'dropout');
  const collectedRegistrations = activeRegistrations.filter(isCollected);
  const unverifiedRegistrations = activeRegistrations.filter(registration => registration.status === 'paid');
  const verifiedRegistrations = activeRegistrations.filter(registration => registration.status === 'verified');
  const revenue = collectedRegistrations.reduce((sum, registration) => sum + registration.finalPayable, 0);
  const dropouts = dropoutRegistrations.length;

  const courseStats = aggregateBy(filteredRegistrations, registration => registration.courseKey);
  const batchStats = aggregateBy(filteredRegistrations, registration => registration.batchDate);
  const counselorStats = aggregateBy(filteredRegistrations, registration => registration.generatedByCounselorName || 'Unassigned');

  const trendPoints = useMemo(() => {
    const map = new Map<string, { label: string; count: number; revenue: number }>();

    collectedRegistrations.forEach(registration => {
      const date = new Date(paymentDate(registration));
      const key = isNaN(date.getTime()) ? registration.createdAt.slice(0, 10) : date.toISOString().slice(0, 10);
      const current = map.get(key) || {
        label: formatDate(key).replace(`, ${new Date(key).getFullYear()}`, ''),
        count: 0,
        revenue: 0
      };
      current.count += 1;
      current.revenue += registration.finalPayable;
      map.set(key, current);
    });

    return Array.from(map.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .slice(-10)
      .map(([, value]) => value);
  }, [collectedRegistrations]);

  const topCourseCount = Math.max(1, ...courseStats.map(item => item.admissions));
  const topCounselorCount = Math.max(1, ...counselorStats.map(item => item.admissions));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <img
              src="/Logo/DV-Logo.png"
              alt="DV Analytics"
              className="h-12 w-auto"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <h1 className="text-xl font-black text-gray-900">Admission Tracker</h1>
              <p className="text-xs font-medium text-gray-500">Read-only admissions and payment dashboard</p>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>Live Read Only</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <Users className="mb-3 h-5 w-5 text-[#485d8b]" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Admissions</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{collectedRegistrations.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <IndianRupee className="mb-3 h-5 w-5 text-[#485d8b]" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Revenue Generated</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{formatCurrency(revenue)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <CheckCircle2 className="mb-3 h-5 w-5 text-green-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Verified Payment</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{verifiedRegistrations.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <Activity className="mb-3 h-5 w-5 text-amber-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Unverified Payment</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{unverifiedRegistrations.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <BarChart3 className="mb-3 h-5 w-5 text-[#485d8b]" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Dropouts</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{dropouts}</p>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <ListFilter className="h-4 w-4 text-[#485d8b]" />
              <span>Filters</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[180px_180px_180px_minmax(220px,1fr)]">
              <MultiSelectFilter
                label="Courses"
                allLabel="All Courses"
                selected={courseFilters}
                onChange={setCourseFilters}
                options={Object.keys(COURSES).map(course => ({ value: course, label: course }))}
              />
              <MultiSelectFilter
                label="Batches"
                allLabel="All Batches"
                selected={batchFilters}
                onChange={setBatchFilters}
                options={batches.map(batch => ({ value: batch, label: formatDate(batch) }))}
              />
              <MultiSelectFilter
                label="Counselors"
                allLabel="All Counselors"
                selected={counselorFilters}
                onChange={setCounselorFilters}
                options={counselorOptions}
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search student, counselor, txn..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#485d8b]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6">
          <div>
            <TrendLine points={trendPoints} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#485d8b]" />
              <h2 className="text-sm font-bold text-gray-900">Course Performance</h2>
            </div>
            <div className="space-y-3">
              {courseStats.length > 0 ? courseStats.map(item => (
                <div key={item.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800">{item.key}</span>
                    <span className="font-semibold text-gray-500">
                      {item.admissions} admissions | {item.verified} verified | {item.unverified} unverified | {item.dropout} dropout | {formatCurrency(item.revenue)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-[#485d8b]" style={{ width: `${percent(item.admissions, topCourseCount)}%` }} />
                  </div>
                </div>
              )) : (
                <p className="py-8 text-center text-sm text-gray-400">No course data available.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#485d8b]" />
              <h2 className="text-sm font-bold text-gray-900">Counselor Performance</h2>
            </div>
            <div className="space-y-3">
              {counselorStats.length > 0 ? counselorStats.map(item => (
                <div key={item.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800">{item.key}</span>
                    <span className="font-semibold text-gray-500">
                      {item.admissions} admissions | {item.verified} verified | {item.unverified} unverified | {item.dropout} dropout | {formatCurrency(item.revenue)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-green-500" style={{ width: `${percent(item.admissions, topCounselorCount)}%` }} />
                  </div>
                </div>
              )) : (
                <p className="py-8 text-center text-sm text-gray-400">No counselor data available.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Batch Summary</h2>
              <p className="text-xs text-gray-500">Admissions and generated revenue by batch</p>
            </div>
            <CalendarDays className="h-5 w-5 text-[#485d8b]" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Total Admissions</th>
                  <th className="px-5 py-3">Verified</th>
                  <th className="px-5 py-3">Unverified</th>
                  <th className="px-5 py-3">Dropout</th>
                  <th className="px-5 py-3">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {batchStats.length > 0 ? batchStats.map(item => (
                  <tr key={item.key} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-bold text-gray-900">{formatDate(item.key)}</td>
                    <td className="px-5 py-3 font-semibold text-gray-700">{item.admissions}</td>
                    <td className="px-5 py-3 font-semibold text-green-700">{item.verified}</td>
                    <td className="px-5 py-3 font-semibold text-amber-700">{item.unverified}</td>
                    <td className="px-5 py-3 font-semibold text-red-700">{item.dropout}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">{formatCurrency(item.revenue)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-400">No batch data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-900">Payment Ledger</h2>
            <p className="text-xs text-gray-500">Read-only list of registration payment records</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Counselor</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Transaction ID / UTR</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredRegistrations.length > 0 ? filteredRegistrations.map(registration => (
                  <tr key={registration.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-bold text-gray-900">{registration.name}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-[#e4e8f0] px-2 py-0.5 text-xs font-bold text-[#3c4d73]">
                        {registration.courseKey}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{formatDate(registration.batchDate)}</td>
                    <td className="px-5 py-3 text-gray-700">{registration.generatedByCounselorName}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">
                      {isCollected(registration) ? formatCurrency(registration.minTokenFee) : '-'}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {registration.paymentMethod === 'manual'
                        ? 'Manual / Office'
                        : registration.paymentMethod === 'cashfree'
                          ? 'Cashfree'
                          : 'Not paid'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-700" title={registration.transactionId || undefined}>
                      {shortRef(registration.transactionId)}
                    </td>
                    <td className="px-5 py-3">
                      {registration.status === 'dropout' ? (
                        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                          Dropout
                        </span>
                      ) : isCollected(registration) ? (
                        <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
                          {registration.status === 'verified' ? 'Verified' : 'Unverified'}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{isCollected(registration) ? formatDate(paymentDate(registration)) : '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-gray-400">No records found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};
