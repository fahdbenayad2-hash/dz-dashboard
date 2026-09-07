import { fetchOrders } from '@/lib/sheetsApi';
import { useRemoteData } from './useRemoteData';
export function useSheetData() {
  const { data: orders, ...state } = useRemoteData(fetchOrders);
  return { orders, ...state };
}
