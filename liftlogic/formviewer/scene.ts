import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildRig, RIG_DIMENSIONS, type Rig, type JointName, type MuscleTag } from './rig';
import { buildEquipment, attachEquipment, type EquipmentResult } from './equipment';
import type { AnimationFile, ArrowSpec, Keyframe, Phase } from './types';

export type CameraPreset = 'front' | 'side' | '45';

export interface CueLabel {
  id: string;
  cue: string;
  /** Screen position in CSS pixels within the canvas, plus fade opacity. */
  x: number; y: number; opacity: number;
  color: string;
}

export interface SceneHandle {
  setPlaying: (playing: boolean) => void;
  /** Scrub to a normalised position and hold it. */
  setProgress: (t: number) => void;
  getProgress: () => number;
  setCamera: (preset: CameraPreset) => void;
  setMistakeMode: (on: boolean) => void;
  setMuscleHighlight: (on: boolean) => void;
  resize: () => void;
  dispose: () => void;
}

const ARROW_COLORS = ['#38bdf8', '#fbbf24', '#a78bfa'];
const FAIL_COLOR = new THREE.Color('#ef4444');

const deg = THREE.MathUtils.degToRad;
/** Smooth in/out so the loop does not snap at keyframe boundaries. */
const ease = (t: number) => t * t * (3 - 2 * t);

function lerpTriple(a: [number, number, number], b: [number, number, number], k: number) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] as [number, number, number];
}

/** Which keyframe pair surrounds `t`, wrapping around the loop. */
function bracket(frames: Keyframe[], t: number) {
  const n = frames.length;
  let i = 0;
  for (let k = 0; k < n; k++) if (frames[k].t <= t) i = k;
  const a = frames[i];
  const b = frames[(i + 1) % n];
  // The final segment wraps past 1 back to the first frame's t.
  const span = (b.t > a.t ? b.t : b.t + 1) - a.t;
  const local = span <= 0 ? 0 : ((t - a.t) + (t < a.t ? 1 : 0)) / span;
  return { a, b, k: ease(Math.min(1, Math.max(0, local))) };
}

