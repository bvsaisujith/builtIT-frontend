'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useAuth();
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
        { href: '/submit/aim', label: 'Submit Aim' },
        { href: '/submit/final', label: 'Submit Final' },
      ]
    : [
        { href: '/#about', label: 'The Event' },
        { href: '/#categories', label: 'Categories' },
        { href: '/#how-it-works', label: 'How It Works' },
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
              <span className="user-name">{profile?.full_name ?? user.email}</span>
              <button className="btn-text" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-text">Log in</Link>
              <Link href="/signup" className="btn-primary btn-sm">Sign up <span>↗</span></Link>
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
