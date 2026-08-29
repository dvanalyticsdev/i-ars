import React, { useState, useEffect } from 'react';
import { db, useLiveDB, initializeDB } from './db';
import { UserSession } from './types';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { CounselorDashboard } from './components/CounselorDashboard';
import { StudentPortal } from './components/StudentPortal';
import { AdmissionTracker } from './components/AdmissionTracker';
import { Database, Code, ChevronUp, ChevronDown } from 'lucide-react';

export const App: React.FC = () => {
  const { settings, counselors, registrations, onboardingTemplates, reload, error } = useLiveDB();
  const [session, setSession] = useState<UserSession | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const isTrackerPage = window.location.pathname === '/tracker';
  const isSandboxEnabled = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  
  // Dev Sandbox states
  const [showSandbox, setShowSandbox] = useState(true);

  // Initialize DB and parse URL params on mount
  useEffect(() => {
    initializeDB().then(reload).catch(console.error);

    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('studentId');
    if (sId) {
      setStudentId(sId);
    }

    // Check existing session in localStorage
    const savedSession = localStorage.getItem('dv_current_session');
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        localStorage.removeItem('dv_current_session');
      }
    }
  }, []);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem('dv_current_session', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('dv_current_session');
    // Clear URL parameters by updating history state
    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    window.history.pushState({}, '', url.toString());
  };

  const handleResetDB = async () => {
    if (confirm('Are you sure you want to reset the database to default seed data? All custom entries will be lost.')) {
      localStorage.removeItem('dv_current_session');
      setSession(null);
      await db.reset();
      await reload();
    }
  };

  // Dev Quick Logins
  const quickLoginAsAdmin = () => {
    setStudentId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('studentId');
    window.history.pushState({}, '', url.toString());

    handleLoginSuccess({
      email: 'admin@dv.com',
      role: 'admin',
      name: 'System Administrator'
    });
  };

  const quickLoginAsCounselor = () => {
    setStudentId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('studentId');
    window.history.pushState({}, '', url.toString());

    // Find the first active counselor in DB
    const active = counselors.find(c => c.status === 'active') || {
      id: 'c1',
      name: 'Neha Sharma',
      email: 'neha@dv.com'
    };
    handleLoginSuccess({
      email: active.email,
      role: 'counselor',
      name: active.name,
      counselorId: active.id
    });
  };

  const handleNavigateToStudentLink = (regId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('studentId', regId);
    window.history.pushState({}, '', url.toString());
    setStudentId(regId);
  };

  const handleBackToStaffPortal = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('studentId');
    window.history.pushState({}, '', url.toString());
    setStudentId(null);
  };

  // Router layout selector
  const renderContent = () => {
    if (isTrackerPage) {
      return <AdmissionTracker registrations={registrations} />;
    }

    if (studentId) {
      return (
        <div className="relative">
          {isSandboxEnabled && (
            <div className="bg-gray-800 text-white text-center py-2 text-xs flex items-center justify-center gap-2">
              <span>You are previewing a Student Enrollment screen.</span>
              <button
                onClick={handleBackToStaffPortal}
                className="underline text-blue-300 hover:text-blue-200 font-bold"
              >
                Return to Staff Portal
              </button>
            </div>
          )}
          <StudentPortal studentId={studentId} registrations={registrations} onDataChange={reload} />
        </div>
      );
    }

    if (!session) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    if (session.role === 'admin') {
      return (
          <AdminDashboard 
          session={session} 
          onLogout={handleLogout} 
          settings={settings}
          counselors={counselors} 
          registrations={registrations}
          onboardingTemplates={onboardingTemplates}
          onDataChange={reload}
        />
      );
    }

    if (session.role === 'counselor') {
      const currentCounselor = counselors.find(counselor => counselor.id === session.counselorId) || null;

      return (
        <CounselorDashboard 
          session={session} 
          onLogout={handleLogout} 
          tokenAmount={settings.tokenAmount}
          registrations={registrations}
          currentCounselor={currentCounselor}
          onDataChange={reload}
        />
      );
    }

    return <div className="p-8 text-center text-red-500">Access Denied / Invalid Role</div>;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-center text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
      <div className="flex-1">
        {renderContent()}
      </div>

      {isSandboxEnabled && (
        <div className="sticky bottom-0 z-40 bg-gray-900 border-t border-gray-800 text-gray-300 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-10">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
              <Code className="w-4 h-4" />
              <span>Sandbox Controls</span>
              <span className="bg-purple-950/60 border border-purple-800 text-purple-300 text-[10px] px-1.5 py-0.2 rounded font-mono">dev_mode</span>
            </div>

            <button 
              onClick={() => setShowSandbox(!showSandbox)}
              className="flex items-center gap-1 text-xs hover:text-white transition-colors"
            >
              <span>{showSandbox ? 'Hide Sandbox Options' : 'Show Sandbox Options'}</span>
              {showSandbox ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showSandbox && (
            <div className="py-4 border-t border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Quick Logins */}
              <div>
                <p className="text-gray-400 font-bold uppercase tracking-wider mb-2">Simulate Quick Login</p>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={quickLoginAsAdmin}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded font-medium border border-gray-700 transition-colors"
                  >
                    Login as Admin
                  </button>
                  <button 
                    onClick={quickLoginAsCounselor}
                    className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded font-medium border border-gray-700 transition-colors"
                  >
                    Login as Counselor
                  </button>
                </div>
              </div>

              {/* Quick Student Link Previews */}
              <div>
                <p className="text-gray-400 font-bold uppercase tracking-wider mb-2">Simulate Student Links</p>
                <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-2">
                  {registrations.length > 0 ? (
                    registrations.map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleNavigateToStudentLink(r.id)}
                        className="text-left truncate hover:text-[#5c76a6] transition-colors"
                        title={`Open link for ${r.name}`}
                      >
                        • {r.name} ({r.courseKey}) - <span className="italic uppercase font-semibold text-[10px]">{r.status}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-gray-500">No registrations generated yet.</span>
                  )}
                </div>
              </div>

              {/* DB Management */}
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-gray-400 font-bold uppercase tracking-wider mb-2">Database Management</p>
                  <button
                    onClick={handleResetDB}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-semibold rounded border border-red-900/50 transition-all flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Reset Local Database</span>
                  </button>
                </div>
                
                <p className="text-[10px] text-gray-500 leading-normal mt-2">
                  Tip: Open this application in two different tabs to experience the real-time instant synchronization across Admin and Counselor dashboards!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default App;
