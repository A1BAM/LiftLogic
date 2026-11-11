import { useEffect, useRef } from 'react';

/**
 * Lets the iPhone's back gesture do what it does everywhere else on the phone:
 * swiping in from the left edge closes the sheet or leaves the workout,
 * instead of throwing you out of the app altogether.
 *
 * Each open layer pushes one history entry tagged with its depth. A back
 * navigation that lands below that depth closes the layer; closing it from
 * the screen (the X, the chevron) steps history back so the two stay in sync.
 */
let depth = 0;

/**
 * Marks entries pushed by this page load. History outlives a reload — and iOS
 * reloads the page whenever it has thrown the tab away — but the layers those
 * old entries stood for are gone. Without this, an entry left over from before
 * the reload reads as "still inside the workout" and swallows a back swipe.
 */
const LOAD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface LayerState {
  liftlogic?: unknown;
  load?: unknown;
}

const isLayer = (state: unknown): state is LayerState =>
  !!state && typeof state === 'object' && 'liftlogic' in (state as object);

/** Depth of an entry from this load; anything else counts as the page itself. */
const depthOf = (state: unknown): number =>
  isLayer(state) && state.load === LOAD_ID ? Number(state.liftlogic) || 0 : 0;

export function useBackToClose(isOpen: boolean, onClose: () => void): void {
  // The latest handler without re-running the effect: a new entry must only
  // ever be pushed when the layer actually opens.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const mine = ++depth;
    const entry = { liftlogic: mine, load: LOAD_ID };
    // Sitting on a leftover entry from before a reload: take it over rather
    // than stack a second one the user would have to swipe through.
    if (isLayer(window.history.state) && depthOf(window.history.state) === 0) {
      window.history.replaceState(entry, '');
    } else {
      window.history.pushState(entry, '');
    }
    let closedByNavigation = false;

    const onPopState = (e: PopStateEvent) => {
      // Depth, not "any popstate": a sheet stepping history back on its own
      // close must not also close the workout underneath it.
      if (depthOf(e.state) < mine) {
        closedByNavigation = true;
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      depth = mine - 1;
      if (!closedByNavigation && depthOf(window.history.state) === mine) {
        window.history.back();
      }
    };
  }, [isOpen]);
}
