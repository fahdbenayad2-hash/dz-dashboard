import { expect, it } from 'vitest';
import { toCSV } from '../csv';
it('escapes quotes, commas and line breaks and prevents formulas', () => {
  expect(toCSV([['a"b,c', '=SUM(A1)', ' +1', 'line\nnext', -20]])).toBe('"a""b,c","\'=SUM(A1)","\' +1","line\nnext","-20"');
});
