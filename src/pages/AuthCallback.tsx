/**
 * OAuth landing route.
 *
 * Google redirects here after sign-in; supabase-js exchanges the code in the URL
 * for a session. Previously the redirect went to `/`, a protected route, so the
 * app raced the exchange against its own auth check. This route waits for the
 * exchange to settle and only then decides where to send the user.
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthLayout, AuthButton } from '../components/AuthLayout';
import { BRAND } from '../config/brand';

function errorFromUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const description = hash.get('error_description') ?? query.get('error_description');
  if (description) return description.replace(/\+/g, ' ');
  return hash.get('error') ?? query.get('error');
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const urlError = errorFromUrl();
    if (urlError) {
      setFailed(urlError);
      return;
    }

    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) navigate('/', { replace: true });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        navigate('/', { replace: true });
      } else {
        setTimeout(() => {
          if (!cancelled) setFailed('We couldn’t complete sign-in. Please try again.');
        }, 4000);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
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
        <Link to="/login">
          <AuthButton type="button">Try again</AuthButton>
        </Link>
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
