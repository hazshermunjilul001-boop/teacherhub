'use client';

import { useEffect } from 'react';

export function RegisterSW() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silently ignore — PWA install just won't be offered, app still works normally
      });
    }
  }, []);

  return null;
}