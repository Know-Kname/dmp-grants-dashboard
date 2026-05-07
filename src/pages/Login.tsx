import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Balancer from 'react-wrap-balancer';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { getErrorRequestId } from '../lib/errors';
import { enableDemoMode } from '../lib/demo-data';
import { Mail, Lock, Sun, Moon, Eye, EyeOff, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { COMPANY } from '../config/company';
import { BRAND } from '../config/brand';

const heroLocations = Object.values(COMPANY.locations).map(loc => ({
  name: loc.name,
  city: loc.city,
}));

// Mount Auburn-esque landscape — quiet path / dappled light, not a building
const PHOTO_URL = '/dmp-hero.jpg'; // replace with your cemetery's hero image

function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/invalid.*login.*credentials|invalid.*credentials|wrong.*password|incorrect.*password/i.test(raw))
    return 'Incorrect email or password. Please try again.';
  if (/email.*not.*confirm|not.*verified/i.test(raw))
    return 'Please verify your email address before signing in.';
  if (/user.*not.*found/i.test(raw))
    return 'No account found with this email address.';
  if (/too.*many.*requests|rate.*limit/i.test(raw))
    return 'Too many attempts. Please wait a moment and try again.';
  if (/network|fetch|connect|ECONNREFUSED|missing-supabase|invalid.*url/i.test(raw))
    return 'Unable to reach the authentication service. Please try again or contact your administrator.';
  if (/oauth.*error|provider.*error/i.test(raw))
    return 'Google sign-in failed. Please try again or use email and password.';
  if (raw && raw !== '[object Object]') return raw;
  return 'Unable to sign in. Please try again.';
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

const EASE_LUX: [number, number, number, number] = [0.16, 1, 0.3, 1];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 1, ease: EASE_LUX } },
};

