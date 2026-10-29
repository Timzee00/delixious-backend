import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '../src/components/ConfirmModal.jsx';

describe('ConfirmModal', () => {
  it('renders the title and message', () => {
    render(<ConfirmModal title="Delete this?" message="This cannot be undone." onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Delete this?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal title="Delete?" message="Sure?" confirmLabel="Delete" onCancel={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal title="Delete?" message="Sure?" onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel (via onClose) when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal title="Delete?" message="Sure?" onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('has proper dialog semantics for screen readers', () => {
    render(<ConfirmModal title="Delete?" message="Sure?" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
