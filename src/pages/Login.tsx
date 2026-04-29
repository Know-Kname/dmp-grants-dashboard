import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Button, Input, Card, Alert } from '../components/ui';
import { getErrorMessage, getErrorRequestId } from '../lib/errors';
import { enableDemoMode } from '../lib/demo-data';
import { Mail, Lock, Sun, Moon, Phone, ExternalLink, Play } from 'lucide-react';
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

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 transition-colors">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-background to-primary-100 dark:from-slate-950 dark:via-background dark:to-slate-900" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg bg-card border border-border text-foreground-muted hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Toggle theme"
      >
        {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="relative w-full max-w-md animate-slide-up">
        <Card className="p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white font-bold text-2xl">{COMPANY.abbreviation}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{COMPANY.shortName}</h1>
            <p className="text-foreground-muted mt-1">{COMPANY.system.name}</p>
            <p className="text-xs text-foreground-muted mt-2">{COMPANY.tagline}</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 animate-fade-in">
              <Alert
                title="Unable to sign in"
                message={error}
                details={errorDetails}
                onDismiss={() => {
                  setError(null);
                  setErrorDetails([]);
                }}
              />
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              type="email"
              label="Email address"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={18} />}
              required
              autoComplete="email"
            />

            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={18} />}
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
            >
              Sign in
            </Button>
          </form>

          {/* Preview Demo Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-center mb-4">
              <p className="text-sm text-foreground-muted mb-3">
                Want to explore the system first?
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full group"
                onClick={() => {
                  enableDemoMode();
                  navigate('/');
                }}
              >
                <Play size={16} className="mr-2 group-hover:text-primary transition-colors" />
                Preview Demo
                <span className="ml-2 text-xs text-foreground-muted">(No login required)</span>
              </Button>
            </div>
            
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-foreground-muted">or sign in</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            
            <p className="text-xs text-foreground-muted text-center">
              Demo credentials: <span className="font-medium text-foreground">admin@dmp.com</span> / <span className="font-medium text-foreground">admin123</span>
            </p>
          </div>
        </Card>

        {/* Company Contact Info */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-center gap-4 text-xs text-foreground-muted">
            <a
              href={`tel:${COMPANY.phone.main.replace(/[^\d]/g, '')}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Phone size={12} />
              {COMPANY.phone.main}
            </a>
            <a
              href={COMPANY.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ExternalLink size={12} />
              Website
            </a>
          </div>

          <p className="text-xs text-foreground-muted text-center">
            {COMPANY.legal.copyright} {COMPANY.legal.allRightsReserved}
          </p>
        </div>
      </div>
    </div>
  );
}
