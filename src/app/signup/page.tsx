'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    roll_number: '',
    phone: '',
    github_username: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.full_name.trim()) e.full_name = 'Required';
    if (!formData.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Invalid email';
    if (!formData.roll_number.trim()) e.roll_number = 'Required';
    if (!formData.phone.trim()) e.phone = 'Required';
    if (formData.password.length < 6) e.password = 'Min 6 characters';
    if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.full_name,
          roll_number: formData.roll_number,
          phone: formData.phone,
          github_username: formData.github_username || undefined,
        },
      },
    });
    setLoading(false);

    if (error) {
      setServerError(error.message);
      return;
    }
    router.push('/login');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">&lt; BUILT IT 2K26 &gt;</span>
        <h1>Create account</h1>
        <p className="auth-subtitle">Sign up to join the hackathon.</p>

        {serverError && <div className="auth-error-banner">{serverError}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              type="text"
              value={formData.full_name}
              onChange={e => handleChange('full_name', e.target.value)}
              placeholder="Jane Doe"
            />
            {errors.full_name && <span className="form-error">{errors.full_name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="you@example.com"
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Roll number</label>
              <input
                className="form-input"
                type="text"
                value={formData.roll_number}
                onChange={e => handleChange('roll_number', e.target.value)}
                placeholder="AITS-2026-001"
              />
              {errors.roll_number && <span className="form-error">{errors.roll_number}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                type="tel"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                placeholder="+91 98765 43210"
              />
              {errors.phone && <span className="form-error">{errors.phone}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">GitHub username <span className="text-muted">(optional)</span></label>
            <input
              className="form-input"
              type="text"
              value={formData.github_username}
              onChange={e => handleChange('github_username', e.target.value)}
              placeholder="janedoe"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={formData.password}
                onChange={e => handleChange('password', e.target.value)}
                placeholder="••••••"
              />
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input
                className="form-input"
                type="password"
                value={formData.confirmPassword}
                onChange={e => handleChange('confirmPassword', e.target.value)}
                placeholder="••••••"
              />
              {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
