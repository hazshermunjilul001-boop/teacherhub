'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState('');

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading('Sending...');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://teacherhub-one.vercel.app/reset-password',
    });
    if (error) {
      setLoading('Error: ' + error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Forgot Password</h1>
        {sent ? (
          <div className="text-center py-6">
            <p className="text-green-400 text-lg font-semibold mb-2">✅ Email sent!</p>
            <p className="text-gray-400 text-sm">
              Check your inbox for a password reset link.
              It may take a minute to arrive.
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6">
              Enter your DepEd email address and we'll send you a reset link.
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()}
              placeholder="teacher@deped.gov.ph"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm mb-4"
            />
            <button
              onClick={handleReset}
              disabled={!email.trim() || !!loading}
              className="w-full py-3 bg-blue-700 hover:bg-blue-600 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {loading || 'Send Reset Link'}
            </button>
          </>
        )}
        <p className="text-center text-gray-600 text-xs mt-6">
          <a href="/" className="text-blue-400 hover:underline">← Back to login</a>
        </p>
      </div>
    </div>
  );
}