import * as THREE from 'three';
import type { EquipmentKind } from './types';
import type { Rig, JointName } from './rig';

/**
 * Equipment built from primitives and either parented to the hands (so it
 * follows the lift) or placed in the scene (benches, stacks, machine frames).
 * Chosen automatically from the exercise's `equipment` field.
 */

const STEEL = 0x8f98a8;
const DARK = 0x39404d;
const PAD = 0x2f6f8f;
const ACCENT = 0x545c6b;

export interface EquipmentResult {
  /** Added to the scene root, static. */
  sceneObjects: THREE.Object3D[];
  /** Added under a hand joint so it tracks the hands. */
  handObjects: Array<{ hand: 'handL' | 'handR' | 'both'; object: THREE.Object3D }>;
  /**
   * Pads parented to whichever limb they press against, so a shin roller stays
   * on the shins through the rep instead of hanging in mid air.
   */
  jointObjects: Array<{ joint: JointName; object: THREE.Object3D }>;
  /**
   * Cables to redraw every frame, each running from a pulley to a hand (or to
   * the midpoint between them, for a bar). Keeping them live means a cable
   * stays attached through the rep instead of being a fixed prop.
   */
  cables?: Array<{ from: THREE.Vector3; to: 'handL' | 'handR' | 'both' }>;
  dispose: () => void;
}

