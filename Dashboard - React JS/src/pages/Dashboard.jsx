import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
// forecastData is populated at runtime by fetching from the API.
// All components reference this variable directly — no prop drilling needed.
let forecastData = {}

// ── Stat Card — .bd.bgc-white, peers.ai-sb.fxw-nw: sparkline left + pill right ─
function StatCard({ title, trend, pillClass, sparkData, color }) {
  const canvasRef = useRef(null)

  const drawBars = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.offsetWidth || canvas.width
    const h = canvas.height
    // Resolve CSS variable colors at draw time
    const resolvedColor = color.startsWith('var(')
      ? getComputedStyle(document.documentElement)
          .getPropertyValue(color.slice(4, color.indexOf(',')).trim())
          .trim() || color.split(',')[1].replace(')','').trim()
      : color
    const fixedH = 20  // matches original style="height:20px"
    canvas.height = fixedH
    ctx.clearRect(0, 0, w, fixedH)
    const max = Math.max(...sparkData)
    const count = sparkData.length
    const gap = 2
    const barW = Math.max(2, Math.floor((w - gap * (count - 1)) / count))
    sparkData.forEach((v, i) => {
      const barH = Math.max(2, (v / max) * (fixedH - 1))
      const x = i * (barW + gap)
      const y = fixedH - barH
      ctx.fillStyle = resolvedColor
      ctx.fillRect(x, y, barW, barH)
    })
  }

  useEffect(() => {
    drawBars()
    const onTheme = () => drawBars()
    window.addEventListener('adminator:themeChanged', onTheme)
    return () => window.removeEventListener('adminator:themeChanged', onTheme)
  }, [sparkData, color])

  return (
    <div className="stat-card">
      {/* layer w-100 mB-10 — title row */}
      <h6 className="stat-card__title">{title}</h6>
      {/* layer w-100 — body row: peers ai-sb fxw-nw */}
      <div className="stat-card__body">
        {/* peer peer-greed — canvas fixed w:100px h:20px */}
        <canvas ref={canvasRef} width={100} height={20} className="stat-card__spark" />
        {/* peer — pill badge */}
        <span className={`stat-card__pill ${pillClass}`}>{trend}</span>
      </div>
    </div>
  )
}


// ── No Data placeholder ───────────────────────────────────────────────────────
function NoDataCard({ title }) {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
  return (
    <div className="card ms-card">
      <div className="ms-card__header">
        <h6 className="card__title">{title}</h6>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:300, gap:12, color:'#72777a' }}>
        <i className="ti-email" style={{ fontSize:36, color:'#99abb4' }} />
        <div style={{ fontSize:14, fontWeight:600 }}>No Data Available</div>
        <div style={{ fontSize:12, color:'#99abb4' }}>This country has no energy data in the dataset.</div>
      </div>
    </div>
  )
}

// ── World Vector Map ──────────────────────────────────────────────────────────
function WorldVectorMap({ onCountrySelect }) {
  const containerRef = useRef(null)
  const instanceRef = useRef(null)
  const selectedCodeRef = useRef(null)
  const countryNamesRef = useRef({})

  // Exact colors from index.js in the original Adminator repo
  const getColors = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    return {
      backgroundColor: isDark ? '#1e293b' : '#f9fafb',
      regionColor:     isDark ? '#565a5c' : '#e6eaf0',
      borderColor:     isDark ? '#72777a' : '#d3d9e3',
      hoverColor:      isDark ? '#7774e7' : '#0f9aee',
      selectedColor:   isDark ? '#37c936' : '#7774e7',
      markerFill:      isDark ? '#0f9aee' : '#7774e7',
      markerStroke:    isDark ? '#37c936' : '#0f9aee',
      textColor:       isDark ? '#99abb4' : '#72777a',
    }
  }

  const initMap = () => {
    if (!containerRef.current || !window.jsVectorMap) return

    // Destroy previous instance
    if (instanceRef.current) {
      try { instanceRef.current.destroy() } catch (_) {}
      instanceRef.current = null
    }

    // Clear container and create fresh inner div
    containerRef.current.innerHTML = ''
    const colors = getColors()

    const mapDiv = document.createElement('div')
    mapDiv.id = 'vmap-' + Date.now()
    // backgroundColor = ocean color, border + borderRadius match original index.js exactly
    mapDiv.style.cssText = [
      'width:100%',
      'height:490px',
      'position:relative',
      'overflow:hidden',
      'border-radius:8px',
      `background-color:${colors.backgroundColor}`,
      `border:1px solid ${colors.borderColor}`,
    ].join(';')
    containerRef.current.appendChild(mapDiv)

    try {
      instanceRef.current = new window.jsVectorMap({
        selector: mapDiv,
        map: 'world',
        backgroundColor: 'transparent',   // SVG itself is transparent; div provides the ocean bg
        zoomOnScroll: false,
        zoomButtons: false,
        regionStyle: {
          initial: {
            fill: colors.regionColor,
            stroke: colors.borderColor,
            'stroke-width': 1,
            'stroke-opacity': 0.4,
          },
          hover: { fill: colors.hoverColor, cursor: 'pointer' },
          selected: { fill: colors.hoverColor },
          selectedHover: { fill: colors.hoverColor },
        },
        markerStyle: {
          initial: {
            r: 7,
            fill: colors.markerFill,
            stroke: colors.markerStroke,
            'stroke-width': 2,
            'stroke-opacity': 0.4,
          },
          hover: { r: 10, fill: colors.hoverColor, 'stroke-opacity': 0.8, cursor: 'pointer' },
        },
        markers: [
          { name: 'INDIA : 350',    coords: [21.00,  78.00]   },
          { name: 'Australia : 250',coords: [-33.00, 151.00]  },
          { name: 'USA : 250',      coords: [36.77,  -119.41] },
          { name: 'UK : 250',       coords: [55.37,  -3.41]   },
          { name: 'UAE : 250',      coords: [25.20,  55.27]   },
        ],
        onMarkerTooltipShow(event, tooltip, index) {
          const marker = this.markers && this.markers[index]
          tooltip.text(marker ? marker.name : `Marker ${index + 1}`)
        },
        onRegionTooltipShow(event, tooltip, code) {
          const name = (this.mapData?.paths?.[code]?.name) || code
          tooltip.text(name)
        },
        onRegionClick(event, code) {
          const colors = getColors()
          const mapDiv = containerRef.current?.querySelector('[id^="vmap-"]')
          if (!mapDiv) return

          const name = countryNamesRef.current[code] || code
          const path = mapDiv.querySelector(`[data-code="${code}"]`)

          // Deselect previously selected country
          if (selectedCodeRef.current && selectedCodeRef.current !== code) {
            const prev = mapDiv.querySelector(`[data-code="${selectedCodeRef.current}"]`)
            if (prev) prev.style.fill = colors.regionColor
          }

          // Toggle: if same country clicked again, deselect it
          if (selectedCodeRef.current === code) {
            if (path) path.style.fill = colors.regionColor
            selectedCodeRef.current = null
            onCountrySelect && onCountrySelect(null)
          } else {
            if (path) path.style.fill = colors.hoverColor
            selectedCodeRef.current = code
            onCountrySelect && onCountrySelect(name)
          }
        },
      })
      // Pre-select United States (US) on initial load
      setTimeout(() => {
        const mapD = containerRef.current?.querySelector('[id^="vmap-"]')
        if (mapD) {
          const usPath = mapD.querySelector('[data-code="US"]')
          if (usPath) {
            usPath.style.fill = colors.hoverColor
            selectedCodeRef.current = 'US'
          }
        }
      }, 120)
    } catch (e) {
      mapDiv.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#72777a;flex-direction:column;gap:8px;background:${colors.backgroundColor};border-radius:8px;border:1px solid ${colors.borderColor}"><i style="font-size:32px;font-family:'Themify',sans-serif" class="ti-map"></i><div>World Map</div></div>`
    }
  }

  useEffect(() => {
    const loadScript = (src) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
      const s = document.createElement('script')
      s.src = src; s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })

    // Load jsvectormap CSS too
    if (!document.querySelector('link[href*="jsvectormap"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/css/jsvectormap.min.css'
      document.head.appendChild(link)
    }

    loadScript('https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/js/jsvectormap.min.js')
      .then(() => {
        // Intercept addMap BEFORE world.js loads so we capture the paths when it calls addMap
        const orig = window.jsVectorMap.addMap.bind(window.jsVectorMap)
        window.jsVectorMap.addMap = (mapName, data) => {
          if (mapName === 'world') {
            countryNamesRef.current = Object.fromEntries(
              Object.entries(data.paths || {}).map(([c, v]) => [c, v.name || c])
            )
          }
          return orig(mapName, data)
        }
      })
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/maps/world.js'))
      .then(() => {
        // If world.js was already cached, addMap was already called — re-extract from the instance
        if (Object.keys(countryNamesRef.current).length === 0) {
          const inst = new window.jsVectorMap({ selector: document.createElement('div'), map: 'world' })
          try {
            const paths = inst?.mapData?.paths || inst?.params?.mapData?.paths || {}
            if (Object.keys(paths).length > 0) {
              countryNamesRef.current = Object.fromEntries(
                Object.entries(paths).map(([c, v]) => [c, v.name || c])
              )
            }
            inst.destroy()
          } catch(_) {}
        }
        setTimeout(initMap, 50)
      })

    // Re-init on theme change
    const onTheme = () => setTimeout(initMap, 50)
    window.addEventListener('adminator:themeChanged', onTheme)

    // Re-init on resize (debounced 300ms)
    let resizeTimer
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(initMap, 300) }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('adminator:themeChanged', onTheme)
      window.removeEventListener('resize', onResize)
      clearTimeout(resizeTimer)
      if (instanceRef.current) {
        try { instanceRef.current.destroy() } catch (_) {}
        instanceRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%' }} />
}

