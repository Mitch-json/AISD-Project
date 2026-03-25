import { useEffect, useRef } from 'react'
import Layout from '../components/Layout'

// We load Chart.js from CDN via a useChartJS hook
function useChartJS(callback, deps = []) {
  const canvasRef = useRef(null)
  useEffect(() => {
    let chart = null
    const tryInit = () => {
      if (typeof window.Chart === 'undefined') {
        setTimeout(tryInit, 100)
        return
      }
      if (canvasRef.current) chart = callback(canvasRef.current, window.Chart)
    }
    tryInit()
    return () => { if (chart) chart.destroy() }
  }, deps)
  return canvasRef
}

// Shared chart defaults
const COLORS = {
  blue: '#4e73df', green: '#1cc88a', red: '#e74a3b', yellow: '#f6c23e',
  cyan: '#36b9cc', purple: '#6f42c1', orange: '#fd7e14', pink: '#e83e8c',
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const genData = (n, min, max) => Array.from({ length: n }, () => Math.floor(Math.random() * (max - min) + min))

// ── Chart Components ───────────────────────────────────────────────────────────

function LineChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label: 'Dataset 1', data: genData(12, 1000, 8000), borderColor: COLORS.blue, backgroundColor: COLORS.blue + '22', tension: 0.4, fill: true },
          { label: 'Dataset 2', data: genData(12, 1000, 8000), borderColor: COLORS.green, backgroundColor: COLORS.green + '22', tension: 0.4, fill: true },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  })
  return <canvas ref={ref} />
}

function AreaChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label: 'Revenue', data: genData(12, 2000, 10000), borderColor: COLORS.purple, backgroundColor: COLORS.purple + '44', tension: 0.4, fill: true },
          { label: 'Expenses', data: genData(12, 1000, 6000), borderColor: COLORS.orange, backgroundColor: COLORS.orange + '44', tension: 0.4, fill: true },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  })
  return <canvas ref={ref} />
}

function ScatterChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'Set A', data: Array.from({ length: 30 }, () => ({ x: Math.random() * 100, y: Math.random() * 100 })), backgroundColor: COLORS.blue + 'bb' },
          { label: 'Set B', data: Array.from({ length: 30 }, () => ({ x: Math.random() * 100, y: Math.random() * 100 })), backgroundColor: COLORS.red + 'bb' },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  })
  return <canvas ref={ref} />
}

function BarChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Dataset 1', data: genData(12, 1000, 8000), backgroundColor: COLORS.blue + 'cc' },
          { label: 'Dataset 2', data: genData(12, 1000, 8000), backgroundColor: COLORS.green + 'cc' },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  })
  return <canvas ref={ref} />
}

function DoughnutChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple'],
        datasets: [{
          data: [300, 220, 150, 180, 100],
          backgroundColor: Object.values(COLORS),
          hoverOffset: 16,          // segments lift outward on hover — matches original
          hoverBorderWidth: 0,
          borderWidth: 2,
          borderColor: 'transparent',
        }],
      },
      options: {
        responsive: true,
        cutout: '70%',              // matches original doughnut hole size
        animation: { animateRotate: true, animateScale: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { enabled: true },
        },
      },
    })
  })
  return <canvas ref={ref} />
}

function PolarChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'polarArea',
      data: {
        labels: ['Red', 'Green', 'Yellow', 'Grey', 'Blue'],
        datasets: [{ data: [11, 16, 7, 3, 14], backgroundColor: Object.values(COLORS).map(c => c + 'bb') }],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  })
  return <canvas ref={ref} />
}

function RadarChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Eating', 'Drinking', 'Sleeping', 'Designing', 'Coding', 'Cycling', 'Running'],
        datasets: [
          { label: 'My First Dataset', data: [65, 59, 90, 81, 56, 55, 40], borderColor: COLORS.blue, backgroundColor: COLORS.blue + '33' },
          { label: 'My Second Dataset', data: [28, 48, 40, 19, 96, 27, 100], borderColor: COLORS.red, backgroundColor: COLORS.red + '33' },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  })
  return <canvas ref={ref} />
}

function MixedChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months.slice(0, 7),
        datasets: [
          { type: 'bar', label: 'Bar Dataset', data: genData(7, 1000, 8000), backgroundColor: COLORS.blue + 'cc' },
          { type: 'line', label: 'Line Dataset', data: genData(7, 2000, 9000), borderColor: COLORS.red, tension: 0.4, fill: false },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  })
  return <canvas ref={ref} />
}

