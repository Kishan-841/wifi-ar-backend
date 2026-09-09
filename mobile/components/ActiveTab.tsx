import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * Which bottom tab is currently shown. All pages stay mounted inside the
 * pager, so a screen cannot tell from its own lifecycle whether it's visible.
 */
export const ActiveTabContext = createContext<string>('');

/**
 * Run `refresh` each time this tab comes back into view.
 *
 * Fires only on the inactive→active transition — not on mount (the screen's
 * own mount effect already fetched) — so cost is exactly one small request
 * per tab switch, and nothing while the user stays put.
 */
export function useRefetchOnFocus(tabKey: string, refresh: () => void) {
  const active = useContext(ActiveTabContext) === tabKey;
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) refresh();
    wasActive.current = active;
  }, [active, refresh]);
}
