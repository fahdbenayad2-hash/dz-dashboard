import { classNames } from '@/lib/utils';

interface RiskMeterProps {
  score: number;
  level: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskMeter({ score, level, color, size = 'md' }: RiskMeterProps) {
  const circumference = size === 'sm' ? 120 : size === 'lg' ? 220 : 160;
  const radius = circumference / (2 * Math.PI);
  const strokeWidth = size === 'sm' ? 6 : size === 'lg' ? 12 : 8;
  const viewBox = `0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`;
  const center = radius + strokeWidth;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className={classNames('inline-flex flex-col items-center gap-2')}>
      <svg width={center * 2} height={center * 2} viewBox={viewBox}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-500"
        />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-xl font-bold"
          fill="currentColor"
        >
          {score}
        </text>
      </svg>
      <span className={classNames(
        'font-semibold',
        size === 'sm' ? 'text-xs' : 'text-sm',
      )} style={{ color }}>
        {level}
      </span>
    </div>
  );
}
