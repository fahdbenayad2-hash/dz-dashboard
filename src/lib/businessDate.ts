const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });
const dateCache = new WeakMap<Date, { time: number; key: string }>();

export function businessDate(date: Date): string {
  const time = date.getTime();
  if (Number.isNaN(time)) throw new Error('Invalid business date');
  const cached = dateCache.get(date);
  if (cached?.time === time) return cached.key;
  const parts = formatter.formatToParts(date);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  const key = `${value('year')}-${value('month')}-${value('day')}`;
  dateCache.set(date, { time, key });
  return key;
}
