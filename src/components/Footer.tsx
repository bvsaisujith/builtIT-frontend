'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="/buildit_logo.jpeg" alt="built IT 2K26" className="footer-logo" />
          <span>Future of IT</span>
        </div>
        <div className="footer-meta">
          <Link href="/about#about">CSIT Department · Explorer&apos;s Club</Link>
          <Link href="/about#rules">Rules &amp; Regulations</Link>
          <Link href="/about#developers">Developers</Link>
          <span>© 2026 built IT</span>
        </div>
      </div>
    </footer>
  );
}
