import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTitle, ChartTooltip, Legend, Filler);

interface LineChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  title?: string;
}

export function LineChart({ labels, datasets, title }: LineChartProps) {
  const chartData = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color || (i === 0 ? '#378ADD' : '#1D9E75'),
      backgroundColor: ds.color
        ? ds.color + '15'
        : i === 0 ? '#378ADD15' : '#1D9E7515',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
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

  return <Line data={chartData} options={options} />;
}
