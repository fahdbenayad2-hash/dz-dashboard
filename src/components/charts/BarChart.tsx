import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, ChartTooltip, Legend);

interface BarChartProps {
  labels: string[];
  values: number[];
  title?: string;
  color?: string;
  horizontal?: boolean;
}

export function BarChart({ labels, values, title, color = '#378ADD', horizontal }: BarChartProps) {
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: color,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    indexAxis: horizontal ? 'y' as const : 'x' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: title ? { display: true, text: title, color: '#6B7280', font: { size: 13, family: 'Cairo' } } : undefined,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6B7280', font: { size: 11, family: 'Cairo' } },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks: { color: '#6B7280', font: { size: 11, family: 'Cairo' } },
      },
    },
  };

  return <Bar data={data} options={options} />;
}