export function buildEquipment(kind: EquipmentKind): EquipmentResult {
  const owned: Array<THREE.BufferGeometry | THREE.Material> = [];
  const M = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4, ...opts });
    owned.push(m);
    return m;
  };
  const G = <T extends THREE.BufferGeometry>(g: T): T => { owned.push(g); return g; };

  const box = (w: number, h: number, d: number, color: number) =>
    new THREE.Mesh(G(new THREE.BoxGeometry(w, h, d)), M(color));
  const cyl = (r: number, h: number, color: number, seg = 14) =>
    new THREE.Mesh(G(new THREE.CylinderGeometry(r, r, h, seg)), M(color));

  const sceneObjects: THREE.Object3D[] = [];
  const handObjects: EquipmentResult['handObjects'] = [];
  const jointObjects: EquipmentResult['jointObjects'] = [];
  const result: EquipmentResult = {
    sceneObjects, handObjects, jointObjects,
    dispose: () => owned.forEach(o => o.dispose())
  };

  /** A barbell shaft with plates, lying across both hands. */
  const barbell = (len = 1.3, plateR = 0.15) => {
    const g = new THREE.Group();
    const shaft = cyl(0.016, len, STEEL);
    shaft.rotation.z = Math.PI / 2; // along X, spanning the hands
    g.add(shaft);
    for (const s of [-1, 1]) {
      const plate = cyl(plateR, 0.05, DARK, 20);
      plate.rotation.z = Math.PI / 2;
      plate.position.x = s * (len / 2 - 0.10);
      g.add(plate);
    }
    return g;
  };

  const dumbbell = () => {
    const g = new THREE.Group();
    const handle = cyl(0.016, 0.20, STEEL);
    handle.rotation.z = Math.PI / 2;
    g.add(handle);
    for (const s of [-1, 1]) {
      const bell = cyl(0.075, 0.09, DARK, 16);
      bell.rotation.z = Math.PI / 2;
      bell.position.x = s * 0.10;
      g.add(bell);
    }
    return g;
  };

  const benchPad = (angleDeg: number) => {
    const g = new THREE.Group();
    const pad = box(0.32, 0.085, 1.20, PAD);
    pad.rotation.x = THREE.MathUtils.degToRad(angleDeg);
    pad.position.set(0, 0.40, 0);
    g.add(pad);
    for (const z of [-0.46, 0.46]) {
      const leg = box(0.26, 0.36, 0.06, ACCENT);
      leg.position.set(0, 0.18, z);
      g.add(leg);
    }
    return g;
  };

  /** Weight stack tower; `handleY` is where the cable ends. */
  /** Face of the tower the fixed cable run sits on, in the stack's own space. */
  const STACK_CABLE_Z = 0.16;

  /**
   * A weight stack with its fixed run of cable. Returns the world point where
   * that run ends, so a live cable can start exactly there: hardcoding the
   * point separately left the two sections terminating on opposite faces of
   * the tower with a visible gap between them.
   */
  const cableStack = (z: number, handleY: number, x = 0) => {
    const g = new THREE.Group();
    const tower = box(0.30, 1.85, 0.30, ACCENT);
    tower.position.set(0, 0.92, 0);
    g.add(tower);
    for (let i = 0; i < 8; i++) {
      const plate = box(0.26, 0.045, 0.26, DARK);
      plate.position.set(0, 0.16 + i * 0.055, 0);
      g.add(plate);
    }
    const cable = cyl(0.006, Math.max(0.05, 1.85 - handleY), 0x1b1f26, 6);
    cable.position.set(0, handleY + (1.85 - handleY) / 2, STACK_CABLE_Z);
    g.add(cable);
    g.position.set(x, 0, z);
    return { group: g, cableEnd: new THREE.Vector3(x, handleY, z + STACK_CABLE_Z) };
  };

  const seatFrame = (backAngle = 8, seatDepth = 0.62, seatCentreZ = 0.12) => {
    const g = new THREE.Group();
    // Top of the pad at 0.50 puts the figure's hips (0.54) on the seat.
    const seat = box(0.38, 0.09, seatDepth, PAD);
    seat.position.set(0, 0.455, seatCentreZ);
    g.add(seat);
    const back = box(0.38, 0.62, 0.09, PAD);
    back.rotation.x = THREE.MathUtils.degToRad(-backAngle);
    back.position.set(0, 0.80, seatCentreZ - seatDepth / 2 - 0.02);
    g.add(back);
    const post = box(0.18, 0.42, 0.18, ACCENT);
    post.position.set(0, 0.21, seatCentreZ);
    g.add(post);
    const foot = box(0.44, 0.06, 0.52, DARK);
    foot.position.set(0, 0.03, seatCentreZ);
    g.add(foot);
    return g;
  };

  switch (kind) {
    case 'barbell':
      handObjects.push({ hand: 'both', object: barbell() });
      break;

    case 'dumbbells':
      handObjects.push({ hand: 'handL', object: dumbbell() });
      handObjects.push({ hand: 'handR', object: dumbbell() });
      break;

    case 'bench-flat':
      sceneObjects.push(benchPad(0));
      handObjects.push({ hand: 'handL', object: dumbbell() });
      handObjects.push({ hand: 'handR', object: dumbbell() });
      break;

    case 'bench-incline': {
      // A seat to sit on plus a back pad rising behind it. The old version
      // tilted the wrong way, which made it a decline bench.
      const g = new THREE.Group();
      const seat = box(0.34, 0.09, 0.42, PAD);
      seat.position.set(0, 0.45, 0.20);
      g.add(seat);
      const back = box(0.34, 0.09, 0.86, PAD);
      back.rotation.x = THREE.MathUtils.degToRad(30); // head end raised
      back.position.set(0, 0.66, -0.32);
      g.add(back);
      for (const [z, h] of [[0.34, 0.41], [-0.62, 0.62]] as const) {
        const leg = box(0.28, h, 0.07, ACCENT);
        leg.position.set(0, h / 2, z);
        g.add(leg);
      }
      sceneObjects.push(g);
      handObjects.push({ hand: 'handL', object: dumbbell() });
      handObjects.push({ hand: 'handR', object: dumbbell() });
      break;
    }

    case 'smith-machine': {
      // Short uprights set well back, so they read as a Smith machine without
      // standing between the camera and the lifter.
      const frame = new THREE.Group();
      for (const x of [-0.62, 0.62]) {
        const rail = cyl(0.022, 1.5, STEEL, 10);
        rail.position.set(x, 0.75, -0.62);
        frame.add(rail);
      }
      sceneObjects.push(frame, benchPad(0));
      handObjects.push({ hand: 'both', object: barbell(1.3, 0.15) });
      break;
    }

    case 'cable-high': {
      const machine = new THREE.Group();
      // Single column set off to the lifter's right with the pulley on a reach
      // arm overhead, which is how these stations are actually laid out and
      // keeps the front view of the lifter clear.
      const TX = -0.72, TZ = 0.42;

      for (const dx of [-0.13, 0.13]) {
        const post = box(0.07, 2.32, 0.07, ACCENT);
        post.position.set(TX + dx, 1.16, TZ);
        machine.add(post);
      }
      const base = box(0.46, 0.07, 0.66, DARK);
      base.position.set(TX, 0.035, TZ);
      machine.add(base);

      for (const dx of [-0.055, 0.055]) {
        const rod = cyl(0.011, 1.95, STEEL, 10);
        rod.position.set(TX + dx, 1.0, TZ);
        machine.add(rod);
      }

      const SELECTED = 6;
      for (let i = 0; i < 14; i++) {
        const plate = box(0.235, 0.052, 0.30, i < SELECTED ? 0x6b7688 : DARK);
        plate.position.set(TX, 0.11 + i * 0.058 + (i < SELECTED ? 0.34 : 0), TZ);
        machine.add(plate);
      }
      const pin = cyl(0.011, 0.16, 0x9aa3b2, 10);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(TX, 0.11 + (SELECTED - 1) * 0.058 + 0.34, TZ - 0.18);
      machine.add(pin);

      // Reach arm from the column across to above the lifter.
      const arm = box(Math.abs(TX) + 0.12, 0.085, 0.10, ACCENT);
      arm.position.set(TX / 2 + 0.05, 2.30, TZ - 0.10);
      machine.add(arm);

      const PULLEY = new THREE.Vector3(0.02, 2.17, TZ - 0.14);
      const wheel = cyl(0.062, 0.026, 0x9aa3b2, 20);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.copy(PULLEY);
      machine.add(wheel);
      for (const dx of [-0.025, 0.025]) {
        const cheek = box(0.011, 0.14, 0.14, ACCENT);
        cheek.position.set(PULLEY.x + dx, PULLEY.y + 0.03, PULLEY.z);
        machine.add(cheek);
      }

      // Fixed cable runs: up the column, then along the arm to the pulley.
      const riser = cyl(0.007, 1.64, 0x14171c, 6);
      riser.position.set(TX, 1.30, TZ - 0.04);
      machine.add(riser);
      const topRun = cyl(0.007, Math.abs(TX) + 0.04, 0x14171c, 6);
      topRun.rotation.z = Math.PI / 2;
      topRun.position.set(TX / 2 + 0.01, 2.245, TZ - 0.12);
      machine.add(topRun);

      sceneObjects.push(machine);
      result.cables = [{ from: PULLEY, to: 'both' }];

      const bar = new THREE.Group();
      const shaft = cyl(0.026, 0.56, 0x3a4250, 16);
      shaft.rotation.z = Math.PI / 2;
      bar.add(shaft);
      for (const sgn of [-1, 1]) {
        const grip = cyl(0.032, 0.17, 0x191d24, 16);
        grip.rotation.z = Math.PI / 2;
        grip.position.x = sgn * 0.185;
        bar.add(grip);
        const endCap = cyl(0.036, 0.018, 0xaab3c2, 14);
        endCap.rotation.z = Math.PI / 2;
        endCap.position.x = sgn * 0.275;
        bar.add(endCap);
      }
      const bracket = box(0.036, 0.058, 0.026, 0xaab3c2);
      bracket.position.y = 0.042;
      bar.add(bracket);
      handObjects.push({ hand: 'both', object: bar });
      break;
    }

    case 'lat-pulldown': {
      // Seated station: a seat with a thigh pad under a high pulley, so the
      // lifter is anchored rather than sitting in mid air.
      const g = new THREE.Group();
      const seat = box(0.38, 0.09, 0.42, PAD);
      seat.position.set(0, 0.455, 0.06);
      g.add(seat);
      const post = box(0.18, 0.42, 0.18, ACCENT);
      post.position.set(0, 0.21, 0.06);
      g.add(post);
      const foot = box(0.42, 0.06, 0.62, DARK);
      foot.position.set(0, 0.03, 0.10);
      g.add(foot);
      // Pad clamped over the thighs to stop the lifter being pulled upward.
      const thighPad = box(0.40, 0.10, 0.24, PAD);
      thighPad.position.set(0, 0.58, 0.32);
      g.add(thighPad);
      for (const dx of [-0.15, 0.15]) {
        const upright = box(0.06, 0.30, 0.06, ACCENT);
        upright.position.set(dx, 0.50, 0.32);
        g.add(upright);
      }
      // Frame carrying the pulley overhead and slightly in front.
      for (const dx of [-0.30, 0.30]) {
        const post2 = box(0.07, 2.25, 0.07, ACCENT);
        post2.position.set(dx, 1.12, -0.52);
        g.add(post2);
      }
      const top = box(0.70, 0.08, 0.80, ACCENT);
      top.position.set(0, 2.22, -0.22);
      g.add(top);

      const PULLEY = new THREE.Vector3(0, 2.12, 0.10);
      const wheel = cyl(0.06, 0.026, 0x9aa3b2, 18);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.copy(PULLEY);
      g.add(wheel);
      sceneObjects.push(g);
      result.cables = [{ from: PULLEY, to: 'both' }];

      // Wide grip bar.
      const bar = new THREE.Group();
      const shaft = cyl(0.024, 1.00, 0x3a4250, 14);
      shaft.rotation.z = Math.PI / 2;
      bar.add(shaft);
      for (const sgn of [-1, 1]) {
        const grip = cyl(0.030, 0.18, 0x191d24, 14);
        grip.rotation.z = Math.PI / 2;
        grip.position.x = sgn * 0.36;
        bar.add(grip);
      }
      handObjects.push({ hand: 'both', object: bar });
      break;
    }

    case 'cable-low': {
      const stack = cableStack(-0.95, 0.35);
      sceneObjects.push(stack.group);
      result.cables = [{ from: stack.cableEnd, to: 'both' }];
      break;
    }

    case 'cable-crossover': {
      // Two towers with the lifter between them, close enough to stay in
      // frame, and a live cable from each pulley to the matching hand.
      const X = 0.92, PY = 1.62;
      const left = cableStack(0, PY, -X);
      const right = cableStack(0, PY, X);
      sceneObjects.push(left.group, right.group);
      result.cables = [
        { from: left.cableEnd, to: 'handR' },
        { from: right.cableEnd, to: 'handL' }
      ];
      break;
    }

    case 'pullup-bar': {
      const g = new THREE.Group();
      const bar = cyl(0.022, 1.30, STEEL);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 2.20;
      g.add(bar);
      for (const x of [-0.62, 0.62]) {
        const post = cyl(0.04, 2.20, ACCENT);
        post.position.set(x, 1.10, 0);
        g.add(post);
      }
      sceneObjects.push(g);
      break;
    }

    case 'machine-seated': {
      // You face the stack on a seated row, so it belongs in front, with a
      // handle in the hands and a cable running back to the pulley.
      sceneObjects.push(seatFrame(10));
      const tower = cableStack(1.25, 0.62);
      sceneObjects.push(tower.group);
      result.cables = [{ from: tower.cableEnd, to: 'both' }];

      const handle = new THREE.Group();
      const grip = cyl(0.022, 0.34, 0x2b3038, 14);
      grip.rotation.z = Math.PI / 2;
      handle.add(grip);
      for (const sgn of [-1, 1]) {
        const pad = cyl(0.028, 0.12, 0x191d24, 12);
        pad.rotation.z = Math.PI / 2;
        pad.position.x = sgn * 0.11;
        handle.add(pad);
      }
      handObjects.push({ hand: 'both', object: handle });
      break;
    }

    case 'machine-lateral': {
      sceneObjects.push(seatFrame(6));
      // Pads ride the upper arms, as the machine's levers do. Left fixed, the
      // arms swept up and out of them.
      for (const side of ['upperArmL', 'upperArmR'] as const) {
        const armPad = box(0.09, 0.22, 0.14, PAD);
        armPad.position.set(side === 'upperArmL' ? 0.075 : -0.075, -0.15, 0.02);
        jointObjects.push({ joint: side, object: armPad });
      }
      break;
    }

    case 'machine-crunch': {
      const g = seatFrame(4);
      // Pad and arm rests ride the chest, which is what the machine's linkage
      // does; fixed, the head curled straight through them.
      const chestPad = box(0.42, 0.16, 0.11, PAD);
      chestPad.position.set(0, 0.16, 0.15);
      jointObjects.push({ joint: 'chest', object: chestPad });
      for (const dx of [-0.16, 0.16]) {
        const armRest = box(0.07, 0.07, 0.30, ACCENT);
        armRest.position.set(dx, 0.20, 0.30);
        jointObjects.push({ joint: 'chest', object: armRest });
      }
      sceneObjects.push(g, cableStack(-0.95, 1.20).group);
      break;
    }

    case 'hack-squat': {
      const g = new THREE.Group();
      // Parented to the spine so it rides down with the lifter, as the sled
      // does. Fixed, the back slid off the pad at the bottom of every rep.
      const backPad = box(0.42, 1.00, 0.09, PAD);
      backPad.position.set(0, 0.40, -0.16);
      jointObjects.push({ joint: 'spine', object: backPad });
      const platform = box(0.76, 0.06, 0.58, ACCENT);
      platform.position.set(0, 0.03, 0.38);
      g.add(platform);
      for (const x of [-0.55, 0.55]) {
        const rail = cyl(0.03, 2.0, STEEL);
        rail.rotation.x = THREE.MathUtils.degToRad(-20);
        rail.position.set(x, 1.0, -0.45);
        g.add(rail);
      }
      sceneObjects.push(g);
      break;
    }

    case 'leg-extension': {
      sceneObjects.push(seatFrame(12));
      // Parented to the shins so it stays against them as the knee opens.
      for (const side of ['shinL', 'shinR'] as const) {
        const roller = cyl(0.055, 0.16, PAD, 14);
        roller.rotation.z = Math.PI / 2;
        roller.position.set(0, -0.34, 0.075);
        jointObjects.push({ joint: side, object: roller });
      }
      break;
    }

    case 'ham-curl-seated': {
      const g = seatFrame(14);
      // Pad clamped across the thighs, just above them.
      const thighPad = box(0.42, 0.09, 0.26, PAD);
      thighPad.position.set(0, 0.575, 0.30);
      g.add(thighPad);
      sceneObjects.push(g);
      for (const side of ['shinL', 'shinR'] as const) {
        const roller = cyl(0.052, 0.16, PAD, 14);
        roller.rotation.z = Math.PI / 2;
        roller.position.set(0, -0.36, -0.07); // behind the ankles
        jointObjects.push({ joint: side, object: roller });
      }
      break;
    }

    case 'calf-seated': {
      const g = seatFrame(6, 0.46, 0.04);
      const kneePad = box(0.42, 0.11, 0.22, PAD);
      kneePad.position.set(0, 0.575, 0.38);
      g.add(kneePad);
      // Block under the balls of the feet, with the heels free to drop.
      const block = box(0.46, 0.12, 0.16, ACCENT);
      block.position.set(0, 0.06, 0.46);
      g.add(block);
      sceneObjects.push(g);
      break;
    }

    case 'none':
    default:
      break;
  }

  return result;
}

/** Attaches hand-held equipment onto the rig's hand joints. */
export function attachEquipment(result: EquipmentResult, rig: Rig, sceneRoot: THREE.Object3D) {
  result.sceneObjects.forEach(o => sceneRoot.add(o));
  for (const { joint, object } of result.jointObjects) rig.joints[joint].add(object);
  for (const { hand, object } of result.handObjects) {
    if (hand === 'both') {
      // A bar spans both hands, so it cannot be a child of either one. The
      // scene positions it on the line between them every frame instead.
      sceneRoot.add(object);
    } else {
      rig.joints[hand].add(object);
    }
  }
}
