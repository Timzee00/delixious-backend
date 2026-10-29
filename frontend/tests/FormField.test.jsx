import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormField from '../src/components/FormField.jsx';

describe('FormField', () => {
  it('renders a labeled text input by default', () => {
    render(<FormField label="Full name" value="" onChange={vi.fn()} />);
    expect(screen.getByText('Full name')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onChange with the new value (not the raw event)', () => {
    const onChange = vi.fn();
    render(<FormField label="Full name" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ada' } });
    expect(onChange).toHaveBeenCalledWith('Ada');
  });

  it('renders a textarea when as="textarea"', () => {
    render(<FormField label="Description" as="textarea" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  it('marks the input as required when required is passed', () => {
    render(<FormField label="Email" value="" onChange={vi.fn()} required />);
    expect(screen.getByRole('textbox')).toBeRequired();
  });
});
