import React from 'react';
import { DayType } from '../types';
import { daysAgoLabel } from '../utils/date';

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

const todayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric'
});

/**
 * Pick a day. The only thing worth adding beyond the three names is when each
 * was last trained — it is what you are actually deciding on, and it makes the
 * longest-rested day obvious without a chart.
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({
  lastTrained, week, onPick, onJournal, onExercises, onLogout
}) => (
  <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6">
    <header className="flex items-start justify-between pt-12">
      <div>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-100">LiftLogic</h1>
        <p className="mt-1 text-[13px] text-zinc-600">{todayFormatter.format(Date.now())}</p>
      </div>
      <button onClick={onLogout} className="btn-quiet -mr-2 px-2 py-1 text-[13px]">
        Lock
      </button>
    </header>

    <nav className="flex flex-1 flex-col justify-end pb-6 pt-16">
      {DAYS.map(({ day, title, muscles }) => {
        const last = lastTrained[day];
        return (
          <button
            key={day}
            onClick={() => onPick(day)}
            className="group flex w-full items-baseline justify-between gap-4 border-b border-ink-700 py-5 text-left
                       first:border-t first:border-ink-700 active:bg-ink-900 transition-colors"
          >
            <span className="min-w-0">
              <span className="block text-[30px] font-medium leading-none tracking-[-0.02em] text-zinc-50">
                {title}
              </span>
              <span className="mt-2 block text-[13px] text-zinc-600">{muscles}</span>
            </span>
            <span className="shrink-0 text-[12px] text-zinc-600">
              {last ? daysAgoLabel(last) : 'never'}
            </span>
          </button>
        );
      })}
    </nav>

    {/* The week so far. Small, but it is the one thing worth knowing before
        picking a day. */}
    <p className="nums text-[13px] text-zinc-600">
      {week.sets === 0 ? (
        'Nothing logged this week yet.'
      ) : (
        <>
          This week <span className="text-zinc-400">{week.sets} sets</span> over{' '}
          <span className="text-zinc-400">{week.days} {week.days === 1 ? 'day' : 'days'}</span>
          {week.volume > 0 && (
            <>
              {' · '}
              <span className="text-zinc-400">{Math.round(week.volume / 1000)}k lbs</span> moved
            </>
          )}
        </>
      )}
    </p>

    <footer className="flex gap-6 pb-8 pt-5 text-[13px]">
      <button onClick={onJournal} className="btn-quiet px-0 py-1">
        Journal
      </button>
      <button onClick={onExercises} className="btn-quiet px-0 py-1">
        Exercises
      </button>
    </footer>
  </div>
);
