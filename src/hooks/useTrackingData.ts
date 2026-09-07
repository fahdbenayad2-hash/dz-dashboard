import { fetchTracking } from '@/lib/sheetsApi';
import { useRemoteData } from './useRemoteData';
export function useTrackingData() {
  const { data: trackingOrders, loading: trackingLoading, ...state } = useRemoteData(fetchTracking);
  return { trackingOrders, trackingLoading, ...state };
}
