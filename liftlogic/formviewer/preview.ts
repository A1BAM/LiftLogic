/**
 * Dev-only harness for eyeballing a form model without going through the app's
 * lock screen. Vite builds index.html only, so this page never ships.
 *
 *   pnpm dev
 *   open /formviewer/preview.html?id=TRICEP_PUSHDOWN&t=0.48&cam=side&m=1
 *
 * `t` is the position in the rep (0..1), `cam` is front | side | 45, `m=1`
 * turns on the target-muscle highlight and `x=1` plays the mistake.
 *
 * `strip=8` instead renders the whole rep as a filmstrip: eight scenes held at
 * evenly spaced points so the motion BETWEEN keyframes can be checked, not just
 * the poses at them. A limb that passes through a bench, or a joint that swings
 * the long way round, only shows up mid-rep.
 *
 * The page sets window.__ready once every scene is up, so a screenshot script
 * can wait on it.
 */
import { createScene, type CameraPreset } from './scene';
import { loadAnimation } from './loader';

const q = new URLSearchParams(location.search);
const id = q.get('id') || 'TRICEP_PUSHDOWN';
const cam = (q.get('cam') || '') as CameraPreset;
const strip = parseInt(q.get('strip') || '0', 10);

const single = document.getElementById('c') as HTMLCanvasElement;
const stripEl = document.getElementById('strip') as HTMLDivElement;
const ready = () => { (window as unknown as { __ready: boolean }).__ready = true; };

loadAnimation(id).then(anim => {
  if (strip > 0) {
    single.remove();
    // One paused scene per frame of the strip. Separate canvases keep this
    // simple; a handful of WebGL contexts is well inside the browser limit.
    for (let i = 0; i < strip; i++) {
      const t = i / strip;
      const fig = document.createElement('figure');
      const canvas = document.createElement('canvas');
      const cap = document.createElement('figcaption');
      cap.textContent = `t=${t.toFixed(2)}`;
      fig.appendChild(canvas);
      fig.appendChild(cap);
      stripEl.appendChild(fig);
      const h = createScene(canvas, anim, () => {});
      h.setPlaying(false);
      h.setCamera(cam || anim.defaultCamera);
      h.setProgress(t);
      h.resize();
    }
    requestAnimationFrame(() => requestAnimationFrame(ready));
    return;
  }

  stripEl.remove();
  const h = createScene(single, anim, () => {});
  h.setPlaying(false);
  if (cam) h.setCamera(cam);
  if (q.get('m') === '1') h.setMuscleHighlight(true);
  if (q.get('x') === '1') h.setMistakeMode(true);
  h.setProgress(parseFloat(q.get('t') || '0'));
  ready();
});
