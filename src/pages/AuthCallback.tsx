/**
 * OAuth landing route.
 *
 * Google redirects here after sign-in; supabase-js exchanges the code in the URL
 * for a session. Previously the redirect went to `/`, a protected route, so the
 * app raced the exchange against its own auth check. This route waits for the
 * exchange to settle and only then decides where to send the user.
 *
 * ## "Any session" is not proof the exchange worked
 *
 * auth-js deliberately keeps a pre-existing session when a URL login fails
 * ("Don't remove existing session on URL login failure", `_initialize`). So if
 * user A is signed in on a shared machine and user B clicks "Continue with
 * Google", a failed exchange leaves A's session in place — and a check of the
 * form `if (session) navigate('/')` reads that as success and drops B straight
 * into A's account, under A's name, with no sign anything went wrong.
 *
 * The identity present *before* the exchange is therefore captured up front, and
 * an unchanged identity is treated as a failure rather than a success. Nobody
 * clicks "sign in" expecting to stay signed in as someone else.
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { preExistingUserId } from '../lib/authStorage';
import { AuthLayout, AuthButton } from '../components/AuthLayout';
import { BRAND } from '../config/brand';

function errorFromUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const description = hash.get('error_description') ?? query.get('error_description');
  if (description) return description.replace(/\+/g, ' ');
  return hash.get('error') ?? query.get('error');
}

/** How long to wait for the exchange before calling it a failure. */
const EXCHANGE_TIMEOUT_MS = 4000;

const STALE_SESSION_MESSAGE =
  'Sign-in didn’t complete, and this browser is still signed in as someone else. ' +
  'Sign out first, then try again.';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const urlError = errorFromUrl();
    if (urlError) {
      setFailed(urlError);
      return;
    }

    let cancelled = false;
    let settled = false;

    /**
     * Accept the session only if it represents a *different* user than the one
     * already signed in — or if nobody was signed in at all.
     */
    const settle = (userId: string | null) => {
      if (cancelled || settled) return;

      if (userId === null) return; // No session yet; keep waiting.

      // Same user as before the exchange means nothing was exchanged — the
      // session on screen is the one that was already here.
      if (preExistingUserId !== null && preExistingUserId === userId) {
        settled = true;
        setFailed(STALE_SESSION_MESSAGE);
        return;
      }

      settled = true;
      navigate('/', { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      settle(session?.user.id ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      settle(session?.user.id ?? null);
    });

    const timer = window.setTimeout(() => {
      if (cancelled || settled) return;
      settled = true;
      setFailed(
        preExistingUserId !== null
          ? STALE_SESSION_MESSAGE
          : 'We couldn’t complete sign-in. Please try again.',
      );
    }, EXCHANGE_TIMEOUT_MS);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [navigate]);

  if (failed) {
    return (
      <AuthLayout
        eyebrow="Sign In"
        title="Sign-in didn’t complete."
        footer={
          <Link
            to="/login"
            className="block text-center text-[11px] uppercase"
            style={{ color: 'rgba(26,26,26,0.55)', letterSpacing: '0.18em', fontWeight: 500 }}
          >
            Back to sign in
          </Link>
        }
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
            {failed}
          </p>
        </div>
        {failed === STALE_SESSION_MESSAGE ? (
          <AuthButton
            type="button"
            onClick={() => {
              void logout().then(() => navigate('/login', { replace: true }));
            }}
          >
            Sign out and try again
          </AuthButton>
        ) : (
          <Link to="/login">
            <AuthButton type="button">Try again</AuthButton>
          </Link>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Sign In" title="Completing sign-in…">
      <div className="flex justify-center py-6">
        <div
          className="w-1 h-10 origin-bottom"
          style={{ backgroundColor: BRAND.green, animation: 'pulse 1.4s ease-in-out infinite' }}
        />
      </div>
    </AuthLayout>
  );
}
