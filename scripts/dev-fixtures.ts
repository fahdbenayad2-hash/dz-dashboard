export function fixture() {
  const date = new Date().toISOString();
  const row = (values: unknown[]) => ({ c: values.map(v => ({ v })) });
  return {
    generation: 'demo-synthetic', completedAt: date,
    Orders: [row([100, date, 'عميل تجريبي', '0000000000', 'Alger', 'Confirmed', 'منتج تجريبي', 4750, 950, 'وكيل تجريبي'])],
    Tracking: [row([100, date, 'وكيل تجريبي', 'عميل تجريبي', 'Alger', 'Livré', 'منتج تجريبي', 4750, 950, 'ناقل تجريبي']), row([101, date, 'وكيل تجريبي', 'عميل تجريبي ثان', 'Oran', 'Retour', 'منتج تجريبي', 4750, 950, 'ناقل تجريبي'])],
  };
}
