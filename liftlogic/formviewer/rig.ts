import * as THREE from 'three';

/**
 * Procedural human figure. No external model files: every part is a primitive
 * (capsule limbs, box feet, sphere head) parented into a bone hierarchy so a
 * rotation on a parent joint carries the whole limb with it.
 *
 *   hips > spine > chest > neck > head
 *   chest > upperArm[LR] > forearm[LR] > hand[LR]
 *   hips  > thigh[LR]    > shin[LR]    > foot[LR]
 *
 * Rest pose is standing upright, arms hanging at the sides, palms inward.
 * The figure faces +Z, up is +Y, and its own left is +X.
 *
 * Every segment hangs along local -Y from its joint origin, which fixes the
 * sign of every angle in data/animations/*.json:
 *   rotation.x  POSITIVE swings the segment toward the figure's BACK (-Z).
 *               So knee flexion is +x, while hip and elbow flexion are -x,
 *               and an arm raised straight overhead through the front is -180.
 *   rotation.z  POSITIVE swings the segment toward +X (the figure's left).
 *               So abduction is +z on the left side and -z on the right.
 *   rotation.y  internal / external rotation about the segment's own axis.
 */

export type JointName =
  | 'root' | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'upperArmL' | 'forearmL' | 'handL'
  | 'upperArmR' | 'forearmR' | 'handR'
  | 'thighL' | 'shinL' | 'footL'
  | 'thighR' | 'shinR' | 'footR';

/** Muscle tags used by the "highlight target muscles" toggle. */
export type MuscleTag =
  | 'chest' | 'front-shoulders' | 'side-shoulders' | 'rear-shoulders'
  | 'back' | 'biceps' | 'triceps' | 'abs'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves';

// Segment lengths in metres for a ~1.75 m figure.
const L = {
  spine: 0.22, chest: 0.20, neck: 0.07, headR: 0.115,
  upperArm: 0.30, forearm: 0.26, hand: 0.09,
  thigh: 0.44, shin: 0.42, foot: 0.26,
  shoulderX: 0.19, hipX: 0.10, hipY: 0.92
};

const SKIN = 0x9aa7bd;
const SKIN_DARK = 0x7d8ba3;

export interface Rig {
  root: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  /** Anchor points arrows attach to; world position is read each frame. */
  anchors: Record<string, THREE.Object3D>;
  /** Meshes grouped by muscle so they can be tinted for the muscle toggle. */
  muscleMeshes: Record<MuscleTag, THREE.Mesh[]>;
  dispose: () => void;
}

const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

function mat(color: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 });
  disposables.push(m);
  return m;
}

/** A capsule of `len` hanging from the joint origin along -Y. */
function segment(len: number, radius: number, color = SKIN): THREE.Mesh {
  const cyl = Math.max(0.001, len - radius * 2);
  const geo = new THREE.CapsuleGeometry(radius, cyl, 6, 12);
  disposables.push(geo);
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  return mesh;
}

