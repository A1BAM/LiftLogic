import * as THREE from 'three';
import type { EquipmentKind } from './types';
import type { Rig } from './rig';

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
  dispose: () => void;
}

export function buildEquipment(kind: EquipmentKind, rig: Rig): EquipmentResult {
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

  /** A barbell shaft with plates, lying across both hands. */
  const barbell = (len = 1.5, plateR = 0.21) => {
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
    const pad = box(0.34, 0.09, 1.15, PAD);
    pad.rotation.x = THREE.MathUtils.degToRad(angleDeg);
    pad.position.set(0, 0.44, 0);
    g.add(pad);
    for (const z of [-0.45, 0.45]) {
      const leg = box(0.30, 0.42, 0.07, ACCENT);
      leg.position.set(0, 0.21, z);
      g.add(leg);
    }
    return g;
  };

  /** Weight stack tower; `handleY` is where the cable ends. */
  const cableStack = (z: number, handleY: number) => {
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
    cable.position.set(0, handleY + (1.85 - handleY) / 2, 0.16);
    g.add(cable);
    g.position.z = z;
    return g;
  };

  const seatFrame = (backAngle = 8) => {
    const g = new THREE.Group();
    const seat = box(0.40, 0.08, 0.40, PAD);
    seat.position.set(0, 0.46, 0);
    g.add(seat);
    const back = box(0.40, 0.70, 0.08, PAD);
    back.rotation.x = THREE.MathUtils.degToRad(-backAngle);
    back.position.set(0, 0.82, -0.22);
    g.add(back);
    const post = box(0.16, 0.46, 0.16, ACCENT);
    post.position.set(0, 0.23, 0);
    g.add(post);
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

    case 'bench-incline':
      sceneObjects.push(benchPad(-30));
      handObjects.push({ hand: 'handL', object: dumbbell() });
      handObjects.push({ hand: 'handR', object: dumbbell() });
      break;

    case 'smith-machine': {
      const frame = new THREE.Group();
      for (const x of [-0.85, 0.85]) {
        const rail = cyl(0.03, 2.3, STEEL);
        rail.position.set(x, 1.15, -0.15);
        frame.add(rail);
      }
      sceneObjects.push(frame, benchPad(0));
      handObjects.push({ hand: 'both', object: barbell(1.7, 0.22) });
      break;
    }

    case 'cable-high':
      sceneObjects.push(cableStack(-0.85, 1.55));
      break;

    case 'cable-low':
      sceneObjects.push(cableStack(-0.95, 0.35));
      break;

    case 'cable-crossover': {
      // Two towers, figure standing between them.
      const left = cableStack(0, 1.6); left.position.x = -1.15;
      const right = cableStack(0, 1.6); right.position.x = 1.15;
      sceneObjects.push(left, right);
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

    case 'machine-seated':
      sceneObjects.push(seatFrame(10), cableStack(-0.95, 0.95));
      break;

    case 'machine-lateral': {
      const g = seatFrame(6);
      // Pads the outer forearms press against.
      for (const s of [-1, 1]) {
        const armPad = box(0.10, 0.26, 0.16, PAD);
        armPad.position.set(s * 0.34, 1.02, 0.05);
        g.add(armPad);
      }
      sceneObjects.push(g);
      break;
    }

    case 'machine-crunch': {
      const g = seatFrame(4);
      const chestPad = box(0.44, 0.16, 0.14, PAD);
      chestPad.position.set(0, 1.16, 0.20);
      g.add(chestPad);
      sceneObjects.push(g, cableStack(-0.95, 1.20));
      break;
    }

    case 'hack-squat': {
      const g = new THREE.Group();
      const backPad = box(0.42, 1.10, 0.10, PAD);
      backPad.rotation.x = THREE.MathUtils.degToRad(-35);
      backPad.position.set(0, 0.85, -0.30);
      g.add(backPad);
      const platform = box(0.70, 0.06, 0.50, ACCENT);
      platform.position.set(0, 0.03, 0.22);
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
      const g = seatFrame(12);
      const shinPad = cyl(0.055, 0.34, PAD);
      shinPad.rotation.z = Math.PI / 2;
      shinPad.position.set(0, 0.18, 0.44);
      g.add(shinPad);
      sceneObjects.push(g);
      break;
    }

    case 'ham-curl-seated': {
      const g = seatFrame(14);
      const thighPad = box(0.40, 0.10, 0.24, PAD);
      thighPad.position.set(0, 0.70, 0.28);
      g.add(thighPad);
      const ankleRoller = cyl(0.05, 0.34, PAD);
      ankleRoller.rotation.z = Math.PI / 2;
      ankleRoller.position.set(0, 0.14, 0.40);
      g.add(ankleRoller);
      sceneObjects.push(g);
      break;
    }

    case 'calf-seated': {
      const g = seatFrame(6);
      const kneePad = box(0.40, 0.12, 0.20, PAD);
      kneePad.position.set(0, 0.76, 0.30);
      g.add(kneePad);
      const footBlock = box(0.44, 0.10, 0.20, ACCENT);
      footBlock.position.set(0, 0.05, 0.34);
      g.add(footBlock);
      sceneObjects.push(g);
      break;
    }

    case 'none':
    default:
      break;
  }

  return {
    sceneObjects,
    handObjects,
    dispose: () => owned.forEach(o => o.dispose())
  };
}

/** Attaches hand-held equipment onto the rig's hand joints. */
export function attachEquipment(result: EquipmentResult, rig: Rig, sceneRoot: THREE.Object3D) {
  result.sceneObjects.forEach(o => sceneRoot.add(o));
  for (const { hand, object } of result.handObjects) {
    if (hand === 'both') {
      // A bar spans both hands: parent to the right hand and let the left
      // hand's keyframes keep it level. Good enough for a form cue.
      rig.joints.handR.add(object);
    } else {
      rig.joints[hand].add(object);
    }
  }
}
