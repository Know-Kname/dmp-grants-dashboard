/**
 * Request a password-reset link.
 *
 * The success message is deliberately non-enumerating — it says the same thing
 * whether or not the address has an account, so this page can't be used to
 * discover who works here.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getErrorMessage } from '../lib/errors';
import { AuthLayout, AuthField, AuthButton } from '../components/AuthLayout';
import { m, AnimatePresence, fadeUp } from '../lib/motion';
import { BRAND } from '../config/brand';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      // Rate limiting is the one failure worth surfacing; everything else is
      // folded into the neutral success state so the form can't enumerate users.
      const message = getErrorMessage(err);
      if (/rate|too many/i.test(message)) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Account Recovery"
      title={sent ? 'Check your email.' : 'Reset your password.'}
      subtitle={
        sent
          ? 'The link expires in one hour.'
          : 'Enter your work email and we’ll send a link to set a new password.'
      }
      footer={
        <Link
          to="/login"
          className="flex items-center justify-center gap-2 text-[11px] uppercase transition-colors"
          style={{ color: 'rgba(26,26,26,0.55)', letterSpacing: '0.18em', fontWeight: 500 }}
        >
          <ArrowLeft size={13} />
          Back to sign in
        </Link>
      }
    >
      <AnimatePresence mode="wait">
        {sent ? (
          <m.div
            key="sent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded px-4 py-4"
            style={{
              backgroundColor: 'rgba(26,61,43,0.05)',
              border: '1px solid rgba(26,61,43,0.18)',
            }}
          >
            <CheckCircle2 size={17} className="flex-shrink-0 mt-0.5" style={{ color: BRAND.green }} />
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(26,26,26,0.7)' }}>
              If an account exists for <span style={{ fontWeight: 600 }}>{email}</span>, a reset link
              is on its way. Check spam if it doesn’t arrive within a few minutes.
            </p>
          </m.div>
        ) : (
          <m.form key="form" onSubmit={handleSubmit} exit={{ opacity: 0 }}>
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

            <m.div variants={fadeUp}>
              <AuthField
                id="reset-email"
                label="Email"
                type="email"
                icon={<Mail size={15} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@detroitmemorialpark.com"
                required
                autoComplete="email"
                autoFocus
              />
            </m.div>

            <m.div variants={fadeUp}>
              <AuthButton type="submit" loading={loading}>
                {loading ? 'Sending' : 'Send reset link'}
              </AuthButton>
            </m.div>
          </m.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
