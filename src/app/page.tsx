'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CATEGORIES } from '@/lib/types';
import CategoryIcon from '@/components/CategoryIcon';

export default function LandingPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <>
      <section className="hero-section">
        <div className="circuit-lines"></div>
        <div className="hero-glow"></div>
        <div className="hero-copy" data-reveal data-reveal-stagger>
          <p className="eyebrow">CSIT Department · Explorer&apos;s Club</p>
          <div className="hero-logo-wrap">
            <img className="hero-logo" src="/buildit_logo.jpeg" alt="built IT 2K26" />
          </div>
          <p className="hero-kicker">AN INTERNAL HACKATHON</p>
          <h1>Future of <span>IT</span></h1>
          <p className="hero-tagline">Innovate today. <span>Impact tomorrow.</span></p>
          <div className="hero-actions">
            <Link href="/login" className="btn-primary">Start building <span>↗</span></Link>
            <Link href="/#about" className="btn-text">Explore the event <span>↓</span></Link>
          </div>
        </div>
        <div className="hero-stats" data-reveal data-reveal-stagger>
          <div><span className="stat-label">DATE</span><strong>21 SEPT</strong><span className="stat-blue">2026</span></div>
          <div><span className="stat-label">TEAM SIZE</span><strong>3</strong><span>MEMBERS</span></div>
          <div><span className="stat-label">BUILD</span><strong>REAL-WORLD</strong><span>SOLUTIONS</span></div>
          <div><span className="stat-label">THEME</span><strong>OPEN</strong><span>INNOVATION</span></div>
        </div>
        <div className="cityscape" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </div>
      </section>

      <section className="section-frame" id="about">
        <div className="section-index">01 <span>/</span> THE EVENT</div>
        <div className="intro-grid" data-reveal data-reveal-stagger>
          <h2>One theme.<br /><em>Countless</em><br />possibilities.</h2>
          <div className="intro-copy">
            <p>built IT 2K26 is a one-day arena for bold ideas and working prototypes. Bring your curiosity, find your people, and turn a real-world problem into something the world can use.</p>
            <p className="muted" style={{ marginTop: '12px' }}>No fixed tracks. No prescribed answers. Just one shared direction: the future of IT.</p>
            <Link href="/#how-it-works" className="arrow-link" style={{ marginTop: '24px' }}>See how it works <span>↗</span></Link>
          </div>
        </div>
      </section>

      <section className="section-frame" id="categories" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="section-heading" data-reveal>
          <div className="section-index">02 <span>/</span> CATEGORIES</div>
          <p>Choose your lens. Solve any real-world problem.</p>
        </div>
        <div className="category-grid" data-reveal data-reveal-stagger>
          {CATEGORIES.map((cat, index) => (
            <button
              key={cat.name}
              className={activeCategory === cat.name ? 'category-card active' : 'category-card'}
              onClick={() => setActiveCategory(cat.name)}
            >
              <span className="category-number">0{index + 1}</span>
              <CategoryIcon type={cat.icon} />
              <strong>{cat.name}</strong>
              <span className="category-short">{cat.short}</span>
            </button>
          ))}
        </div>
        <div className="category-note" data-reveal>
          <span className="blue-dot"></span>
          {activeCategory ? (
            <>Your team can build under <strong>{activeCategory}</strong> — or explore a different problem space.</>
          ) : (
            <>All categories are open. Find the problem worth building for.</>
          )}
        </div>
      </section>

      <section className="section-frame" id="how-it-works" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="section-index" data-reveal>03 <span>/</span> THE BUILD</div>
        <div className="process-heading" data-reveal>
          <h2>From first idea<br />to <span>final build.</span></h2>
          <p>Two submissions. One day to make your mark.</p>
        </div>
        <div className="process-grid" data-reveal data-reveal-stagger>
          <div className="process-card">
            <span className="process-number">01</span>
            <div><h3>Form your team</h3><p>Assemble three curious minds and choose the problem you want to take on.</p></div>
            <span className="process-arrow">↗</span>
          </div>
          <div className="process-card">
            <span className="process-number">02</span>
            <div><h3>Shape your aim</h3><p>Turn your insight into a clear direction and present it with a focused pitch.</p></div>
            <span className="process-arrow">↗</span>
          </div>
          <div className="process-card">
            <span className="process-number">03</span>
            <div><h3>Ship the future</h3><p>Build, deploy, and submit an application that makes the idea real.</p></div>
            <span className="process-arrow">↗</span>
          </div>
        </div>
      </section>

      <section className="section-frame final-cta" data-reveal data-reveal-stagger style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="cta-brackets">&lt; / &gt;</div>
        <p className="eyebrow">21 SEPTEMBER 2026</p>
        <h2>Ready to build<br /><span>what&apos;s next?</span></h2>
        <Link href="/login" className="btn-primary">Join built IT 2K26 <span>↗</span></Link>
      </section>
    </>
  );
}