/** Word-mask reveal — same primitive as Memorial hero */
function RevealWords({
  children,
  delay = 0,
  perWord = 0.07,
  className = '',
  style,
}: {
  children: string;
  delay?: number;
  perWord?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const words = children.split(' ');
  return (
    <span aria-label={children} className={className} style={style}>
      {words.map((w, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            display: 'inline-block',
            overflow: 'hidden',
            verticalAlign: 'baseline',
            marginRight: '0.22em',
            paddingBottom: '0.08em',
          }}
        >
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ y: '108%' }}
            animate={{ y: 0 }}
            transition={{ delay: delay + i * perWord, duration: 0.95, ease: EASE_LUX }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Subtle film grain — matches Memorial */
function FilmGrain({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ opacity, mixBlendMode: 'overlay' }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="login-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#login-grain)" />
      </svg>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, signInWithGoogle } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorDetails([]);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(friendlyAuthError(err));
      const requestId = getErrorRequestId(err);
      setErrorDetails(requestId ? [`Request ID: ${requestId}`] : []);
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    enableDemoMode();
    navigate('/');
  };

  const handleGoogle = async () => {
    setError(null);
    setErrorDetails([]);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Supabase redirects away — no navigate() needed
    } catch (err) {
      setError(friendlyAuthError(err));
      setShakeKey((k) => k + 1);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bone)' }}>
      {/* ───── LEFT — duotone landscape + brand ───── */}
      <div className="hidden lg:flex lg:w-[55%] flex-col relative overflow-hidden" style={{ backgroundColor: BRAND.greenDeep }}>
        {/* Photo with Ken Burns + duotone */}
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.06, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2.4, ease: EASE_LUX }}
          style={{
            backgroundImage: `url('${PHOTO_URL}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(1) contrast(1.06) brightness(0.88)',
          }}
        />
        {/* Forest multiply layer — duotone */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(170deg, rgba(15,36,25,0.78) 0%, rgba(26,61,43,0.65) 50%, rgba(15,36,25,0.92) 100%)`,
            mixBlendMode: 'multiply',
          }}
        />
        <FilmGrain opacity={0.07} />

        {/* Vertical gold rule, very thin */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-px"
          style={{ height: '120px', backgroundColor: BRAND.gold, opacity: 0.4 }}
        />

        {/* Content */}
        <motion.div
          className="relative flex flex-col h-full px-12 xl:px-16 py-14 justify-between"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          {/* Top: brand mark */}
          <motion.div variants={fadeUp}>
            <img
              src="/favicon.svg"
              alt="RIP"
              className="h-12 w-auto"
              style={{ filter: 'brightness(0) saturate(100%) invert(1)', opacity: 0.92 }}
            />
          </motion.div>

          {/* Middle: headline + tagline */}
          <div className="max-w-2xl">
            <motion.div
              variants={fadeUp}
              className="text-[10px] uppercase mb-8"
              style={{ color: BRAND.gold, letterSpacing: '0.32em', fontWeight: 500, opacity: 0.85 }}
            >
              A Century of Remembrance
            </motion.div>

            <h1
              className="text-white leading-[0.96] mb-10"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.6rem, 5.5vw, 5rem)',
                fontWeight: 400,
                fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0',
                letterSpacing: '-0.025em',
              }}
            >
              <span className="block">
                <RevealWords delay={0.15}>Honoring lives.</RevealWords>
              </span>
              <span className="block" style={{ fontStyle: 'italic', color: BRAND.gold, fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1' }}>
                <RevealWords delay={0.45}>Preserving</RevealWords>
              </span>
              <span className="block">
                <RevealWords delay={0.65}>legacies.</RevealWords>
              </span>
            </h1>

            <motion.div
              variants={fadeUp}
              className="mb-8"
              style={{ width: '48px', height: '1px', backgroundColor: BRAND.gold, opacity: 0.6 }}
            />

            <motion.p
              variants={fadeUp}
              className="text-base leading-relaxed max-w-md"
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                color: 'rgba(245,241,234,0.62)',
                fontSize: '1.05rem',
                lineHeight: 1.65,
              }}
            >
              <Balancer>
                A century of dignified service across three Michigan sanctuaries.
                This system keeps our operations as enduring as our mission.
              </Balancer>
            </motion.p>
          </div>

          {/* Bottom: locations + copyright */}
          <motion.div variants={fadeUp}>
            <div className="grid grid-cols-3 gap-6 mb-10 max-w-lg">
              {heroLocations.map((loc) => (
                <div key={loc.name}>
                  <p
                    className="text-[10px] uppercase mb-1"
                    style={{ color: BRAND.gold, letterSpacing: '0.22em', fontWeight: 600, opacity: 0.7 }}
                  >
                    {loc.name}
                  </p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-serif)' }}>
                    {loc.city}, MI
                  </p>
                </div>
              ))}
            </div>

            <div className="w-full h-px mb-5" style={{ backgroundColor: 'rgba(196,154,44,0.18)' }} />
            <p className="text-[10px] uppercase" style={{ color: 'rgba(245,241,234,0.32)', letterSpacing: '0.2em' }}>
              {COMPANY.legal.copyright} · State of Michigan Official Historic Site
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* ───── RIGHT — bone form panel ───── */}
      <div
        className="flex-1 flex flex-col relative overflow-y-auto"
        style={{ backgroundColor: 'var(--bone)' }}
      >
        <div className="absolute top-5 right-5 z-10">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-md transition-all"
            style={{ border: '1px solid rgba(26,61,43,0.18)', color: 'rgba(26,26,26,0.5)' }}
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Mobile brand bar */}
        <div className="lg:hidden flex items-center px-6 py-4" style={{ backgroundColor: BRAND.greenDeep }}>
          <img
            src="/favicon.svg"
            alt="RIP"
            className="h-9 w-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(1)', opacity: 0.9 }}
          />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-16 sm:px-12">
          <motion.div
            className="w-full max-w-[420px]"
            initial="hidden"
            animate="show"
            variants={stagger}
          >
            <motion.p
              variants={fadeUp}
              className="text-[10px] uppercase mb-5"
              style={{ color: BRAND.green, letterSpacing: '0.28em', fontWeight: 600 }}
            >
              Staff Sign In
            </motion.p>

            <motion.h2
              variants={fadeUp}
              className="leading-tight mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 3.4vw, 2.75rem)',
                fontWeight: 400,
                fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 0',
                letterSpacing: '-0.02em',
                color: 'var(--ink)',
              }}
            >
              <Balancer>Welcome back.</Balancer>
            </motion.h2>

            <motion.p
              variants={fadeUp}
              className="text-sm mb-10"
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                color: 'rgba(26,26,26,0.5)',
              }}
            >
              Sign in to access the {COMPANY.system.name}.
            </motion.p>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key={shakeKey}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, x: [0, -8, 8, -8, 8, -4, 4, 0] }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mb-6 flex items-start gap-2.5 rounded px-3.5 py-3 text-sm"
                  style={{ backgroundColor: 'rgba(185,28,28,0.07)', border: '1px solid rgba(185,28,28,0.18)', color: 'rgb(153,27,27)' }}
                >
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{error}{errorDetails.map(d => ` (${d})`).join('')}</span>
                  <button
                    onClick={() => { setError(null); setErrorDetails([]); }}
                    className="flex-shrink-0 text-current/60 hover:text-current transition-colors"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <motion.div variants={fadeUp} className="mb-5">
                <label
                  htmlFor="login-email"
                  className="block text-[10px] uppercase mb-2.5"
                  style={{ color: 'rgba(26,26,26,0.55)', letterSpacing: '0.22em', fontWeight: 600 }}
                >
                  Email
                </label>
                <div
                  className="relative flex items-center transition-all duration-200"
                  style={{
                    borderBottom: '1px solid rgba(26,61,43,0.25)',
                    backgroundColor: 'transparent',
                  }}
                >
                  <Mail size={15} style={{ color: 'rgba(26,26,26,0.4)' }} />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcemetery.com"
                    required
                    autoComplete="email"
                    className="w-full pl-3 pr-2 py-3 bg-transparent text-base outline-none"
                    style={{
                      color: 'var(--ink)',
                      fontFamily: 'var(--font-serif)',
                    }}
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="mb-8">
                <label
                  htmlFor="login-password"
                  className="block text-[10px] uppercase mb-2.5"
                  style={{ color: 'rgba(26,26,26,0.55)', letterSpacing: '0.22em', fontWeight: 600 }}
                >
                  Password
                </label>
                <div
                  className="relative flex items-center transition-all duration-200"
                  style={{
                    borderBottom: '1px solid rgba(26,61,43,0.25)',
                  }}
                >
                  <Lock size={15} style={{ color: 'rgba(26,26,26,0.4)' }} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="w-full pl-3 pr-9 py-3 bg-transparent text-base outline-none"
                    style={{
                      color: 'var(--ink)',
                      fontFamily: 'var(--font-serif)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: 'rgba(26,26,26,0.4)' }}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={fadeUp}>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={loading ? {} : { scale: 1.005 }}
                  whileTap={loading ? {} : { scale: 0.995 }}
                  className="w-full flex items-center justify-center gap-2.5 py-4 px-5 text-[11px] uppercase font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: BRAND.greenDeep,
                    color: 'var(--bone)',
                    letterSpacing: '0.22em',
                    border: 'none',
                    borderRadius: '2px',
                  }}
                >
                  {loading ? (
                    <>
                      <span
                        className="w-3.5 h-3.5 border rounded-full animate-spin"
                        style={{ borderColor: 'rgba(245,241,234,0.3)', borderTopColor: 'var(--bone)' }}
                      />
                      Signing in
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </form>

            {/* ── Google OAuth ── */}
            <motion.div variants={fadeUp} className="mt-5">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(26,61,43,0.15)' }} />
                <span className="text-[10px] uppercase" style={{ color: 'rgba(26,26,26,0.4)', letterSpacing: '0.28em' }}>or</span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(26,61,43,0.15)' }} />
              </div>
              <motion.button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                whileHover={googleLoading || loading ? {} : { scale: 1.005 }}
                whileTap={googleLoading || loading ? {} : { scale: 0.995 }}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-5 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  border: '1px solid rgba(26,61,43,0.22)',
                  color: 'rgba(26,26,26,0.8)',
                  backgroundColor: 'var(--bone)',
                  borderRadius: '2px',
                }}
                onMouseEnter={(e) => { if (!googleLoading && !loading) e.currentTarget.style.backgroundColor = 'rgba(26,61,43,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bone)'; }}
              >
                {googleLoading ? (
                  <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(26,61,43,0.2)', borderTopColor: BRAND.green }} />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </motion.button>
            </motion.div>

            {/* ── Demo ── */}
            <motion.div variants={fadeUp} className="mt-3">
              <motion.button
                type="button"
                onClick={handleDemo}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.995 }}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-5 text-[11px] uppercase font-medium transition-colors"
                style={{
                  color: 'rgba(26,26,26,0.45)',
                  backgroundColor: 'transparent',
                  letterSpacing: '0.22em',
                  border: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = BRAND.green)}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.45)')}
              >
                <Sparkles size={12} style={{ color: BRAND.gold }} />
                Explore Demo
              </motion.button>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="text-xs text-center mt-6"
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                color: 'rgba(26,26,26,0.4)',
              }}
            >
              Staff demo: <span style={{ fontStyle: 'normal', color: 'rgba(26,26,26,0.6)' }}>admin@dmp.com</span>
              {' / '}
              <span style={{ fontStyle: 'normal', color: 'rgba(26,26,26,0.6)' }}>admin123</span>
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-14 pt-8"
              style={{ borderTop: '1px solid rgba(26,61,43,0.12)' }}
            >
              <div
                className="flex items-center justify-center gap-5 text-[11px] uppercase"
                style={{ color: 'rgba(26,26,26,0.42)', letterSpacing: '0.18em', fontWeight: 500 }}
              >
                <a
                  href={`tel:${COMPANY.phone.main.replace(/[^\d]/g, '')}`}
                  className="hover:underline transition-colors"
                  style={{ color: 'rgba(26,26,26,0.55)' }}
                >
                  {COMPANY.phone.main}
                </a>
                <span style={{ color: 'rgba(196,154,44,0.5)' }}>·</span>
                <a
                  href={COMPANY.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline transition-colors"
                  style={{ color: 'rgba(26,26,26,0.55)' }}
                >
                  
                </a>
              </div>
              <p
                className="text-[10px] uppercase text-center mt-3"
                style={{ color: 'rgba(26,26,26,0.3)', letterSpacing: '0.2em' }}
              >
                {COMPANY.legal.copyright}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
