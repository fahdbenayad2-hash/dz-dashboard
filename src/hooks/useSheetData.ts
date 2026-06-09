import { useState, useEffect, useCallback, useRef } from 'react';
import type { Order } from '@/types';
import { fetchOrders } from '@/lib/sheetsApi';

export function useSheetData() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await fetchOrders();
      setOrders(data);
      setError(null);
    } catch {
      if (!initialLoadDone.current) {
        setError('تعذر تحميل البيانات');
      }
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 60000);
    return () => clearInterval(interval);
  }, [load]);

  const refresh = useCallback(() => load(false), [load]);

  return { orders, loading, error, refresh };
}
