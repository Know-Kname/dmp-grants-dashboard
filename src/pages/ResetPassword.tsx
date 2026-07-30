/**
 * Set a new password from a recovery link.
 *
 * ## The guard is the security boundary of this page
 *
 * `updateUser({ password })` changes the password of whoever the **current**
 * session belongs to, and Supabase demands no current-password challenge. So
 * whatever decides to render this form decides who can be taken over.
 *
 * The previous guard was `if (event === 'PASSWORD_RECOVERY' || session)`, which
 * accepted *any* session, including an ordinary staff login already sitting in
 * `localStorage`. On a shared workstation, typing `/reset-password` into the
 * address bar produced a working form pointed at the signed-in colleague's
 * account. It also mis-fired the other way: opening someone else's recovery link
 * in a browser holding your own session left your session intact (auth-js does
 * not clear it on a failed URL login) and rewrote *your* password under a
 * "Password updated" banner.
 *
 * This page therefore ignores sessions entirely as a readiness signal. It asks
 * one question: **did a recovery happen during this page load?** That means the
 * URL arrived carrying recovery credentials (snapshotted in `../lib/recovery`
 * before auth-js scrubs them) *and* those credentials actually produced a
 * `PASSWORD_RECOVERY` event. No evidence, no form.
 *
 * ## Cross-device links
 *
 * With `flowType: 'pkce'`, auth-js only attempts a `?code=` exchange when the
 * matching code verifier is in *this* browser's storage
 * (`_isPKCECallback` requires `params.code && <verifier>`). Request the reset on
 * the office desktop, open the email on a phone, and there is no verifier — so
 * no exchange is even attempted and the link, which is perfectly valid, reads as
 * "expired". Staff burn resets forever with no path to success.
 *
 * The fix is the token-hash path: a `?token_hash=…&type=recovery` link is
 * verified here with `verifyOtp`, which needs no local verifier and therefore
 * works on any device. That requires the Supabase email template to emit
 * `{{ .TokenHash }}` — see `docs/06-supabase.md`. Until that template is
 * changed, links still arrive as `?code=`, so the PKCE path is kept and, when
 * the verifier is missing, says plainly which browser to use instead of blaming
 * the link.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getErrorMessage } from '../lib/errors';
import { resetPasswordFormSchema } from '../lib/schemas';
import { useForm, getFieldError } from '../hooks/useForm';
import { AuthLayout, AuthField, AuthButton } from '../components/AuthLayout';
import { m, AnimatePresence, fadeUp } from '../lib/motion';
import { BRAND } from '../config/brand';
import {
  initialRecoveryLink,
  hasPasswordRecoveryFired,
  onPasswordRecovery,
  endRecoverySession,
} from '../lib/recovery';
import type { z } from 'zod';

type Status = 'checking' | 'ready' | 'invalid' | 'done';

type ResetPasswordFormValues = z.input<typeof resetPasswordFormSchema>;

/** What to tell the user when the page refuses to render the form. */
interface InvalidReason {
  title: string;
  subtitle: string;
  detail: string;
}

const REASONS = {
  /** The URL carried no recovery credentials at all — e.g. typed by hand. */
  noLink: {
    title: 'Open the link from your email.',
    subtitle: 'This page can only be reached from a password reset email.',
    detail:
      'For your security, a new password can only be set by following the link we email you — being signed in is not enough. Request a link below and open it from your inbox.',
  },
  /** PKCE code present, but this browser never requested the reset. */
  wrongBrowser: {
    title: 'Open this link in the browser you requested it from.',
    subtitle: 'The link is fine — this browser just can’t complete it.',
    detail:
      'For security, this reset link has to be finished in the same browser that requested it. Open the email on the computer where you clicked “Reset your password”, or request a fresh link from this device.',
  },
  /** The server rejected the credentials: expired, already used, tampered. */
  rejected: {
    title: 'This link has expired.',
    subtitle: 'Reset links are valid for one hour and can only be used once.',
    detail: 'We couldn’t verify this reset link.',
  },
} satisfies Record<string, InvalidReason>;

/**
 * How long to wait for a `PASSWORD_RECOVERY` event that should already be on its
 * way. Only reached on the PKCE/implicit paths, where auth-js owns the exchange
 * and we can only observe the outcome. The token-hash path awaits `verifyOtp`
 * directly and never uses this.
 */
