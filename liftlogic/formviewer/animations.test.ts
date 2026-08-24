import { describe, it, expect } from 'vitest';
import { AVAILABLE_ANIMATION_IDS, hasAnimation, loadAnimation } from './loader';
import type { AnimationFile, Keyframe } from './types';

/**
 * Guards the hand-edited files in data/animations/. These numbers are meant to
 * be tweaked by hand when a rep looks wrong, so a typo needs to fail here
 * rather than at 6am in a gym.
 */

const JOINTS = new Set([
  'root','hips','spine','chest','neck','head',
  'upperArmL','forearmL','handL','upperArmR','forearmR','handR',
  'thighL','shinL','footL','thighR','shinR','footR'
]);
const ANCHORS = new Set([
  'hips','chest','head','shoulderL','shoulderR','elbowL','elbowR',
  'handL','handR','kneeL','kneeR','footL','footR'
]);
const PHASES = new Set(['start','mid','bottom','lockout']);
const EQUIPMENT = new Set([
  'none','barbell','dumbbells','bench-flat','bench-incline','cable-high','cable-low',
  'cable-crossover','smith-machine','machine-seated','machine-lateral','machine-crunch',
  'hack-squat','leg-extension','ham-curl-seated','calf-seated','pullup-bar'
]);

// Vague cues the viewer is explicitly meant to avoid, and jargon that should
// be said in plain words instead.
const BANNED_CUES = ['elbows in', 'chest up', 'brace', 'tuck'];
const JARGON = ['scapula', 'acetabul', 'glenohum', 'latissimus', 'gastrocnem'];

const ids = [...AVAILABLE_ANIMATION_IDS].sort();

const checkKeyframes = (frames: Keyframe[], label: string) => {
  expect(frames.length, `${label}: needs at least 3 keyframes`).toBeGreaterThanOrEqual(3);
  const ts = frames.map(f => f.t);
  expect(ts, `${label}: keyframe t values must ascend`).toEqual([...ts].sort((a, b) => a - b));
  for (const f of frames) {
    expect(PHASES.has(f.phase), `${label}: bad phase ${f.phase}`).toBe(true);
    expect(f.t, `${label}: t out of range`).toBeGreaterThanOrEqual(0);
    expect(f.t, `${label}: t out of range`).toBeLessThanOrEqual(1);
    expect(f.note?.length, `${label}: every keyframe needs a note`).toBeGreaterThan(0);
    for (const [joint, angles] of Object.entries(f.joints)) {
      expect(JOINTS.has(joint), `${label}: unknown joint "${joint}"`).toBe(true);
      expect(angles, `${label}: ${joint} must be [x,y,z]`).toHaveLength(3);
      for (const a of angles as number[]) {
        expect(Number.isFinite(a), `${label}: ${joint} has a non-numeric angle`).toBe(true);
        expect(Math.abs(a), `${label}: ${joint} angle ${a} is beyond +/-360`).toBeLessThanOrEqual(360);
      }
    }
  }
};

describe('animation files', () => {
  it('discovers every committed form model', () => {
    expect(ids.length).toBeGreaterThan(0);
    expect(hasAnimation(ids[0])).toBe(true);
    expect(hasAnimation('definitely-not-an-exercise')).toBe(false);
  });

  it('rejects a request for an exercise with no model', async () => {
    await expect(loadAnimation('definitely-not-an-exercise')).rejects.toThrow();
  });

  it.each(ids)('%s is well formed', async (id) => {
    const a: AnimationFile = await loadAnimation(id);

    // Keyed on the primary key, so renaming an exercise cannot orphan its model.
    expect(a.exerciseId).toBe(id);
    expect(a.displayName?.length).toBeGreaterThan(0);
    expect(a.resolvedAs?.length).toBeGreaterThan(0);
    expect(EQUIPMENT.has(a.equipment), `bad equipment "${a.equipment}"`).toBe(true);
    expect(['front', 'side', '45']).toContain(a.defaultCamera);
    expect(a.targetMuscles.length).toBeGreaterThan(0);
    expect(a.loopSeconds).toBeGreaterThan(0);

    checkKeyframes(a.keyframes, `${id} main`);
    checkKeyframes(a.mistake.keyframes, `${id} mistake`);

    // Never more than three arrows on screen at once.
    expect(a.arrows.length, `${id}: more than 3 arrows`).toBeLessThanOrEqual(3);
    expect(a.arrows.length).toBeGreaterThan(0);

    for (const arrow of a.arrows) {
      expect(ANCHORS.has(arrow.anchor), `${id}: bad anchor "${arrow.anchor}"`).toBe(true);
      expect(arrow.phases.length, `${id}: ${arrow.id} is never visible`).toBeGreaterThan(0);
      for (const p of arrow.phases) expect(PHASES.has(p), `${id}: bad phase ${p}`).toBe(true);
      // A zero vector would leave the arrow pointing nowhere.
      const mag = Math.hypot(...arrow.dir);
      expect(mag, `${id}: ${arrow.id} has no direction`).toBeGreaterThan(0);

      const cue = arrow.cue.toLowerCase();
      for (const banned of BANNED_CUES) {
        expect(cue.includes(banned), `${id}: cue uses banned phrase "${banned}"`).toBe(false);
      }
      for (const word of JARGON) {
        expect(cue.includes(word), `${id}: cue uses jargon "${word}"`).toBe(false);
      }
      // Every cue names a body part and where it goes, so it is never a
      // one-word instruction.
      expect(arrow.cue.split(/\s+/).length, `${id}: cue "${arrow.cue}" is too terse`).toBeGreaterThan(6);
    }

    expect(a.mistake.label.length).toBeGreaterThan(0);
    expect(a.mistake.cue.length).toBeGreaterThan(20);
    expect(a.mistake.failJoints.length, `${id}: mistake marks no joint`).toBeGreaterThan(0);
    for (const j of a.mistake.failJoints) {
      expect(JOINTS.has(j), `${id}: mistake names unknown joint "${j}"`).toBe(true);
    }
  });
});
