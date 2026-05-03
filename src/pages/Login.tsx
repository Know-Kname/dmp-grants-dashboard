import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Alert } from '../components/ui';
import { getErrorMessage, getErrorRequestId } from '../lib/errors';
import { enableDemoMode } from '../lib/demo-data';
import { Mail, Lock, Sun, Moon, Eye, EyeOff, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { COMPANY } from '../config/company';
import { BRAND } from '../config/brand';
import { motion, AnimatePresence } from 'framer-motion';

const stats = [
  { value: '100+', label: 'Years Serving Michigan' },
  { value: '170+', label: 'Acres Across 3 Sites' },
  { value: '3', label: 'Cemetery Locations' },
];

const heroLocations = [
  { name: 'DMP East', city: COMPANY.locations.east.city + ', ' + COMPANY.locations.east.state },
  { name: 'DMP West', city: COMPANY.locations.west.city + ', ' + COMPANY.locations.west.state },
  { name: 'Gracelawn', city: COMPANY.locations.gracelawn.city + ', ' + COMPANY.locations.gracelawn.state },
];

const PHOTO_URL =
  'https://images.unsplash.com/photo-1618022325802-7e5e732d97a1?w=1400&q=80&auto=format&fit=crop';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const { login } = useAuth();
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
      const message = getErrorMessage(err, 'Unable to sign in. Please try again.');
      const requestId = getErrorRequestId(err);
      setError(message);
      setErrorDetails(requestId ? [`Request ID: ${requestId}`] : []);
      setShakeKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    enableDemoMode();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — photo + brand */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url('${PHOTO_URL}')` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg,
              rgba(10,34,21,0.88) 0%,
              rgba(26,61,43,0.72) 45%,
              rgba(10,34,21,0.92) 100%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ backgroundColor: BRAND.gold, opacity: 0.35 }}
        />

        <motion.div
          className="relative flex flex-col h-full px-14 py-14 justify-between"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <div>
            <motion.div variants={fadeUp} className="flex items-center gap-4 mb-14">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-xl"
                style={{ backgroundColor: BRAND.gold, color: BRAND.greenDeep, letterSpacing: '-0.02em' }}
              >
                DMP
              </div>
              <div>
                <p className="text-white font-semibold tracking-wide text-sm">Detroit Memorial Park</p>
                <p className="text-xs" style={{ color: 'rgba(196,154,44,0.7)' }}>Association, Inc.</p>
              </div>
            </motion.div>

            <div className="mb-10">
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                style={{
                  backgroundColor: 'rgba(196,154,44,0.15)',
                  color: BRAND.goldLight,
                  border: '1px solid rgba(196,154,44,0.25)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: BRAND.gold }}
                />
                Est. {COMPANY.established} · Michigan's Trusted Cemetery
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-white leading-[1.1] mb-5"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(2.2rem, 3.5vw, 3rem)',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                }}
              >
                Honoring Lives.<br />
                <span style={{ color: BRAND.gold }}>Preserving</span><br />
                Legacies.
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="leading-relaxed text-sm max-w-xs"
                style={{ color: 'rgba(255,255,255,0.52)' }}
              >
                A century of dignified service across three Michigan communities.
                This management system keeps our operations as enduring as our mission.
              </motion.p>
            </div>

            <motion.div variants={fadeUp} className="flex gap-8 mb-10">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-bold" style={{ color: BRAND.gold }}>{s.value}</p>
                  <p className="text-xs mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mb-10"
              style={{ width: '3rem', height: '1px', backgroundColor: 'rgba(196,154,44,0.45)' }}
            />

            <motion.div variants={fadeUp} className="space-y-3">
              {heroLocations.map((loc) => (
                <div key={loc.name} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: 'rgba(196,154,44,0.12)',
                      border: '1px solid rgba(196,154,44,0.2)',
                    }}
                  >
                    <MapPin size={12} style={{ color: BRAND.gold }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">{loc.name}</span>
                    <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {loc.city}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div variants={fadeUp}>
            <div className="w-full h-px mb-6" style={{ backgroundColor: 'rgba(196,154,44,0.15)' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {COMPANY.legal.copyright} · State of Michigan Official Historic Site
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col bg-background relative overflow-y-auto">
        <div className="absolute top-5 right-5 z-10">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl border border-border text-foreground-muted hover:text-foreground hover:bg-accent transition-all"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div
          className="lg:hidden flex items-center gap-3 px-6 py-5"
          style={{ backgroundColor: BRAND.green }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: BRAND.gold, color: BRAND.greenDeep }}
          >
            DMP
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Detroit Memorial Park</p>
            <p className="text-xs" style={{ color: 'rgba(196,154,44,0.8)' }}>Cemetery Management System</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10">
          <motion.div
            className="w-full max-w-[400px]"
            initial="hidden"
            animate="show"
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="mb-8">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h2>
              <p className="text-foreground-muted text-sm mt-1.5">
                Sign in to access the {COMPANY.system.name}
              </p>
            </motion.div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key={shakeKey}
                  initial={{ opacity: 0, x: 0 }}
                  animate={{
                    opacity: 1,
                    x: [0, -10, 10, -10, 10, -5, 5, 0],
                    transition: { duration: 0.5, ease: 'easeOut' },
                  }}
                  exit={{ opacity: 0 }}
                  className="mb-6"
                >
                  <Alert
                    title="Unable to sign in"
                    message={error}
                    details={errorDetails}
                    onDismiss={() => { setError(null); setErrorDetails([]); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <motion.div variants={fadeUp} className="mb-4">
                <label htmlFor="login-email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email address
                </label>
                <div className="login-field group relative flex items-center rounded-xl border border-border bg-input transition-all duration-150 focus-within:border-[var(--brand-green)] focus-within:shadow-[0_0_0_3px_rgba(26,61,43,0.1)]">
                  <Mail size={16} className="absolute left-3.5 text-foreground-subtle" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@detroitmemorialpark.org"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle outline-none rounded-xl"
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="mb-4">
                <label htmlFor="login-password" className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <div className="login-field group relative flex items-center rounded-xl border border-border bg-input transition-all duration-150 focus-within:border-[var(--brand-green)] focus-within:shadow-[0_0_0_3px_rgba(26,61,43,0.1)]">
                  <Lock size={16} className="absolute left-3.5 text-foreground-subtle" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle outline-none rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-foreground-subtle hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={fadeUp}>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={loading ? {} : { scale: 1.02 }}
                  whileTap={loading ? {} : { scale: 0.98 }}
                  className="login-submit w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white shadow-[0_4px_14px_rgba(26,61,43,0.35)] disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none mt-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </form>

            <motion.div variants={fadeUp} className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-foreground-subtle px-1">or</span>
              <div className="flex-1 h-px bg-border" />
            </motion.div>

            <motion.div variants={fadeUp}>
              <motion.button
                type="button"
                onClick={handleDemo}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="login-demo w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-150 text-foreground"
              >
                <Sparkles size={15} style={{ color: BRAND.gold }} />
                Explore Demo
                <span className="text-xs text-foreground-subtle font-normal">— no login required</span>
              </motion.button>
            </motion.div>

            <motion.p variants={fadeUp} className="text-xs text-center text-foreground-subtle mt-4">
              Staff login:&ensp;
              <span className="font-medium text-foreground">admin@dmp.com</span>
              &ensp;/&ensp;
              <span className="font-medium text-foreground">admin123</span>
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10 pt-6 border-t border-border">
              <div className="flex items-center justify-center gap-5 text-xs text-foreground-subtle">
                <a
                  href={`tel:${COMPANY.phone.main.replace(/[^\d]/g, '')}`}
                  className="hover:text-foreground transition-colors"
                >
                  {COMPANY.phone.main}
                </a>
                <span className="w-1 h-1 rounded-full bg-border" />
                <a
                  href={COMPANY.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  detroitmemorialpark.org
                </a>
              </div>
              <p className="text-xs text-center text-foreground-subtle mt-2">
                {COMPANY.legal.copyright}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
