import type { AnimationFile } from './types';

/**
 * Animation files are discovered at build time from data/animations/. Adding a
 * new file is all it takes for its exercise to light up in the UI; an exercise
 * with no file simply is not in `AVAILABLE_ANIMATION_IDS` and its button stays
 * disabled. Nothing here talks to the database.
 */
const modules = import.meta.glob('../data/animations/*.json');

const idFromPath = (p: string) => p.slice(p.lastIndexOf('/') + 1, -'.json'.length);

/** Exercise primary keys that have a form model, known synchronously. */
export const AVAILABLE_ANIMATION_IDS: ReadonlySet<string> = new Set(
  Object.keys(modules).map(idFromPath)
);

export function hasAnimation(exerciseId: string): boolean {
  return AVAILABLE_ANIMATION_IDS.has(exerciseId);
}

const cache = new Map<string, Promise<AnimationFile>>();

/** Loads one exercise's form model. Rejects if the exercise has no file. */
export function loadAnimation(exerciseId: string): Promise<AnimationFile> {
  const cached = cache.get(exerciseId);
  if (cached) return cached;

  const entry = Object.entries(modules).find(([p]) => idFromPath(p) === exerciseId);
  if (!entry) return Promise.reject(new Error(`No form model for "${exerciseId}"`));

  const promise = entry[1]().then(m => (m as { default: AnimationFile }).default);
  cache.set(exerciseId, promise);
  return promise;
}
