import React from 'react';
import { DayType } from '../types';
import { daysAgoLabel, partOfDay } from '../utils/date';

interface HomeScreenProps {
  /** When each day was last trained, by day type. Null if never. */
  lastTrained: Partial<Record<DayType, number | null>>;
  /** Sets logged and weight moved over the last seven days. */
  week: { sets: number; volume: number; days: number };
  onPick: (day: DayType) => void;
  onJournal: () => void;
  onExercises: () => void;
  onLogout: () => void;
}

const DAYS: Array<{ day: DayType; title: string; muscles: string }> = [
  { day: 'PUSH', title: 'Push', muscles: 'Chest · Shoulders · Triceps' },
  { day: 'PULL', title: 'Pull', muscles: 'Back · Biceps' },
  { day: 'LEGS', title: 'Legs', muscles: 'Quads · Hamstrings · Calves' }
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric'
});

/**
 * The front door. It greets you, says what day it is, and asks the one
 * question it exists to ask — with enough about each answer that you can
 * decide without opening anything.
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({
  lastTrained, week, onPick, onJournal, onExercises, onLogout
}) => {
  const now = Date.now();
  // The day you have rested longest is usually the one to do, so it is the
  // one the screen leans on.
  const suggested = DAYS.reduce((longest, d) => {
    const a = lastTrained[d.day];
    const b = lastTrained[longest.day];
    if (!a) return d; // never trained wins outright
    if (!b) return longest;
    return a < b ? d : longest;
  }, DAYS[0]).day;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6">
      <header className="pt-[calc(env(safe-area-inset-top)+3rem)]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="display text-[30px] leading-tight">
              Good {partOfDay(now)}.
            </h1>
            <p className="mt-1.5 text-[14px] text-cream-400">{dateFormatter.format(now)}</p>
          </div>
          <button onClick={onLogout} className="btn-quiet -mr-3 -mt-2 px-3 text-[14px]">
            Lock
          </button>
        </div>

        <p className="mt-6 text-[15px] leading-relaxed text-cream-200">
          {week.sets === 0 ? (
            <>Nothing logged this week yet — pick a day and start it off.</>
          ) : (
            <>
              This week you have put in{' '}
              <span className="display text-[17px]">{week.sets} sets</span> over{' '}
              <span className="display text-[17px]">
                {week.days} {week.days === 1 ? 'day' : 'days'}
              </span>
              {week.volume > 0 && (
                <>
                  , moving{' '}
                  <span className="display text-[17px]">
                    {Math.round(week.volume / 1000)}k lbs
                  </span>
                </>
              )}
              .
            </>
          )}
        </p>
      </header>

      <nav className="flex flex-1 flex-col justify-end gap-3 pb-7 pt-6">
        {DAYS.map(({ day, title, muscles }) => {
          const last = lastTrained[day];
          const isSuggested = day === suggested;
          return (
            <button
              key={day}
              onClick={() => onPick(day)}
              className={`panel w-full px-5 py-6 text-left transition-colors active:bg-ink-800 ${
                isSuggested ? 'border-ember/35' : ''
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="display text-[27px] leading-none">{title}</span>
                  <span className="shrink-0 text-[14px] text-cream-400">
                    {last ? daysAgoLabel(last) : 'never'}
                  </span>
                </span>
                {/* The hint rides with the muscle list rather than stacking in
                    the right-hand column, where it squeezed the list onto two
                    lines. */}
                <span className="mt-2.5 block text-[14px] text-cream-400">
                  {muscles}
                  {isSuggested && <span className="text-ember"> · rested longest</span>}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <footer className="flex gap-2 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-[14px]">
        <button onClick={onJournal} className="btn-quiet px-4">
          Journal
        </button>
        <button onClick={onExercises} className="btn-quiet px-4">
          Exercises
        </button>
      </footer>
    </div>
  );
};
