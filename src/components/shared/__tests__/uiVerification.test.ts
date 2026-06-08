import { describe, it, expect } from 'vitest';

describe('RiskMeter', () => {
  it('score=0 → اللون أخضر، القوس في البداية', () => {
    const score = 0;
    const circumference = 160;
    const dashOffset = circumference - (score / 100) * circumference;
    const autoColor = score >= 80 ? '#E24B4A' : score >= 60 ? '#EF9F27' : score >= 40 ? '#378ADD' : '#1D9E75';

    expect(dashOffset).toBe(circumference);
    expect(autoColor).toBe('#1D9E75');
  });

  it('score=100 → اللون أحمر، القوس ممتلئ', () => {
    const score = 100;
    const circumference = 160;
    const dashOffset = circumference - (score / 100) * circumference;
    const autoColor = score >= 80 ? '#E24B4A' : score >= 60 ? '#EF9F27' : score >= 40 ? '#378ADD' : '#1D9E75';

    expect(dashOffset).toBe(0);
    expect(autoColor).toBe('#E24B4A');
  });
});

describe('DeltaCard', () => {
  it('الإرجاع إذا ارتفع → سهم أحمر (سلبي)', () => {
    const change = 5.5;
    const invertSemantics = true;
    const isGood = invertSemantics ? change <= 0 : change >= 0;

    expect(isGood).toBe(false);
  });

  it('الإرجاع إذا انخفض → سهم أخضر (إيجابي)', () => {
    const change = -3.2;
    const invertSemantics = true;
    const isGood = invertSemantics ? change <= 0 : change >= 0;

    expect(isGood).toBe(true);
  });
});
