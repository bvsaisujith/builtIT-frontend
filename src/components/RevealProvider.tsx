'use client';

import { useEffect } from 'react';

/**
 * Scroll-reveal engine.
 * - Watches every [data-reveal] element and adds .revealed when it enters the viewport.
 * - [data-reveal-stagger] containers get their direct children indexed via the
 *   --i custom property, producing a fluid cascade (see globals.css).
 * - Re-scans on DOM mutations so client-side navigations are covered.
 * - Falls back to instantly-revealed when the user prefers reduced motion.
 */
export default function RevealProvider() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );

    const indexStaggerChildren = (el: Element) => {
      Array.from(el.children).forEach((child, i) => {
        (child as HTMLElement).style.setProperty('--i', String(i));
      });
    };

    const scan = () => {
      const pending = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.revealed)');
      pending.forEach((el) => {
        if (el.hasAttribute('data-reveal-stagger')) indexStaggerChildren(el);
        if (reduced) {
          el.classList.add('revealed');
        } else {
          observer.observe(el);
        }
      });
    };

    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
