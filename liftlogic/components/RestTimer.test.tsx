import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { RestTimer } from './RestTimer';

describe('RestTimer', () => {
  const defaultProps = {
    endTime: null as number | null,
    onCancel: vi.fn(),
    onAdd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000000000000));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders nothing when endTime is null', () => {
    const { container } = render(<RestTimer {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with an endTime', () => {
    const endTime = Date.now() + 60000; // 1 minute from now
    render(<RestTimer {...defaultProps} endTime={endTime} />);

    expect(screen.getByText('1:00')).toBeTruthy();
  });

  it('decrements time every second', () => {
    const endTime = Date.now() + 60000;
    render(<RestTimer {...defaultProps} endTime={endTime} />);

    expect(screen.getByText('1:00')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('0:59')).toBeTruthy();
  });

  it('calls onCancel when time reaches 0', () => {
    const endTime = Date.now() + 2000; // 2 seconds
    render(<RestTimer {...defaultProps} endTime={endTime} />);

    expect(screen.getByText('0:02')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onAdd with 30 when Add 30 seconds is clicked', () => {
    const endTime = Date.now() + 60000;
    render(<RestTimer {...defaultProps} endTime={endTime} />);

    const addButton = screen.getByLabelText('Add 30 seconds');
    fireEvent.click(addButton);

    expect(defaultProps.onAdd).toHaveBeenCalledWith(30);
  });

  it('calls onAdd with -30 when Subtract 30 seconds is clicked', () => {
    const endTime = Date.now() + 60000;
    render(<RestTimer {...defaultProps} endTime={endTime} />);

    const subButton = screen.getByLabelText('Subtract 30 seconds');
    fireEvent.click(subButton);

    expect(defaultProps.onAdd).toHaveBeenCalledWith(-30);
  });

  it('calls onCancel when Close Timer is clicked', () => {
    const endTime = Date.now() + 60000;
    render(<RestTimer {...defaultProps} endTime={endTime} />);

    const closeButton = screen.getByLabelText('Close Timer');
    fireEvent.click(closeButton);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });
});
