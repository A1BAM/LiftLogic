import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  afterEach(cleanup);

  const renderModal = (props: Partial<React.ComponentProps<typeof Modal>> = {}) =>
    render(
      <Modal onClose={props.onClose ?? vi.fn()} title="Swap this lift" {...props}>
        <button>First</button>
        <button>Last</button>
      </Modal>
    );

  it('names the dialog by its heading', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Screen readers announce the dialog by its own title rather than "dialog".
    expect(dialog).toHaveAccessibleName('Swap this lift');
  });

  it('closes on the close button, the backdrop and Escape', async () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not close when the panel itself is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await userEvent.setup().click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog and restores it on the way out', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = renderModal();
    // The panel takes focus, not a field: a dialog that grabbed a text input
    // would raise the keyboard on a phone unasked.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')));

    unmount();
    await waitFor(() => expect(document.activeElement).toBe(opener));
    opener.remove();
  });

  it('keeps Tab inside the dialog', async () => {
    renderModal();
    const user = userEvent.setup();
    const close = screen.getByLabelText('Close');
    const last = screen.getByText('Last');

    // Forwards off the end wraps to the first control rather than reaching the
    // workout behind the dialog.
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);

    // And backwards off the front wraps to the last.
    close.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it('shows a subtitle and extra header controls when given them', () => {
    renderModal({
      subtitle: 'Log each set individually',
      headerActions: <button>Export</button>
    });
    expect(screen.getByText('Log each set individually')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    // The shell's own close button is still there alongside them.
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('rises from the bottom edge on phones in sheet form', () => {
    const { container } = renderModal({ variant: 'sheet' });
    expect((container.firstChild as HTMLElement).className).toContain('items-end');
  });
});
