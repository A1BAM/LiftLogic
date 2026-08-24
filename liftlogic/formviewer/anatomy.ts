import * as THREE from 'three';

/**
 * Geometry helpers for building an anatomical figure out of primitives.
 *
 * The figure is made of two kinds of part:
 *   - a lathe-turned limb, whose profile gives the smooth taper and swell of a
 *     real arm or leg rather than the uniform tube of a capsule;
 *   - ellipsoid muscle bellies laid over it (triceps, biceps, deltoid, calf),
 *     which is what makes a limb read as a limb instead of a blob.
 */

export interface ProfilePoint {
  /** Distance along the segment, 0 at the joint, 1 at its far end. */
  t: number;
  /** Radius in metres at that point. */
  r: number;
}

/**
 * A limb turned from a profile, hanging along -Y from the joint origin.
 * The profile is resampled through a Catmull-Rom curve so a handful of control
 * points produce a smooth surface.
 */
export function latheLimb(
  length: number,
  profile: ProfilePoint[],
  radialSegments = 20,
  samples = 26
): THREE.LatheGeometry {
  const curve = new THREE.CatmullRomCurve3(
    profile.map(p => new THREE.Vector3(p.r, -p.t * length, 0)),
    false,
    'catmullrom',
    0.4
  );
  const pts = curve.getPoints(samples).map(v => new THREE.Vector2(Math.max(0.004, v.x), v.y));
  return new THREE.LatheGeometry(pts, radialSegments);
}

/** An ellipsoid muscle belly: a sphere scaled on each axis. */
export function belly(rx: number, ry: number, rz: number, segments = 16): THREE.SphereGeometry {
  const g = new THREE.SphereGeometry(1, segments, Math.max(8, segments - 4));
  g.scale(rx, ry, rz);
  return g;
}

/**
 * A rounded box, used where a shape is boxy but should not have hard edges
 * (jaw, palm, foot). Built by scaling a sphere-ish icosahedron toward a cube.
 */
export function roundedBox(w: number, h: number, d: number, round = 0.35): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const half = new THREE.Vector3(w / 2, h / 2, d / 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Push each vertex partway toward the enclosing ellipsoid.
    const n = v.clone().divide(half).normalize().multiply(half);
    v.lerp(n, round);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Places a geometry's local origin at a point, then offsets it. */
export function offset<T extends THREE.BufferGeometry>(g: T, x: number, y: number, z: number): T {
  g.translate(x, y, z);
  return g;
}

export const SKIN = 0xc98f6a;
export const SKIN_SHADE = 0xb27c5b;
export const HAIR = 0x2b2119;
export const SHORTS = 0x1f2b45;
export const SHOE = 0x22252b;
export const SHOE_SOLE = 0xd6d9de;

/** One elliptical cross-section of a lofted body part. */
export interface Section {
  /** Height in metres, measured downward from the joint (0 = at the joint). */
  y: number;
  /** Half-width, across the body (X). */
  w: number;
  /** Half-depth, front to back (Z). */
  d: number;
  /** Shifts this ring forward or back, for the curve of a spine or a calf. */
  z?: number;
  /** Shifts this ring sideways. */
  x?: number;
}

/**
 * Lofts a smooth surface through elliptical cross-sections.
 *
 * This is what keeps the figure from reading as a heap of spheres: a torso is
 * one continuous surface that is broad at the chest, pinched at the waist and
 * flared at the hips, rather than several ellipsoids intersecting each other.
 * Sections are interpolated through a Catmull-Rom curve, so a handful of
 * control rings produce an anatomical shape.
 */
export function loft(sections: Section[], radialSegments = 24, rings = 30): THREE.BufferGeometry {
  const ys = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s.y, 0, 0)), false, 'catmullrom', 0.3);
  const ws = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s.w, 0, 0)), false, 'catmullrom', 0.3);
  const ds = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s.d, 0, 0)), false, 'catmullrom', 0.3);
  const zs = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s.z ?? 0, 0, 0)), false, 'catmullrom', 0.3);
  const xs = new THREE.CatmullRomCurve3(sections.map(s => new THREE.Vector3(s.x ?? 0, 0, 0)), false, 'catmullrom', 0.3);

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = ys.getPoint(t).x;
    const w = Math.max(0.004, ws.getPoint(t).x);
    const d = Math.max(0.004, ds.getPoint(t).x);
    const cz = zs.getPoint(t).x;
    const cx = xs.getPoint(t).x;
    for (let j = 0; j < radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      positions.push(cx + Math.cos(a) * w, y, cz + Math.sin(a) * d);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * radialSegments + j;
      const b = i * radialSegments + ((j + 1) % radialSegments);
      const c = (i + 1) * radialSegments + j;
      const e = (i + 1) * radialSegments + ((j + 1) % radialSegments);
      indices.push(a, c, b, b, c, e);
    }
  }

  // Cap both ends so the form is closed.
  const capTop = positions.length / 3;
  positions.push(xs.getPoint(0).x, ys.getPoint(0).x, zs.getPoint(0).x);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(capTop, (j + 1) % radialSegments, j);
  }
  const capBot = positions.length / 3;
  positions.push(xs.getPoint(1).x, ys.getPoint(1).x, zs.getPoint(1).x);
  const base = rings * radialSegments;
  for (let j = 0; j < radialSegments; j++) {
    indices.push(capBot, base + j, base + ((j + 1) % radialSegments));
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
