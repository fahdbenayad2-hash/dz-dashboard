import { expect, it } from 'vitest';
import { businessDate } from '../businessDate';
it('groups timestamps around midnight by the Algeria business day', () => {
  expect(businessDate(new Date('2026-09-06T22:59:59Z'))).toBe('2026-09-06');
  expect(businessDate(new Date('2026-09-06T23:00:00Z'))).toBe('2026-09-07');
});
