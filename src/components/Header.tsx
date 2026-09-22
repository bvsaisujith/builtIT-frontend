'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, profileCompleted } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navLinks = user
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/problem-statements', label: 'Problems' },
        { href: '/teams', label: 'Teams' },
        { href: '/submit/aim', label: 'Submit Aim' },
        { href: '/submit/final', label: 'Submit Final' },
        { href: '/winners', label: 'Winners' },
        { href: '/about', label: 'About' },
        // Only shown once onboarding is done — /profile redirects to
        // /complete-profile otherwise, so the link would have nowhere new to go.
        ...(profileCompleted ? [{ href: '/profile', label: 'Profile' }] : []),
        ...(profile?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
      ]
    : [
        { href: '/#about', label: 'The Event' },
        { href: '/#categories', label: 'Categories' },
        { href: '/#how-it-works', label: 'How It Works' },
        { href: '/winners', label: 'Winners' },
        { href: '/about', label: 'About' },
      ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="built IT 2K26 home">
          <span className="brand-bracket">&lt;</span>
          <img src="/buildit_logo.jpeg" alt="built IT 2K26" className="brand-logo" />
          <span className="brand-bracket">&gt;</span>
        </Link>

        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'nav-link active' : 'nav-link'}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              {!profileCompleted && pathname !== '/complete-profile' && (
                <Link href="/complete-profile" className="btn-secondary btn-sm">Complete profile</Link>
              )}
              <Link
                href="/profile"
                className="user-identity"
                title="Your profile"
                aria-label="Your profile"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    style={{ width: 30, height: 30, borderRadius: '50%' }}
                  />
                ) : null}
                <span className="user-name">
                  {profile?.github_username ? `@${profile.github_username}` : profile?.full_name ?? user.email}
                </span>
              </Link>
              <button className="btn-text" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-primary btn-sm">Join with GitHub <span>↗</span></Link>
            </>
          )}
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  );
}
