/**
 * Dev-only harness for eyeballing a form model without going through the app's
 * lock screen. Vite builds index.html only, so this page never ships.
 *
 *   pnpm dev
 *   open /formviewer/preview.html?id=TRICEP_PUSHDOWN&t=0.48&cam=side&m=1
 *
 * `t` is the position in the rep (0..1), `cam` is front | side | 45, `m=1`
 * turns on the target-muscle highlight and `x=1` plays the mistake. The
 * page sets window.__ready once the scene is up, so a screenshot script can
 * wait on it.
 */
import { createScene } from './scene';
import { loadAnimation } from './loader';

const id = new URLSearchParams(location.search).get('id') || 'TRICEP_PUSHDOWN';
const at = parseFloat(new URLSearchParams(location.search).get('t') || '0');
const cam = (new URLSearchParams(location.search).get('cam') || '') as never;

const canvas = document.getElementById('c') as HTMLCanvasElement;
loadAnimation(id).then(anim => {
  const h = createScene(canvas, anim, () => {});
  h.setPlaying(false);
  h.setProgress(at);
  if (cam) h.setCamera(cam);
  const q = new URLSearchParams(location.search);
  if (q.get('m') === '1') h.setMuscleHighlight(true);
  if (q.get('x') === '1') h.setMistakeMode(true);
  h.setProgress(at);
  (window as unknown as { __ready: boolean }).__ready = true;
});