// ── Small Pie Chart — matches original: thick stroke, dark filled center ────────
function SmallPieChart({ value, color }) {
  const canvasRef = useRef(null)

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const cx = size / 2, cy = size / 2, r = size / 2 - 10
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    ctx.clearRect(0, 0, size, size)

    // Track ring
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = isDark ? '#3a3f55' : '#e0e0e0'
    ctx.lineWidth = 10; ctx.stroke()

    // Colored arc
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (value / 100) * Math.PI * 2)
    ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.lineCap = 'butt'; ctx.stroke()

    // Dark filled center circle (like original)
    const centerBg = isDark ? '#252836' : '#ffffff'
    ctx.beginPath(); ctx.arc(cx, cy, r - 14, 0, Math.PI * 2)
    ctx.fillStyle = centerBg; ctx.fill()

    // Center text
    ctx.fillStyle = isDark ? '#e0e6ed' : '#354052'
    ctx.font = `bold ${Math.round(size * 0.18)}px Roboto, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(value + '%', cx, cy)
  }

  useEffect(() => {
    draw()
    const onTheme = () => draw()
    window.addEventListener('adminator:themeChanged', onTheme)
    return () => window.removeEventListener('adminator:themeChanged', onTheme)
  }, [value, color])

  return <canvas ref={canvasRef} width={100} height={100} style={{width:'80px',height:'80px'}} />
}



// ── Energy Risk Panel ─────────────────────────────────────────────────────────
// Computes deficit and recommendations live from forecastData —
// no pre-built file needed. Automatically reflects model updates.
function computeDeficit(country) {
  const rows = forecastData[country]
  if (!rows) return null

  const hist = rows.filter(r => r.type === 'historical')
  const fore = rows.filter(r => r.type === 'forecast')
  if (!hist.length || !fore.length) return null

  const lastHist = hist[hist.length - 1]
  const near     = fore.find(r => r.year === 2034) || fore[Math.min(9, fore.length - 1)]
  const long_    = fore[fore.length - 1]

  const buildHorizon = (r) => {
    if (!r) return null
    const gen    = r.electricity_generation ?? 0
    const demand = r.demand ?? 0
    if (demand <= gen) return null

    const gap_twh = demand - gen
    const gap_pct = gen > 0 ? gap_twh / gen * 100 : 999

    const fossil  = lastHist.fossil_electricity     ?? 0
    const renew   = lastHist.renewables_electricity ?? 0
    const nuclear = lastHist.nuclear_electricity    ?? 0
    const total   = fossil + renew + nuclear

    let rec_renew, rec_fossil, rec_nuke
    if (total > 0) {
      const rw = (renew / total) * 1.5
      const fw = (fossil / total) * 0.8
      const nw = (nuclear / total) * 1.0
      const tw = rw + fw + nw || 1
      rec_renew  = (rw / tw) * gap_twh
      rec_fossil = (fw / tw) * gap_twh
      rec_nuke   = (nw / tw) * gap_twh
    } else {
      rec_renew = gap_twh; rec_fossil = 0; rec_nuke = 0
    }

    return {
      year: r.year,
      demand: +demand.toFixed(2),
      generation: +gen.toFixed(2),
      gap_twh: +gap_twh.toFixed(2),
      gap_pct: +gap_pct.toFixed(1),
      recommendations: {
        renewables: { add_twh: +rec_renew.toFixed(2),  increase_pct: renew  > 0 ? +(rec_renew  / renew  * 100).toFixed(1) : null },
        fossil:     { add_twh: +rec_fossil.toFixed(2), increase_pct: fossil > 0 ? +(rec_fossil / fossil * 100).toFixed(1) : null },
        nuclear:    { add_twh: +rec_nuke.toFixed(2),   increase_pct: nuclear> 0 ? +(rec_nuke   / nuclear* 100).toFixed(1) : null },
      }
    }
  }

  const h2034 = buildHorizon(near)
  const h2044 = buildHorizon(long_)
  if (!h2034 && !h2044) return null

  return {
    country,
    current_gen: +(lastHist.electricity_generation ?? 0).toFixed(2),
    current_mix: {
      fossil:      +(lastHist.fossil_electricity     ?? 0).toFixed(2),
      renewables:  +(lastHist.renewables_electricity ?? 0).toFixed(2),
      nuclear:     +(lastHist.nuclear_electricity    ?? 0).toFixed(2),
    },
    '2034': h2034,
    '2044': h2044,
  }
}

function EnergyMixDonut({ activeCountry }) {
  const country = activeCountry || 'United States'
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    const loadChartJS = () => new Promise((resolve) => {
      if (window.Chart) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
      s.onload = resolve
      document.head.appendChild(s)
    })

    const initChart = () => {
      if (!canvasRef.current || !window.Chart) return
      if (chartRef.current) { chartRef.current.destroy() }

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      const rows   = forecastData[country]
      if (!rows) return
      const hist = rows.filter(r => r.type === 'historical')
      if (!hist.length) return
      const last = hist[hist.length - 1]

      const sources = [
        { label: 'Coal',    key: 'coal_electricity',     color: '#6b7280' },  // slate grey
        { label: 'Oil',     key: 'oil_electricity',      color: '#dc2626' },  // deep red
        { label: 'Gas',     key: 'gas_electricity',      color: '#f97316' },  // orange
        { label: 'Hydro',   key: 'hydro_electricity',    color: '#0ea5e9' },  // sky blue
        { label: 'Solar',   key: 'solar_electricity',    color: '#eab308' },  // amber
        { label: 'Wind',    key: 'wind_electricity',     color: '#6ee7b7' },  // teal
        { label: 'Nuclear', key: 'nuclear_electricity',  color: '#7774e7' },  // purple
        { label: 'Biofuel', key: 'biofuel_electricity',  color: '#84cc16' },  // lime
      ]

      const values  = sources.map(s => +(last[s.key] ?? 0).toFixed(3))
      const total   = values.reduce((a,b) => a+b, 0)
      const hasData = total > 0

      if (!hasData) {
        // Draw a "no data" message on the canvas
        const ctx = canvasRef.current.getContext('2d')
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        return
      }

      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'doughnut',
        data: {
          labels: sources.map(s => s.label),
          datasets: [{
            data: values,
            backgroundColor: sources.map(s => s.color + 'cc'),
            borderColor:     sources.map(s => s.color),
            borderWidth: 2,
            hoverBorderWidth: 3,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: isDark ? '#1c1f2b' : '#fff',
              titleColor: isDark ? '#e0e6ed' : '#354052',
              bodyColor:  isDark ? '#b0bec5' : '#72777a',
              borderColor: isDark ? '#313644' : '#e6eaf0',
              borderWidth: 1, padding: 10,
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed
                  const pct = total > 0 ? (v / total * 100).toFixed(1) : 0
                  return ` ${ctx.label}: ${v.toFixed(2)} TWh (${pct}%)`
                }
              }
            }
          },
          animation: { animateRotate: true, duration: 700 },
        }
      })
    }

    loadChartJS().then(() => setTimeout(initChart, 50))
    const onTheme = () => setTimeout(initChart, 50)
    window.addEventListener('adminator:themeChanged', onTheme)
    return () => {
      window.removeEventListener('adminator:themeChanged', onTheme)
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    }
  }, [country])

  // Legend items
  const rows   = forecastData[country]
  const hist   = rows ? rows.filter(r => r.type === 'historical') : []
  const last   = hist.length ? hist[hist.length - 1] : null
  const sources = [
    { label:'Coal',    key:'coal_electricity',    color:'#6b7280' },
    { label:'Oil',     key:'oil_electricity',     color:'#dc2626' },
    { label:'Gas',     key:'gas_electricity',     color:'#f97316' },
    { label:'Hydro',   key:'hydro_electricity',   color:'#0ea5e9' },
    { label:'Solar',   key:'solar_electricity',   color:'#eab308' },
    { label:'Wind',    key:'wind_electricity',    color:'#6ee7b7' },
    { label:'Nuclear', key:'nuclear_electricity', color:'#7774e7' },
    { label:'Biofuel', key:'biofuel_electricity', color:'#84cc16' },
  ]
  const values = last ? sources.map(s => +(last[s.key] ?? 0).toFixed(3)) : sources.map(() => 0)
  const total  = values.reduce((a,b) => a+b, 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'18px 20px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#99abb4', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
        <i className="ti-bar-chart" style={{ marginRight:6 }} /> Energy Mix Breakdown
      </div>
      <div style={{ fontSize:13, fontWeight:600, color:'#e0e6ed', marginBottom:16 }}>{country}</div>

      {/* Donut canvas */}
      <div style={{ position:'relative', flex:'0 0 200px', display:'flex', justifyContent:'center' }}>
        <canvas ref={canvasRef} style={{ maxWidth:200, maxHeight:200 }} />
        {/* Centre label */}
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          textAlign:'center', pointerEvents:'none' }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#e0e6ed' }}>{total.toFixed(1)}</div>
          <div style={{ fontSize:9, color:'#99abb4' }}>TWh</div>
        </div>
      </div>

      {/* Legend grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 10px', marginTop:14, flex:1, overflowY:'auto' }}>
        {sources.map((s, i) => {
          const v   = values[i]
          const pct = total > 0 ? (v / total * 100).toFixed(1) : '0.0'
          return (
            <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
              <div style={{ width:9, height:9, borderRadius:'50%', background:s.color, flexShrink:0,
                boxShadow:`0 0 5px ${s.color}88` }} />
              <span style={{ fontSize:10, color:'#b0bec5', flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.label}</span>
              <span style={{ fontSize:10, fontWeight:600, color:'#e0e6ed', whiteSpace:'nowrap' }}>{pct}%</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize:9, color:'#72777a', marginTop:8, textAlign:'center' }}>Based on last historical year</div>
    </div>
  )
}

function EnergyRiskPanel({ activeCountry }) {
  const country = activeCountry || 'United States'
  const [slide, setSlide] = useState(0)   // 0 = risk, 1 = mix
  const SLIDES = 2

  const goTo = (idx) => setSlide(idx)

  const d = computeDeficit(country)

  // ── No data for this country ───────────────────────────────────────────────
  const rows = forecastData[country]
  if (!rows || !rows.length) {
    return (
      <div className="sv-card__stats"
        style={{ display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', gap:12, padding:'24px 20px' }}>
        <i className="ti-email" style={{ fontSize:36, color:'#99abb4' }} />
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'#99abb4', marginBottom:6 }}>No Data</div>
          <div style={{ fontSize:12, color:'#72777a', lineHeight:1.5 }}>
            No energy data available<br/>for {country}.
          </div>
        </div>
      </div>
    )
  }

  // ── Slide container ────────────────────────────────────────────────────────
  return (
    <div className="sv-card__stats"
      style={{ padding:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>

      {/* Slide wrapper — CSS transition on transform */}
      <div style={{
        display:'flex', width:`${SLIDES * 100}%`,
        transform:`translateX(-${slide * (100 / SLIDES)}%)`,
        transition:'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
        flex:1, minHeight:0,
      }}>
        {/* ── Slide 0: Energy Risk ─────────────────────────────────────────── */}
        <div style={{ width:`${100 / SLIDES}%`, flexShrink:0, overflowY:'auto' }}>
          <EnergyRiskContent country={country} d={d} />
        </div>

        {/* ── Slide 1: Energy Mix Donut ─────────────────────────────────────── */}
        <div style={{ width:`${100/SLIDES}%`, flexShrink:0, overflowY:'auto' }}>
          {slide === 1 && <EnergyMixDonut activeCountry={country} />}
        </div>
      </div>

      {/* ── Nav controls ──────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:12,
        padding:'8px 0 10px', borderTop:'1px solid rgba(255,255,255,0.06)',
        background:'rgba(0,0,0,0.15)', flexShrink:0,
      }}>
        <button onClick={() => goTo((slide - 1 + SLIDES) % SLIDES)}
          style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:6, color:'#b0bec5', fontSize:11, padding:'3px 10px', cursor:'pointer',
            transition:'background 0.2s' }}
          onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.16)'}
          onMouseLeave={e => e.target.style.background='rgba(255,255,255,0.08)'}>
          ‹ Prev
        </button>

        {/* Dot indicators */}
        {Array.from({ length: SLIDES }).map((_, i) => (
          <div key={i} onClick={() => goTo(i)} style={{
            width: i === slide ? 20 : 7, height:7, borderRadius:4,
            background: i === slide ? '#0f9aee' : 'rgba(255,255,255,0.2)',
            cursor:'pointer', transition:'all 0.3s ease',
          }} />
        ))}

        <button onClick={() => goTo((slide + 1) % SLIDES)}
          style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:6, color:'#b0bec5', fontSize:11, padding:'3px 10px', cursor:'pointer',
            transition:'background 0.2s' }}
          onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.16)'}
          onMouseLeave={e => e.target.style.background='rgba(255,255,255,0.08)'}>
          Next ›
        </button>


      </div>
    </div>
  )
}


// ── Full Site Visits Card (map left 70% + stats right 30%) ───────────────────
// Matches original: peers fxw-nw@lg+ layout, no card header, title inside left panel
function SiteVisits({ onCountrySelect, activeCountry }) {
  return (
    <div className="sv-card">
      <div className="sv-card__inner">

        {/* ── Left: World Vector Map (70%) — peer peer-greed w-70p ── */}
        <div className="sv-card__map">
          <h6 className="sv-card__title">World Map</h6>
          <div className="sv-map-container">
            <WorldVectorMap onCountrySelect={onCountrySelect} />
          </div>
        </div>

        {/* ── Right: Energy Risk Panel ─────────────────────────── */}
        <EnergyRiskPanel activeCountry={activeCountry} />
      </div>
    </div>
  )
}

// ── Mini Gauge ──────────────────────────────────────────────────────────────
function MiniGauge({ title, value, color }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cx = canvas.width / 2, cy = canvas.height / 2, r = 28
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = '#e9ecef'
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, (-Math.PI / 2) + (value / 100) * Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.stroke()
  }, [value, color])

  return (
    <div className="mini-gauge">
      <canvas ref={canvasRef} width={70} height={70} />
      <div className="mini-gauge__label">
        <p className="mini-gauge__pct">{value}%</p>
        <small>{title}</small>
      </div>
    </div>
  )
}

// ── GDP & Population Chart ───────────────────────────────────────────────────
function GdpPopChart({ activeCountry }) {
  if (activeCountry && !forecastData[activeCountry]) return <NoDataCard title={`GDP & Population — ${activeCountry}`} />
  const country = forecastData[activeCountry] ? activeCountry : 'United States'
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    const loadChartJS = () => new Promise((resolve) => {
      if (window.Chart) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
      s.onload = resolve
      document.head.appendChild(s)
    })

    const initChart = () => {
      if (!canvasRef.current || !window.Chart) return
      if (chartRef.current) { chartRef.current.destroy() }

      const isDark     = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
      const tickColor  = isDark ? '#7b8fa6' : '#99abb4'
      const labelColor = isDark ? '#e0e6ed' : '#354052'
      const ptBorder   = isDark ? '#252836' : '#fff'

      const rows   = forecastData[country]
      const labels = rows.map(r => r.year)
      const gdpB   = rows.map(r => r.gdp   != null ? +(r.gdp / 1e9).toFixed(2)   : null)
      const popM   = rows.map(r => r.population != null ? +(r.population / 1e6).toFixed(3) : null)

      // Split into historical/forecast segments for styling
      const lastHistIdx = rows.findLastIndex(r => r.type === 'historical')
      const mkHist = arr => arr.map((v, i) => i <= lastHistIdx ? v : null)
      const mkFore = arr => arr.map((v, i) => {
        if (i > lastHistIdx) return v
        if (i === lastHistIdx) return v   // bridge
        return null
      })

      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'GDP — Historical (B USD)',
              data: mkHist(gdpB),
              borderColor: '#37c936',
              backgroundColor: 'rgba(55,201,54,0.07)',
              fill: true, borderWidth: 2.5,
              pointBackgroundColor: '#37c936', pointBorderColor: ptBorder,
              pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
              tension: 0.4, spanGaps: false,
              yAxisID: 'yGdp',
            },
            {
              label: 'GDP — Forecast (B USD)',
              data: mkFore(gdpB),
              borderColor: '#37c936',
              backgroundColor: 'rgba(55,201,54,0.04)',
              fill: true, borderWidth: 2.5, borderDash: [6, 3],
              pointBackgroundColor: '#37c936', pointBorderColor: ptBorder,
              pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
              tension: 0.4, spanGaps: false,
              yAxisID: 'yGdp',
            },
            {
              label: 'Population — Historical (M)',
              data: mkHist(popM),
              borderColor: '#f7a35c',
              backgroundColor: 'rgba(247,163,92,0.07)',
              fill: true, borderWidth: 2.5,
              pointBackgroundColor: '#f7a35c', pointBorderColor: ptBorder,
              pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
              tension: 0.4, spanGaps: false,
              yAxisID: 'yPop',
            },
            {
              label: 'Population — Forecast (M)',
              data: mkFore(popM),
              borderColor: '#f7a35c',
              backgroundColor: 'rgba(247,163,92,0.04)',
              fill: true, borderWidth: 2.5, borderDash: [6, 3],
              pointBackgroundColor: '#f7a35c', pointBorderColor: ptBorder,
              pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
              tension: 0.4, spanGaps: false,
              yAxisID: 'yPop',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top', align: 'start',
              labels: {
                color: labelColor, usePointStyle: true,
                pointStyle: 'rectRounded', padding: 20,
                font: { size: 13, family: 'Roboto, sans-serif' },
              },
            },
            tooltip: {
              backgroundColor: isDark ? '#1c1f2b' : '#fff',
              titleColor: isDark ? '#e0e6ed' : '#354052',
              bodyColor: isDark ? '#b0bec5' : '#72777a',
              borderColor: isDark ? '#313644' : '#e6eaf0',
              borderWidth: 1, padding: 12,
              callbacks: {
                label: (ctx) => {
                  const axisId = ctx.dataset.yAxisID
                  const unit = axisId === 'yGdp' ? ' B USD' : ' M'
                  return ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toLocaleString() + unit : 'N/A'}`
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 16, maxRotation: 0 },
              border: { display: false },
            },
            yGdp: {
              type: 'linear', position: 'left',
              grid: { color: gridColor },
              ticks: { color: '#37c936', font: { size: 11 }, callback: v => `$${v.toLocaleString()}B` },
              border: { display: false },
              beginAtZero: true, min: 0,
              title: { display: true, text: 'GDP (Billion USD)', color: '#37c936', font: { size: 12 } },
            },
            yPop: {
              type: 'linear', position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#f7a35c', font: { size: 11 }, callback: v => `${v.toLocaleString()}M` },
              border: { display: false },
              beginAtZero: true, min: 0,
              title: { display: true, text: 'Population (Millions)', color: '#f7a35c', font: { size: 12 } },
            },
          },
        },
      })
    }

    loadChartJS().then(() => setTimeout(initChart, 50))
    const onTheme = () => setTimeout(initChart, 50)
    window.addEventListener('adminator:themeChanged', onTheme)
    return () => {
      window.removeEventListener('adminator:themeChanged', onTheme)
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    }
  }, [country])

  return (
    <div className="card ms-card">
      <div className="ms-card__header">
        <h6 className="card__title">GDP & Population — {country}</h6>
      </div>
      <div className="ms-card__chart" style={{ height: '480px' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

const DEFAULT_COUNTRY = 'United States'

function MonthlyStats({ activeCountry }) {
  if (activeCountry && !forecastData[activeCountry]) return <NoDataCard title={`Electricity Demand — ${activeCountry}`} />
  const country = forecastData[activeCountry] ? activeCountry : DEFAULT_COUNTRY
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    const loadChartJS = () => new Promise((resolve) => {
      if (window.Chart) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
      s.onload = resolve
      document.head.appendChild(s)
    })

    const initChart = () => {
      if (!canvasRef.current || !window.Chart) return
      if (chartRef.current) { chartRef.current.destroy() }

      const isDark     = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
      const tickColor  = isDark ? '#7b8fa6' : '#99abb4'
      const labelColor = isDark ? '#e0e6ed' : '#354052'
      const ptBorder   = isDark ? '#252836' : '#fff'

      const allRows  = forecastData[country]
      const labels   = allRows.map(r => r.year)

      // Historical line: actual values, null for forecast years
      const histData = allRows.map(r => r.type === 'historical' ? r.demand : null)

      // Forecast line: null for historical years, values for forecast years
      // Stitch the last historical point so the line connects visually
      const lastHistIdx  = allRows.findLastIndex(r => r.type === 'historical')
      const forecastSeries = allRows.map((r, i) => {
        if (r.type === 'forecast') return r.demand
        if (i === lastHistIdx)     return r.demand   // bridge point
        return null
      })

      // ── Generation series: single continuous line across all years ──────────
      // electricity_generation is present on every row (historical actual,
      // forecast forward-filled from last known), so we never need to split it.
      // Use spanGaps:true as a final safety net for any nulls.
      const genSeries = allRows.map(r => r.electricity_generation ?? null)

      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Historical Demand (TWh)',
              data: histData,
              borderColor: '#0f9aee',
              backgroundColor: 'rgba(15,154,238,0.08)',
              fill: true,
              borderWidth: 2.5,
              pointBackgroundColor: '#0f9aee',
              pointBorderColor: ptBorder,
              pointBorderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 6,
              tension: 0.4,
              spanGaps: false,
            },
            {
              label: 'Forecast Demand (TWh)',
              data: forecastSeries,
              borderColor: '#7774e7',
              backgroundColor: 'rgba(119,116,231,0.08)',
              fill: true,
              borderWidth: 2.5,
              borderDash: [6, 3],
              pointBackgroundColor: '#7774e7',
              pointBorderColor: ptBorder,
              pointBorderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 6,
              tension: 0.4,
              spanGaps: false,
            },
            {
              label: 'Total Generation (TWh)',
              data: genSeries,
              borderColor: '#e84393',
              backgroundColor: 'transparent',
              fill: false,
              borderWidth: 2,
              borderDash: [],
              pointBackgroundColor: '#e84393',
              pointBorderColor: ptBorder,
              pointBorderWidth: 2,
              pointRadius: 2,
              pointHoverRadius: 6,
              tension: 0.4,
              spanGaps: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'start',
              labels: {
                color: labelColor,
                usePointStyle: true,
                pointStyle: 'rectRounded',
                padding: 20,
                font: { size: 13, family: 'Roboto, sans-serif' },
              },
              title: { display: false },
            },
            layout: {
              padding: { top: 16 },
            },
            tooltip: {
              backgroundColor: isDark ? '#1c1f2b' : '#fff',
              titleColor: isDark ? '#e0e6ed' : '#354052',
              bodyColor: isDark ? '#b0bec5' : '#72777a',
              borderColor: isDark ? '#313644' : '#e6eaf0',
              borderWidth: 1,
              padding: 12,
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y
                  return v != null ? ` ${ctx.dataset.label}: ${v.toFixed(1)} TWh` : ` ${ctx.dataset.label}: N/A`
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: {
                color: tickColor,
                font: { size: 11 },
                maxTicksLimit: 16,
                maxRotation: 0,
              },
              border: { display: false },
            },
            y: {
              grid: { color: gridColor },
              ticks: {
                color: tickColor,
                font: { size: 12 },
                callback: (v) => `${v.toLocaleString()} TWh`,
              },
              border: { display: false },
              beginAtZero: true,
              min: 0,
            },
          },
        },
      })
    }

    loadChartJS().then(() => setTimeout(initChart, 50))

    const onTheme = () => setTimeout(initChart, 50)
    window.addEventListener('adminator:themeChanged', onTheme)
    return () => {
      window.removeEventListener('adminator:themeChanged', onTheme)
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    }
  }, [country])

  // ── Footer stats derived from data ───────────────────────────────────────────
  const allRows  = forecastData[country]
  const hist     = allRows.filter(r => r.type === 'historical')
  const fore     = allRows.filter(r => r.type === 'forecast')
  const lastHist = hist[hist.length - 1]
  const lastFore = fore[fore.length - 1]

  // Use CAGR instead of simple % so zero-start countries don't produce Infinity.
  // Find first non-zero historical demand as the base.
  const firstNonZeroHist = hist.find(r => r.demand > 0)
  const histCAGR = (() => {
    if (!firstNonZeroHist || firstNonZeroHist.demand <= 0) return null
    const years = lastHist.year - firstNonZeroHist.year
    if (years <= 0) return null
    return (Math.pow(lastHist.demand / firstNonZeroHist.demand, 1 / years) - 1) * 100
  })()

  // Forecast CAGR: from last historical to last forecast year
  const foreCAGR = (() => {
    if (!lastHist || lastHist.demand <= 0 || !lastFore) return null
    const years = lastFore.year - lastHist.year
    if (years <= 0) return null
    return (Math.pow(lastFore.demand / lastHist.demand, 1 / years) - 1) * 100
  })()

  const fmtCAGR = (v) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%/yr` : 'N/A'

  return (
    <div className="card ms-card">
      {/* Header */}
      <div className="ms-card__header">
        <h6 className="card__title">Electricity Demand — {country}</h6>
      </div>

      {/* Chart */}
      <div className="ms-card__chart" style={{ height: '480px' }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Footer stats */}
      <div className="ms-card__footer">
        <div className="ms-stat">
          <span className="ms-stat__value">{fmtCAGR(histCAGR)}</span>
          <i className={`ti-arrow-${histCAGR != null && histCAGR >= 0 ? 'up' : 'down'} ms-stat__icon`} />
          <small className="ms-stat__label">Hist. CAGR ({firstNonZeroHist?.year}–{lastHist.year})</small>
        </div>
        <div className="ms-stat">
          <span className="ms-stat__value">{lastHist.demand.toFixed(1)} TWh</span>
          <i className="ti-bolt ms-stat__icon" />
          <small className="ms-stat__label">Demand {lastHist.year}</small>
        </div>
        <div className="ms-stat">
          <span className="ms-stat__value">{fmtCAGR(foreCAGR)}</span>
          <i className={`ti-arrow-${foreCAGR != null && foreCAGR >= 0 ? 'up' : 'down'} ms-stat__icon`} />
          <small className="ms-stat__label">Forecast CAGR ({lastHist.year}–{lastFore.year})</small>
        </div>
        <div className="ms-stat">
          <span className="ms-stat__value">{lastFore.demand.toFixed(1)} TWh</span>
          <i className="ti-bolt ms-stat__icon" />
          <small className="ms-stat__label">Projected {lastFore.year}</small>
        </div>
      </div>
    </div>
  )
}

// ── Electricity Mix Chart (Mixed: bars every 5yr + generation line) ──────────
function ElectricityMixChart({ activeCountry }) {
  if (activeCountry && !forecastData[activeCountry]) return <NoDataCard title={`Electricity Mix — ${activeCountry}`} />
  const country  = forecastData[activeCountry] ? activeCountry : 'United States'
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    const loadChartJS = () => new Promise((resolve) => {
      if (window.Chart) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
      s.onload = resolve
      document.head.appendChild(s)
    })

    const initChart = () => {
      if (!canvasRef.current || !window.Chart) return
      if (chartRef.current) { chartRef.current.destroy() }

      const isDark     = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
      const tickColor  = isDark ? '#7b8fa6' : '#99abb4'
      const labelColor = isDark ? '#e0e6ed' : '#354052'
      const ptBorder   = isDark ? '#252836' : '#fff'

      const allRows = forecastData[country]

      // ── Build year→row lookup ─────────────────────────────────────────────
      const byYear = {}
      allRows.forEach(r => { byYear[r.year] = r })

      // ── Every-5-year ticks across full range (historical + forecast) ───────
      const firstYear = allRows[0]?.year ?? 1985
      const lastYear  = allRows[allRows.length - 1]?.year ?? 2044
      const startSnap = Math.ceil(firstYear / 5) * 5
      const barYears  = []
      for (let y = startSnap; y <= lastYear; y += 5) barYears.push(y)

      // Last historical year — used to visually separate hist vs forecast bars
      const lastHistYear = allRows.filter(r => r.type === 'historical').slice(-1)[0]?.year ?? 2024

      const barLabels = barYears.map(y => String(y))

      // ── Helper: split data into historical / forecast arrays ──────────────
      // Historical bars: solid fill. Forecast bars: lighter (hatched via lower opacity).
      const splitByType = (field, histAlpha, foreAlpha, rgb) => {
        const data  = barYears.map(y => byYear[y]?.[field] ?? null)
        const bgColors = barYears.map(y =>
          y <= lastHistYear
            ? `rgba(${rgb}, ${histAlpha})`
            : `rgba(${rgb}, ${foreAlpha})`
        )
        const borderColors = barYears.map(() => `rgba(${rgb}, 1)`)
        const borderDash   = barYears.map(y => y > lastHistYear ? [4, 3] : [])
        return { data, bgColors, borderColors }
      }

      const fossil  = splitByType('fossil_electricity',  0.80, 0.35, '220, 80, 80')
      const renew   = splitByType('renewables_electricity', 0.80, 0.35, '55, 201, 54')
      const nuclear = splitByType('nuclear_electricity', 0.80, 0.35, '119, 116, 231')

      // ── Generation line: historical solid, forecast dashed ────────────────
      const genAll  = barYears.map(y => byYear[y]?.electricity_generation ?? null)
      // Bridge point: last hist value repeated as first forecast point
      const genHist = barYears.map(y => y <= lastHistYear ? (byYear[y]?.electricity_generation ?? null) : null)
      const genFore = barYears.map(y => {
        if (y > lastHistYear) return byYear[y]?.electricity_generation ?? null
        if (y === lastHistYear) return byYear[y]?.electricity_generation ?? null
        return null
      })

      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: barLabels,
          datasets: [
            // ── Bars ──────────────────────────────────────────────────────
            {
              label: 'Fossil (TWh)',
              type: 'bar',
              data: fossil.data,
              backgroundColor: fossil.bgColors,
              borderColor:     fossil.borderColors,
              borderWidth: 1,
              borderRadius: 3,
              yAxisID: 'y',
            },
            {
              label: 'Renewables (TWh)',
              type: 'bar',
              data: renew.data,
              backgroundColor: renew.bgColors,
              borderColor:     renew.borderColors,
              borderWidth: 1,
              borderRadius: 3,
              yAxisID: 'y',
            },
            {
              label: 'Nuclear (TWh)',
              type: 'bar',
              data: nuclear.data,
              backgroundColor: nuclear.bgColors,
              borderColor:     nuclear.borderColors,
              borderWidth: 1,
              borderRadius: 3,
              yAxisID: 'y',
            },
            // ── Generation line — historical (solid) ─────────────────────
            {
              label: 'Total Generation — Historical (TWh)',
              type: 'line',
              data: genHist,
              borderColor:          '#e84393',
              backgroundColor:      'transparent',
              borderWidth: 2.5,
              pointBackgroundColor: '#e84393',
              pointBorderColor:     ptBorder,
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7,
              tension: 0.4,
              spanGaps: false,
              yAxisID: 'y',
            },
            // ── Generation line — forecast (dashed) ──────────────────────
            {
              label: 'Total Generation — Forecast (TWh)',
              type: 'line',
              data: genFore,
              borderColor:          '#e84393',
              backgroundColor:      'transparent',
              borderWidth: 2.5,
              borderDash: [6, 3],
              pointBackgroundColor: '#e84393',
              pointBorderColor:     ptBorder,
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7,
              tension: 0.4,
              spanGaps: false,
              yAxisID: 'y',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top', align: 'start',
              labels: {
                color: labelColor, usePointStyle: true,
                pointStyle: 'rectRounded', padding: 20,
                font: { size: 13, family: 'Roboto, sans-serif' },
              },
            },
            tooltip: {
              backgroundColor: isDark ? '#1c1f2b' : '#fff',
              titleColor: isDark ? '#e0e6ed' : '#354052',
              bodyColor:  isDark ? '#b0bec5' : '#72777a',
              borderColor: isDark ? '#313644' : '#e6eaf0',
              borderWidth: 1, padding: 12,
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y
                  return v != null
                    ? ` ${ctx.dataset.label}: ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} TWh`
                    : ` ${ctx.dataset.label}: N/A`
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: tickColor, font: { size: 12 }, maxRotation: 0 },
              border: { display: false },
            },
            y: {
              type: 'linear', position: 'left',
              grid: { color: gridColor },
              ticks: {
                color: tickColor, font: { size: 11 },
                callback: v => `${v.toLocaleString()} TWh`,
              },
              border: { display: false },
              beginAtZero: true, min: 0,
              title: { display: true, text: 'TWh', color: tickColor, font: { size: 12 } },
            },
          },
        },
      })
    }

    loadChartJS().then(() => setTimeout(initChart, 50))
    const onTheme = () => setTimeout(initChart, 50)
    window.addEventListener('adminator:themeChanged', onTheme)
    return () => {
      window.removeEventListener('adminator:themeChanged', onTheme)
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    }
  }, [country])

  return (
    <div className="card ms-card">
      <div className="ms-card__header">
        <h6 className="card__title">Electricity Mix — {country}</h6>
      </div>
      <div className="ms-card__chart" style={{ height: '480px' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

// ── GHG Emissions Chart ───────────────────────────────────────────────────────
function GHGChart({ activeCountry }) {
  if (activeCountry && !forecastData[activeCountry]) return <NoDataCard title={`GHG Emissions — ${activeCountry}`} />
  const country  = forecastData[activeCountry] ? activeCountry : 'United States'
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    const loadChartJS = () => new Promise((resolve) => {
      if (window.Chart) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
      s.onload = resolve
      document.head.appendChild(s)
    })

    const initChart = () => {
      if (!canvasRef.current || !window.Chart) return
      if (chartRef.current) { chartRef.current.destroy() }

      const isDark     = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
      const tickColor  = isDark ? '#7b8fa6' : '#99abb4'
      const labelColor = isDark ? '#e0e6ed' : '#354052'
      const ptBorder   = isDark ? '#252836' : '#fff'

      const allRows = forecastData[country]
      const hist    = allRows.filter(r => r.type === 'historical')
      const fore    = allRows.filter(r => r.type === 'forecast')
      const lastHistIdx = allRows.findLastIndex(r => r.type === 'historical')

      // ── Emission intensity: GHG per TWh of fossil (from last 5 historical yrs) ──
      const recent = hist.slice(-5).filter(r => (r.fossil_electricity ?? 0) > 0.1 && (r.greenhouse_gas_emissions ?? 0) > 0)
      const intensity = recent.length > 0
        ? recent.reduce((s, r) => s + r.greenhouse_gas_emissions / r.fossil_electricity, 0) / recent.length
        : 0.69   // global median fallback

      // ── Deficit + recommendation for this country ─────────────────────────
      const deficit = computeDeficit(country)
      const rec          = deficit?.['2044']?.recommendations ?? deficit?.['2034']?.recommendations ?? null
      const recFossilAdd = rec?.fossil?.add_twh ?? 0   // deficit countries: fossil ADDED

      // ── Clean transition: compute fossil REDUCTION for surplus countries ──
      // Mirrors the exact logic in EnergyRiskContent no-deficit block
      const isSurplus = !deficit || (!deficit['2034'] && !deficit['2044'])
      let fossilReduce = 0
      if (isSurplus) {
        const lastH   = hist[hist.length - 1] || {}
        const f2044r  = fore[fore.length - 1] || {}
        const fossil  = lastH.fossil_electricity ?? 0
        const gen     = lastH.electricity_generation ?? 0
        const demand44 = f2044r.demand ?? (lastH.demand ?? 0)
        const surplus  = gen - demand44
        const maxFossilReduction = Math.min(fossil * 0.6, Math.max(0, surplus + fossil * 0.4))
        fossilReduce = Math.min(fossil - Math.max(fossil - maxFossilReduction, gen * 0.05), fossil)
      }

      // ── Build series ──────────────────────────────────────────────────────
      const labels = allRows.map(r => r.year)

      // 1. Historical actual GHG — solid blue
      const ghgHist = allRows.map(r => r.type === 'historical' ? (r.greenhouse_gas_emissions ?? null) : null)

      // 2. Baseline forecast GHG: fossil (forward-filled) × intensity — bridge from last hist
      const ghgBaseFore = allRows.map((r, i) => {
        if (r.type === 'forecast') return +((r.fossil_electricity ?? 0) * intensity).toFixed(4)
        if (i === lastHistIdx)     return r.greenhouse_gas_emissions ?? null
        return null
      })

      // 3a. DEFICIT country: fossil added → emissions RISE (red dashed)
      const ghgWithDeficitRec = recFossilAdd > 0
        ? allRows.map((r, i) => {
            if (r.type === 'forecast')
              return +(((r.fossil_electricity ?? 0) + recFossilAdd) * intensity).toFixed(4)
            if (i === lastHistIdx) return r.greenhouse_gas_emissions ?? null
            return null
          })
        : null

      // 3b. SURPLUS country: fossil reduced → emissions FALL (green dashed)
      const ghgWithTransition = isSurplus && fossilReduce > 0
        ? allRows.map((r, i) => {
            if (r.type === 'forecast') {
              const reducedFossil = Math.max(0, (r.fossil_electricity ?? 0) - fossilReduce)
              return +(reducedFossil * intensity).toFixed(4)
            }
            if (i === lastHistIdx) return r.greenhouse_gas_emissions ?? null
            return null
          })
        : null

      const datasets = [
        {
          label: 'Historical GHG (Mt CO₂)',
          data: ghgHist,
          borderColor: '#0f9aee',
          backgroundColor: 'rgba(15,154,238,0.08)',
          fill: true, borderWidth: 2.5,
          pointBackgroundColor: '#0f9aee', pointBorderColor: ptBorder,
          pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
          tension: 0.4, spanGaps: false,
        },
        {
          label: 'Forecast GHG — Baseline (Mt CO₂)',
          data: ghgBaseFore,
          borderColor: '#7774e7',
          backgroundColor: 'rgba(119,116,231,0.06)',
          fill: true, borderWidth: 2.5, borderDash: [6, 3],
          pointBackgroundColor: '#7774e7', pointBorderColor: ptBorder,
          pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
          tension: 0.4, spanGaps: false,
        },
      ]

      // Deficit: add fossil cost line (red)
      if (ghgWithDeficitRec) {
        datasets.push({
          label: 'Forecast GHG — With Deficit Recommendations (Mt CO₂)',
          data: ghgWithDeficitRec,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.06)',
          fill: true, borderWidth: 2.5, borderDash: [4, 2],
          pointBackgroundColor: '#ef4444', pointBorderColor: ptBorder,
          pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
          tension: 0.4, spanGaps: false,
        })
      }

      // Surplus: add clean transition line (green) showing emissions reduction
      if (ghgWithTransition) {
        datasets.push({
          label: 'Forecast GHG — With Clean Transition (Mt CO₂)',
          data: ghgWithTransition,
          borderColor: '#37c936',
          backgroundColor: 'rgba(55,201,54,0.07)',
          fill: true, borderWidth: 2.5, borderDash: [6, 3],
          pointBackgroundColor: '#37c936', pointBorderColor: ptBorder,
          pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 6,
          tension: 0.4, spanGaps: false,
        })
      }

      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top', align: 'start',
              labels: {
                color: labelColor, usePointStyle: true,
                pointStyle: 'rectRounded', padding: 20,
                font: { size: 13, family: 'Roboto, sans-serif' },
              },
            },
            layout: { padding: { top: 16 } },
            tooltip: {
              backgroundColor: isDark ? '#1c1f2b' : '#fff',
              titleColor: isDark ? '#e0e6ed' : '#354052',
              bodyColor:  isDark ? '#b0bec5' : '#72777a',
              borderColor: isDark ? '#313644' : '#e6eaf0',
              borderWidth: 1, padding: 12,
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y
                  return v != null ? ` ${ctx.dataset.label}: ${v.toFixed(2)} Mt CO₂` : ` ${ctx.dataset.label}: N/A`
                },
                afterBody: (items) => {
                  const base = items.find(i => i.dataset.label.includes('Baseline'))
                  if (!base || base.parsed.y == null) return []
                  // Deficit: show additional cost
                  const defRec = items.find(i => i.dataset.label.includes('Deficit'))
                  if (defRec && defRec.parsed.y != null) {
                    const delta = defRec.parsed.y - base.parsed.y
                    return [`  ↑ Extra emissions from fossil recs: +${delta.toFixed(2)} Mt CO₂`]
                  }
                  // Surplus: show reduction achieved
                  const transRec = items.find(i => i.dataset.label.includes('Transition'))
                  if (transRec && transRec.parsed.y != null) {
                    const saved = base.parsed.y - transRec.parsed.y
                    if (saved > 0) return [`  ↓ CO₂ saved by transition: -${saved.toFixed(2)} Mt CO₂`]
                  }
                  return []
                }
              },
            },
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 16, maxRotation: 0 },
              border: { display: false },
            },
            y: {
              grid: { color: gridColor },
              ticks: {
                color: tickColor, font: { size: 12 },
                callback: v => `${v.toLocaleString()} Mt`,
              },
              border: { display: false },
              beginAtZero: true, min: 0,
              title: { display: true, text: 'Greenhouse Gas Emissions (Mt CO₂)', color: tickColor, font: { size: 12 } },
            },
          },
        },
      })
    }

    loadChartJS().then(() => setTimeout(initChart, 50))
    const onTheme = () => setTimeout(initChart, 50)
    window.addEventListener('adminator:themeChanged', onTheme)
    return () => {
      window.removeEventListener('adminator:themeChanged', onTheme)
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    }
  }, [country])

  // ── Footer: emission delta summary ────────────────────────────────────────
  const allRows  = forecastData[country]
  const hist     = allRows.filter(r => r.type === 'historical')
  const fore     = allRows.filter(r => r.type === 'forecast')
  const deficit      = computeDeficit(country)
  const rec          = deficit?.['2044']?.recommendations ?? deficit?.['2034']?.recommendations ?? null
  const recFossilAdd = rec?.fossil?.add_twh ?? 0
  const isSurplusF   = !deficit || (!deficit['2034'] && !deficit['2044'])

  const recent5F = hist.slice(-5).filter(r => (r.fossil_electricity ?? 0) > 0.1 && (r.greenhouse_gas_emissions ?? 0) > 0)
  const intensity = recent5F.length > 0
    ? recent5F.reduce((s, r) => s + r.greenhouse_gas_emissions / r.fossil_electricity, 0) / recent5F.length
    : 0.69

  const lastHistGHG  = hist[hist.length - 1]?.greenhouse_gas_emissions ?? 0
  const baselineFore = (fore[fore.length - 1]?.fossil_electricity ?? 0) * intensity
  const baselineDelta = baselineFore - lastHistGHG

  // Deficit: emission cost of fossil recommendations
  const withDeficitRec   = ((fore[fore.length-1]?.fossil_electricity ?? 0) + recFossilAdd) * intensity
  // Surplus: emission saving from clean transition
  let fossilReduceF = 0
  if (isSurplusF) {
    const lastH2   = hist[hist.length-1] || {}
    const f2044f   = fore[fore.length-1] || {}
    const fossilF  = lastH2.fossil_electricity ?? 0
    const genF     = lastH2.electricity_generation ?? 0
    const demand44F = f2044f.demand ?? (lastH2.demand ?? 0)
    const surplusF  = genF - demand44F
    const maxRedF   = Math.min(fossilF*0.6, Math.max(0, surplusF + fossilF*0.4))
    fossilReduceF   = Math.min(fossilF - Math.max(fossilF - maxRedF, genF*0.05), fossilF)
  }
  const withTransition   = ((fore[fore.length-1]?.fossil_electricity ?? 0) - fossilReduceF) * intensity
  const transitionSaving = baselineFore - withTransition

  return (
    <div className="card ms-card">
      <div className="ms-card__header">
        <h6 className="card__title">GHG Emissions — {country}</h6>
      </div>
      <div className="ms-card__chart" style={{ height: '480px' }}>
        <canvas ref={canvasRef} />
      </div>
      <div className="ms-card__footer">
        <div className="ms-stat">
          <span className="ms-stat__value">{lastHistGHG.toFixed(1)} Mt</span>
          <i className="ti-bolt ms-stat__icon" />
          <small className="ms-stat__label">GHG {hist[hist.length-1]?.year}</small>
        </div>
        <div className="ms-stat">
          <span className="ms-stat__value">{baselineFore.toFixed(1)} Mt</span>
          <i className={`ti-arrow-${baselineDelta >= 0 ? 'up' : 'down'} ms-stat__icon`} style={{ color: baselineDelta >= 0 ? '#ef4444' : '#37c936' }} />
          <small className="ms-stat__label">Baseline 2044</small>
        </div>
        {/* Deficit country: show emissions cost of fossil recommendations */}
        {recFossilAdd > 0 && (
          <>
            <div className="ms-stat">
              <span className="ms-stat__value">{withDeficitRec.toFixed(1)} Mt</span>
              <i className="ti-arrow-up ms-stat__icon" style={{ color:'#ef4444' }} />
              <small className="ms-stat__label">With Fossil Rec. 2044</small>
            </div>
            <div className="ms-stat">
              <span className="ms-stat__value" style={{ color:'#ef4444' }}>+{(withDeficitRec - baselineFore).toFixed(1)} Mt</span>
              <i className="ti-alert ms-stat__icon" style={{ color:'#ef4444' }} />
              <small className="ms-stat__label">Emissions Cost</small>
            </div>
          </>
        )}
        {/* Surplus country: show emissions saved by clean transition */}
        {isSurplusF && fossilReduceF > 0 && (
          <>
            <div className="ms-stat">
              <span className="ms-stat__value" style={{ color:'#37c936' }}>{withTransition.toFixed(1)} Mt</span>
              <i className="ti-arrow-down ms-stat__icon" style={{ color:'#37c936' }} />
              <small className="ms-stat__label">With Transition 2044</small>
            </div>
            <div className="ms-stat">
              <span className="ms-stat__value" style={{ color:'#37c936' }}>-{transitionSaving.toFixed(1)} Mt</span>
              <i className="ti-check ms-stat__icon" style={{ color:'#37c936' }} />
              <small className="ms-stat__label">CO₂ Saved</small>
            </div>
          </>
        )}
        <div className="ms-stat">
          <span className="ms-stat__value">{intensity.toFixed(3)}</span>
          <i className="ti-bolt ms-stat__icon" />
          <small className="ms-stat__label">Mt CO₂ / TWh fossil</small>
        </div>
      </div>
    </div>
  )
}

function EnergyRiskContent({ country, d }) {
  // ── No deficit: show clean-energy transition recommendations ───────────────
  if (!d || (!d['2034'] && !d['2044'])) {
    const rows   = forecastData[country] || []
    const hist   = rows.filter(r => r.type === 'historical')
    const fore   = rows.filter(r => r.type === 'forecast')
    const last   = hist[hist.length - 1] || {}
    const f2044  = fore[fore.length - 1] || {}

    const fossil  = last.fossil_electricity     ?? 0
    const renew   = last.renewables_electricity ?? 0
    const nuclear = last.nuclear_electricity    ?? 0
    const gen     = last.electricity_generation ?? 0
    const ghg     = last.greenhouse_gas_emissions ?? 0
    const demand  = last.demand ?? 0
    const demand44 = f2044.demand ?? demand

    const fossilPct  = gen > 0 ? +(fossil  / gen * 100).toFixed(1) : 0
    const renewPct   = gen > 0 ? +(renew   / gen * 100).toFixed(1) : 0
    const nuclearPct = gen > 0 ? +(nuclear / gen * 100).toFixed(1) : 0

    // GHG emission intensity from fossil
    const intensity = fossil > 0 ? ghg / fossil : 0.69

    // Surplus available for transition (generation headroom above 2044 demand)
    const surplus = gen - demand44
    // Max fossil we can safely reduce while still meeting 2044 demand
    // Strategy: shift fossil → 50% renewables + 50% nuclear (if nuclear exists) or all renewables
    const maxFossilReduction = Math.min(fossil * 0.6, Math.max(0, surplus + fossil * 0.4))
    const fossilTarget  = Math.max(fossil - maxFossilReduction, gen * 0.05)  // keep ≥5% as baseload
    const fossilReduce  = fossil - fossilTarget
    const renewIncrease = nuclear > 10 ? fossilReduce * 0.65 : fossilReduce * 0.85
    const nukeIncrease  = nuclear > 10 ? fossilReduce * 0.35 : fossilReduce * 0.15

    // GHG impact: removing fossil reduces by (fossil_reduce × intensity)
    const ghgReduction  = fossilReduce * intensity
    const ghgNew        = Math.max(0, ghg - ghgReduction)
    const ghgPctDrop    = ghg > 0 ? (ghgReduction / ghg * 100).toFixed(1) : 0

    // New mix percentages after transition
    const newFossil  = fossilTarget
    const newRenew   = renew  + renewIncrease
    const newNuclear = nuclear + nukeIncrease
    const newTotal   = newFossil + newRenew + newNuclear

    const barMax = Math.max(renewIncrease, nukeIncrease, fossilReduce, 0.1) * 1.2
    const TransBar = ({ label, color, value, icon, isReduction }) => {
      if (!value || value <= 0) return null
      const w = Math.round((value / barMax) * 100)
      return (
        <div style={{ marginBottom:9 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
            <span style={{ fontSize:11, color:'#b0bec5', display:'flex', alignItems:'center', gap:4 }}>
              <span>{icon}</span> {label}
            </span>
            <span style={{ fontSize:11, fontWeight:700, color }}>
              {isReduction ? '-' : '+'}{value.toFixed(1)} TWh
            </span>
          </div>
          <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:4, height:7, overflow:'hidden' }}>
            <div style={{ width:`${w}%`, height:'100%', background:color, borderRadius:4,
              transition:'width 0.6s ease', boxShadow:`0 0 5px ${color}88` }} />
          </div>
        </div>
      )
    }

    return (
      <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:0, overflowY:'auto' }}>

        {/* Header */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#99abb4', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              <i className="ti-stats-up" style={{ marginRight:5 }} /> Clean Transition
            </span>
            <span style={{ fontSize:10, fontWeight:700, color:'#37c936',
              background:'rgba(55,201,54,0.12)', padding:'2px 8px', borderRadius:10, border:'1px solid rgba(55,201,54,0.3)' }}>
              Surplus <i className="ti-check" style={{ marginLeft:3 }} />
            </span>
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:'#e0e6ed' }}>{country}</div>
          <div style={{ fontSize:11, color:'#72777a', marginTop:3 }}>
            Meeting demand — focus should be decarbonisation
          </div>
        </div>

        {/* Current mix summary */}
        <div style={{ background:'rgba(55,201,54,0.07)', border:'1px solid rgba(55,201,54,0.2)',
          borderRadius:8, padding:'9px 11px', marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            {[
              { label:'Fossil', val:fossilPct, color:'#ef4444' },
              { label:'Renewables', val:renewPct, color:'#37c936' },
              { label:'Nuclear', val:nuclearPct, color:'#7774e7' },
            ].map(m => (
              <div key={m.label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, fontWeight:800, color:m.color }}>{m.val}%</div>
                <div style={{ fontSize:9, color:'#99abb4' }}>{m.label}</div>
              </div>
            ))}
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:800, color:'#e0e6ed' }}>{gen.toFixed(0)}</div>
              <div style={{ fontSize:9, color:'#99abb4' }}>TWh gen</div>
            </div>
          </div>
        </div>

        {/* Recommended shifts */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#99abb4', textTransform:'uppercase',
            letterSpacing:'0.07em', marginBottom:9 }}>Recommended Energy Shifts</div>
          <TransBar label="Reduce Fossil"       color="#ef4444" value={fossilReduce}  icon={<i className="ti-arrow-down" />} isReduction={true}  />
          <TransBar label="Increase Renewables" color="#37c936" value={renewIncrease} icon={<i className="ti-stats-up" />} isReduction={false} />
          <TransBar label="Increase Nuclear"    color="#7774e7" value={nukeIncrease}  icon={<i className="ti-bolt" />} isReduction={false} />
        </div>

        {/* GHG impact */}
        <div style={{ background:'rgba(15,154,238,0.07)', border:'1px solid rgba(15,154,238,0.2)',
          borderRadius:8, padding:'9px 11px', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#99abb4', textTransform:'uppercase',
            letterSpacing:'0.07em', marginBottom:8 }}><i className="ti-map" style={{ marginRight:6 }} /> GHG Emissions Impact</div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#ef4444' }}>{ghg.toFixed(0)} Mt</div>
              <div style={{ fontSize:9, color:'#99abb4' }}>Current</div>
            </div>
            <i className="ti-arrow-right" style={{ fontSize:16, color:'#37c936', alignSelf:'center' }} />
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#37c936' }}>{ghgNew.toFixed(0)} Mt</div>
              <div style={{ fontSize:9, color:'#99abb4' }}>After transition</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#37c936' }}>-{ghgPctDrop}%</div>
              <div style={{ fontSize:9, color:'#99abb4' }}>CO₂ reduction</div>
            </div>
          </div>
          {/* Before/After bar */}
          <div style={{ marginBottom:4 }}>
            <div style={{ fontSize:9, color:'#99abb4', marginBottom:3 }}>Before</div>
            <div style={{ height:7, background:'rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:'100%', height:'100%', background:'#ef4444', borderRadius:4 }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize:9, color:'#99abb4', marginBottom:3 }}>After</div>
            <div style={{ height:7, background:'rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:`${Math.round((ghgNew/ghg)*100)}%`, height:'100%',
                background:'linear-gradient(90deg,#37c936,#0f9aee)', borderRadius:4,
                transition:'width 0.8s ease' }} />
            </div>
          </div>
        </div>

        {/* Target mix */}
        <div style={{ fontSize:10, color:'#72777a', lineHeight:1.6,
          borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:8 }}>
          Target mix: fossil {(newFossil/newTotal*100).toFixed(0)}% →{' '}
          renewables {(newRenew/newTotal*100).toFixed(0)}% →{' '}
          nuclear {(newNuclear/newTotal*100).toFixed(0)}%<br/>
          Demand fully covered. Transition maintains grid stability.
        </div>

      </div>
    )
  }

  const yr2034  = d['2034']
  const yr2044  = d['2044']
  const display = yr2044 || yr2034
  const horizonLabel = yr2044 ? '2044' : '2034'

  const mix = d.current_mix
  const totalMix  = (mix.fossil + mix.renewables + mix.nuclear) || 1
  const fossilPct  = Math.round(mix.fossil     / totalMix * 100)
  const renewPct   = Math.round(mix.renewables / totalMix * 100)
  const nuclearPct = Math.round(mix.nuclear    / totalMix * 100)

  const recs    = display.recommendations
  const gapPct  = display.gap_pct
  const sevColor = gapPct > 300 ? '#ef4444' : gapPct > 100 ? '#f97316' : '#eab308'
  const sevLabel = gapPct > 300 ? 'Critical' : gapPct > 100 ? 'High Risk' : 'Moderate'

  const maxRec = Math.max(recs.renewables.add_twh||0, recs.fossil.add_twh||0, recs.nuclear.add_twh||0, 0.1) * 1.15

  const RecBar = ({ label, color, addTwh, pct, icon }) => {
    if (!addTwh || addTwh <= 0) return null
    const barW = Math.round((addTwh / maxRec) * 100)
    return (
      <div style={{ marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
          <span style={{ fontSize:11, color:'#b0bec5', display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:13 }}>{icon}</span> {label}
          </span>
          <span style={{ fontSize:11, fontWeight:700, color }}>
            +{addTwh.toFixed(1)} TWh {pct != null ? `(+${pct}%)` : '(new)'}
          </span>
        </div>
        <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:4, height:8, overflow:'hidden' }}>
          <div style={{ width:`${barW}%`, height:'100%', background:color, borderRadius:4,
            transition:'width 0.6s ease', boxShadow:`0 0 6px ${color}88` }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:0 }}>
      {/* Header */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#99abb4', textTransform:'uppercase', letterSpacing:'0.08em' }}>
            <i className="ti-bolt" style={{ marginRight:5 }} /> Energy Risk
          </span>
          <span style={{ fontSize:10, fontWeight:700, color:sevColor,
            background:sevColor+'22', padding:'2px 8px', borderRadius:10, border:`1px solid ${sevColor}55` }}>
            {sevLabel}
          </span>
        </div>
        <div style={{ fontSize:13, fontWeight:600, color:'#e0e6ed' }}>{country}</div>
      </div>

      {/* Deficit summary */}
      <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
        borderRadius:8, padding:'10px 12px', marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'#ef4444' }}>{display.gap_twh.toFixed(1)} TWh</div>
            <div style={{ fontSize:10, color:'#99abb4' }}>Gap by {horizonLabel}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:sevColor }}>{gapPct > 999 ? '>999' : gapPct}%</div>
            <div style={{ fontSize:10, color:'#99abb4' }}>Deficit %</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'#7774e7' }}>{display.demand.toFixed(1)} TWh</div>
            <div style={{ fontSize:10, color:'#99abb4' }}>Projected Demand</div>
          </div>
        </div>
        <div style={{ position:'relative', height:6, background:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ position:'absolute', left:0, top:0, height:'100%', borderRadius:3,
            width:`${Math.min(100, (display.generation/display.demand)*100).toFixed(1)}%`,
            background:'linear-gradient(90deg, #0f9aee, #37c936)' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
          <span style={{ fontSize:9, color:'#37c936' }}>Gen: {display.generation.toFixed(1)} TWh</span>
          <span style={{ fontSize:9, color:'#ef4444' }}>Need: {display.demand.toFixed(1)} TWh</span>
        </div>
      </div>

      {/* Current mix donut (small) */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#99abb4', textTransform:'uppercase',
          letterSpacing:'0.07em', marginBottom:8 }}>Current Mix (last known)</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            {(() => {
              const cx=32, cy=32, r=26
              const segs=[{val:fossilPct,color:'#ef4444'},{val:renewPct,color:'#37c936'},{val:nuclearPct,color:'#7774e7'}]
              let offset=-90
              return segs.map((s,i) => {
                if (s.val<=0) return null
                const deg=s.val*3.6, rad=a=>a*Math.PI/180
                const x1=cx+r*Math.cos(rad(offset)), y1=cy+r*Math.sin(rad(offset))
                const x2=cx+r*Math.cos(rad(offset+deg)), y2=cy+r*Math.sin(rad(offset+deg))
                const large=deg>180?1:0
                const path=`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
                offset+=deg
                return <path key={i} d={path} fill={s.color} opacity={0.85} />
              })
            })()}
            <circle cx={32} cy={32} r={18} fill={document.documentElement.getAttribute('data-theme')==='dark'?'#1e293b':'#f9fafb'} />
          </svg>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
            {[{label:'Fossil',color:'#ef4444',pct:fossilPct,twh:mix.fossil},
              {label:'Renewables',color:'#37c936',pct:renewPct,twh:mix.renewables},
              {label:'Nuclear',color:'#7774e7',pct:nuclearPct,twh:mix.nuclear}].map(m => (
              <div key={m.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:m.color, flexShrink:0 }} />
                <span style={{ fontSize:11, color:'#b0bec5', flex:1 }}>{m.label}</span>
                <span style={{ fontSize:11, fontWeight:600, color:'#e0e6ed' }}>{m.pct}%</span>
                <span style={{ fontSize:10, color:'#99abb4' }}>({m.twh.toFixed(1)})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <div style={{ fontSize:11, fontWeight:600, color:'#99abb4', textTransform:'uppercase',
          letterSpacing:'0.07em', marginBottom:10 }}>Recommended Increases to Close Gap</div>
        <RecBar label="Renewables" color="#37c936" icon={<i className="ti-stats-up" />} addTwh={recs.renewables.add_twh} pct={recs.renewables.increase_pct} />
        <RecBar label="Fossil Fuels" color="#f97316" icon={<i className="ti-alert" />} addTwh={recs.fossil.add_twh} pct={recs.fossil.increase_pct} />
        <RecBar label="Nuclear" color="#7774e7" icon={<i className="ti-bolt" />} addTwh={recs.nuclear.add_twh} pct={recs.nuclear.increase_pct} />
        <div style={{ fontSize:10, color:'#72777a', marginTop:8, lineHeight:1.5,
          borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:8 }}>
          Recommendations weighted by current energy mix.<br/>
          Renewables are given 1.5× priority for sustainability.
        </div>
      </div>
    </div>
  )
}

