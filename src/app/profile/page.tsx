'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getProfile, getSessionUser } from '@/lib/data';
import type { Profile } from '@/lib/types';

// Same roll number grammar used on /complete-profile and enforced at the
// database level by the profiles_roll_number_format CHECK constraint (007).
//   prefix: exactly one of 24AK1A25 | 25AK5A25 | 25AK1A25 | 26AK5A25
//   suffix: 01..99 or A0..E9
const ROLL_NUMBER_PATTERN =
  /^(?:24AK1A25|25AK5A25|25AK1A25|26AK5A25)(?:[0-9]{2}|[A-E][0-9])$/;

function normaliseRollNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function ProfileContent() {
  const router = useRouter();
  const { profile, loading, refreshProfile } = useAuth();
  const prefilled = useRef(false);
  const [ready, setReady] = useState(false);
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
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Prefill once from the auth context snapshot (falling back to a direct fetch
  // when the context row has not arrived yet — the same race the
  // /complete-profile page guards against). Participants only reach this page
  // after onboarding, so a not-yet-completed profile is sent to
  // /complete-profile, and edits in progress are never overwritten because the
  // form is seeded only once.
  useEffect(() => {
    if (prefilled.current || loading) return;
    let cancelled = false;
    (async () => {
      const row = (profile as Profile | null) ?? ((await getProfile()) as Profile | null);
      if (cancelled) return;
      if (!row?.profile_completed_at) {
        router.replace('/complete-profile', { scroll: false });
        return;
      }
      prefilled.current = true;
      setForm({
        full_name: row.full_name ?? '',
        email: row.email ?? '',
        roll_number: row.roll_number ?? '',
        phone: row.phone ?? '',
        year: row.year ?? '',
        section: row.section ?? '',
      });
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [profile, loading, router]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
    setSuccess(false);
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
    setSuccess(false);

    const normalizedRoll = normaliseRollNumber(form.roll_number);
    if (!validate(normalizedRoll)) return;

    const user = await getSessionUser();
    if (!user) {
      setError('Session expired. Please log in again.');
      router.replace('/login', { scroll: false });
      return;
    }

    // Guard: is this roll number already taken by someone else?
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

    // Guard: is this email already taken by someone else? (optional field)
    const email = form.email.trim().toLowerCase();
    if (email) {
      const { data: emailClash, error: emailClashError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .neq('id', user.id)
        .maybeSingle();

      if (emailClashError) {
        setError(emailClashError.message);
        return;
      }
      if (emailClash) {
        setErrors(prev => ({ ...prev, email: 'This email is already registered.' }));
        setError('This email is already registered.');
        return;
      }
    }

    setSaving(true);
    // profile_completed_at / role are deliberately NOT sent: the completion
    // timestamp and the admin role can never be changed from the client.
    const payload = {
      full_name: form.full_name.trim(),
      email: email || null,
      roll_number: normalizedRoll,
      phone: form.phone.trim(),
      year: form.year.trim(),
      section: form.section.trim(),
    };

    const { data: saved, error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single();

    setSaving(false);

    if (updateError) {
      // 23505 = DB-level UNIQUE violation (roll_number or email).
      if ((updateError as { code?: string }).code === '23505') {
        const field = (updateError.message || '').toLowerCase().includes('email')
          ? 'email'
          : 'roll_number';
        const msg = field === 'email'
          ? 'This email is already registered by another participant.'
          : 'This roll number is already registered.';
        setErrors(prev => ({ ...prev, [field]: msg }));
        setError(msg);
      } else {
        setError(updateError.message);
      }
      return; // keep the entered values so nothing is lost
    }

    if (!saved) {
      setError('Save could not be verified. Please try again.');
      return;
    }

    await refreshProfile();
    setSuccess(true);
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
    <div className="dashboard-page">
      <Link href="/dashboard" className="btn-text" style={{ marginBottom: '16px' }}>← Dashboard</Link>
      <h1>Your profile</h1>
      <p className="subtitle">
        Update your contact and academic details. Your GitHub identity stays connected automatically.
      </p>

      <div className="dash-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: 56, height: 56, borderRadius: '50%' }}
            />
          ) : (
            <span className="dash-hero-avatar dash-hero-avatar-fallback" style={{ width: 56, height: 56 }}>
              &lt; / &gt;
            </span>
          )}
          <div>
            <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>
              {profile?.full_name ?? 'Participant'}
            </p>
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
          GitHub identity is imported automatically from your connected account and cannot be edited here.
        </p>
      </div>

      {error && <div className="auth-error-banner">{error}</div>}
      {success && !error && (
        <div className="submit-success">
          <h4>Profile updated</h4>
          <p>Your details have been saved.</p>
        </div>
      )}

      <div className="dash-card">
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
            {errors.full_name && <span className="form-error">{errors.full_name}</span>}
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
            {errors.roll_number && <span className="form-error">{errors.roll_number}</span>}
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
            {errors.phone && <span className="form-error">{errors.phone}</span>}
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
            {errors.year && <span className="form-error">{errors.year}</span>}
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
            {errors.section && <span className="form-error">{errors.section}</span>}
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
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <button type="submit" className="btn-primary" disabled={saving} style={{ justifyContent: 'center' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
