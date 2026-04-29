import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Button, Input, Alert } from '../components/ui';
import { getErrorMessage, getErrorRequestId } from '../lib/errors';
import { enableDemoMode } from '../lib/demo-data';
import { Mail, Lock, Sun, Moon, Phone, MapPin, Play } from 'lucide-react';
import { COMPANY } from '../config/company';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 text-white overflow-hidden"
        style={{
          backgroundImage: 'url(/dmp-hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#1a3d2b',
        }}
      >
        {/* Deep green overlay — shows alone when no image, darkens image when present */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f2419]/90 via-[#1a3d2b]/80 to-[#2d5a3d]/70" />

        {/* Content sits above overlay */}
        <div className="relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-[#c49a2c] flex items-center justify-center shadow-lg">
              <span className="font-bold text-[#1a3d2b] text-lg">{COMPANY.abbreviation}</span>
            </div>
            <div>
              <p className="font-semibold text-white leading-tight">{COMPANY.shortName}</p>
              <p className="text-xs text-white/60">{COMPANY.system.name}</p>
            </div>
          </div>

          {/* Hero text */}
          <h1 className="text-5xl font-bold leading-tight tracking-tight mb-4">
            Preserving<br />Memories
          </h1>
          <p className="text-xl text-white/80 font-light mb-2">Since {COMPANY.established}</p>
          <div className="w-16 h-0.5 bg-[#c49a2c] mb-8" />
          <p className="text-base text-white/70 max-w-sm leading-relaxed">
            {COMPANY.description.split('.')[0]}.
          </p>
        </div>

        {/* Bottom location cards */}
        <div className="relative z-10">
          <p className="text-xs text-white/50 uppercase tracking-widest mb-4 font-medium">
            Three Locations · Over 170 Acres
          </p>
          <div className="grid grid-cols-3 gap-3">
            {Object.values(COMPANY.locations).map((loc) => (
              <div
                key={loc.name}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3"
              >
                <MapPin size={12} className="text-[#c49a2c] mb-1.5" />
                <p className="text-xs font-semibold text-white leading-tight">{loc.city}, {loc.state}</p>
                <p className="text-[10px] text-white/50 mt-0.5 flex items-center gap-1">
                  <Phone size={9} />{loc.phone}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/30 mt-4">{COMPANY.legal.copyright}</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col bg-background transition-colors">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-border">
          {/* Mobile only: compact logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-[#1a3d2b] flex items-center justify-center">
              <span className="text-white font-bold text-xs">{COMPANY.abbreviation}</span>
            </div>
            <span className="font-semibold text-foreground text-sm">{COMPANY.shortName}</span>
          </div>
          <div className="hidden lg:block" />

          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
              <p className="text-foreground-muted mt-1 text-sm">Sign in to the management system</p>
            </div>

            {error && (
              <div className="mb-6">
                <Alert
                  title="Unable to sign in"
                  message={error}
                  details={errorDetails}
                  onDismiss={() => { setError(null); setErrorDetails([]); }}
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="Email address"
                placeholder="you@dmp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail size={16} />}
                required
                autoComplete="email"
              />
              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock size={16} />}
                required
                autoComplete="current-password"
              />
              <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
                Sign in
              </Button>
            </form>

            {/* Demo */}
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-sm text-foreground-muted text-center mb-3">
                Want to explore first?
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => { enableDemoMode(); navigate('/'); }}
              >
                <Play size={15} className="mr-2" />
                Preview Demo
                <span className="ml-2 text-xs text-foreground-muted">(No login required)</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border">
          <p className="text-xs text-foreground-muted text-center">
            {COMPANY.legal.copyright} · {COMPANY.phone.main}
          </p>
        </div>
      </div>
    </div>
  );
}
