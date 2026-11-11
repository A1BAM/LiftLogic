import { describe, it, expect, beforeEach } from 'vitest';
import { loadResume, saveResume } from './resume';

const NOW = 1_800_000_000_000;
const MIN = 60_000;

describe('resume', () => {
  beforeEach(() => localStorage.clear());

  it('starts clean when nothing was saved', () => {
    expect(loadResume(NOW)).toEqual({ day: null, restEndTime: null, signedIn: false });
  });

  it('brings back the workout and a rest timer that is still running', () => {
    saveResume({ day: 'PUSH', restEndTime: NOW + 90_000, signedIn: true }, NOW);
    // Safari reloads the page 40 seconds later.
    expect(loadResume(NOW + 40_000)).toEqual({ day: 'PUSH', restEndTime: NOW + 90_000, signedIn: true });
  });

  it('drops a rest that ran out while the page was gone, but keeps the workout', () => {
    saveResume({ day: 'PULL', restEndTime: NOW + 90_000, signedIn: true }, NOW);
    expect(loadResume(NOW + 5 * MIN)).toMatchObject({ day: 'PULL', restEndTime: null });
  });

  it('lands on the home screen once the workout is hours old', () => {
    saveResume({ day: 'PUSH', restEndTime: null, signedIn: true }, NOW);
    expect(loadResume(NOW + 5 * 60 * MIN)).toMatchObject({ day: null, signedIn: true });
  });

  it('ignores a corrupt or unexpected entry', () => {
    localStorage.setItem('liftlogic_resume', '{not json');
    expect(loadResume(NOW).day).toBeNull();
    localStorage.setItem('liftlogic_resume', JSON.stringify({ day: 'ARMS', savedAt: NOW, restEndTime: 'soon' }));
    expect(loadResume(NOW)).toEqual({ day: null, restEndTime: null, signedIn: false });
  });
});
