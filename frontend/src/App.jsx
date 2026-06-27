import { useEffect, useState, useRef, useMemo } from 'react'
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps'

const TOKYO = { lat: 35.6762, lng: 139.6503 }
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const PROXIMITY_METERS = 120
const THEME = '#7c3aed'
const THEME_DARK = '#4c1d95'

const MAP_STYLES = [
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#fefdf5' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#fdfbec' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#ade8f4' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a7ab5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fde68a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#fbbf24' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fef9e7' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4f5a0' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3a7d1e' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: 20 }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#fde68a' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#fefce8' }] },
]

// 聖地ピン用 SVG（紫の星マーク）
const SPOT_ICON = {
  path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  fillColor: '#7c3aed',
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 1.5,
  scale: 1.0,
  anchor: { x: 12, y: 12 },
}

const DEMO_SPEEDS = [
  { label: '10s', ms: 10000 },
  { label: '30s', ms: 30000 },
  { label: '60s', ms: 60000 },
]

function haversine(a, b) {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function interpolatePath(path, t) {
  if (!path.length) return null
  if (t <= 0) return path[0]
  if (t >= 1) return path[path.length - 1]
  const segs = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = haversine(path[i - 1], path[i])
    segs.push(d)
    total += d
  }
  let rem = t * total
  for (let i = 0; i < segs.length; i++) {
    if (rem <= segs[i]) {
      const r = segs[i] > 0 ? rem / segs[i] : 0
      return {
        lat: path[i].lat + (path[i + 1].lat - path[i].lat) * r,
        lng: path[i].lng + (path[i + 1].lng - path[i].lng) * r,
      }
    }
    rem -= segs[i]
  }
  return path[path.length - 1]
}

function Route({ spots, onPathReady }) {
  const map = useMap()

  useEffect(() => {
    if (!map || spots.length < 2) return

    const service = new google.maps.DirectionsService()
    const renderer = new google.maps.DirectionsRenderer({ suppressMarkers: true })
    renderer.setMap(map)

    const waypoints = spots.slice(1, -1).map(s => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }))

    service.route({
      origin: { lat: spots[0].lat, lng: spots[0].lng },
      destination: { lat: spots[spots.length - 1].lat, lng: spots[spots.length - 1].lng },
      waypoints,
      travelMode: google.maps.TravelMode.WALKING,
    }, (result, status) => {
      if (status === 'OK') {
        renderer.setDirections(result)
        const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }))
        onPathReady(path)
      }
    })

    return () => renderer.setMap(null)
  }, [map, spots])

  return null
}

// フロントサイドキャッシュ（spot_id -> intro text）
const introCache = {}

function Card({ spot, onClose }) {
  const [intro, setIntro] = useState(introCache[spot.id] || spot.intro_short_en)
  const [loading, setLoading] = useState(!introCache[spot.id])
  const [aiOk, setAiOk] = useState(!!introCache[spot.id])

  useEffect(() => {
    if (introCache[spot.id]) {
      setIntro(introCache[spot.id])
      setLoading(false)
      setAiOk(true)
      return
    }
    setIntro(spot.intro_short_en)
    setLoading(true)
    setAiOk(false)
    fetch(`${BACKEND_URL}/generate-intro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: spot.id,
        spot_name_en: spot.spot_name_en,
        anime_title_en: spot.anime_title_en,
        scene_description: spot.scene_description,
        area: spot.area,
      }),
    })
      .then(r => { if (!r.ok) throw new Error('server error'); return r.json() })
      .then(data => {
        if (data.intro) {
          introCache[spot.id] = data.intro
          setIntro(data.intro)
          setAiOk(true)
        }
      })
      .catch(() => {
        // 通信・API失敗 → JSON の元テキストをそのまま表示
        setIntro(spot.intro_short_en)
        setAiOk(false)
      })
      .finally(() => setLoading(false))
  }, [spot.id])

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 12, right: 12,
      maxWidth: 380, margin: '0 auto',
      background: 'white', borderRadius: 20,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
      zIndex: 10, overflow: 'hidden',
    }}>
      {/* ヘッダー帯 */}
      <div style={{
        background: `linear-gradient(135deg, ${THEME} 0%, ${THEME_DARK} 100%)`,
        padding: '14px 44px 14px 18px',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
          {spot.anime_title_en}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
          {spot.spot_name_en}
        </div>
        {spot.area && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            📍 {spot.area}
          </div>
        )}
      </div>

      {/* 閉じるボタン */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 10, right: 12,
        background: 'rgba(255,255,255,0.2)', border: 'none',
        color: '#fff', fontSize: 16, width: 28, height: 28,
        borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>

      {/* 本文 */}
      <div style={{ padding: '14px 18px 12px' }}>
        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7, minHeight: 56 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', paddingTop: 4 }}>
              <div style={{
                width: 15, height: 15, border: '2px solid #e0e0e0',
                borderTop: '2px solid #7c3aed', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <span style={{ fontSize: 13 }}>Generating introduction…</span>
            </div>
          ) : intro}
        </div>
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 8, textAlign: 'right' }}>
          {!loading && (aiOk ? '✨ AI generated' : '📄 description')}
        </div>
      </div>
    </div>
  )
}

function DemoControls({ demoMode, setDemoMode, playing, onPlay, onPause, onReset, progress, hasPath, speedMs, setSpeedMs }) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(255,255,255,0.95)', borderRadius: 24, padding: '8px 14px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.18)', display: 'flex', gap: 8,
      alignItems: 'center', zIndex: 10, userSelect: 'none',
      maxWidth: 'calc(100vw - 32px)',
    }}>
      <button
        onClick={() => setDemoMode(m => !m)}
        style={{
          fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
          border: 'none', cursor: 'pointer',
          background: demoMode ? '#7c3aed' : '#e0e0e0',
          color: demoMode ? '#fff' : '#555',
        }}
      >
        {demoMode ? 'DEMO' : 'LIVE'}
      </button>
      {demoMode && (
        <>
          <button
            onClick={playing ? onPause : onPlay}
            disabled={!hasPath}
            style={{
              fontSize: 20, background: 'none', border: 'none',
              cursor: hasPath ? 'pointer' : 'default', opacity: hasPath ? 1 : 0.35,
              lineHeight: 1,
            }}
          >
            {playing ? '⏸' : '▶️'}
          </button>
          <button
            onClick={onReset}
            style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
          >
            ⏮
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {DEMO_SPEEDS.map(s => (
              <button
                key={s.ms}
                onClick={() => { setSpeedMs(s.ms); onReset() }}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 10,
                  border: 'none', cursor: 'pointer',
                  background: speedMs === s.ms ? '#7c3aed' : '#e8e8e8',
                  color: speedMs === s.ms ? '#fff' : '#666',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ width: 70, height: 5, background: '#e8e8e8', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${progress * 100}%`, height: '100%',
              background: '#7c3aed', borderRadius: 3, transition: 'width 0.1s linear',
            }} />
          </div>
        </>
      )}
    </div>
  )
}

