import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Play, Pause, RotateCcw, AlertTriangle, Flame } from 'lucide-react';
import { ExerciseDef } from '../types';
import { loadAnimation } from '../formviewer/loader';
import { useEscapeKey } from './Modal';
import { createScene, type SceneHandle, type CameraPreset, type CueLabel } from '../formviewer/scene';
import type { AnimationFile } from '../formviewer/types';
import { logger } from '../utils/logger';

interface FormViewerModalProps {
  exercise: ExerciseDef;
  onClose: () => void;
  /** Closes the viewer and puts the cursor in the weight field. */
  onLogSet: () => void;
}

const CAMERAS: CameraPreset[] = ['front', 'side', '45'];

export const FormViewerModal: React.FC<FormViewerModalProps> = ({ exercise, onClose, onLogSet }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const lastTapRef = useRef(0);

  const [anim, setAnim] = useState<AnimationFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cues, setCues] = useState<CueLabel[]>([]);
  const [playing, setPlaying] = useState(true);
  const [scrub, setScrub] = useState(0);
  const [mistake, setMistake] = useState(false);
  const [muscles, setMuscles] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAnimation(exercise.id)
      .then(a => { if (!cancelled) setAnim(a); })
      .catch(err => {
        logger.error('Failed to load form model', err);
        if (!cancelled) setError('This exercise has no form model yet.');
      });
    return () => { cancelled = true; };
  }, [exercise.id]);

  // Build the scene once the model is in hand, and tear it down on close so
  // the render loop is not left running behind a dismissed modal.
  useEffect(() => {
    if (!anim || !canvasRef.current) return;
    const handle = createScene(canvasRef.current, anim, setCues);
    sceneRef.current = handle;

    const onResize = () => handle.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    let raf = 0;
    const tick = () => { setScrub(handle.getProgress()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      handle.dispose();
      sceneRef.current = null;
    };
  }, [anim]);

  // Stop rendering while the tab is hidden, so it cannot drain the battery
  // in a pocket mid-workout.
  useEffect(() => {
    const onVisibility = () => sceneRef.current?.setPlaying(!document.hidden && playing);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [playing]);

  // The shell in Modal does not fit here: this one is full screen, has no
  // backdrop to dismiss over the canvas, and carries its own header controls.
  // Escape should still close it, so that much is shared.
  useEscapeKey(onClose);

  const togglePlay = useCallback(() => {
    setPlaying(p => { sceneRef.current?.setPlaying(!p); return !p; });
  }, []);

  const handleScrub = (value: number) => {
    setScrub(value);
    sceneRef.current?.setProgress(value);
    if (playing) { setPlaying(false); sceneRef.current?.setPlaying(false); }
  };

  // Double tap anywhere on the canvas returns to the lift's default view.
  const onCanvasPointerUp = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      sceneRef.current?.setCamera(anim?.defaultCamera ?? 'side');
    }
    lastTapRef.current = now;
  };

  const toggleMistake = () => {
    setMistake(m => { sceneRef.current?.setMistakeMode(!m); return !m; });
  };
  const toggleMuscles = () => {
    setMuscles(m => { sceneRef.current?.setMuscleHighlight(!m); return !m; });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col" role="dialog" aria-modal="true"
         aria-label={`Form guide for ${exercise.name}`}>
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2 shrink-0">
        <div className="min-w-0 pr-3">
          <h2 className="text-lg font-bold text-slate-100 truncate">{exercise.name}</h2>
          {anim && <p className="text-xs text-slate-400 truncate">{anim.resolvedAs}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Close form guide"
          className="shrink-0 p-3 -mr-1 -mt-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
        >
          <X size={22} />
        </button>
      </div>

      {/* Figure: top two-thirds */}
      <div className="relative flex-[2] min-h-0 mx-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-slate-400 text-sm">
            {error}
          </div>
        ) : !anim ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
            Loading form model…
          </div>
        ) : null}

        <canvas
          ref={canvasRef}
          onPointerUp={onCanvasPointerUp}
          className="w-full h-full block"
          // Safari must not steal the gesture and scroll the log behind us.
          style={{ touchAction: 'none' }}
        />

        {/* Cue text floats beside its own arrow rather than sitting in a
            paragraph under the model. */}
        {anim && cues.map(c => (
          <div
            key={c.id}
            className="pointer-events-none absolute max-w-[47%] text-[11px] leading-snug font-medium px-2 py-1 rounded-lg bg-slate-900/85 border"
            style={{
              left: Math.min(Math.max(c.x + 10, 4), Math.max(4, (canvasRef.current?.clientWidth ?? 320) - 150)),
              top: Math.min(Math.max(c.y - 12, 4), Math.max(4, (canvasRef.current?.clientHeight ?? 320) - 46)),
              opacity: c.opacity,
              borderColor: c.color,
              color: c.color
            }}
          >
            {c.cue}
          </div>
        ))}

        {/* Camera presets */}
        <div className="absolute top-2 left-2 flex gap-1">
          {CAMERAS.map(p => (
            <button
              key={p}
              onClick={() => sceneRef.current?.setCamera(p)}
              className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md bg-slate-800/90 text-slate-300 border border-slate-700 active:bg-slate-700"
            >
              {p === '45' ? '45°' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Controls and cues: bottom third */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="shrink-0 p-2.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <input
            type="range" min={0} max={1} step={0.001} value={scrub}
            onChange={e => handleScrub(parseFloat(e.target.value))}
            aria-label="Scrub through the rep"
            className="flex-1 accent-blue-500"
            style={{ touchAction: 'none' }}
          />
          <button
            onClick={() => sceneRef.current?.setCamera(anim?.defaultCamera ?? 'side')}
            aria-label="Reset camera"
            className="shrink-0 p-2.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleMistake}
            aria-pressed={mistake}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold border transition-colors ${
              mistake
                ? 'bg-red-900/40 border-red-600 text-red-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <AlertTriangle size={15} /> Common mistake
          </button>
          <button
            onClick={toggleMuscles}
            aria-pressed={muscles}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold border transition-colors ${
              muscles
                ? 'bg-red-900/40 border-red-600 text-red-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Flame size={15} /> Target muscles
          </button>
        </div>

        {mistake && anim && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-3">
            <p className="text-xs font-bold text-red-300 mb-1">{anim.mistake.label}</p>
            <p className="text-xs text-red-200/90 leading-snug">{anim.mistake.cue}</p>
          </div>
        )}

        <button
          onClick={onLogSet}
          className="w-full py-3.5 rounded-xl bg-blue-600 active:bg-blue-700 text-white font-bold text-sm"
        >
          Log this set
        </button>
      </div>
    </div>
  );
};

export default FormViewerModal;
