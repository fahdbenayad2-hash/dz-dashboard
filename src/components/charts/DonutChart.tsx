import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutChartProps {
  labels: string[];
  values: number[];
  colors?: string[];
  title?: string;
}

export function DonutChart({ labels, values, colors, title }: DonutChartProps) {
  const defaultColors = ['#1D9E75', '#E24B4A', '#EF9F27', '#7F77DD'];

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors || defaultColors,
        borderWidth: 2,
        borderColor: 'var(--color-card)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 16,
          usePointStyle: true,
          font: { size: 12, family: 'Cairo' },
          color: '#6B7280',
        },
      },
      title: title ? {
        display: true,
        text: title,
        color: '#6B7280',
        font: { size: 13, family: 'Cairo' },
      } : undefined,
    },
  };

  return <Doughnut data={data} options={options} />;
}
