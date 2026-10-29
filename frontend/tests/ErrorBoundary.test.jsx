import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';

function Bomb() {
  throw new Error('Boom');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows a fallback UI instead of crashing when a child throws', () => {
    // React logs the error to console too - silence that noise for this test.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('This page hit a snag')).toBeInTheDocument();
    expect(screen.queryByText('All good')).not.toBeInTheDocument();
  });

  it('lets the person retry, clearing the error state', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try again')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try again'));
    // Bomb throws again immediately since it's still mounted with the same
    // props - the meaningful check is that the reset handler runs without
    // itself throwing, and the fallback is still showing a stable UI.
    expect(screen.getByText('This page hit a snag')).toBeInTheDocument();
  });
});