function App() {
  const [spots, setSpots] = useState([])
  const [selected, setSelected] = useState(null)
  const [routePath, setRoutePath] = useState([])

  // Demo mode state
  const [demoMode, setDemoMode] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [demoProgress, setDemoProgress] = useState(0)
  const [speedMs, setSpeedMs] = useState(30000)
  const triggeredRef = useRef(new Set())

  useEffect(() => {
    fetch('/seichi_data.json')
      .then(r => r.json())
      .then(raw => {
        const data = raw.filter(s =>
          s.id &&
          typeof s.lat === 'number' && !isNaN(s.lat) &&
          typeof s.lng === 'number' && !isNaN(s.lng) &&
          s.spot_name_en && s.anime_title_en
        )
        setSpots(data)
        // 全聖地ぶんの紹介文を起動時に一括生成
        fetch(`${BACKEND_URL}/prefetch-intros`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.map(s => ({
            id: s.id,
            spot_name_en: s.spot_name_en,
            anime_title_en: s.anime_title_en,
            scene_description: s.scene_description,
            area: s.area,
          }))),
        })
          .then(r => r.json())
          .then(res => {
            if (res.intros) Object.assign(introCache, res.intros)
          })
          .catch(() => {})
      })
  }, [])

  // Animation loop
  useEffect(() => {
    if (!playing || !demoMode || routePath.length === 0) return
    const step = 100 / speedMs
    const id = setInterval(() => {
      setDemoProgress(prev => {
        const next = prev + step
        if (next >= 1) { setPlaying(false); return 1 }
        return next
      })
    }, 100)
    return () => clearInterval(id)
  }, [playing, demoMode, routePath.length, speedMs])

  const demoPos = useMemo(
    () => (demoMode && routePath.length) ? interpolatePath(routePath, demoProgress) : null,
    [demoMode, routePath, demoProgress],
  )

  // Proximity trigger: auto-show card when demo marker nears a spot
  useEffect(() => {
    if (!demoPos || !spots.length) return
    for (const spot of spots) {
      if (
        haversine(demoPos, { lat: spot.lat, lng: spot.lng }) < PROXIMITY_METERS &&
        !triggeredRef.current.has(spot.id)
      ) {
        triggeredRef.current.add(spot.id)
        setSelected(spot)
        break
      }
    }
  }, [demoPos, spots])

  const handleReset = () => {
    setDemoProgress(0)
    setPlaying(false)
    triggeredRef.current.clear()
    setSelected(null)
  }

  // Real GPS hook point — swap demoPos for navigator.geolocation position when demoMode is false
  // const livePos = useLiveGPS(!demoMode)

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={TOKYO}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI={false}
          styles={MAP_STYLES}
          onClick={() => setSelected(null)}
        >
          <Route spots={spots} onPathReady={setRoutePath} />
          {spots.map(spot => (
            <Marker
              key={spot.id}
              position={{ lat: spot.lat, lng: spot.lng }}
              title={spot.spot_name_en}
              icon={SPOT_ICON}
              onClick={() => setSelected(spot)}
            />
          ))}
          {demoPos && (
            <Marker
              position={demoPos}
              title="You are here"
              zIndex={999}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: THEME,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 3,
                scale: 10,
              }}
            />
          )}
        </Map>
      </APIProvider>
      <DemoControls
        demoMode={demoMode}
        setDemoMode={m => { setDemoMode(m); handleReset() }}
        playing={playing}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onReset={handleReset}
        progress={demoProgress}
        hasPath={routePath.length > 0}
        speedMs={speedMs}
        setSpeedMs={setSpeedMs}
      />
      {selected && <Card spot={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default App
