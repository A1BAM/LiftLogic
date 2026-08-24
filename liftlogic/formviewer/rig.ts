import * as THREE from 'three';
import {
  latheLimb, belly, roundedBox, offset, loft,
  SKIN, SKIN_SHADE, HAIR, SHORTS, SHOE, SHOE_SOLE
} from './anatomy';

/**
 * Procedural human figure. No external model files: every part is generated
 * from primitives and assembled into a bone hierarchy, so a rotation on a
 * parent joint carries the whole limb with it.
 *
 *   hips > spine > chest > neck > head
 *   chest > upperArm[LR] > forearm[LR] > hand[LR] > finger segments
 *   hips  > thigh[LR]    > shin[LR]    > foot[LR]
 *
 * Limbs are lathe-turned from a profile so they taper and swell like real
 * limbs, with ellipsoid muscle bellies (deltoid, biceps, triceps, forearm
 * extensors, quads, hamstrings, calves) laid over the top. That detail is the
 * point of the viewer: on a triceps pushdown you need to see the back of the
 * upper arm change shape as the elbow opens.
 *
 * Rest pose is standing upright, arms hanging at the sides.
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

export type MuscleTag =
  | 'chest' | 'front-shoulders' | 'side-shoulders' | 'rear-shoulders'
  | 'back' | 'biceps' | 'triceps' | 'abs'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves';

/** How tightly the fingers curl. Most lifts hold something. */
export type HandPose = 'grip' | 'open' | 'fist';

const L = {
  spine: 0.22, chest: 0.21, neck: 0.08, headR: 0.105,
  upperArm: 0.30, forearm: 0.26, palm: 0.10,
  thigh: 0.45, shin: 0.42, foot: 0.27,
  shoulderX: 0.168, hipX: 0.10, hipY: 0.92
};

export interface Rig {
  root: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  anchors: Record<string, THREE.Object3D>;
  muscleMeshes: Record<MuscleTag, THREE.Mesh[]>;
  setHandPose: (pose: HandPose) => void;
  dispose: () => void;
}

