import { useCallback, useEffect, useRef, useState } from 'react';

import type { ListParams, Page } from './api';

export const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/**
 * Server-paged list with search.
 *
 * - `query` is what the user types; the request fires DEBOUNCE_MS after the
 *   last keystroke, so a 7-letter search costs one request, not seven.
 * - `refresh()` reloads page one for the current query (pull-to-refresh, tab
 *   focus, after a create/delete). `loadMore()` appends the next page.
 * - Stale responses are dropped: a slow "kit" reply can't overwrite "kitchen".
 */
export function usePagedList<T>(fetcher: (p: ListParams) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const pageResult = await fetcher({ q: debounced, offset: 0, limit: PAGE_SIZE });
      if (id !== requestId.current) return;
      setItems(pageResult.items);
      setTotal(pageResult.total);
      setNextOffset(pageResult.nextOffset);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(String((e as Error).message ?? e));
      setItems((prev) => prev ?? []);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetcher, debounced]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (nextOffset == null || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const pageResult = await fetcher({ q: debounced, offset: nextOffset, limit: PAGE_SIZE });
      if (id !== requestId.current) return;
      setItems((prev) => [...(prev ?? []), ...pageResult.items]);
      setTotal(pageResult.total);
      setNextOffset(pageResult.nextOffset);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoadingMore(false);
    }
  }, [fetcher, debounced, nextOffset, loadingMore]);

  return {
    items,
    total,
    query,
    setQuery,
    /** True while typing has changed the query but the request hasn't fired yet. */
    searching: query.trim() !== debounced,
    loading,
    loadingMore,
    hasMore: nextOffset != null,
    error,
    refresh,
    loadMore,
  };
}
