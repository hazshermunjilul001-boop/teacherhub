'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const router  = useRouter();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [message,   setMessage]   = useState('');
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash — check for an active session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setMessage('Invalid or expired reset link. Please request a new one.');
    });
  }, []);

  const handleUpdate = async () => {
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }
    if (password.length < 6)  { setMessage('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setMessage('✅ Password updated! Redirecting...');
      setTimeout(() => router.push('/'), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Set New Password</h1>
        {!ready ? (
          <p className="text-red-400 text-sm mt-4">{message || 'Checking reset link...'}</p>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6">Enter your new password below.</p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm mb-3"
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm mb-4"
            />
            {message && (
              <p className={`text-sm mb-4 ${message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {message}
              </p>
            )}
            <button
              onClick={handleUpdate}
              disabled={loading || !password || !confirm}
              className="w-full py-3 bg-blue-700 hover:bg-blue-600 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}