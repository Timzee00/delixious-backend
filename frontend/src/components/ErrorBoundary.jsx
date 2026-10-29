import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // In a real deployment, forward this to your error-tracking service
    // (Sentry, etc). Logging here at minimum means it's not silently lost.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <div className="ticket p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-danger">Something broke</p>
            <h1 className="mt-2 font-display text-xl font-bold text-ink">This page hit a snag</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Nothing you did caused this. Try again, or head back to the home page.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-lg border border-hairline py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink-soft"
              >
                Try again
              </button>
              <a
                href="/"
                className="flex-1 rounded-lg bg-pepper py-2 text-sm font-semibold text-white transition-colors hover:bg-pepper-dark"
              >
                Back to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
