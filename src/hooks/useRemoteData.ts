import { useCallback, useEffect, useRef, useState } from 'react';

export function useRemoteData<T>(fetcher: (signal?: AbortSignal) => Promise<T[]>) {
  const [state, setState] = useState<{ data: T[]; loading: boolean; refreshing: boolean; error: string | null; lastUpdated: Date | null }>({
    data: [], loading: true, refreshing: false, error: null, lastUpdated: null,
  });
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState(previous => ({ ...previous, refreshing: true }));
    try {
      const data = await fetcher(controller.signal);
      if (!controller.signal.aborted) setState({ data, loading: false, refreshing: false, error: null, lastUpdated: new Date() });
    } catch {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, refreshing: false, error: 'تعذّر قراءة البيانات من Google Sheets. أعد المحاولة.' }));
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [fetcher]);

  useEffect(() => {
    const initial = setTimeout(() => { void refresh(); }, 0);
    const interval = setInterval(() => { void refresh(); }, 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      active.current?.abort();
      active.current = null;
    };
  }, [refresh]);
  return { ...state, refresh };
}
