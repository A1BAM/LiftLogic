import type { JointName, MuscleTag } from './rig';

/**
 * Shape of every file in data/animations/. One file per exercise, named after
 * the exercise's primary key (the `id` inside the __DEFINITION__ row's JSON),
 * never the display name.
 *
 * All joint values are EULER ANGLES IN DEGREES, ordered [x, y, z]:
 *   x = flexion / extension   (+x swings a limb forward)
 *   y = internal / external rotation
 *   z = abduction / adduction (+z swings a limb away from the midline)
 * A joint left out of a keyframe holds its rest-pose angle.
 */

export type Phase = 'start' | 'mid' | 'bottom' | 'lockout';

export type AnchorName =
  | 'hips' | 'chest' | 'head'
  | 'shoulderL' | 'shoulderR' | 'elbowL' | 'elbowR' | 'handL' | 'handR'
  | 'kneeL' | 'kneeR' | 'footL' | 'footR';

export type EquipmentKind =
  | 'none'
  | 'barbell'
  | 'dumbbells'
  | 'bench-flat'
  | 'bench-incline'
  | 'cable-high'
  | 'cable-low'
  | 'cable-crossover'
  | 'smith-machine'
  | 'machine-seated'
  | 'machine-lateral'
  | 'machine-crunch'
  | 'hack-squat'
  | 'leg-extension'
  | 'ham-curl-seated'
  | 'calf-seated'
  | 'pullup-bar';

export interface Keyframe {
  /** Which point in the rep this is. */
  phase: Phase;
  /** Position in the loop, 0..1. Keyframes must be sorted ascending. */
  t: number;
  /** Plain-language description of the position, for whoever edits this file. */
  note: string;
  /** Joint angles in degrees. Omitted joints hold the rest pose. */
  joints: Partial<Record<JointName, [number, number, number]>>;
  /** Moves the whole figure in metres, e.g. the descent of a squat. */
  rootOffset?: [number, number, number];
  /**
   * Rotates the whole figure in degrees. Used to lie it on a bench
   * ([-90,0,0] = flat on its back) or recline it ([-60,0,0] = 30 degree
   * incline). Held constant across a lift's keyframes unless it should move.
   */
  rootRotation?: [number, number, number];
}

export interface ArrowSpec {
  id: string;
  /** Joint the arrow is attached to; it tracks that joint as the figure moves. */
  anchor: AnchorName;
  /**
   * Direction the body part should TRAVEL or PRESS, in figure-local space:
   * +x is the figure's left, +y is up, +z is the direction it faces.
   */
  dir: [number, number, number];
  /** Only drawn during these phases; fades out elsewhere. */
  phases: Phase[];
  /** Names a body part AND a physical reference point. Floats beside the arrow. */
  cue: string;
  /** Metres. Defaults to 0.28. */
  length?: number;
  color?: string;
}

export interface MistakeSpec {
  /** Short label for the toggle, e.g. "Knees caving inward". */
  label: string;
  /** Why it is wrong and what to do instead, same cue rules as ArrowSpec. */
  cue: string;
  /** Joints tinted red while the mistake plays. */
  failJoints: JointName[];
  /** The wrong version of the rep. Same format as the correct keyframes. */
  keyframes: Keyframe[];
}

export interface AnimationFile {
  /** Primary key from the exercises data. Must match the filename. */
  exerciseId: string;
  /** Name as it appears in the log. */
  displayName: string;
  /** Which specific movement this was interpreted as. */
  resolvedAs: string;
  equipment: EquipmentKind;
  /** Side view is the default for most lifts: that is where form breaks show. */
  defaultCamera: 'front' | 'side' | '45';
  targetMuscles: MuscleTag[];
  /** How the hands are shaped. Defaults to 'grip'; most lifts hold something. */
  handPose?: 'grip' | 'open' | 'fist';
  /** Seconds for one full loop of the rep. */
  loopSeconds: number;
  keyframes: Keyframe[];
  arrows: ArrowSpec[];
  mistake: MistakeSpec;
}