const RECOVERY_EVENT_TIMEOUT_MS = 5000;

/**
 * In-flight (or completed) `verifyOtp` call for this page load.
 *
 * A `token_hash` is single-use, so the call must happen exactly once. React
 * StrictMode mounts effects twice in development, which without this would burn
 * the token on the first run and report "expired" on the second — making the
 * flow impossible to exercise locally. Module scope rather than a ref because it
 * must survive the unmount/remount StrictMode performs.
 */
let verification: Promise<{ error: unknown }> | null = null;

function verifyRecoveryToken(tokenHash: string): Promise<{ error: unknown }> {
  verification ??= supabase.auth
    .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    .then(({ error }) => ({ error: error as unknown }));
  return verification;
}

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('checking');
  const [reason, setReason] = useState<InvalidReason>(REASONS.rejected);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fail = (next: InvalidReason) => {
      if (cancelled) return;
      setReason(next);
      setStatus('invalid');
    };
    const succeed = () => {
      if (!cancelled) setStatus('ready');
    };

    /** Resolve once auth-js reports a recovery, or give up. */
    const awaitRecoveryEvent = () => {
      if (hasPasswordRecoveryFired()) {
        succeed();
        return undefined;
      }

      const unsubscribe = onPasswordRecovery(succeed);
      const timer = window.setTimeout(() => {
        // The exchange either failed or never ran. Critically, we do NOT fall
        // back to "is there a session?" — on a failed exchange auth-js keeps any
        // pre-existing session, and treating that as success is the takeover.
        fail(REASONS.rejected);
      }, RECOVERY_EVENT_TIMEOUT_MS);

      return () => {
        unsubscribe();
        window.clearTimeout(timer);
      };
    };

    let cleanup: (() => void) | undefined;

    switch (initialRecoveryLink.kind) {
      case 'error':
        fail({
          ...REASONS.rejected,
          detail: initialRecoveryLink.errorDescription ?? REASONS.rejected.detail,
        });
        break;

      case 'token_hash': {
        // Device-independent: no code verifier involved, so this works from the
        // phone the email was opened on. A rejection here is a real rejection
        // from the server, not a missing-verifier false negative.
        const tokenHash = initialRecoveryLink.tokenHash;
        if (tokenHash === null) {
          fail(REASONS.noLink);
          break;
        }
        void verifyRecoveryToken(tokenHash).then(({ error: verifyError }) => {
          if (verifyError) {
            fail({ ...REASONS.rejected, detail: getErrorMessage(verifyError) });
          } else {
            succeed();
          }
        });
        break;
      }

      case 'pkce':
        if (!initialRecoveryLink.hadCodeVerifier) {
          // auth-js will not even attempt the exchange without the verifier, so
          // no event is coming. Say which browser to use rather than "expired".
          fail(REASONS.wrongBrowser);
        } else {
          cleanup = awaitRecoveryEvent();
        }
        break;

      case 'implicit':
        cleanup = awaitRecoveryEvent();
        break;

      case 'none':
      default:
        // No recovery credentials in the URL. An existing session is explicitly
        // NOT accepted here — that was the account-takeover path.
        fail(REASONS.noLink);
        break;
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const form = useForm<ResetPasswordFormValues, z.output<typeof resetPasswordFormSchema>>({
    schema: resetPasswordFormSchema,
    initialValues: { password: '', confirmPassword: '' },
    onSubmit: async (data) => {
      setError(null);
      try {
        await updatePassword(data.password);
        endRecoverySession();
        setStatus('done');
        setTimeout(() => navigate('/', { replace: true }), 1800);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    },
  });

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
        title={reason.title}
        subtitle={reason.subtitle}
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
            {reason.detail}
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
      <form onSubmit={form.handleSubmit}>
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
            {...form.getFieldProps('password')}
            error={getFieldError('password', form.errors, form.touched)}
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
            {...form.getFieldProps('confirmPassword')}
            error={getFieldError('confirmPassword', form.errors, form.touched)}
            required
            autoComplete="new-password"
          />
        </m.div>

        <m.div variants={fadeUp}>
          <AuthButton type="submit" loading={form.isSubmitting}>
            {form.isSubmitting ? 'Saving' : 'Set new password'}
          </AuthButton>
        </m.div>
      </form>
    </AuthLayout>
  );
}
