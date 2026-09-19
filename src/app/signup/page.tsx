'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Email/password signup is disabled: GitHub is the only supported sign-in
// method. Keep the route internally so old links do not 404 - they land on
// the GitHub-first login page instead.
export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);
  return null;
}

