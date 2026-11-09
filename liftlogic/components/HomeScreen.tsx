import React from 'react';
import { DayType } from '../types';
import { daysAgoLabel } from '../utils/date';
import { Bubbles } from './Bubbles';

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

const DAYS: Array<{ day: DayType; title: string; muscles: string; tint: string }> = [
  { day: 'PUSH', title: 'Push', muscles: 'Chest · Shoulders · Triceps', tint: 'from-aero-300/80 to-aero-500/70' },
  { day: 'PULL', title: 'Pull', muscles: 'Back · Biceps', tint: 'from-leaf-300/80 to-leaf-500/70' },
  { day: 'LEGS', title: 'Legs', muscles: 'Quads · Hamstrings · Calves', tint: 'from-aero-200/90 to-leaf-400/70' }
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
  <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5">
    <Bubbles />

    <header className="relative flex items-start justify-between pt-[calc(env(safe-area-inset-top)+2.75rem)]">
      <div>
        <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-aero-900">LiftLogic</h1>
        <p className="mt-0.5 text-[14px] text-aero-700">{todayFormatter.format(Date.now())}</p>
      </div>
      <button onClick={onLogout} className="btn-quiet px-3 py-1.5 text-[14px]">
        Lock
      </button>
    </header>

    <nav className="relative flex flex-1 flex-col justify-end gap-3 pb-5 pt-10">
      {DAYS.map(({ day, title, muscles, tint }) => {
        const last = lastTrained[day];
        return (
          <button
            key={day}
            onClick={() => onPick(day)}
            className="glass relative flex w-full items-center justify-between gap-4 overflow-hidden
                       px-5 py-5 text-left transition-transform active:translate-y-px"
          >
            {/* A wash of colour down one side, so the three days are tellable
                apart at a glance without three different cards. */}
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${tint}`}
            />
            <span className="min-w-0">
              <span className="block text-[27px] font-semibold leading-none tracking-[-0.02em] text-aero-900">
                {title}
              </span>
              <span className="mt-1.5 block text-[14px] text-aero-700">{muscles}</span>
            </span>
            <span className="shrink-0 rounded-full border border-white/70 bg-white/60 px-3 py-1 text-[13px] text-aero-700">
              {last ? daysAgoLabel(last) : 'never'}
            </span>
          </button>
        );
      })}
    </nav>

    {/* The week so far. Small, but it is the one thing worth knowing before
        picking a day. */}
    <p className="nums relative text-[14px] text-aero-700">
      {week.sets === 0 ? (
        'Nothing logged this week yet.'
      ) : (
        <>
          This week <span className="font-semibold text-aero-800">{week.sets} sets</span> over{' '}
          <span className="font-semibold text-aero-800">
            {week.days} {week.days === 1 ? 'day' : 'days'}
          </span>
          {week.volume > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-aero-800">{Math.round(week.volume / 1000)}k lbs</span>{' '}
              moved
            </>
          )}
        </>
      )}
    </p>

    <footer className="relative flex gap-3 pt-4 text-[14px] pb-[calc(env(safe-area-inset-bottom)+1.75rem)]">
      <button onClick={onJournal} className="btn-quiet border-white/70 bg-white/55 px-4 py-2">
        Journal
      </button>
      <button onClick={onExercises} className="btn-quiet border-white/70 bg-white/55 px-4 py-2">
        Exercises
      </button>
    </footer>
  </div>
);
