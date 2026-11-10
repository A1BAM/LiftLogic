import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBackToClose } from './useBackToClose';

const settle = () => new Promise(r => setTimeout(r, 20));

describe('useBackToClose', () => {
  it('closes the layer when the user navigates back', async () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useBackToClose(true, onClose));

    window.history.back();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    unmount();
    await settle();
  });

  it('pushes nothing while closed', () => {
    const before = window.history.length;
    const { unmount } = renderHook(() => useBackToClose(false, vi.fn()));
    expect(window.history.length).toBe(before);
    unmount();
  });

  it('steps history back when closed from the screen, without closing the layer beneath', async () => {
    const closeDay = vi.fn();
    const closeSheet = vi.fn();
    const day = renderHook(() => useBackToClose(true, closeDay));
    const sheet = renderHook(({ open }) => useBackToClose(open, closeSheet), {
      initialProps: { open: true }
    });
    const sheetDepth = window.history.state.liftlogic;

    // The X on the sheet: it closes itself, and history follows.
    sheet.rerender({ open: false });
    await waitFor(() => expect(window.history.state.liftlogic).toBe(sheetDepth - 1));

    expect(closeDay).not.toHaveBeenCalled();
    expect(closeSheet).not.toHaveBeenCalled();

    // The next back gesture now leaves the workout.
    window.history.back();
    await waitFor(() => expect(closeDay).toHaveBeenCalledTimes(1));

    sheet.unmount();
    day.unmount();
    await settle();
  });
});
