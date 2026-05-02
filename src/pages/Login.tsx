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

const dotMatrix = Array.from({ length: 25 });

const heroBackgroundStyle = {
  background: `
    radial-gradient(ellipse 80% 60% at 20% 30%, rgba(196,154,44,0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 80% at 80% 80%, rgba(26,61,43,0.8) 0%, transparent 70%),
    linear-gradient(160deg, ${BRAND.green} 0%, ${BRAND.greenDeep} 100%)
  `,
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
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
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col relative overflow-hidden"
        style={{ backgroundColor: BRAND.greenDeep }}
      >
        <div className="absolute inset-0" style={heroBackgroundStyle} />

        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke={BRAND.gold} strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <svg className="absolute bottom-0 right-0 w-[420px] h-[420px] opacity-[0.06]" viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="420" cy="420" r="200" stroke={BRAND.gold} strokeWidth="1.5"/>
          <circle cx="420" cy="420" r="280" stroke={BRAND.gold} strokeWidth="1"/>
          <circle cx="420" cy="420" r="360" stroke={BRAND.gold} strokeWidth="0.5"/>
        </svg>

        <div className="absolute top-16 left-16 grid grid-cols-5 gap-3 opacity-20">
          {dotMatrix.map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: BRAND.gold }} />
          ))}
        </div>

        <div className="relative flex flex-col h-full px-14 py-14 justify-between">
          <div>
            <div className="flex items-center gap-4 mb-14">
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
            </div>

            <div className="mb-10">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
                style={{ backgroundColor: 'rgba(196,154,44,0.15)', color: BRAND.goldLight, border: '1px solid rgba(196,154,44,0.25)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: BRAND.gold }} />
                Est. {COMPANY.established} · Michigan's Trusted Cemetery
              </div>
              <h1 className="text-white font-bold leading-tight mb-4" style={{ fontSize: '2.6rem', letterSpacing: '-0.02em' }}>
                Honoring Lives.<br />
                <span style={{ color: BRAND.gold }}>Preserving</span><br />
                Legacies.
              </h1>
              <p className="leading-relaxed text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                A century of dignified service across three Michigan communities.
                This management system keeps our operations as enduring as our mission.
              </p>
            </div>

            <div className="flex gap-8 mb-10">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-bold" style={{ color: BRAND.gold }}>{s.value}</p>
                  <p className="text-xs mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="w-12 h-px mb-10" style={{ backgroundColor: 'rgba(196,154,44,0.4)' }} />

            <div className="space-y-2.5">
              {heroLocations.map((loc) => (
                <div key={loc.name} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(196,154,44,0.12)', border: '1px solid rgba(196,154,44,0.2)' }}
                  >
                    <MapPin size={12} style={{ color: BRAND.gold }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">{loc.name}</span>
                    <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{loc.city}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="w-full h-px mb-6" style={{ backgroundColor: 'rgba(196,154,44,0.15)' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {COMPANY.legal.copyright} · State of Michigan Official Historic Site
            </p>
          </div>
        </div>
      </div>

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
          <div className="w-full max-w-[400px] animate-slide-up">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h2>
              <p className="text-foreground-muted text-sm mt-1.5">
                Sign in to access the {COMPANY.system.name}
              </p>
            </div>

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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
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
              </div>

              <div>
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="login-submit w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-150 mt-2 text-white shadow-[0_4px_14px_rgba(26,61,43,0.35)] disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none"
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

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-foreground-subtle px-1">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={handleDemo}
              className="login-demo w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-150 text-foreground"
            >
              <Sparkles size={15} style={{ color: BRAND.gold }} />
              Explore Demo
              <span className="text-xs text-foreground-subtle font-normal">— no login required</span>
            </button>

            <p className="text-xs text-center text-foreground-subtle mt-4">
              Staff login:&ensp;
              <span className="font-medium text-foreground">admin@dmp.com</span>
              &ensp;/&ensp;
              <span className="font-medium text-foreground">admin123</span>
            </p>

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
