import { Bar, Line } from 'react-chartjs-2'
import {
  BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend)

const ACCENT = '#1f5c4a'
const MUTED = '#7a7466'
const tick = { color: MUTED, font: { family: 'Outfit' } }
const grid = { color: '#e4ddcf' }

const barOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { ...tick, maxRotation: 0, autoSkip: true } },
    y: { beginAtZero: true, grid, ticks: tick },
  },
}

export function BarChart({ labels, values }: { labels: string[]; values: number[] }) {
  return (
    <div className="h-56">
      <Bar
        options={barOptions}
        data={{ labels, datasets: [{ data: values, backgroundColor: ACCENT, borderRadius: 4 }] }}
      />
    </div>
  )
}

export function WeightChart({ labels, actual, target }: { labels: string[]; actual: number[]; target: number | null }) {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: target !== null, labels: { color: MUTED } } },
    scales: {
      x: { grid: { display: false }, ticks: { ...tick, maxRotation: 0, autoSkip: true } },
      y: { grid, ticks: tick },
    },
  }
  const datasets = [
    { label: 'Weight (kg)', data: actual, borderColor: ACCENT, backgroundColor: ACCENT, pointRadius: 3, tension: 0.25 },
    ...(target !== null
      ? [{ label: 'Target', data: labels.map(() => target), borderColor: MUTED, backgroundColor: MUTED, borderDash: [6, 4], pointRadius: 0 }]
      : []),
  ]
  return (
    <div className="h-56">
      <Line options={options} data={{ labels, datasets }} />
    </div>
  )
}
