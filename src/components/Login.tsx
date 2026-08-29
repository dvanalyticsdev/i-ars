import React, { useState } from 'react';
import { db } from '../db';
import { UserSession } from '../types';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const showPreviewCredentials = import.meta.env.DEV;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Simulate network delay for realistic experience
    setTimeout(async () => {
      try {
        const session = await db.login(email.trim().toLowerCase(), password);
        onLoginSuccess(session);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unable to connect to the server. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 transition-all duration-300 hover:shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-48 h-auto flex items-center justify-center p-2 rounded-xl mb-4 bg-gray-50 border border-gray-100">
            <img 
              src="/Logo/DV-Logo.png" 
              alt="DV Logo" 
              className="max-w-full max-h-20 object-contain"
              onError={(e) => {
                // Fallback in case logo doesn't load
                e.currentTarget.src = 'https://placehold.co/200x80/485d8b/ffffff?text=DV+Admissions';
              }}
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Staff Authentication</h2>
          <p className="text-sm text-gray-500 mt-1">Admission Registration Portal</p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="email">
              Work Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                id="email"
                type="email"
                required
                className="block w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#485d8b] focus:border-[#485d8b] focus:bg-white text-sm transition-all"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                className="block w-full pl-11 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#485d8b] focus:border-[#485d8b] focus:bg-white text-sm transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-[#485d8b] hover:bg-[#3c4d73] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#485d8b] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {showPreviewCredentials && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Default credentials for preview</h4>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <div><span className="font-semibold text-gray-700">Admin:</span> admin@dv.com / DvA@2026!rK9#Pq72</div>
              <div><span className="font-semibold text-gray-700">Counselor:</span> neha@dv.com / password123</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