// ── Energy Mix Bubble Chart ───────────────────────────────────────────────────
// ── Bubble color helpers (pure functions, used inside and outside useEffect) ──
const bubbleColorFn = p => {
  if (p.fossil_pct  >= 60) return 'rgba(239,68,68,0.75)'
  if (p.renew_pct   >= 60) return 'rgba(55,201,54,0.75)'
  if (p.nuclear_pct >= 30) return 'rgba(119,116,231,0.75)'
  return 'rgba(247,163,92,0.75)'
}
const bubbleBorderFn = p => {
  if (p.fossil_pct  >= 60) return 'rgba(239,68,68,1)'
  if (p.renew_pct   >= 60) return 'rgba(55,201,54,1)'
  if (p.nuclear_pct >= 30) return 'rgba(119,116,231,1)'
  return 'rgba(247,163,92,1)'
}

function EnergyMixBubble({ activeCountry }) {
  const canvasRef       = useRef(null)
  const chartRef        = useRef(null)
  const pinnedRef       = useRef(null)   // index of pinned (clicked) bubble
  const tooltipElRef    = useRef(null)   // DOM ref for custom pinned tooltip
  const pointsRef       = useRef([])     // store points for highlight updates

  // Re-highlight whenever activeCountry changes (driven by map click)
  const highlightCountry = (countryName) => {
    const chart = chartRef.current
    if (!chart) return
    const dataset  = chart.data.datasets[0]
    const pts      = pointsRef.current
    const isDark   = document.documentElement.getAttribute('data-theme') === 'dark'

    dataset.backgroundColor = pts.map(p => {
      const isActive = p.country === countryName
      const base = bubbleColorFn(p)
      if (isActive) return base.replace(/[\d.]+\)$/, '1)')  // full opacity
      return base.replace(/[\d.]+\)$/, '0.3)')              // dim others
    })
    dataset.borderColor = pts.map(p => {
      const isActive = p.country === countryName
      return isActive ? '#ffffff' : bubbleBorderFn(p)
    })
    dataset.borderWidth     = pts.map(p => p.country === countryName ? 3 : 1.5)
    dataset.hoverBorderWidth = pts.map(p => p.country === countryName ? 4 : 2.5)

    chart.update('none')  // no animation for snappy response
  }

  useEffect(() => {
    if (activeCountry) highlightCountry(activeCountry)
  }, [activeCountry])

  useEffect(() => {
    const loadChartJS = () => new Promise((resolve) => {
      if (window.Chart) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
      s.onload = resolve
      document.head.appendChild(s)
    })

    const initChart = () => {
      if (!canvasRef.current || !window.Chart) return
      if (chartRef.current) { chartRef.current.destroy() }

      const isDark    = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
      const tickColor = isDark ? '#7b8fa6' : '#99abb4'

      const MIN_GEN = 1
      const MAX_R   = 28
      const MIN_R   = 5

      const points = []
      Object.entries(forecastData).forEach(([country, rows]) => {
        const hist = rows.filter(r => r.type === 'historical')
        if (!hist.length) return
        const last    = hist[hist.length - 1]
        const fossil  = last.fossil_electricity     ?? 0
        const renew   = last.renewables_electricity ?? 0
        const nuclear = last.nuclear_electricity    ?? 0
        const gen     = last.electricity_generation ?? 0
        if (gen < MIN_GEN) return
        points.push({
          country, fossil, renew, nuclear, gen,
          logRenew:  Math.log10(renew  + 1),
          logFossil: Math.log10(fossil + 1),
          fossil_pct:  gen > 0 ? +(fossil  / gen * 100).toFixed(1) : 0,
          renew_pct:   gen > 0 ? +(renew   / gen * 100).toFixed(1) : 0,
          nuclear_pct: gen > 0 ? +(nuclear / gen * 100).toFixed(1) : 0,
        })
      })
      pointsRef.current = points

      const maxLogGen = Math.max(...points.map(p => Math.log10(p.gen + 1)))
      const scaleR = p => Math.max(MIN_R, Math.min(MAX_R,
        (Math.log10(p.gen + 1) / maxLogGen) * MAX_R
      ))

      const bubbleData = points.map(p => ({
        x: p.logRenew, y: p.logFossil, r: scaleR(p),
        _country: p.country, _gen: p.gen,
        _fossil: p.fossil, _renew: p.renew, _nuclear: p.nuclear,
        _fossil_pct: p.fossil_pct, _renew_pct: p.renew_pct, _nuclear_pct: p.nuclear_pct,
      }))

      const logTicks = [0, 1, 10, 50, 100, 500, 1000, 5000].map(v => ({ raw: v, log: Math.log10(v + 1) }))

      // ── Custom pinned tooltip element ────────────────────────────────────
      let tooltipEl = tooltipElRef.current
      if (!tooltipEl) {
        tooltipEl = document.createElement('div')
        tooltipEl.style.cssText = `
          position:absolute; pointer-events:none; display:none;
          background:${isDark ? '#1c1f2b' : '#fff'};
          border:1px solid ${isDark ? '#313644' : '#e6eaf0'};
          border-radius:8px; padding:12px 14px;
          font-size:12px; font-family:Roboto,sans-serif;
          color:${isDark ? '#b0bec5' : '#72777a'};
          box-shadow:0 4px 20px rgba(0,0,0,0.3);
          min-width:200px; z-index:999;
        `
        canvasRef.current.parentElement.style.position = 'relative'
        canvasRef.current.parentElement.appendChild(tooltipEl)
        tooltipElRef.current = tooltipEl
      }

      const showPinnedTooltip = (pt, x, y) => {
        tooltipEl.innerHTML = `
          <div style="font-weight:700;font-size:13px;color:${isDark?'#e0e6ed':'#354052'};margin-bottom:8px;border-bottom:1px solid ${isDark?'#313644':'#e6eaf0'};padding-bottom:6px">
            ${pt._country}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <div>Total Generation : <b>${pt._gen.toFixed(1)} TWh</b></div>
            <div>Fossil           : <b>${pt._fossil.toFixed(1)} TWh (${pt._fossil_pct}%)</b></div>
            <div>Renewables       : <b>${pt._renew.toFixed(1)} TWh (${pt._renew_pct}%)</b></div>
            <div>Nuclear          : <b>${pt._nuclear.toFixed(1)} TWh (${pt._nuclear_pct}%)</b></div>
          </div>
        `
        // Position tooltip — keep it within bounds
        const canvas   = canvasRef.current
        const cRect    = canvas.getBoundingClientRect()
        const parentW  = canvas.parentElement.offsetWidth
        const parentH  = canvas.parentElement.offsetHeight
        tooltipEl.style.display = 'block'
        const tw = tooltipEl.offsetWidth  || 220
        const th = tooltipEl.offsetHeight || 120
        let left = x + 16
        let top  = y - th / 2
        if (left + tw > parentW - 8) left = x - tw - 16
        if (top < 8) top = 8
        if (top + th > parentH - 8) top = parentH - th - 8
        tooltipEl.style.left = left + 'px'
        tooltipEl.style.top  = top  + 'px'
      }

      const hidePinnedTooltip = () => {
        tooltipEl.style.display = 'none'
        pinnedRef.current = null
      }

      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'bubble',
        data: {
          datasets: [{
            label: 'Countries',
            data: bubbleData,
            backgroundColor: points.map(p => bubbleColorFn(p)),
            borderColor:     points.map(p => bubbleBorderFn(p)),
            borderWidth: 1.5,
            hoverBorderWidth: 3,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick(event, elements) {
            if (elements.length > 0) {
              const idx = elements[0].index
              const pt  = bubbleData[idx]
              const el  = chartRef.current.getDatasetMeta(0).data[idx]
              pinnedRef.current = idx
              showPinnedTooltip(pt, el.x, el.y)
            } else {
              hidePinnedTooltip()
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              // Built-in tooltip: opaque background, only shows on hover (not pinned)
              enabled: true,
              backgroundColor: isDark ? '#1c1f2b' : '#ffffff',
              titleColor: isDark ? '#e0e6ed' : '#354052',
              bodyColor:  isDark ? '#b0bec5' : '#72777a',
              borderColor: isDark ? '#313644' : '#e6eaf0',
              borderWidth: 1, padding: 14,
              opacity: 1,
              callbacks: {
                title: (items) => items[0]?.raw?._country ?? '',
                label: (ctx) => {
                  const d = ctx.raw
                  return [
                    ` Total Generation : ${d._gen.toFixed(1)} TWh`,
                    ` Fossil           : ${d._fossil.toFixed(1)} TWh (${d._fossil_pct}%)`,
                    ` Renewables       : ${d._renew.toFixed(1)} TWh (${d._renew_pct}%)`,
                    ` Nuclear          : ${d._nuclear.toFixed(1)} TWh (${d._nuclear_pct}%)`,
                  ]
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: gridColor }, min: 0, max: Math.log10(5000 + 1),
              ticks: {
                color: tickColor, font: { size: 11 },
                callback: (val) => {
                  const match = logTicks.find(t => Math.abs(t.log - val) < 0.05)
                  return match != null ? `${match.raw} TWh` : ''
                },
                maxTicksLimit: 9,
              },
              border: { display: false },
              title: { display: true, text: '← Less Renewables    Renewables Electricity (log scale)    More Renewables →', color: '#37c936', font: { size: 12, weight: 'bold' } },
            },
            y: {
              grid: { color: gridColor }, min: 0, max: Math.log10(7000 + 1),
              ticks: {
                color: tickColor, font: { size: 11 },
                callback: (val) => {
                  const match = logTicks.find(t => Math.abs(t.log - val) < 0.05)
                  return match != null ? `${match.raw} TWh` : ''
                },
                maxTicksLimit: 9,
              },
              border: { display: false },
              title: { display: true, text: '↑ More Fossil    Fossil Electricity (log scale)    Less Fossil ↓', color: '#ef4444', font: { size: 12, weight: 'bold' } },
            },
          },
        },
        plugins: [{
          id: 'quadrantLabels',
          afterDraw(chart) {
            const { ctx, chartArea: { left, right, top, bottom, width, height }, scales } = chart
            const midLogX = Math.log10(100 + 1)
            const midLogY = Math.log10(100 + 1)
            const midPxX  = scales.x.getPixelForValue(midLogX)
            const midPxY  = scales.y.getPixelForValue(midLogY)
            ctx.save()
            ctx.setLineDash([5, 6])
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(midPxX, top);  ctx.lineTo(midPxX, bottom); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(left, midPxY); ctx.lineTo(right, midPxY);  ctx.stroke()
            ctx.setLineDash([])
            const qLabels = [
              { x: left + 12,  y: top + 18,    text: 'Fossil Dominant',             align: 'left'  },
              { x: right - 12, y: top + 18,    text: 'Mixed High Output',           align: 'right' },
              { x: left + 12,  y: bottom - 10, text: 'Renewables Leader',           align: 'left'  },
              { x: right - 12, y: bottom - 10, text: 'Low Fossil & High Renewables',  align: 'right' },
            ]
            ctx.font = 'bold 11px Roboto, sans-serif'
            qLabels.forEach(l => {
              ctx.textAlign = l.align
              ctx.fillStyle = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
              ctx.fillText(l.text, l.x, l.y)
            })
            ctx.font = '10px Roboto, sans-serif'
            ctx.textAlign = 'center'
            const dataset = chart.data.datasets[0]
            dataset.data.forEach((pt, i) => {
              if (pt._gen < 50) return
              const meta = chart.getDatasetMeta(0)
              const el   = meta.data[i]
              if (!el) return
              const px = el.x
              const py = el.y - el.options.radius - 4
              ctx.fillStyle = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'
              ctx.fillText(pt._country, px + 1, py + 1)
              ctx.fillStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(30,30,30,0.85)'
              ctx.fillText(pt._country, px, py)
            })
            ctx.restore()
          }
        }]
      })

      // Dismiss pinned tooltip on outside click
      const onOutsideClick = (e) => {
        if (canvasRef.current && !canvasRef.current.contains(e.target)) {
          hidePinnedTooltip()
        }
      }
      document.addEventListener('click', onOutsideClick)

      // Apply initial highlight for activeCountry
      if (activeCountry) {
        setTimeout(() => highlightCountry(activeCountry), 80)
      }

      return () => {
        document.removeEventListener('click', onOutsideClick)
      }
    }

    loadChartJS().then(() => setTimeout(initChart, 50))
    const onTheme = () => setTimeout(initChart, 50)
    window.addEventListener('adminator:themeChanged', onTheme)
    return () => {
      window.removeEventListener('adminator:themeChanged', onTheme)
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      if (tooltipElRef.current) { tooltipElRef.current.remove(); tooltipElRef.current = null }
    }
  }, [])

  const legendItems = [
    { color: '#ef4444', label: 'Fossil Dominant (≥60% fossil)' },
    { color: '#37c936', label: 'Renewables Dominant (≥60% renewables)' },
    { color: '#7774e7', label: 'Notable Nuclear (≥30% nuclear)' },
    { color: '#f7a35c', label: 'Mixed Energy Mix' },
  ]

  return (
    <div className="card ms-card">
      <div className="ms-card__header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <h6 className="card__title">Global Energy Mix — Fossil vs Renewables</h6>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
          {legendItems.map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:l.color, flexShrink:0 }} />
              <span style={{ fontSize:11, color:'#99abb4' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#b0bec5', flexShrink:0 }} />
            <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #b0bec5', flexShrink:0 }} />
            <span style={{ fontSize:11, color:'#99abb4' }}>Bubble size = Total Generation</span>
          </div>
        </div>
      </div>
      <div className="ms-card__chart" style={{ height:'680px', position:'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}


// ── Main Dashboard Page ────────────────────────────────────────────────────────
const API_URL = 'https://group12-model-api.onrender.com/forecast'

export default function Dashboard() {
  const [activeCountry, setActiveCountry] = useState('United States')
  const [dataReady, setDataReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('Fetching forecast data from:', API_URL)
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        return res.json()
      })
      .then((data) => {
        console.log('Forecast data received:', {
          countries: Object.keys(data).length,
          sample: Object.keys(data).slice(0, 5),
        })
        forecastData = data
        setDataReady(true)
      })
      .catch((err) => {
        console.error('Failed to fetch forecast data:', err)
        setError(err.message)
      })
  }, [])

  if (error) {
    return (
      <Layout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 400, flexDirection: 'column', gap: 12, color: '#72777a' }}>
          <i className="ti-alert" style={{ fontSize: 36, color: '#ef4444' }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>Failed to load forecast data</div>
          <div style={{ fontSize: 13, color: '#99abb4' }}>{error}</div>
        </div>
      </Layout>
    )
  }

  if (!dataReady) {
    return (
      <Layout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 400, flexDirection: 'column', gap: 12, color: '#72777a' }}>
          <div style={{ fontSize: 14 }}>Loading forecast data...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Stat Cards — sparkline bars (peer-greed) + pill badge (peer) */}
      

      {/* Site Visits — full width: vector map (70%) + stats (30%) */}
      <SiteVisits onCountrySelect={(name) => name && setActiveCountry(name)} activeCountry={activeCountry} />

      {/* Monthly Stats — full-width line chart with footer */}
      <MonthlyStats activeCountry={activeCountry} />

      {/* GDP & Population Chart */}
      <GdpPopChart activeCountry={activeCountry} />

      {/* Electricity Mix Chart */}
      <ElectricityMixChart activeCountry={activeCountry} />

      {/* GHG Emissions Chart */}
      <GHGChart activeCountry={activeCountry} />

      {/* Global Energy Mix Bubble Chart */}
      <EnergyMixBubble activeCountry={activeCountry} />
    </Layout>
  )
}
