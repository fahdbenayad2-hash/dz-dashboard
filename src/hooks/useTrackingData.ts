import { useState, useEffect, useCallback, useRef } from 'react';
import type { TrackingOrder } from '@/types';
import { fetchTracking } from '@/lib/sheetsApi';

export function useTrackingData() {
  const [trackingOrders, setTrackingOrders] = useState<TrackingOrder[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setTrackingLoading(true);
    try {
      const data = await fetchTracking();
      setTrackingOrders(data);
      setTrackingError(null);
    } catch {
      if (!initialLoadDone.current) {
        setTrackingError('تعذر تحميل بيانات التتبع');
      }
    } finally {
      setTrackingLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 60000);
    return () => clearInterval(interval);
  }, [load]);

  const refresh = useCallback(() => load(false), [load]);

  return { trackingOrders, trackingLoading, trackingError, refresh };
}
