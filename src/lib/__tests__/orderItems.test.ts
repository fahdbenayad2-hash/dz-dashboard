import { describe, expect, it } from 'vitest';
import type { TrackingOrder } from '@/types';
import { expandProductOrders, itemSubtotal, parseOrderItems } from '../orderItems';

const tracking = (overrides: Partial<TrackingOrder> = {}): TrackingOrder => ({
  orderId: '26119', date: new Date('2026-09-08T12:00:00Z'), agent: 'agent', customer: 'customer',
  wilaya: 'Alger', trackingStatus: 'Livré', statusCategory: 'delivered', product: '[سلة متعددة المنتجات]',
  total: 16000, delivery: 800, driver: 'driver', ...overrides,
});

describe('Octomatic line items', () => {
  it('parses unit price and quantity from the verified order format', () => {
    const items = parseOrderItems(JSON.stringify([{ product_id: 385, price: '7600', quantity: 2, product: { name: 'طقم القمر' } }]));
    expect(items).toEqual([{ productId: '385', name: 'طقم القمر', quantity: 2, unitPrice: 7600 }]);
    expect(itemSubtotal(items)).toBe(15200);
    const [row] = expandProductOrders([tracking({ items })]);
    expect(row.product).toBe('طقم القمر');
    expect(row.quantity).toBe(2);
    expect(row.total).toBe(16000);
  });

  it('allocates a basket total and shipping exactly once across its products', () => {
    const items = parseOrderItems(JSON.stringify([
      { product_id: 1, price: '1000', quantity: 1, product: { name: 'A' } },
      { product_id: 2, price: '2000', quantity: 2, product: { name: 'B' } },
    ]));
    const rows = expandProductOrders([tracking({ items, total: 5555, delivery: 777 })]);
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, row) => sum + row.total, 0)).toBe(5555);
    expect(rows.reduce((sum, row) => sum + row.delivery, 0)).toBe(777);
    expect(rows.map(row => row.quantity)).toEqual([1, 2]);
  });

  it('keeps the order visible and flags missing item details', () => {
    const [row] = expandProductOrders([tracking({ items: parseOrderItems('not-json') })]);
    expect(row.product).toBe('[سلة متعددة المنتجات]');
    expect(row.itemDataMissing).toBe(true);
  });
});
