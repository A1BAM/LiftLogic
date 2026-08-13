
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseDef, WorkoutLog, DayType } from '../types';

describe('ExerciseCard', () => {
  const mockExercise: ExerciseDef = {
    id: 'test-1',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    defaultWeight: 135,
    increment: 5,
    targetReps: 10,
    dayType: 'PUSH' as DayType
  };

  const defaultProps = {
    exercise: mockExercise,
    exerciseLogs: [],
    onLogClick: vi.fn(),
    onHistoryClick: vi.fn(),
    onArchive: vi.fn(),
    onSwitch: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-10-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const createLog = (timestamp: number, weight: number, reps: number, sets: number = 1): WorkoutLog => ({
    id: `log-${Date.now()}-${Math.random()}`,
    exerciseId: mockExercise.id,
    timestamp,
    weight,
    reps,
    sets
  });

  it('renders correctly with no logs', () => {
    render(<ExerciseCard {...defaultProps} />);

    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getAllByText('No logs yet').length).toBeGreaterThan(0); // One in previous, one in tooltip/mobile view
    expect(screen.getByText('Start Workout')).toBeInTheDocument();
    expect(screen.getByText('Start light to build form.')).toBeInTheDocument();
  });

  it('shows Build Volume when previous logs have less than target sets', () => {
    const yesterday = new Date('2023-10-14T12:00:00Z').getTime();
    const logs = [createLog(yesterday, 135, 10, 2)]; // Only 2 sets

    render(<ExerciseCard {...defaultProps} exerciseLogs={logs} />);

    expect(screen.getByText('Build Volume: Complete 3 sets.')).toBeInTheDocument();
  });

  it('shows Build Strength when previous logs meet volume but not target reps', () => {
    const yesterday = new Date('2023-10-14T12:00:00Z').getTime();
    const logs = [
        createLog(yesterday, 135, 10, 2),
        createLog(yesterday - 1000, 135, 8, 1) // One set missed target reps
    ];

    render(<ExerciseCard {...defaultProps} exerciseLogs={logs} />);

    expect(screen.getByText('Build Strength: Hit 10 reps on all sets.')).toBeInTheDocument();
    expect(screen.getByText('Target Goal')).toBeInTheDocument();
  });

  it('shows Overload and Increase Weight when previous logs meet both volume and reps', () => {
    const yesterday = new Date('2023-10-14T12:00:00Z').getTime();
    const logs = [
        createLog(yesterday, 135, 12, 1),
        createLog(yesterday - 1000, 135, 10, 2)
    ];

    render(<ExerciseCard {...defaultProps} exerciseLogs={logs} />);

    expect(screen.getByText('Overload: All sets hit 10+ reps!')).toBeInTheDocument();
    expect(screen.getByText('Increase Weight')).toBeInTheDocument();
    expect(screen.getByText('140')).toBeInTheDocument(); // 135 + 5 increment
  });

  it('shows Add Another Set when today partially completed', () => {
    const today = new Date('2023-10-15T12:00:00Z').getTime();
    const logs = [createLog(today, 135, 10, 2)]; // 2 sets today, need 3

    render(<ExerciseCard {...defaultProps} exerciseLogs={logs} />);

    expect(screen.getByText('Add Another Set')).toBeInTheDocument();
  });

  it('shows View Today\'s Log when today is completed', () => {
    const today = new Date('2023-10-15T12:00:00Z').getTime();
    const logs = [createLog(today, 135, 10, 3)]; // 3 sets today

    render(<ExerciseCard {...defaultProps} exerciseLogs={logs} />);

    expect(screen.getByText("View Today's Log")).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument(); // Matches uppercase tracking-wider span
  });

  it('renders progress indicator with the correct accessible label', () => {
    const today = new Date('2023-10-15T12:00:00Z').getTime();
    const logs = [createLog(today, 135, 10, 2)]; // 2 sets today

    render(<ExerciseCard {...defaultProps} exerciseLogs={logs} />);

    const progressIndicator = screen.getByLabelText('Progress: 2 of 3 sets completed');
    expect(progressIndicator).toBeInTheDocument();
  });

  it('handles interaction callbacks correctly', () => {
    render(<ExerciseCard {...defaultProps} />);

    // Switch
    const switchBtn = screen.getByRole('button', { name: 'Switch Exercise' });
    fireEvent.click(switchBtn);
    expect(defaultProps.onSwitch).toHaveBeenCalledWith(mockExercise);

    // History
    const historyBtn = screen.getByRole('button', { name: 'View History' });
    fireEvent.click(historyBtn);
    expect(defaultProps.onHistoryClick).toHaveBeenCalledWith(mockExercise);

    // Log (Start Workout)
    const startBtn = screen.getByText('Start Workout');
    fireEvent.click(startBtn);
    expect(defaultProps.onLogClick).toHaveBeenCalledWith(mockExercise);
  });

  it('handles archive with confirmation', () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<ExerciseCard {...defaultProps} />);

    const archiveBtn = screen.getByRole('button', { name: 'Archive Exercise' });
    fireEvent.click(archiveBtn);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Archive Bench Press?'));
    expect(defaultProps.onArchive).toHaveBeenCalledWith(mockExercise);

    confirmSpy.mockRestore();
  });
});
