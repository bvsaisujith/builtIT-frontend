'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getProfile, getSessionUser } from '@/lib/data';
import type { Profile } from '@/lib/types';

// Roll number grammar fixed by the event organizers:
//   prefix: exactly one of 24AK1A25 | 25AK5A25 | 25AK1A25 | 26AK5A25
//   suffix: exactly two chars — 01..99 or A0..E9
// Examples: 24AK1A2501, 24AK1A2599, 24AK1A25A0, 24AK1A25E4
// Rejects: ...2500, ...25F0, ...25Z9, ...25AA, ...25A10, 7-char variants.
// NOTE: not exported — Next.js pages may only export a default component.
// The same grammar is enforced at the database level by the
// profiles_roll_number_format CHECK constraint (migration 007).
const ROLL_NUMBER_PATTERN =
  /^(?:24AK1A25|25AK5A25|25AK1A25|26AK5A25)(?:[0-9]{2}|[A-E][0-9])$/;

function normaliseRollNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [ready, setReady] = useState(false);
  const [prefillFailed, setPrefillFailed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    roll_number: '',
    phone: '',
    year: '',
    section: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill: fetch the row directly AND watch the context snapshot.
  // The old code read only the context snapshot on first paint — AuthContext may
  // still be loading then — so saved values were overwritten with ''.
  // Never overwrite saved values with empty strings: only fill a field when the
  // row actually has a value.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = (await getProfile()) as Profile | null;
      if (cancelled) return;
      if (!row) {
        // Row missing (trigger racing OAuth insert) — still let the form render.
        setPrefillFailed(true);
        setReady(true);
        return;
      }
      if (row.profile_completed_at) {
        router.replace('/dashboard', { scroll: false });
        return;
      }
      if (row.avatar_url) setAvatarUrl(row.avatar_url);
      setAuthName((row.full_name ?? '').trim());
      setForm(prev => ({
        full_name: row.full_name?.trim() || prev.full_name,
        email: row.email?.trim() || prev.email,
        roll_number: row.roll_number?.trim() || prev.roll_number,
        phone: row.phone?.trim() || prev.phone,
        year: row.year?.trim() || prev.year,
        section: row.section?.trim() || prev.section,
      }));
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  // If the context profile arrives after the direct fetch (slow trigger race),
  // merge any non-empty saved values in — again, never blanking user input.
  useEffect(() => {
    if (!ready || !profile) return;
    const p = profile as Profile;
    if (p.profile_completed_at) {
      router.replace('/dashboard', { scroll: false });
      return;
    }
    setForm(prev => ({
      full_name: p.full_name?.trim() || prev.full_name,
      email: p.email?.trim() || prev.email,
      roll_number: p.roll_number?.trim() || prev.roll_number,
      phone: p.phone?.trim() || prev.phone,
      year: p.year?.trim() || prev.year,
      section: p.section?.trim() || prev.section,
    }));
    if (p.avatar_url) setAvatarUrl(prev => prev ?? p.avatar_url);
  }, [ready, profile, router]);

  // GitHub identity (username/profile/avatar) is display-only here: it comes
  // automatically from the OAuth login and is never typed by the participant.
  useEffect(() => {
    if (profile?.avatar_url && !avatarUrl) setAvatarUrl(profile.avatar_url);
  }, [profile, avatarUrl]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (roll: string): boolean => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'Required';
    if (!roll) {
      e.roll_number = 'Required';
    } else if (!ROLL_NUMBER_PATTERN.test(roll)) {
      e.roll_number = 'Invalid roll number — e.g. 24AK1A2501';
    }
    if (!form.phone.trim()) e.phone = 'Required';
    else if (!/^[+]?[\d\s\-()]{6,20}$/.test(form.phone.trim())) e.phone = 'Invalid phone (6–20 digits)';
    if (!form.year.trim()) e.year = 'Required';
    if (!form.section.trim()) e.section = 'Required';
    else if (form.section.trim().length > 20) e.section = 'Too long (max 20)';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Invalid email address';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);

    const normalizedRoll = normaliseRollNumber(form.roll_number);
    if (!validate(normalizedRoll)) return;

    const user = await getSessionUser();
    if (!user) {
      setError('Session expired. Please log in again.');
      router.replace('/login', { scroll: false });
      return;
    }

    // Prefill check: is this roll number already taken by someone else?
    const { data: clash, error: clashError } = await supabase
      .from('profiles')
      .select('id')
      .eq('roll_number', normalizedRoll)
      .neq('id', user.id)
      .maybeSingle();

    if (clashError) {
      setError(clashError.message);
      return;
    }
    if (clash) {
      setErrors(prev => ({ ...prev, roll_number: 'This roll number is already registered.' }));
      setError('This roll number is already registered.');
      return;
    }

    setLoading(true);
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() ? form.email.trim().toLowerCase() : null,
      roll_number: normalizedRoll,
      phone: form.phone.trim(),
      year: form.year.trim(),
      section: form.section.trim(),
      profile_completed_at: new Date().toISOString(),
    };

    const { data: saved, error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      setLoading(false);
      // 23505 = DB-level UNIQUE violation (roll_number or email).
      if ((updateError as { code?: string }).code === '23505') {
        const msg = (updateError.message || '').toLowerCase().includes('roll')
          ? 'This roll number is already registered.'
          : 'This value is already registered by another participant.';
        setErrors(prev => ({ ...prev, roll_number: msg }));
        setError(msg);
      } else {
        setError(updateError.message);
      }
      return; // keep entered form data, do NOT redirect
    }

    // Verify the save actually landed before leaving.
    if (!saved?.profile_completed_at || !saved?.roll_number) {
      setLoading(false);
      setError('Save could not be verified. Please try again.');
      return;
    }

    await refreshProfile();
    setLoading(false);
    router.replace('/dashboard', { scroll: false });
  };

  if (!ready) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading...</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">&lt; BUILT IT 2K26 &gt;</span>
        <h1>Complete your profile</h1>
        <p className="auth-subtitle">A few more details before you can join a team.</p>

        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {avatarUrl && (
              <img src={avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 48, height: 48, borderRadius: '50%' }} />
            )}
            <div>
              <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>{authName || 'Participant'}</p>
              {profile?.github_username && (
                <a
                  href={profile.github_url ?? `https://github.com/${profile.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent-secondary)', fontSize: '13px' }}
                >
                  @{profile.github_username}
                </a>
              )}
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '10px' }}>
            GitHub identity is imported automatically from your connected account.
          </p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              type="text"
              value={form.full_name}
              onChange={e => handleChange('full_name', e.target.value)}
              placeholder="Your name as it should appear"
              required
            />
            {errors.full_name && <span className="field-error">{errors.full_name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Roll number</label>
            <input
              className="form-input"
              type="text"
              value={form.roll_number}
              onChange={e => handleChange('roll_number', normaliseRollNumber(e.target.value))}
              placeholder="e.g. 24AK1A2501"
              required
            />
            {errors.roll_number && <span className="field-error">{errors.roll_number}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Phone number</label>
            <input
              className="form-input"
              type="tel"
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="+91 98765 43210"
              required
            />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Year</label>
            <select
              className="form-input"
              value={form.year}
              onChange={e => handleChange('year', e.target.value)}
              required
            >
              <option value="" disabled>Select your year</option>
              <option value="II Year">II Year</option>
              <option value="III Year">III Year</option>
            </select>
            {errors.year && <span className="field-error">{errors.year}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Section</label>
            <select
              className="form-input"
              value={form.section}
              onChange={e => handleChange('section', e.target.value)}
              required
            >
              <option value="" disabled>Select your section</option>
              <option value="CSIT 1">CSIT 1</option>
              <option value="CSIT 2">CSIT 2</option>
            </select>
            {errors.section && <span className="field-error">{errors.section}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Email <span className="text-muted">(optional)</span></label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="you@example.com"
            />
            <span className="form-hint">Used only for event announcements. Your GitHub account stays the sign-in method.</span>
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Saving...' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

