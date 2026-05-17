import { QueryProvider } from './lib/query';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { ConfirmProvider } from './lib/confirm';
import ErrorBoundary from './components/ErrorBoundary';
import { brand } from './config/brand';

export default function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <ErrorBoundary>
              <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl mb-4 mx-auto flex items-center justify-center" style={{ backgroundColor: brand.teal }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                      <path d="M9 3H7v8l-4 8h18L17 11V3h-2"/>
                      <path d="M9 3h6"/>
                      <circle cx="11" cy="15" r="1" fill="white" stroke="none"/>
                      <circle cx="14" cy="17" r="0.75" fill="white" stroke="none"/>
                    </svg>
                  </div>
                  <h1 className="text-3xl font-bold text-foreground">{brand.name}</h1>
                  <p className="text-foreground-muted mt-2">{brand.tagline}</p>
                  <p className="text-foreground-subtle text-sm mt-4">Stage 1 scaffold — building full app…</p>
                </div>
              </div>
            </ErrorBoundary>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
