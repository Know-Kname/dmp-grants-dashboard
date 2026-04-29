import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Alert } from '../components/ui';
import { getErrorMessage, getErrorRequestId } from '../lib/errors';
import { enableDemoMode } from '../lib/demo-data';
import { Mail, Lock, Sun, Moon, Eye, EyeOff, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { COMPANY } from '../config/company';

const DMP_GREEN = '#1a3d2b';
const DMP_GREEN_DEEP = '#0f2419';
const DMP_GOLD = '#c49a2c';
const DMP_GOLD_LIGHT = '#d4aa3c';

const locations = [
  { name: 'DMP East', city: 'Warren, MI' },
  { name: 'DMP West', city: 'Redford, MI' },
  { name: 'Gracelawn', city: 'Flint, MI' },
];

const stats = [
  { value: '100+', label: 'Years Serving Michigan' },
  { value: '170+', label: 'Acres Across 3 Sites' },
  { value: '3', label: 'Cemetery Locations' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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

      {/* ── LEFT HERO PANEL ──────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col relative overflow-hidden"
        style={{ backgroundColor: DMP_GREEN_DEEP }}
      >
        {/* layered radial gradient glow */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 30%, rgba(196,154,44,0.12) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 80% 80%, rgba(26,61,43,0.8) 0%, transparent 70%),
              linear-gradient(160deg, ${DMP_GREEN} 0%, ${DMP_GREEN_DEEP} 100%)
            `,
          }}
        />

        {/* geometric grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#c49a2c" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* decorative arcs */}
        <svg className="absolute bottom-0 right-0 w-[420px] h-[420px] opacity-[0.06]" viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="420" cy="420" r="200" stroke="#c49a2c" strokeWidth="1.5"/>
          <circle cx="420" cy="420" r="280" stroke="#c49a2c" strokeWidth="1"/>
          <circle cx="420" cy="420" r="360" stroke="#c49a2c" strokeWidth="0.5"/>
        </svg>

        {/* top-left decorative dots */}
        <div className="absolute top-16 left-16 grid grid-cols-5 gap-3 opacity-20">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: DMP_GOLD }} />
          ))}
        </div>

        {/* content */}
        <div className="relative flex flex-col h-full px-14 py-14 justify-between">

          {/* top brand */}
          <div>
            {/* monogram */}
            <div className="flex items-center gap-4 mb-14">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-xl"
                style={{ backgroundColor: DMP_GOLD, color: DMP_GREEN_DEEP, letterSpacing: '-0.02em' }}
              >
                DMP
              </div>
              <div>
                <p className="text-white font-semibold tracking-wide text-sm">Detroit Memorial Park</p>
                <p className="text-xs" style={{ color: 'rgba(196,154,44,0.7)' }}>Association, Inc.</p>
              </div>
            </div>

            {/* main headline */}
            <div className="mb-10">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
                style={{ backgroundColor: 'rgba(196,154,44,0.15)', color: DMP_GOLD_LIGHT, border: `1px solid rgba(196,154,44,0.25)` }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: DMP_GOLD }} />
                Est. {COMPANY.established} · Michigan's Trusted Cemetery
              </div>
              <h1 className="text-white font-bold leading-tight mb-4" style={{ fontSize: '2.6rem', letterSpacing: '-0.02em' }}>
                Honoring Lives.<br />
                <span style={{ color: DMP_GOLD }}>Preserving</span><br />
                Legacies.
              </h1>
              <p className="leading-relaxed text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                A century of dignified service across three Michigan communities.
                This management system keeps our operations as enduring as our mission.
              </p>
            </div>

            {/* stats row */}
            <div className="flex gap-8 mb-10">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-bold" style={{ color: DMP_GOLD }}>{s.value}</p>
                  <p className="text-xs mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* gold divider */}
            <div className="w-12 h-px mb-10" style={{ backgroundColor: 'rgba(196,154,44,0.4)' }} />

            {/* location pills */}
            <div className="space-y-2.5">
              {locations.map((loc, i) => (
                <div
                  key={loc.name}
                  className="flex items-center gap-3 group"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(196,154,44,0.12)', border: '1px solid rgba(196,154,44,0.2)' }}
                  >
                    <MapPin size={12} style={{ color: DMP_GOLD }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">{loc.name}</span>
                    <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{loc.city}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* bottom tagline */}
          <div>
            <div className="w-full h-px mb-6" style={{ backgroundColor: 'rgba(196,154,44,0.15)' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {COMPANY.legal.copyright} · State of Michigan Official Historic Site
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ─────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-background relative overflow-y-auto">

        {/* theme toggle */}
        <div className="absolute top-5 right-5 z-10">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl border border-border text-foreground-muted hover:text-foreground hover:bg-accent transition-all"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* mobile-only brand header */}
        <div
          className="lg:hidden flex items-center gap-3 px-6 py-5"
          style={{ backgroundColor: DMP_GREEN }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: DMP_GOLD, color: DMP_GREEN_DEEP }}
          >
            DMP
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Detroit Memorial Park</p>
            <p className="text-xs" style={{ color: 'rgba(196,154,44,0.8)' }}>Cemetery Management System</p>
          </div>
        </div>

        {/* form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[400px] animate-slide-up">

            {/* heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h2>
              <p className="text-foreground-muted text-sm mt-1.5">
                Sign in to access the {COMPANY.system.name}
              </p>
            </div>

            {/* error */}
            {error && (
              <div className="mb-6 animate-fade-in">
                <Alert
                  title="Unable to sign in"
                  message={error}
                  details={errorDetails}
                  onDismiss={() => { setError(null); setErrorDetails([]); }}
                />
              </div>
            )}

            {/* form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* email */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Email address
                </label>
                <div
                  className="relative flex items-center rounded-xl border transition-all duration-150"
                  style={{
                    borderColor: emailFocused ? DMP_GREEN : 'hsl(var(--border))',
                    boxShadow: emailFocused ? `0 0 0 3px rgba(26,61,43,0.1)` : 'none',
                    backgroundColor: 'hsl(var(--input))',
                  }}
                >
                  <Mail size={16} className="absolute left-3.5 text-foreground-subtle" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="you@detroitmemorialpark.org"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle outline-none rounded-xl"
                  />
                </div>
              </div>

              {/* password */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <div
                  className="relative flex items-center rounded-xl border transition-all duration-150"
                  style={{
                    borderColor: passwordFocused ? DMP_GREEN : 'hsl(var(--border))',
                    boxShadow: passwordFocused ? `0 0 0 3px rgba(26,61,43,0.1)` : 'none',
                    backgroundColor: 'hsl(var(--input))',
                  }}
                >
                  <Lock size={16} className="absolute left-3.5 text-foreground-subtle" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
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
              </div>

              {/* sign in button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-150 mt-2"
                style={{
                  backgroundColor: loading ? 'rgba(26,61,43,0.7)' : DMP_GREEN,
                  color: 'white',
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(26,61,43,0.35)',
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#0f2419')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = DMP_GREEN)}
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
              </button>
            </form>

            {/* divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-foreground-subtle px-1">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* demo button */}
            <button
              type="button"
              onClick={handleDemo}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-150 group"
              style={{ borderColor: 'rgba(196,154,44,0.4)', color: 'hsl(var(--foreground))', backgroundColor: 'rgba(196,154,44,0.05)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(196,154,44,0.1)'; e.currentTarget.style.borderColor = DMP_GOLD; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(196,154,44,0.05)'; e.currentTarget.style.borderColor = 'rgba(196,154,44,0.4)'; }}
            >
              <Sparkles size={15} style={{ color: DMP_GOLD }} />
              Explore Demo
              <span className="text-xs text-foreground-subtle font-normal">— no login required</span>
            </button>

            {/* demo credentials hint */}
            <p className="text-xs text-center text-foreground-subtle mt-4">
              Staff login:&ensp;
              <span className="font-medium text-foreground">admin@dmp.com</span>
              &ensp;/&ensp;
              <span className="font-medium text-foreground">admin123</span>
            </p>

            {/* footer */}
            <div className="mt-10 pt-6 border-t border-border">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
