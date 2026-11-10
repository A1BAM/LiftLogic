import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  afterEach(cleanup);

  const props = {
    lastTrained: { PUSH: Date.now() - 3 * 86400000, PULL: Date.now() - 86400000 },
    week: { sets: 18, volume: 21400, days: 3 },
    onPick: vi.fn(),
    onJournal: vi.fn(),
    onExercises: vi.fn(),
    onLogout: vi.fn()
  };

  it('says when each day was last trained, and admits when one never was', () => {
    render(<HomeScreen {...props} />);
    // Which day to do is mostly a question of what has rested longest.
    expect(screen.getByText('3 days ago')).toBeInTheDocument();
    expect(screen.getByText('yesterday')).toBeInTheDocument();
    expect(screen.getByText('never')).toBeInTheDocument();
  });

  it('picks the day that was tapped', () => {
    const onPick = vi.fn();
    render(<HomeScreen {...props} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /^Pull/ }));
    expect(onPick).toHaveBeenCalledWith('PULL');
  });

  it('sums the week in one line', () => {
    render(<HomeScreen {...props} />);
    const text = document.body.textContent || '';
    expect(text).toContain('18 sets');
    expect(text).toContain('3 days');
    expect(text).toContain('21k lbs');
  });

  it('says plainly when the week is empty, rather than showing zeroes', () => {
    render(<HomeScreen {...props} week={{ sets: 0, volume: 0, days: 0 }} />);
    expect(
      screen.getByText(/Nothing logged this week yet — pick a day and start it off\./)
    ).toBeInTheDocument();
  });

  it('greets you and names the day that has rested longest', () => {
    render(<HomeScreen {...props} />);
    // Push was 3 days ago, Pull yesterday, Legs never — so Legs is the pick.
    expect(screen.getByText(/^Good (morning|afternoon|evening)\.$/)).toBeInTheDocument();
    const legs = screen.getByRole('button', { name: /^Legs/ });
    expect(legs.textContent).toContain('rested longest');
    // And only that one is marked.
    expect(screen.getByRole('button', { name: /^Push/ }).textContent).not.toContain('rested longest');
  });
});