function BubbleChart() {
  const ref = useChartJS((canvas, Chart) => {
    return new Chart(canvas, {
      type: 'bubble',
      data: {
        datasets: [
          {
            label: 'Dataset 1',
            data: Array.from({ length: 12 }, () => ({ x: Math.random() * 200 - 100, y: Math.random() * 200 - 100, r: Math.random() * 20 + 5 })),
            backgroundColor: COLORS.blue + 'bb',
          },
          {
            label: 'Dataset 2',
            data: Array.from({ length: 12 }, () => ({ x: Math.random() * 200 - 100, y: Math.random() * 200 - 100, r: Math.random() * 20 + 5 })),
            backgroundColor: COLORS.red + 'bb',
          },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  })
  return <canvas ref={ref} />
}

// ── Pie Progress (Easy Pie Chart equivalent) ──────────────────────────────────
function PieProgress({ title, value, color }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cx = canvas.width / 2, cy = canvas.height / 2, r = 44
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 8; ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (value / 100) * Math.PI * 2)
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke()
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--c-text-base') || '#333'
    ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${value}%`, cx, cy)
  }, [value, color])
  return (
    <div className="pie-progress">
      <canvas ref={canvasRef} width={104} height={104} />
      <p className="pie-progress__title">{title}</p>
    </div>
  )
}

// ── Sparkline (inline mini charts) ───────────────────────────────────────────
function SparkLine({ data, color, type = 'line', height = 40, label }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)
    const max = Math.max(...data.map(v => Array.isArray(v) ? Math.max(...v) : v))
    const min = Math.min(...data.map(v => Array.isArray(v) ? Math.min(...v) : v))
    const range = max - min || 1
    const barW = w / data.length * 0.7
    data.forEach((v, i) => {
      const val = Array.isArray(v) ? v[0] : v
      const x = (w / data.length) * i + (w / data.length) * 0.15
      const barH = ((val - min) / range) * (h - 8) + 4
      if (type === 'bar') {
        ctx.fillStyle = val < 0 ? '#dc3545' : color
        ctx.fillRect(x, h - barH, barW, barH)
      }
    })
    if (type === 'line') {
      ctx.beginPath()
      data.forEach((v, i) => {
        const val = Array.isArray(v) ? v[0] : v
        const x = (i / (data.length - 1)) * (w - 4) + 2
        const y = h - ((val - min) / range) * (h - 8) - 4
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke()
      ctx.lineTo(w - 2, h); ctx.lineTo(2, h); ctx.closePath()
      ctx.fillStyle = color + '33'; ctx.fill()
    }
  }, [data, color, type])
  return (
    <div className="spark-row">
      <small className="spark-row__label">{label}</small>
      <canvas ref={canvasRef} width={160} height={height} style={{ width: '100%', maxWidth: '160px' }} />
    </div>
  )
}

// ── Main Charts Page ───────────────────────────────────────────────────────────
export default function Charts() {
  // Inject Chart.js CDN if not already loaded
  useEffect(() => {
    if (document.getElementById('chartjs-cdn')) return
    const script = document.createElement('script')
    script.id = 'chartjs-cdn'
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
    document.head.appendChild(script)
  }, [])

  return (
    <Layout>
      {/* Row 1: Line + Area */}
      <div className="grid grid--2">
        <div className="card">
          <div className="card__header"><h6 className="card__title">Line Chart</h6></div>
          <div className="card__body"><LineChart /></div>
        </div>
        <div className="card">
          <div className="card__header"><h6 className="card__title">Area Chart</h6></div>
          <div className="card__body"><AreaChart /></div>
        </div>
      </div>

      {/* Row 2: Scatter + Bar */}
      <div className="grid grid--2">
        <div className="card">
          <div className="card__header"><h6 className="card__title">Scatter Chart</h6></div>
          <div className="card__body"><ScatterChart /></div>
        </div>
        <div className="card">
          <div className="card__header"><h6 className="card__title">Bar Chart</h6></div>
          <div className="card__body"><BarChart /></div>
        </div>
      </div>

      {/* Row 3: Sparklines */}
      <div className="grid grid--1">
        <div className="card">
          <div className="card__header"><h6 className="card__title">Sparklines</h6></div>
          <div className="card__body">
            <div className="grid grid--3">
              <div>
                <SparkLine label="Spark Line" data={[5, 8, 3, 11, 9, 14, 7, 12, 10, 15]} color={COLORS.blue} type="line" />
                <SparkLine label="Spark Bar" data={[5, 8, 3, 11, 9, 14, 7, 12, 10, 15]} color={COLORS.green} type="bar" />
              </div>
              <div>
                <SparkLine label="Spark Discrete" data={[4, 6, 7, 2, 8, 5, 9, 3, 6, 8]} color={COLORS.red} type="bar" />
                <SparkLine label="Spark Bullet" data={[3, 5, 2, 9, 6, 4, 8, 1, 7, 5]} color={COLORS.yellow} type="bar" />
              </div>
              <div>
                <SparkLine label="Spark Box" data={[2, 4, 8, 5, 9, 3, 7, 6, 4, 8]} color={COLORS.purple} type="line" />
                <SparkLine label="Spark Tristate" data={[3, -2, 5, -1, 4, -3, 2, 6, -2, 4]} color={COLORS.cyan} type="bar" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Doughnut + Polar + Radar */}
      <div className="grid grid--3">
        <div className="card">
          <div className="card__header"><h6 className="card__title">Doughnut Chart</h6></div>
          <div className="card__body"><DoughnutChart /></div>
        </div>
        <div className="card">
          <div className="card__header"><h6 className="card__title">Polar Area Chart</h6></div>
          <div className="card__body"><PolarChart /></div>
        </div>
        <div className="card">
          <div className="card__header"><h6 className="card__title">Radar Chart</h6></div>
          <div className="card__body"><RadarChart /></div>
        </div>
      </div>

      {/* Row 5: Mixed + Bubble */}
      <div className="grid grid--2">
        <div className="card">
          <div className="card__header"><h6 className="card__title">Mixed Chart</h6></div>
          <div className="card__body"><MixedChart /></div>
        </div>
        <div className="card">
          <div className="card__header"><h6 className="card__title">Bubble Chart</h6></div>
          <div className="card__body"><BubbleChart /></div>
        </div>
      </div>

      {/* Row 6: Easy Pie Charts */}
      <div className="grid grid--1">
        <div className="card">
          <div className="card__header"><h6 className="card__title">Easy Pie Charts</h6></div>
          <div className="card__body">
            <div className="pie-row">
              <PieProgress title="New Users" value={75} color={COLORS.blue} />
              <PieProgress title="New Purchases" value={60} color={COLORS.green} />
              <PieProgress title="New Customers" value={85} color={COLORS.yellow} />
              <PieProgress title="Bounce Rate" value={33} color={COLORS.red} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
