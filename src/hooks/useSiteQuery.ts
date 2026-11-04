import { useCallback, useEffect, useRef, useState } from 'react';

export function useSiteQuery<T>(fetcher: (opts: { refresh: boolean }) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (refresh: boolean) => {
    setError(null);
    if (refresh) setRefreshing(true);
    try {
      setData(await fetcherRef.current({ refresh }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { data, error, refreshing, refresh: () => load(true), reload: () => load(false) };
}
