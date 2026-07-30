/**
 * Set a new password from a recovery link.
 *
 * The form renders only once a recovery session exists. Supabase delivers that
 * session by exchanging a code in the URL, so a user landing on the bare route —
 * or arriving with an expired link — must see an explanation rather than a form
 * whose submit would 401.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getErrorMessage } from '../lib/errors';
import { resetPasswordFormSchema } from '../lib/schemas';
import { AuthLayout, AuthField, AuthButton } from '../components/AuthLayout';
import { m, AnimatePresence, fadeUp } from '../lib/motion';
import { BRAND } from '../config/brand';

type Status = 'checking' | 'ready' | 'invalid' | 'done';

/**
 * Supabase reports expired/consumed links via error params on the hash or query.
 *
 * Best-effort by design: with `detectSessionInUrl` enabled the client often
 * consumes and clears the hash before this runs, in which case the session check
 * below falls through to the same "expired" state with generic copy. This only
 * upgrades the message when the params survive (query-string variant, or a
 * reload), so the guard must never depend on it firing.
 */
function linkErrorFromUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const description = hash.get('error_description') ?? query.get('error_description');
  const code = hash.get('error') ?? query.get('error');
  if (!description && !code) return null;
  return description ? description.replace(/\+/g, ' ') : 'This link is no longer valid.';
}

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('checking');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const urlError = linkErrorFromUrl();
    if (urlError) {
      setLinkError(urlError);
      setStatus('invalid');
      return;
    }

    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || session) setStatus('ready');
    });

    // The listener catches the code exchange; this catches the case where it
    // already completed before we subscribed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        setStatus('ready');
      } else {
        // Give detectSessionInUrl a moment to finish before declaring failure.
        setTimeout(() => {
          if (!cancelled) setStatus((s) => (s === 'checking' ? 'invalid' : s));
        }, 2500);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = resetPasswordFormSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Please check the form.');
      return;
    }

    setSaving(true);
    try {
      await updatePassword(parsed.data.password);
      setStatus('done');
      setTimeout(() => navigate('/'), 1800);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const backLink = (
    <Link
      to="/login"
      className="flex items-center justify-center gap-2 text-[11px] uppercase transition-colors"
      style={{ color: 'rgba(26,26,26,0.55)', letterSpacing: '0.18em', fontWeight: 500 }}
    >
      <ArrowLeft size={13} />
      Back to sign in
    </Link>
  );

  if (status === 'checking') {
    return (
      <AuthLayout eyebrow="Account Recovery" title="Verifying your link…" footer={backLink}>
        <div className="flex justify-center py-6">
          <div
            className="w-1 h-10 origin-bottom"
            style={{ backgroundColor: BRAND.green, animation: 'pulse 1.4s ease-in-out infinite' }}
          />
        </div>
      </AuthLayout>
    );
  }

  if (status === 'invalid') {
    return (
      <AuthLayout
        eyebrow="Account Recovery"
        title="This link has expired."
        subtitle="Reset links are valid for one hour and can only be used once."
        footer={backLink}
      >
        <div
          className="flex items-start gap-3 rounded px-4 py-4 mb-6"
          style={{
            backgroundColor: 'rgba(185,28,28,0.06)',
            border: '1px solid rgba(185,28,28,0.18)',
          }}
        >
          <AlertCircle size={17} className="flex-shrink-0 mt-0.5" style={{ color: 'rgb(153,27,27)' }} />
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(26,26,26,0.7)' }}>
            {linkError ?? 'We couldn’t verify this reset link.'}
          </p>
        </div>
        <Link to="/forgot-password">
          <AuthButton type="button">Request a new link</AuthButton>
        </Link>
      </AuthLayout>
    );
  }

  if (status === 'done') {
    return (
      <AuthLayout
        eyebrow="Account Recovery"
        title="Password updated."
        subtitle="Signing you in…"
        footer={backLink}
      >
        <div
          className="flex items-start gap-3 rounded px-4 py-4"
          style={{
            backgroundColor: 'rgba(26,61,43,0.05)',
            border: '1px solid rgba(26,61,43,0.18)',
          }}
        >
          <CheckCircle2 size={17} className="flex-shrink-0 mt-0.5" style={{ color: BRAND.green }} />
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(26,26,26,0.7)' }}>
            Your password has been changed. Taking you to the dashboard.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Account Recovery"
      title="Choose a new password."
      subtitle="At least 12 characters. Use something you don’t use anywhere else."
      footer={backLink}
    >
      <form onSubmit={handleSubmit}>
        <AnimatePresence>
          {error && (
            <m.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded px-3.5 py-3 text-sm"
              style={{
                backgroundColor: 'rgba(185,28,28,0.07)',
                border: '1px solid rgba(185,28,28,0.18)',
                color: 'rgb(153,27,27)',
              }}
            >
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </m.div>
          )}
        </AnimatePresence>

        <m.div variants={fadeUp} className="relative">
          <AuthField
            id="new-password"
            label="New password"
            type={show ? 'text' : 'password'}
            icon={<Lock size={15} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-1 top-[38px] p-1 transition-colors"
            style={{ color: 'rgba(26,26,26,0.4)' }}
            tabIndex={-1}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </m.div>

        <m.div variants={fadeUp}>
          <AuthField
            id="confirm-password"
            label="Confirm password"
            type={show ? 'text' : 'password'}
            icon={<Lock size={15} />}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </m.div>

        <m.div variants={fadeUp}>
          <AuthButton type="submit" loading={saving}>
            {saving ? 'Saving' : 'Set new password'}
          </AuthButton>
        </m.div>
      </form>
    </AuthLayout>
  );
}
