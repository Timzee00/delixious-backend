import { useEffect, useRef } from 'react';

/**
 * Shared modal overlay - handles the backdrop, Escape-to-close, and basic
 * focus management (focuses the dialog on open, returns focus to whatever
 * triggered it on close). Every modal in the app renders through this
 * instead of duplicating the overlay markup and a11y wiring per-component.
 */
export default function Modal({ children, onClose, labelledBy, className = 'max-w-sm' }) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    dialogRef.current?.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`ticket w-full p-6 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
