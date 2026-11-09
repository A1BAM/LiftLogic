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
  <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5">
    <header className="flex items-start justify-between pt-[calc(env(safe-area-inset-top)+2.5rem)]">
      <div>
        <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-white">LiftLogic</h1>
        <p className="mt-1 text-[14px] text-zinc-400">{todayFormatter.format(Date.now())}</p>
      </div>
      <button onClick={onLogout} className="btn-quiet -mr-3 px-3 text-[14px]">
        Lock
      </button>
    </header>

    <nav className="flex flex-1 flex-col justify-end gap-3 pb-6 pt-10">
      {DAYS.map(({ day, title, muscles }) => {
        const last = lastTrained[day];
        return (
          <button
            key={day}
            onClick={() => onPick(day)}
            className="panel flex w-full items-center justify-between gap-4 px-5 py-5 text-left
                       transition-colors active:bg-ink-800"
          >
            <span className="min-w-0">
              <span className="block text-[28px] font-semibold leading-none tracking-[-0.02em] text-white">
                {title}
              </span>
              <span className="mt-2 block text-[14px] text-zinc-400">{muscles}</span>
            </span>
            <span className="shrink-0 text-[14px] text-zinc-400">
              {last ? daysAgoLabel(last) : 'never'}
            </span>
          </button>
        );
      })}
    </nav>

    {/* The week so far. Small, but it is the one thing worth knowing before
        picking a day. */}
    <p className="nums text-[14px] text-zinc-400">
      {week.sets === 0 ? (
        'Nothing logged this week yet.'
      ) : (
        <>
          This week <span className="font-semibold text-white">{week.sets} sets</span> over{' '}
          <span className="font-semibold text-white">
            {week.days} {week.days === 1 ? 'day' : 'days'}
          </span>
          {week.volume > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-white">{Math.round(week.volume / 1000)}k lbs</span>{' '}
              moved
            </>
          )}
        </>
      )}
    </p>

    <footer className="flex gap-2 pt-3 text-[14px] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <button onClick={onJournal} className="btn-quiet px-4">
        Journal
      </button>
      <button onClick={onExercises} className="btn-quiet px-4">
        Exercises
      </button>
    </footer>
  </div>
);