export function createScene(
  canvas: HTMLCanvasElement,
  anim: AnimationFile,
  onCues: (labels: CueLabel[]) => void
): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); // capped, per spec
  renderer.setClearColor(0x0f172a);
  // Shadows are what make the muscle relief read as shape rather than texture.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.5));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
  key.position.set(2.6, 4.2, 3.1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.camera.left = -2.4;
  key.shadow.camera.right = 2.4;
  key.shadow.camera.top = 3.2;
  key.shadow.camera.bottom = -0.6;
  key.shadow.bias = -0.0012;
  scene.add(key);
  // Low fill from the front so the chest and arms are not lost in shadow.
  const fill = new THREE.DirectionalLight(0xdbeafe, 0.55);
  fill.position.set(-1.4, 1.2, 3.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x93c5fd, 0.6);
  rim.position.set(-3, 2, -2.5);
  scene.add(rim);

  const floorGeo = new THREE.CircleGeometry(3.2, 40);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 1 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(6, 12, 0x334155, 0x243044);
  grid.position.y = 0.002;
  scene.add(grid);

  const owned: Array<THREE.BufferGeometry | THREE.Material> = [];
  const rig: Rig = buildRig();
  // The figure rotates about its HIPS, not its feet. Lying a body down by
  // rotating about the floor would swing it away from the bench entirely;
  // pivoting at the hips means rootRotation tips the body where it stands and
  // rootOffset then places the hips on the pad.
  const HIP_Y = RIG_DIMENSIONS.hipY;
  const figure = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -HIP_Y;
  body.add(rig.root);
  figure.add(body);
  figure.position.y = HIP_Y;
  scene.add(figure);

  rig.setHandPose(anim.handPose ?? 'grip');

  const equipment: EquipmentResult = buildEquipment(anim.equipment, rig);
  attachEquipment(equipment, rig, scene);
  equipment.sceneObjects.forEach(o => o.traverse(c => {
    const m = c as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  }));
  equipment.handObjects.forEach(({ object }) => object.traverse(c => {
    const m = c as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; }
  }));

  // Two-handed equipment spans the hands, so it is placed on the line between
  // them each frame rather than parented to one hand.
  const spanning = equipment.handObjects.filter(h => h.hand === 'both').map(h => h.object);
  const spanA = new THREE.Vector3();
  const spanB = new THREE.Vector3();
  const spanMid = new THREE.Vector3();
  const spanAxis = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0);

  function updateSpanning() {
    if (!spanning.length) return;
    rig.anchors.handL.getWorldPosition(spanA);
    rig.anchors.handR.getWorldPosition(spanB);
    spanMid.addVectors(spanA, spanB).multiplyScalar(0.5);
    spanAxis.subVectors(spanA, spanB);
    if (spanAxis.lengthSq() < 1e-8) return;
    spanAxis.normalize();
    for (const obj of spanning) {
      obj.position.copy(spanMid);
      // The bar is modelled along its own X axis, so align that with the axis
      // running from the right hand to the left.
      obj.quaternion.setFromUnitVectors(xAxis, spanAxis);
    }
  }

  // --- arrows ------------------------------------------------------------
  // Parented to the scene rather than to the joint, so an arrow keeps pointing
  // the way the body part should travel instead of spinning with the limb. Its
  // position is refreshed from the joint's world position every frame.
  interface LiveArrow { spec: ArrowSpec; obj: THREE.Group; anchor: THREE.Object3D; color: string; opacity: number; }
  const arrows: LiveArrow[] = anim.arrows.slice(0, 3).map((spec, i) => {
    const color = spec.color || ARROW_COLORS[i % ARROW_COLORS.length];
    const len = spec.length ?? 0.28;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
    const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, len * 0.72, 8);
    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.position.y = len * 0.36;
    const headGeo = new THREE.ConeGeometry(0.035, len * 0.28, 10);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = len * 0.86;
    g.add(shaft, head);
    g.visible = false;
    scene.add(g);
    return { spec, obj: g, anchor: rig.anchors[spec.anchor], color, opacity: 0 };
  });

  // Live cables: redrawn each frame from each pulley to the hand it feeds, so
  // they stay taut through the rep instead of being static props.
  const cableGeo = new THREE.CylinderGeometry(0.007, 0.007, 1, 8);
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.85 });
  const cables = (equipment.cables ?? []).map(spec => {
    const mesh = new THREE.Mesh(cableGeo, cableMat);
    mesh.castShadow = true;
    scene.add(mesh);
    return { spec, mesh };
  });
  if (cables.length) { owned.push(cableGeo, cableMat); }

  const cableEnd = new THREE.Vector3();
  const cableOther = new THREE.Vector3();
  const cableMid = new THREE.Vector3();
  const cableDir = new THREE.Vector3();
  const upUnit = new THREE.Vector3(0, 1, 0);

  function updateCables() {
    for (const { spec, mesh } of cables) {
      if (spec.to === 'both') {
        // A bar's cable clips to the middle of it, just above the hands.
        rig.anchors.handR.getWorldPosition(cableEnd);
        rig.anchors.handL.getWorldPosition(cableOther);
        cableEnd.lerp(cableOther, 0.5).y += 0.05;
      } else {
        rig.anchors[spec.to].getWorldPosition(cableEnd);
      }
      cableDir.subVectors(cableEnd, spec.from);
      const len = cableDir.length();
      if (len < 1e-4) continue;
      cableMid.copy(spec.from).addScaledVector(cableDir, 0.5);
      mesh.position.copy(cableMid);
      mesh.scale.set(1, len, 1);
      mesh.quaternion.setFromUnitVectors(upUnit, cableDir.normalize());
    }
  }

  // --- red marking -------------------------------------------------------
  // Muscle highlighting shows dedicated patches. The mistake mode still tints
  // a limb, so those meshes get their own material copy first: the body shares
  // one material, and tinting it would redden the whole figure.
  const ownedMats: THREE.Material[] = [];
  const originalOf = new Map<THREE.Mesh, THREE.Material>();

  const jointMeshes = (name: JointName): THREE.Mesh[] => {
    const out: THREE.Mesh[] = [];
    rig.joints[name].children.forEach(c => {
      const m = c as THREE.Mesh;
      // Highlight patches are not part of the limb's own surface.
      if (m.isMesh && m.visible) out.push(m);
    });
    return out;
  };

  const markFail = (meshes: THREE.Mesh[]) => {
    for (const mesh of meshes) {
      if (!originalOf.has(mesh)) {
        originalOf.set(mesh, mesh.material as THREE.Material);
        const copy = (mesh.material as THREE.MeshStandardMaterial).clone();
        copy.color.copy(FAIL_COLOR);
        ownedMats.push(copy);
        mesh.material = copy;
      }
    }
  };
  const clearFail = () => {
    originalOf.forEach((mat, mesh) => { mesh.material = mat; });
    originalOf.clear();
  };

  // --- state -------------------------------------------------------------
  let mistakeMode = false;
  let muscleHighlight = false;
  let playing = true;
  let progress = 0;
  let raf = 0;
  let last = performance.now();
  let disposed = false;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 1.2;
  controls.maxDistance = 8;
  // Clamped so the figure can never be flipped upside down.
  controls.minPolarAngle = deg(25);
  controls.maxPolarAngle = deg(115);
  controls.target.set(0, 0.95, 0);
  // One finger orbits, two fingers pinch-zoom and pan.
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const PRESETS: Record<CameraPreset, THREE.Vector3> = {
    front: new THREE.Vector3(0, 1.15, 3.5),
    side: new THREE.Vector3(3.5, 1.15, 0.01),
    '45': new THREE.Vector3(2.5, 1.5, 2.5)
  };
  function setCamera(preset: CameraPreset) {
    camera.position.copy(PRESETS[preset]);
    controls.target.set(0, 0.95, 0);
    controls.update();
  }
  setCamera(anim.defaultCamera);

  // --- pose application --------------------------------------------------
  const restRotations = new Map<THREE.Object3D, THREE.Euler>();
  Object.values(rig.joints).forEach(j => restRotations.set(j, j.rotation.clone()));

  function applyPose(t: number) {
    const frames = mistakeMode ? anim.mistake.keyframes : anim.keyframes;
    const { a, b, k } = bracket(frames, t);

    // Reset to rest so a joint omitted from a keyframe holds its rest angle.
    restRotations.forEach((rot, obj) => obj.rotation.copy(rot));

    const names = new Set<string>([...Object.keys(a.joints), ...Object.keys(b.joints)]);
    names.forEach(nameStr => {
      const name = nameStr as JointName;
      const joint = rig.joints[name];
      if (!joint) return;
      const from = a.joints[name] ?? b.joints[name]!;
      const to = b.joints[name] ?? a.joints[name]!;
      const [x, y, z] = lerpTriple(from, to, k);
      joint.rotation.set(deg(x), deg(y), deg(z));
    });

    const offA = a.rootOffset ?? [0, 0, 0];
    const offB = b.rootOffset ?? [0, 0, 0];
    const [ox, oy, oz] = lerpTriple(offA, offB, k);
    // rootOffset moves the hips relative to where they stand.
    figure.position.set(ox, HIP_Y + oy, oz);

    const rotA = a.rootRotation ?? [0, 0, 0];
    const rotB = b.rootRotation ?? [0, 0, 0];
    const [rx, ry, rz] = lerpTriple(rotA, rotB, k);
    figure.rotation.set(deg(rx), deg(ry), deg(rz));

    return a.phase;
  }

  // --- per-frame arrow + cue placement -----------------------------------
  const worldPos = new THREE.Vector3();
  const dirVec = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);
  const projected = new THREE.Vector3();
  const labels: CueLabel[] = [];

  function updateArrows(phase: Phase, dt: number) {
    labels.length = 0;
    const rect = { w: canvas.clientWidth, h: canvas.clientHeight };

    for (const arrow of arrows) {
      const active = arrow.spec.phases.includes(phase);
      // Fade rather than pop, so a cue for the bottom of a lift is gone by lockout.
      const target = active ? 1 : 0;
      arrow.opacity += (target - arrow.opacity) * Math.min(1, dt * 7);
      if (arrow.opacity < 0.02) { arrow.obj.visible = false; continue; }
      arrow.obj.visible = true;

      arrow.anchor.getWorldPosition(worldPos);
      arrow.obj.position.copy(worldPos);

      // Direction is authored in the figure's own space, so rotate it by the
      // figure's current root rotation: "press up" stays up when lying down.
      dirVec.set(arrow.spec.dir[0], arrow.spec.dir[1], arrow.spec.dir[2]).normalize();
      dirVec.applyQuaternion(figure.quaternion);
      arrow.obj.quaternion.setFromUnitVectors(upVec, dirVec);

      arrow.obj.traverse(o => {
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m && 'opacity' in m) m.opacity = arrow.opacity;
      });

      // Project the arrow tip so its cue can float beside it.
      projected.copy(worldPos).addScaledVector(dirVec, (arrow.spec.length ?? 0.28) * 1.05);
      projected.project(camera);
      labels.push({
        id: arrow.spec.id,
        cue: arrow.spec.cue,
        x: (projected.x * 0.5 + 0.5) * rect.w,
        y: (-projected.y * 0.5 + 0.5) * rect.h,
        opacity: arrow.opacity,
        color: arrow.color
      });
    }
    onCues(labels.slice());
  }

  function updateTints() {
    // Show only the patches for this lift's target muscles.
    for (const meshes of Object.values(rig.muscleHighlights)) {
      for (const m of meshes) m.visible = false;
    }
    if (muscleHighlight) {
      for (const tag of anim.targetMuscles as MuscleTag[]) {
        for (const m of rig.muscleHighlights[tag] || []) m.visible = true;
      }
    }
    clearFail();
    if (mistakeMode) {
      for (const j of anim.mistake.failJoints) markFail(jointMeshes(j));
    }
  }

  function render(now: number) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing) progress = (progress + dt / anim.loopSeconds) % 1;
    const phase = applyPose(progress);
    updateSpanning();
    updateCables();
    updateArrows(phase, dt);
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  updateTints();
  raf = requestAnimationFrame(render);

  return {
    setPlaying: (p) => {
      playing = p;
      // Restart the clock so a resumed loop does not jump by the paused time.
      last = performance.now();
      if (p && !raf && !disposed) raf = requestAnimationFrame(render);
    },
    setProgress: (t) => { progress = Math.min(1, Math.max(0, t)); },
    getProgress: () => progress,
    setCamera,
    setMistakeMode: (on) => { mistakeMode = on; updateTints(); },
    setMuscleHighlight: (on) => { muscleHighlight = on; updateTints(); },
    resize,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      controls.dispose();
      rig.dispose();
      equipment.dispose();
      floorGeo.dispose(); floorMat.dispose();
      ownedMats.forEach(m => m.dispose());
      owned.forEach(o => o.dispose());
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      arrows.forEach(a => a.obj.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      }));
      renderer.dispose();
    }
  };
}
