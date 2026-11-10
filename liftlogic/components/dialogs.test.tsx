import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { confirmDialog, notify, DialogHost } from './dialogs';
import { EditSetModal } from './EditSetModal';

afterEach(cleanup);

describe('in-app dialogs', () => {
  it('resolves true when the question is confirmed', async () => {
    render(<DialogHost />);
    let answer: Promise<boolean>;
    act(() => {
      answer = confirmDialog({ title: 'Archive Chest Fly?', confirmLabel: 'Archive' });
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    expect(await answer!).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves false on Cancel', async () => {
    render(<DialogHost />);
    let answer: Promise<boolean>;
    act(() => {
      answer = confirmDialog({ title: 'Delete this exercise?', destructive: true });
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await answer!).toBe(false);
  });

  it('asks queued questions one at a time', async () => {
    render(<DialogHost />);
    act(() => {
      notify('Not saved');
      notify('Not deleted');
    });

    expect(await screen.findByText('Not saved')).toBeInTheDocument();
    expect(screen.queryByText('Not deleted')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Not deleted')).toBeInTheDocument();
  });

  it('answers no when nothing is mounted to ask with', async () => {
    expect(await confirmDialog({ title: 'Delete?' })).toBe(false);
  });
});

describe('EditSetModal', () => {
  it('saves a corrected set, fractions included', () => {
    const onSave = vi.fn();
    const log = { id: 'a', exerciseId: 'curl', timestamp: 1, weight: 30, reps: 8, sets: 1 };
    render(<EditSetModal log={log} onClose={() => {}} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Weight (lbs)'), { target: { value: '27.5' } });
    fireEvent.click(screen.getByLabelText('Increase reps by 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledWith({ ...log, weight: 27.5, reps: 9 });
  });
});
