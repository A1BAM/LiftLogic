import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalHistoryModal } from './GlobalHistoryModal';

describe('GlobalHistoryModal', () => {
  const defaultProps = {
    logs: [],
    currentDayType: null,
    onClose: vi.fn(),
    onImport: vi.fn(),
    customExercises: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error message when importing invalid JSON', () => {
    render(<GlobalHistoryModal {...defaultProps} />);

    // Click Import Data button to enter import mode
    const importDataBtn = screen.getByLabelText('Import Data');
    fireEvent.click(importDataBtn);

    // Find the textarea and enter invalid JSON
    const textarea = screen.getByLabelText('Workout history JSON');
    fireEvent.change(textarea, { target: { value: 'invalid json text' } });

    // Click Import Logs button
    const submitBtn = screen.getByRole('button', { name: 'Import Logs' });
    fireEvent.click(submitBtn);

    // Verify error is displayed (we check by regex since the browser error message is included)
    const errorMessage = screen.getByText(/is not valid JSON|Unexpected token/i);
    expect(errorMessage).toBeTruthy();

    // Verify onImport was not called
    expect(defaultProps.onImport).not.toHaveBeenCalled();
  });
});
