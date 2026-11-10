import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Closes on Escape. Split out because the full-screen form viewer wants this
 * behaviour without the dialog shell below.
 */
function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onEscape]);
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

interface ModalProps {
  onClose: () => void;
  /** Heading text, or a heading with its icon. */
  title: React.ReactNode;
  /** Small line under the heading. */
  subtitle?: React.ReactNode;
  /** Controls sitting to the left of the close button. */
  headerActions?: React.ReactNode;
  /**
   * 'sheet' rises from the bottom edge on phones and centres from `sm` up,
   * which puts a thumb-heavy form within reach one-handed.
   */
  variant?: 'center' | 'sheet';
  /** For a question that must be answered with its own buttons. */
  hideClose?: boolean;
  children: React.ReactNode;
}

/**
 * The shell every dialog in the app shares: backdrop, panel, header with a
 * close button, Escape to dismiss, and the focus handling that goes with
 * `aria-modal` — focus moves into the dialog, Tab cycles inside it, and
 * whatever was focused before is restored on the way out.
 *
 * Children are the body, and any footer, inside the panel.
 */
export const Modal: React.FC<ModalProps> = ({
  onClose,
  title,
  subtitle,
  headerActions,
  variant = 'center',
  hideClose = false,
  children
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEscapeKey(onClose);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // The panel itself takes focus rather than the first control: a modal that
    // grabs a text field on open would fight the fields these dialogs focus
    // deliberately, and would pop the keyboard up on a phone unasked.
    panelRef.current?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus?.();
  }, []);

  // The page behind must not scroll while a dialog is up. Without this a
  // swipe that runs past the end of a sheet moves the workout underneath.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    // Wrap at both ends so Tab never escapes to the workout behind the dialog.
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const isSheet = variant === 'sheet';

  return (
    <div
      className={`backdrop-in fixed inset-0 z-50 flex justify-center bg-black/70 ${
        isSheet ? 'items-end sm:items-center' : 'items-center p-4'
      }`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-ink-800 w-full max-w-md border-ink-700 flex flex-col max-h-[88dvh] outline-none
          ${isSheet
            ? 'sheet-in rounded-t-2xl sm:rounded-2xl border-t sm:border'
            : 'pop-in rounded-2xl border'}`}
      >
        <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-5">
          <div className="min-w-0">
            {/* A long title wraps; the icon beside it must not be squashed to
                make room, which is what happened when each dialog rolled its
                own header. */}
            <h2 id={titleId} className="display flex items-center gap-2 text-[21px] [&>svg]:shrink-0">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-[14px] text-cream-400">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            {!hideClose && (
              <button
                onClick={onClose}
                className="btn-quiet p-2"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};
