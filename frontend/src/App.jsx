import { useEffect, useState, useRef, useMemo } from 'react'
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps'

const TOKYO = { lat: 35.6762, lng: 139.6503 }
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const PROXIMITY_METERS = 120
const DEMO_DURATION_MS = 30000

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

function Card({ spot, onClose }) {
  const [intro, setIntro] = useState(spot.intro_short_en)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setIntro(spot.intro_short_en)
    setLoading(true)
    fetch(`${BACKEND_URL}/generate-intro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spot_name_en: spot.spot_name_en,
        anime_title_en: spot.anime_title_en,
        scene_description: spot.scene_description,
        area: spot.area,
      }),
    })
      .then(r => r.json())
      .then(data => { if (data.intro) setIntro(data.intro) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [spot.id])

  return (
    <div style={{
      position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      background: 'white', borderRadius: 12, padding: '16px 20px', width: 320,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 10,
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 8, right: 12,
        background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
      }}>✕</button>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{spot.anime_title_ja}</div>
      <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>{spot.spot_name_ja}</div>
      <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, minHeight: 60 }}>
        {loading ? <span style={{ color: '#aaa' }}>Generating introduction…</span> : intro}
      </div>
      <div style={{ fontSize: 11, color: '#bbb', marginTop: 8, textAlign: 'right' }}>
        {!loading && '✨ AI generated'}
      </div>
    </div>
  )
}

function DemoControls({ demoMode, setDemoMode, playing, onPlay, onPause, onReset, progress, hasPath }) {
  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(255,255,255,0.95)', borderRadius: 24, padding: '8px 18px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.18)', display: 'flex', gap: 10,
      alignItems: 'center', zIndex: 10, userSelect: 'none',
    }}>
      <button
        onClick={() => setDemoMode(m => !m)}
        style={{
          fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
          border: 'none', cursor: 'pointer',
          background: demoMode ? '#1a73e8' : '#e0e0e0',
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
          <div style={{
            width: 90, height: 5, background: '#e8e8e8', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress * 100}%`, height: '100%',
              background: '#1a73e8', borderRadius: 3, transition: 'width 0.1s linear',
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
  const triggeredRef = useRef(new Set())

  useEffect(() => {
    fetch('/seichi_data.json')
      .then(r => r.json())
      .then(setSpots)
  }, [])

  // Animation loop
  useEffect(() => {
    if (!playing || !demoMode || routePath.length === 0) return
    const step = 100 / DEMO_DURATION_MS
    const id = setInterval(() => {
      setDemoProgress(prev => {
        const next = prev + step
        if (next >= 1) { setPlaying(false); return 1 }
        return next
      })
    }, 100)
    return () => clearInterval(id)
  }, [playing, demoMode, routePath.length])

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
          onClick={() => setSelected(null)}
        >
          <Route spots={spots} onPathReady={setRoutePath} />
          {spots.map(spot => (
            <Marker
              key={spot.id}
              position={{ lat: spot.lat, lng: spot.lng }}
              title={spot.spot_name_en}
              onClick={() => setSelected(spot)}
            />
          ))}
          {demoPos && (
            <Marker
              position={demoPos}
              title="You are here"
              zIndex={999}
              label={{ text: '●', color: '#1a73e8', fontSize: '18px', fontWeight: 'bold' }}
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
      />
      {selected && <Card spot={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default App
