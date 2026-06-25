import { useEffect, useState } from 'react'
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps'

const TOKYO = { lat: 35.6762, lng: 139.6503 }

function Route({ spots }) {
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
      if (status === 'OK') renderer.setDirections(result)
    })

    return () => renderer.setMap(null)
  }, [map, spots])

  return null
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

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

function App() {
  const [spots, setSpots] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch('/seichi_data.json')
      .then(r => r.json())
      .then(setSpots)
  }, [])

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
          <Route spots={spots} />
          {spots.map(spot => (
            <Marker
              key={spot.id}
              position={{ lat: spot.lat, lng: spot.lng }}
              title={spot.spot_name_en}
              onClick={() => setSelected(spot)}
            />
          ))}
        </Map>
      </APIProvider>
      {selected && <Card spot={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default App