/** A joint group positioned at `y` (and optional x) relative to its parent. */
function joint(parent: THREE.Object3D, name: string, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function buildRig(): Rig {
  disposables.length = 0;

  const root = new THREE.Group();
  root.name = 'root';

  // --- torso -------------------------------------------------------------
  const hips = joint(root, 'hips', 0, L.hipY, 0);
  const pelvis = segment(0.16, 0.10, SKIN_DARK);
  pelvis.position.y = -0.02;
  hips.add(pelvis);

  // Spine and chest are drawn upward from the hips, so they use +Y offsets
  // for their children while the capsule itself is flipped.
  const spine = joint(hips, 'spine', 0, 0, 0);
  const spineMesh = segment(L.spine, 0.105);
  spineMesh.position.y = L.spine / 2;
  spine.add(spineMesh);

  const chest = joint(spine, 'chest', 0, L.spine, 0);
  const chestMesh = segment(L.chest, 0.125);
  chestMesh.position.y = L.chest / 2;
  chest.add(chestMesh);

  const neck = joint(chest, 'neck', 0, L.chest, 0);
  const neckMesh = segment(L.neck, 0.045);
  neckMesh.position.y = L.neck / 2;
  neck.add(neckMesh);

  const head = joint(neck, 'head', 0, L.neck, 0);
  const headGeo = new THREE.SphereGeometry(L.headR, 20, 16);
  disposables.push(headGeo);
  const headMesh = new THREE.Mesh(headGeo, mat(SKIN));
  headMesh.position.y = L.headR * 0.9;
  head.add(headMesh);

  // Nose marker so the figure's facing direction is unambiguous (+Z is front).
  const noseGeo = new THREE.SphereGeometry(0.028, 8, 8);
  disposables.push(noseGeo);
  const nose = new THREE.Mesh(noseGeo, mat(SKIN_DARK));
  nose.position.set(0, L.headR * 0.85, L.headR * 0.92);
  head.add(nose);

  // --- arms --------------------------------------------------------------
  const arms: Record<string, THREE.Group> = {};
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1; // figure faces +Z, so its left is +X
    const upper = joint(chest, `upperArm${side}`, sx * L.shoulderX, L.chest * 0.92, 0);
    upper.add(segment(L.upperArm, 0.058));

    const fore = joint(upper, `forearm${side}`, 0, -L.upperArm, 0);
    fore.add(segment(L.forearm, 0.048));

    const hand = joint(fore, `hand${side}`, 0, -L.forearm, 0);
    hand.add(segment(L.hand, 0.045, SKIN_DARK));

    arms[`upperArm${side}`] = upper;
    arms[`forearm${side}`] = fore;
    arms[`hand${side}`] = hand;
  }

  // --- legs --------------------------------------------------------------
  const legs: Record<string, THREE.Group> = {};
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const thigh = joint(hips, `thigh${side}`, sx * L.hipX, -0.06, 0);
    thigh.add(segment(L.thigh, 0.082));

    const shin = joint(thigh, `shin${side}`, 0, -L.thigh, 0);
    shin.add(segment(L.shin, 0.062));

    const foot = joint(shin, `foot${side}`, 0, -L.shin, 0);
    const footGeo = new THREE.BoxGeometry(0.10, 0.06, L.foot);
    disposables.push(footGeo);
    const footMesh = new THREE.Mesh(footGeo, mat(SKIN_DARK));
    // Foot sits below the ankle and points forward (+Z).
    footMesh.position.set(0, -0.03, L.foot * 0.28);
    foot.add(footMesh);

    legs[`thigh${side}`] = thigh;
    legs[`shin${side}`] = shin;
    legs[`foot${side}`] = foot;
  }

  const joints = {
    root, hips, spine, chest, neck, head,
    upperArmL: arms.upperArmL, forearmL: arms.forearmL, handL: arms.handL,
    upperArmR: arms.upperArmR, forearmR: arms.forearmR, handR: arms.handR,
    thighL: legs.thighL, shinL: legs.shinL, footL: legs.footL,
    thighR: legs.thighR, shinR: legs.shinR, footR: legs.footR
  } as Record<JointName, THREE.Object3D>;

  // Arrow anchors. Most map straight onto a joint; a few sit at a segment's
  // far end (elbow, knee, ankle) which is where a cue usually points from.
  const anchor = (parent: THREE.Object3D, name: string, y: number) => {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.y = y;
    parent.add(a);
    return a;
  };
  const anchors: Record<string, THREE.Object3D> = {
    hips: anchor(hips, 'a_hips', 0),
    chest: anchor(chest, 'a_chest', L.chest * 0.6),
    head: anchor(head, 'a_head', L.headR),
    shoulderL: anchor(arms.upperArmL, 'a_shoulderL', 0),
    shoulderR: anchor(arms.upperArmR, 'a_shoulderR', 0),
    elbowL: anchor(arms.forearmL, 'a_elbowL', 0),
    elbowR: anchor(arms.forearmR, 'a_elbowR', 0),
    handL: anchor(arms.handL, 'a_handL', -L.hand * 0.5),
    handR: anchor(arms.handR, 'a_handR', -L.hand * 0.5),
    kneeL: anchor(legs.shinL, 'a_kneeL', 0),
    kneeR: anchor(legs.shinR, 'a_kneeR', 0),
    footL: anchor(legs.footL, 'a_footL', 0),
    footR: anchor(legs.footR, 'a_footR', 0)
  };

  const muscleMeshes: Record<MuscleTag, THREE.Mesh[]> = {
    chest: [chestMesh],
    'front-shoulders': [arms.upperArmL.children[0] as THREE.Mesh, arms.upperArmR.children[0] as THREE.Mesh],
    'side-shoulders': [arms.upperArmL.children[0] as THREE.Mesh, arms.upperArmR.children[0] as THREE.Mesh],
    'rear-shoulders': [arms.upperArmL.children[0] as THREE.Mesh, arms.upperArmR.children[0] as THREE.Mesh],
    back: [chestMesh, spineMesh],
    biceps: [arms.upperArmL.children[0] as THREE.Mesh, arms.upperArmR.children[0] as THREE.Mesh],
    triceps: [arms.upperArmL.children[0] as THREE.Mesh, arms.upperArmR.children[0] as THREE.Mesh],
    abs: [spineMesh],
    quads: [legs.thighL.children[0] as THREE.Mesh, legs.thighR.children[0] as THREE.Mesh],
    hamstrings: [legs.thighL.children[0] as THREE.Mesh, legs.thighR.children[0] as THREE.Mesh],
    glutes: [pelvis],
    calves: [legs.shinL.children[0] as THREE.Mesh, legs.shinR.children[0] as THREE.Mesh]
  };

  const owned = [...disposables];
  return {
    root, joints, anchors, muscleMeshes,
    dispose: () => owned.forEach(d => d.dispose())
  };
}

/** Segment lengths, exported so equipment can be sized against the figure. */
export const RIG_DIMENSIONS = L;
