import React from 'react';

/**
 * Drifting bubbles, as background. Pointer-events are off and they are kept to
 * the middle band of the screen: a bubble behind a line of text costs more in
 * legibility than it adds in atmosphere.
 */
export const Bubbles: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
    <span className="bubble h-32 w-32 left-[-34px] top-[24%] opacity-70" />
    <span className="bubble h-36 w-36 right-[-40px] top-[36%] opacity-60" />
    <span className="bubble h-12 w-12 left-[32%] top-[54%] opacity-65" />
    <span className="bubble h-20 w-20 right-[16%] top-[64%] opacity-50" />
    <span className="bubble h-7 w-7 left-[14%] top-[70%] opacity-70" />
    <span className="bubble h-5 w-5 right-[38%] top-[46%] opacity-60" />
  </div>
);
