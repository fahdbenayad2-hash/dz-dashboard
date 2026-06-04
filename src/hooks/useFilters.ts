import { useState, useMemo, useCallback } from 'react';
import type { Order, OrderStatus, FilterState } from '@/types';

export function useFilters(orders: Order[]) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    statusFilter: [],
    wilayaFilter: [],
    agentFilter: [],
    dateRange: null,
    totalMin: null,
    totalMax: null,
  });

  const [sortKey, setSortKey] = useState<keyof Order | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleSort = useCallback((key: keyof Order) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(o =>
        o.customer.toLowerCase().includes(q) ||
        o.wilaya.toLowerCase().includes(q) ||
        o.agent.toLowerCase().includes(q) ||
        o.product.toLowerCase().includes(q) ||
        String(o.id).includes(q)
      );
    }

    if (filters.statusFilter.length > 0) {
      result = result.filter(o => filters.statusFilter.includes(o.status));
    }

    if (filters.wilayaFilter.length > 0) {
      result = result.filter(o => filters.wilayaFilter.includes(o.wilaya));
    }

    if (filters.agentFilter.length > 0) {
      result = result.filter(o => filters.agentFilter.includes(o.agent));
    }

    if (filters.dateRange) {
      result = result.filter(o => {
        const d = new Date(o.date);
        return d >= new Date(filters.dateRange!.from) && d <= new Date(filters.dateRange!.to + 'T23:59:59');
      });
    }

    if (filters.totalMin !== null) {
      result = result.filter(o => o.total >= filters.totalMin!);
    }
    if (filters.totalMax !== null) {
      result = result.filter(o => o.total <= filters.totalMax!);
    }

    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc'
          ? (Number(aVal) - Number(bVal))
          : (Number(bVal) - Number(aVal));
      });
    }

    return result;
  }, [orders, filters, sortKey, sortDir]);

  const getUniqueValues = useCallback((key: keyof Order) => {
    return [...new Set(orders.map(o => String(o[key])))]
      .filter(Boolean)
      .sort();
  }, [orders]);

  const uniqueStatuses = useMemo(() => getUniqueValues('status') as OrderStatus[], [getUniqueValues]);
  const uniqueWilayas = useMemo(() => getUniqueValues('wilaya'), [getUniqueValues]);
  const uniqueAgents = useMemo(() => getUniqueValues('agent'), [getUniqueValues]);

  return {
    filters, updateFilter, sortKey, sortDir, toggleSort,
    filteredOrders, uniqueStatuses, uniqueWilayas, uniqueAgents,
  };
}
