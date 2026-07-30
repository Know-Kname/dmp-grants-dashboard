/**
 * React error boundary — wraps `<AppRoutes/>` in `App.tsx`, inside the Query/Theme/
 * Auth/Toast providers. An error thrown by one of those providers themselves would
 * not be caught here.
 * The only class component in the codebase (getDerivedStateFromError requires it).
 * Accepts an optional fallback prop; defaults to a full-page error screen.
 */
import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI error boundary caught an error', { error, info });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Styled with design tokens rather than fixed grays: this screen renders
      // *because* something already failed, so it must still honour the user's
      // light/dark theme instead of flashing a white panel in dark mode.
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="max-w-lg w-full bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-foreground-muted mb-4">
              The application hit an unexpected error. You can reload or try again.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
              >
                Reload
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary-hover transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