export function buildRig(): Rig {
  const owned: Array<THREE.BufferGeometry | THREE.Material> = [];
  const G = <T extends THREE.BufferGeometry>(g: T): T => { owned.push(g); return g; };
  const M = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...extra });
    owned.push(m);
    return m;
  };

  const skin = M(SKIN);
  const skinShade = M(SKIN_SHADE);
  const hairMat = M(HAIR, { roughness: 0.85 });
  const shortsMat = M(SHORTS, { roughness: 0.9 });
  const shoeMat = M(SHOE, { roughness: 0.8 });
  const soleMat = M(SHOE_SOLE, { roughness: 0.7 });

  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const me = new THREE.Mesh(G(g), m);
    me.castShadow = true;
    me.receiveShadow = true;
    return me;
  };

  const joint = (parent: THREE.Object3D, name: string, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const root = new THREE.Group();
  root.name = 'root';

  // ── pelvis and torso ───────────────────────────────────────────────────
  const hips = joint(root, 'hips', 0, L.hipY, 0);
  const pelvis = mesh(loft([
    { y: 0.055, w: 0.126, d: 0.098 },
    { y: -0.01, w: 0.143, d: 0.114, z: -0.014 },
    { y: -0.07, w: 0.142, d: 0.122, z: -0.026 },
    { y: -0.13, w: 0.133, d: 0.110, z: -0.018 },
    { y: -0.18, w: 0.122, d: 0.094, z: -0.004 }
  ], 24, 20), shortsMat);
  hips.add(pelvis);
  const glutes = pelvis; // shape comes from the pelvis loft's rearward sections

  const spine = joint(hips, 'spine', 0, 0, 0);
  // Abdomen and lower back as a single lofted form: widest at the base of the
  // ribs, pinched at the waist. Muscle relief is a gentle change of section,
  // not a ball stuck on the front.
  const waist = mesh(loft([
    { y: -0.02, w: 0.126, d: 0.100 },
    { y: 0.06, w: 0.110, d: 0.091 },
    { y: 0.14, w: 0.116, d: 0.097 },
    { y: L.spine + 0.03, w: 0.141, d: 0.107 }
  ], 28, 34), skin);
  spine.add(waist);
  // Faint abdominal segmentation, sunk mostly inside the silhouette so it
  // reads as relief rather than as beads on a string.
  const absMeshes: THREE.Mesh[] = [];
  for (let row = 0; row < 3; row++) {
    for (const sx of [-1, 1]) {
      const ab = mesh(
        offset(belly(0.028, 0.020, 0.008, 12), sx * 0.029, 0.058 + row * 0.048, 0.082),
        skin
      );
      spine.add(ab);
      absMeshes.push(ab);
    }
  }

  const chest = joint(spine, 'chest', 0, L.spine, 0);
  // Ribcage: broad across, shallow front to back, tapering into the shoulders.
  const ribcage = mesh(loft([
    { y: 0.00, w: 0.140, d: 0.106 },
    { y: 0.05, w: 0.163, d: 0.117 },
    { y: 0.11, w: 0.172, d: 0.119 },
    { y: 0.17, w: 0.164, d: 0.110 },
    { y: L.chest, w: 0.140, d: 0.094 }
  ], 28, 34), skin);
  chest.add(ribcage);
  // Pectorals: wide and flat, tucked against the ribcage surface.
  const pecL = mesh(offset(belly(0.062, 0.034, 0.013, 18), 0.050, L.chest * 0.62, 0.078), skin);
  const pecR = mesh(offset(belly(0.062, 0.034, 0.013, 18), -0.050, L.chest * 0.62, 0.078), skin);
  chest.add(pecL, pecR);
  // The lat flare is carried by the ribcage loft's own section, so there is no
  // separate lat mesh to read as a lump. These stay as tint targets only.
  const latL = ribcage;
  const latR = ribcage;
  // Trapezius sloping from the neck out to the shoulders.
  const traps = mesh(offset(belly(0.118, 0.034, 0.050, 18), 0, L.chest * 0.93, -0.026), skin);
  chest.add(traps);

  const neck = joint(chest, 'neck', 0, L.chest, 0);
  const neckMesh = mesh(loft([
    { y: 0.00, w: 0.062, d: 0.060, z: -0.006 },
    { y: 0.04, w: 0.052, d: 0.052, z: -0.002 },
    { y: L.neck + 0.02, w: 0.049, d: 0.050, z: 0.004 }
  ], 18, 12), skin);
  neck.add(neckMesh);

  // ── head ───────────────────────────────────────────────────────────────
  const head = joint(neck, 'head', 0, L.neck, 0);
  const cranium = mesh(loft([
    { y: 0.015, w: 0.052, d: 0.058, z: 0.006 },
    { y: 0.055, w: 0.072, d: 0.082, z: 0.010 },
    { y: 0.105, w: 0.086, d: 0.098, z: 0.004 },
    { y: 0.165, w: 0.092, d: 0.100, z: -0.004 },
    { y: 0.215, w: 0.080, d: 0.086, z: -0.010 },
    { y: 0.245, w: 0.045, d: 0.048, z: -0.012 }
  ], 24, 22), skin);
  head.add(cranium);
  const brow = mesh(offset(belly(0.070, 0.014, 0.022, 14), 0, 0.152, 0.082), skinShade);
  head.add(brow);
  const nose = mesh(offset(belly(0.018, 0.030, 0.026, 12), 0, 0.120, 0.098), skin);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const eye = mesh(offset(belly(0.014, 0.011, 0.008, 12), sx * 0.034, 0.138, 0.084), M(0x2a2622));
    head.add(eye);
    const ear = mesh(offset(belly(0.010, 0.026, 0.019, 12), sx * 0.090, 0.135, -0.004), skin);
    head.add(ear);
  }
  // Hair as a close cap over the back and top of the skull only.
  const hair = mesh(loft([
    { y: 0.115, w: 0.090, d: 0.101, z: -0.016 },
    { y: 0.170, w: 0.095, d: 0.103, z: -0.010 },
    { y: 0.222, w: 0.082, d: 0.088, z: -0.014 },
    { y: 0.248, w: 0.046, d: 0.050, z: -0.016 }
  ], 22, 14), hairMat);
  head.add(hair);

  // ── arms ───────────────────────────────────────────────────────────────
  const arms: Record<string, THREE.Group> = {};
  const delts: THREE.Mesh[] = [];
  const bis: THREE.Mesh[] = [];
  const tris: THREE.Mesh[] = [];
  const fingerJoints: THREE.Object3D[] = [];

  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const upper = joint(chest, `upperArm${side}`, sx * L.shoulderX, L.chest * 0.80, 0);

    // Upper arm: thick at the shoulder, narrowing into the elbow.
    upper.add(mesh(loft([
      { y: 0.00, w: 0.050, d: 0.054 },
      { y: -0.05, w: 0.052, d: 0.060, z: -0.004 },
      { y: -0.14, w: 0.047, d: 0.056, z: -0.006 },
      { y: -0.23, w: 0.039, d: 0.043, z: -0.002 },
      { y: -L.upperArm, w: 0.034, d: 0.036 }
    ], 22, 20), skin));

    // Deltoid cap over the shoulder joint.
    const delt = mesh(offset(belly(0.062, 0.078, 0.062, 20), -sx * 0.006, -0.030, -0.002), skin);
    upper.add(delt); delts.push(delt);

    // Biceps on the front, triceps larger on the back. On a pushdown the
    // triceps is the thing being watched, so it gets a distinct long head
    // running down the back of the arm plus a lateral head near the shoulder.
    const bi = mesh(offset(belly(0.030, 0.066, 0.024, 16), 0, -0.118, 0.030), skin);
    upper.add(bi); bis.push(bi);

    const triLong = mesh(offset(belly(0.034, 0.088, 0.030, 16), -sx * 0.006, -0.128, -0.034), skin);
    const triLat = mesh(offset(belly(0.024, 0.050, 0.022, 14), sx * 0.026, -0.086, -0.028), skin);
    upper.add(triLong, triLat); tris.push(triLong, triLat);

    // Elbow.
    const elbow = mesh(belly(0.032, 0.028, 0.033, 14), skinShade);
    elbow.position.y = -L.upperArm;
    upper.add(elbow);

    const fore = joint(upper, `forearm${side}`, 0, -L.upperArm, 0);
    // Forearm: broad just below the elbow, tapering hard into the wrist.
    fore.add(mesh(loft([
      { y: 0.00, w: 0.038, d: 0.040 },
      { y: -0.05, w: 0.045, d: 0.046, z: 0.004 },
      { y: -0.12, w: 0.039, d: 0.040 },
      { y: -0.20, w: 0.029, d: 0.032 },
      { y: -L.forearm, w: 0.024, d: 0.029 }
    ], 22, 20), skin));
    // Extensor mass on the outside of the upper forearm.
    fore.add(mesh(offset(belly(0.020, 0.046, 0.018, 14), sx * 0.020, -0.072, 0.016), skin));

    // ── hand: palm, four fingers of three segments, opposed thumb ────────
    const hand = joint(fore, `hand${side}`, 0, -L.forearm, 0);
    hand.add(mesh(offset(roundedBox(0.078, 0.092, 0.036, 0.5), 0, -0.046, 0), skin));
    // Heel of the thumb.
    hand.add(mesh(offset(belly(0.022, 0.03, 0.018, 12), sx * 0.028, -0.038, 0.008), skin));

    const fingerLen = [0.030, 0.026, 0.021];
    for (let f = 0; f < 4; f++) {
      // Index nearest the thumb, little finger furthest out.
      const spread = (f - 1.5) * 0.021;
      const scale = f === 3 ? 0.82 : f === 0 ? 0.95 : 1;
      let parent: THREE.Object3D = hand;
      let originY = -0.092;
      for (let seg = 0; seg < 3; seg++) {
        const j = joint(parent, `f${side}${f}${seg}`, seg === 0 ? -sx * spread : 0, originY, 0);
        const len = fingerLen[seg] * scale;
        j.add(mesh(latheLimb(len, [
          { t: 0, r: 0.0115 * scale }, { t: 0.6, r: 0.0105 * scale }, { t: 1, r: 0.0095 * scale }
        ], 10, 8), skin));
        fingerJoints.push(j);
        parent = j;
        originY = -len;
      }
    }
    // Thumb: rooted at the side of the palm and rotated across it.
    let thumbParent: THREE.Object3D = hand;
    let thumbY = -0.03;
    for (let seg = 0; seg < 2; seg++) {
      const j = joint(thumbParent, `t${side}${seg}`, seg === 0 ? sx * 0.036 : 0, thumbY, seg === 0 ? 0.012 : 0);
      if (seg === 0) j.rotation.z = sx * 0.55;
      const len = seg === 0 ? 0.030 : 0.024;
      j.add(mesh(latheLimb(len, [{ t: 0, r: 0.0135 }, { t: 1, r: 0.0105 }], 10, 8), skin));
      fingerJoints.push(j);
      thumbParent = j;
      thumbY = -len;
    }

    arms[`upperArm${side}`] = upper;
    arms[`forearm${side}`] = fore;
    arms[`hand${side}`] = hand;
  }

  // ── legs ───────────────────────────────────────────────────────────────
  const legs: Record<string, THREE.Group> = {};
  const quads: THREE.Mesh[] = [];
  const hams: THREE.Mesh[] = [];
  const calves: THREE.Mesh[] = [];

  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const thigh = joint(hips, `thigh${side}`, sx * L.hipX, -0.055, 0);
    thigh.add(mesh(loft([
      { y: 0.00, w: 0.084, d: 0.088 },
      { y: -0.10, w: 0.082, d: 0.090, z: 0.004 },
      { y: -0.24, w: 0.070, d: 0.078 },
      { y: -0.38, w: 0.056, d: 0.060 },
      { y: -L.thigh, w: 0.050, d: 0.052 }
    ], 22, 22), skin));
    const quad = mesh(offset(belly(0.044, 0.130, 0.022, 16), 0, -0.20, 0.056), skin);
    const ham = mesh(offset(belly(0.040, 0.115, 0.020, 16), 0, -0.17, -0.058), skin);
    thigh.add(quad, ham); quads.push(quad); hams.push(ham);
    // Shorts covering the top of the thigh.
    thigh.add(mesh(offset(belly(0.098, 0.115, 0.095, 18), 0, -0.075, 0), shortsMat));

    const knee = mesh(offset(belly(0.045, 0.036, 0.044, 14), 0, 0.004, 0.006), skin);
    knee.position.y = -L.thigh;
    thigh.add(knee);

    const shin = joint(thigh, `shin${side}`, 0, -L.thigh, 0);
    shin.add(mesh(loft([
      { y: 0.00, w: 0.048, d: 0.050 },
      { y: -0.08, w: 0.050, d: 0.058, z: -0.008 },
      { y: -0.20, w: 0.040, d: 0.046, z: -0.006 },
      { y: -0.34, w: 0.028, d: 0.032 },
      { y: -L.shin, w: 0.026, d: 0.030 }
    ], 22, 22), skin));
    const calf = mesh(offset(belly(0.038, 0.078, 0.028, 16), 0, -0.112, -0.040), skin);
    shin.add(calf); calves.push(calf);

    const foot = joint(shin, `foot${side}`, 0, -L.shin, 0);
    foot.add(mesh(loft([
      { y: 0.010, w: 0.046, d: 0.050, z: -0.030 },
      { y: -0.018, w: 0.052, d: 0.090, z: 0.020 },
      { y: -0.044, w: 0.050, d: 0.115, z: 0.048 },
      { y: -0.060, w: 0.042, d: 0.100, z: 0.055 }
    ], 20, 18), shoeMat));
    foot.add(mesh(offset(roundedBox(0.106, 0.022, L.foot * 0.94, 0.3), 0, -0.070, L.foot * 0.20), soleMat));
    // Ankle collar so the shoe meets the leg cleanly.
    foot.add(mesh(offset(belly(0.045, 0.038, 0.045, 14), 0, -0.006, -0.012), shoeMat));

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

  const anchor = (parent: THREE.Object3D, name: string, y: number, z = 0) => {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(0, y, z);
    parent.add(a);
    return a;
  };
  const anchors: Record<string, THREE.Object3D> = {
    hips: anchor(hips, 'a_hips', 0),
    chest: anchor(chest, 'a_chest', L.chest * 0.6, 0.1),
    head: anchor(head, 'a_head', L.headR * 1.9),
    shoulderL: anchor(arms.upperArmL, 'a_shoulderL', -0.02),
    shoulderR: anchor(arms.upperArmR, 'a_shoulderR', -0.02),
    elbowL: anchor(arms.forearmL, 'a_elbowL', 0),
    elbowR: anchor(arms.forearmR, 'a_elbowR', 0),
    handL: anchor(arms.handL, 'a_handL', -0.05),
    handR: anchor(arms.handR, 'a_handR', -0.05),
    kneeL: anchor(legs.shinL, 'a_kneeL', 0),
    kneeR: anchor(legs.shinR, 'a_kneeR', 0),
    footL: anchor(legs.footL, 'a_footL', -0.03, 0.06),
    footR: anchor(legs.footR, 'a_footR', -0.03, 0.06)
  };

  const muscleMeshes: Record<MuscleTag, THREE.Mesh[]> = {
    chest: [pecL, pecR],
    'front-shoulders': delts,
    'side-shoulders': delts,
    'rear-shoulders': delts,
    back: [latL, latR, traps],
    biceps: bis,
    triceps: tris,
    abs: absMeshes,
    quads,
    hamstrings: hams,
    glutes: [glutes],
    calves
  };

  // Fingers curl by rotating each segment a little further than the last.
  const setHandPose = (pose: HandPose) => {
    const curl = pose === 'fist' ? 1 : pose === 'grip' ? 0.62 : 0.06;
    for (const j of fingerJoints) {
      const isThumb = j.name.startsWith('t');
      const seg = Number(j.name.slice(-1));
      const base = isThumb ? 0.5 : 0.95;
      // Elbow-style flexion for fingers is -x: they close toward the palm side.
      j.rotation.x = -curl * base * (seg === 0 ? 1 : 0.85);
    }
  };
  setHandPose('grip');

  return {
    root, joints, anchors, muscleMeshes, setHandPose,
    dispose: () => owned.forEach(o => o.dispose())
  };
}

export const RIG_DIMENSIONS = L;
