/**
 * Dev-only harness for eyeballing a form model without going through the app's
 * lock screen. Vite builds index.html only, so this page never ships.
 *
 *   pnpm dev
 *   open /formviewer/preview.html?id=TRICEP_PUSHDOWN&t=0.48&cam=side
 *
 * `t` is the position in the rep (0..1) and `cam` is front | side | 45. The
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
  (window as unknown as { __ready: boolean }).__ready = true;
});
