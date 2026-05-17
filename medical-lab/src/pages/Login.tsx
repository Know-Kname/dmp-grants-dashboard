import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { brand } from '../config/brand';
import { Microscope, FlaskConical } from 'lucide-react';

export default function Login() {
  const { loginDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    loginDemo();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex flex-col justify-between w-96 p-10 text-white"
        style={{ backgroundColor: brand.teal }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Microscope className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold">{brand.name}</span>
        </div>

        <div>
          <h2 className="text-3xl font-bold leading-snug mb-4">
            Modern lab management,<br />simplified.
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            LabCore LIMS consolidates patient records, test orders, specimen tracking,
            results, instruments, reagents, billing, and quality control in one
            streamlined system.
          </p>
        </div>

        <div className="space-y-3">
          {['Patient & order management', 'Specimen accessioning', 'Result verification', 'Billing & insurance claims', 'QC trending'].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-white/80">
              <FlaskConical className="w-4 h-4 text-white/50" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: brand.teal }}>
              <Microscope className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-foreground">{brand.name}</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Sign in</h1>
          <p className="text-foreground-muted text-sm mb-6">
            Use the demo to explore without credentials.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="you@lab.example"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-4 bg-card border border-input rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-submit w-full h-10 rounded-lg text-white font-medium text-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-foreground-muted bg-background px-2">or</div>
          </div>

          <button
            type="button"
            onClick={handleDemo}
            className="login-demo w-full h-10 rounded-lg border text-sm font-medium text-foreground transition-colors"
          >
            Explore Demo
          </button>

          <p className="mt-4 text-center text-xs text-foreground-subtle">
            Demo mode uses local mock data — no backend required.
          </p>
        </div>
      </div>
    </div>
  );
}
