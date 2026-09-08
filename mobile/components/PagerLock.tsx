import { createContext, useContext } from 'react';

/**
 * Lets a screen with its own horizontal gestures (the Home board's room
 * dragging) pause tab swiping while a drag is in progress.
 */
export const PagerLockContext = createContext<(locked: boolean) => void>(() => {});

export function usePagerLock() {
  return useContext(PagerLockContext);
}
