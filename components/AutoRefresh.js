'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Polls the server so new messages appear without a manual reload.
export default function AutoRefresh({ intervalMs = 5000 }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
