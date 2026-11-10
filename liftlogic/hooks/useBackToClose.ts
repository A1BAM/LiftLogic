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

const depthOf = (state: unknown): number =>
  (state && typeof state === 'object' && Number((state as { liftlogic?: unknown }).liftlogic)) || 0;

export function useBackToClose(isOpen: boolean, onClose: () => void): void {
  // The latest handler without re-running the effect: a new entry must only
  // ever be pushed when the layer actually opens.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const mine = ++depth;
    window.history.pushState({ liftlogic: mine }, '');
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
