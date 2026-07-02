import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps'
import { MarkerClusterer } from '@googlemaps/markerclusterer'

// ============================================================
// 汎用紹介文（AI生成失敗時・intro_short_en 未記入時のフォールバック）
// ここを編集してください ↓
const GENERIC_INTRO = `Welcome to this anime pilgrimage spot! This location appeared in a beloved anime series and draws fans from around the world. Come and experience the scenery that inspired the story.`
// ============================================================

const TOKYO = { lat: 35.6762, lng: 139.6503 }
const TOKYO_STATION = { lat: 35.6812, lng: 139.7671 }
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const PROXIMITY_METERS = 100
const THEME = '#7c3aed'
const THEME_DARK = '#4c1d95'
const DEMO_STEP = 0.001   // degrees per tick (≈110m)
const DEMO_TICK_MS = 600  // marker position update interval
const ARRIVE_DEG = 0.001  // ≈110m, spot "arrived"

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

const RED_PIN_ICON = {
  path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
  fillColor: '#EA4335',
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 1.5,
  scale: 1.8,
  anchor: { x: 12, y: 22 },
}

const DIM_SPOT_ICON = {
  path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  fillColor: '#9ca3af',
  fillOpacity: 0.5,
  strokeColor: '#e5e7eb',
  strokeWeight: 1,
  scale: 0.9,
  anchor: { x: 12, y: 12 },
}

const SPOT_ICON = {
  path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  fillColor: '#7c3aed',
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 1.5,
  scale: 1.0,
  anchor: { x: 12, y: 12 },
}

function haversine(a, b) {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function formatDistance(meters) {
  if (meters >= 100000) return 'Far away'
  if (meters < 100) return `About ${Math.round(meters)}m`
  return `About ${(meters / 1000).toFixed(1)}km`
}

// ── 選択中スポット専用マーカー（パルスをここだけで持つ）─────────────────
function SelectedSpotMarker({ spot, onClick }) {
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 500)
    return () => clearInterval(id)
  }, [])
  return (
    <Marker
      position={{ lat: spot.lat, lng: spot.lng }}
      title={spot.spot_name_en}
      icon={{ ...SPOT_ICON, scale: pulse ? 1.6 : 1.1, fillColor: '#a855f7' }}
      zIndex={100}
      onClick={onClick}
    />
  )
}

// ── 聖地ピンクラスタリング（Reactの再描画から切り離し）────────────────
function ClusteredSpotMarkers({ spots, selectedId, onSelect, highlightAnime }) {
  const map = useMap()
  const clustererRef = useRef(null)

  useEffect(() => {
    if (!map) return
    clustererRef.current = new MarkerClusterer({ map })
    return () => { clustererRef.current?.setMap(null); clustererRef.current = null }
  }, [map])

  useEffect(() => {
    if (!clustererRef.current) return
    clustererRef.current.clearMarkers()
    const markers = spots
      .filter(s => s.id !== selectedId && !(highlightAnime && s.anime_title_en === highlightAnime))
      .map(spot => {
        const icon = highlightAnime ? DIM_SPOT_ICON : SPOT_ICON
        const m = new google.maps.Marker({
          position: { lat: spot.lat, lng: spot.lng },
          title: spot.spot_name_en,
          icon,
        })
        if (onSelect) m.addListener('click', () => onSelect(spot))
        return m
      })
    clustererRef.current.addMarkers(markers)
  }, [spots, selectedId, onSelect, highlightAnime])

  return null
}

// ── デモ自由移動エンジン＋カメラ制御 ────────────────────────────────────
function DemoEngine({ spots, startPos, playing, onPosChange, selectedId }) {
  const map = useMap()
  const posRef      = useRef(null)
  const targetRef   = useRef(null)
  const visitedRef  = useRef(new Set())
  const wobbleRef   = useRef(0)
  const pauseUntilRef = useRef(0)
  const selectedRef = useRef(selectedId)
  const startPosRef = useRef(startPos)

  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  // startPos が変わったらリセット
  useEffect(() => {
    startPosRef.current = startPos
    posRef.current = startPos || null
    targetRef.current = null
    visitedRef.current = new Set()
    wobbleRef.current = 0
    if (startPos) onPosChange({ ...startPos })
  }, [startPos])

  // 移動ループ
  useEffect(() => {
    if (!playing) return

    const tick = setInterval(() => {
      const sp  = startPosRef.current
      const pos = posRef.current
      if (!sp || !pos) return

      // 次のターゲットを選ぶ
      if (!targetRef.current) {
        const eligible = spots.filter(s =>
          haversine(sp, { lat: s.lat, lng: s.lng }) <= 40000 &&
          !visitedRef.current.has(s.id)
        )
        if (!eligible.length) { visitedRef.current = new Set(); return }
        // 近い順に選ぶ（揺らぎのため上位3件からランダム）
        eligible.sort((a, b) =>
          haversine(pos, { lat: a.lat, lng: a.lng }) - haversine(pos, { lat: b.lat, lng: b.lng })
        )
        targetRef.current = eligible[Math.floor(Math.random() * Math.min(3, eligible.length))]
      }

      const { lat: tLat, lng: tLng, id } = targetRef.current
      const dLat = tLat - pos.lat
      const dLng = tLng - pos.lng
      const dist  = Math.sqrt(dLat * dLat + dLng * dLng)

      if (dist < ARRIVE_DEG) {
        visitedRef.current.add(id)
        targetRef.current = null
        pauseUntilRef.current = Date.now() + 5000
        return
      }

      // スポット到達後の待機中はその場で止まる
      if (Date.now() < pauseUntilRef.current) return

      // 向きにゆるい揺らぎ
      wobbleRef.current = wobbleRef.current * 0.85 + (Math.random() - 0.5) * 0.3
      const ang = Math.atan2(dLng, dLat) + wobbleRef.current
      const newPos = {
        lat: pos.lat + Math.cos(ang) * DEMO_STEP,
        lng: pos.lng + Math.sin(ang) * DEMO_STEP,
      }
      posRef.current = newPos
      onPosChange({ ...newPos })
    }, DEMO_TICK_MS)

    return () => clearInterval(tick)
  }, [playing, spots, map])

  // カメラ: rAF で毎フレームposRefを読んでsetCenter（マーカーtickと独立）
  useEffect(() => {
    if (!map || !playing) return
    let rafId
    const follow = () => {
      if (!selectedRef.current && posRef.current) map.setCenter(posRef.current)
      rafId = requestAnimationFrame(follow)
    }
    rafId = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(rafId)
  }, [map, playing])

  // カード開閉でカメラ切替
  useEffect(() => {
    if (!map) return
    if (selectedId) {
      const spot = spots.find(s => s.id === selectedId)
      if (spot) { map.panTo({ lat: spot.lat, lng: spot.lng }); map.setZoom(15) }
    } else if (posRef.current) {
      map.panTo(posRef.current)
    }
  }, [selectedId, map])

  return null
}

// ── ライブモードのカメラ制御 ─────────────────────────────────────────────
function LiveCamera({ livePos, selected, locateTick }) {
  const map = useMap()
  const livePosRef = useRef(livePos)
  useEffect(() => { livePosRef.current = livePos }, [livePos])

  // スポット選択 / 解除でカメラ切替
  useEffect(() => {
    if (!map) return
    if (selected) {
      map.panTo({ lat: selected.lat, lng: selected.lng })
      map.setZoom(15)
    }
  }, [selected?.id, map])

  // GPS ボタン押下で現在地へ
  useEffect(() => {
    if (!map || !locateTick || !livePosRef.current) return
    map.panTo(livePosRef.current)
    map.setZoom(14)
  }, [locateTick, map])

  return null
}

// ── AIキャッシュ ─────────────────────────────────────────────────────────
const introCache = {}

// ── スポットカード（距離表示付き）────────────────────────────────────────
const isPlaceholder = t => !t || t.startsWith('PLACEHOLDER')

function Card({ spot, currentPos, onClose }) {
  const staticIntro = spot.generic_intro_en || (!isPlaceholder(spot.intro_short_en) ? spot.intro_short_en : GENERIC_INTRO)
  const [intro, setIntro]   = useState(introCache[spot.id] || staticIntro)
  const [loading, setLoading] = useState(!introCache[spot.id])
  const [aiOk, setAiOk]     = useState(!!introCache[spot.id])
  const [expanded, setExpanded] = useState(false)

  const distText = currentPos
    ? formatDistance(haversine(currentPos, { lat: spot.lat, lng: spot.lng }))
    : null

  useEffect(() => {
    if (introCache[spot.id]) {
      setIntro(introCache[spot.id]); setLoading(false); setAiOk(true); return
    }
    setIntro(null); setLoading(true); setAiOk(false)
    fetch(`${BACKEND_URL}/generate-intro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: spot.id, spot_name_en: spot.spot_name_en,
        anime_title_en: spot.anime_title_en,
        scene_description: spot.scene_description, area: spot.area,
      }),
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (data.intro) { introCache[spot.id] = data.intro; setIntro(data.intro); setAiOk(true) } })
      .catch(() => { setIntro(staticIntro); setAiOk(false) })
      .finally(() => setLoading(false))
  }, [spot.id])

  return (
    <div style={{
      position: 'absolute', bottom: 60, left: 12, right: 12,
      maxWidth: 380, margin: '0 auto',
      background: 'white', borderRadius: 20,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
      zIndex: 10, overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          background: `linear-gradient(135deg, ${THEME} 0%, ${THEME_DARK} 100%)`,
          padding: '14px 44px 14px 18px', cursor: 'pointer',
        }}
      >
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
        {distText && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            🚶 {distText}
          </div>
        )}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginTop: 8, padding: '4px 10px', borderRadius: 20,
          background: 'rgba(255,255,255,0.25)',
          fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.03em',
        }}>
          {expanded ? '▲ close' : '▼ read more'}
        </div>
      </div>

      <button onClick={onClose} style={{
        position: 'absolute', top: 10, right: 12,
        background: 'rgba(255,255,255,0.2)', border: 'none',
        color: '#fff', fontSize: 16, width: 28, height: 28,
        borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>

      {expanded && (
        <div style={{ padding: '14px 18px 12px' }}>
          <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>
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
      )}
    </div>
  )
}

// ── 観光スポットポップアップ ─────────────────────────────────────────────
function TouristPopup({ spot, onClose }) {
  return (
    <div style={{
      position: 'absolute', bottom: 60, left: 12, right: 12,
      maxWidth: 380, margin: '0 auto',
      background: 'white', borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 10, overflow: 'hidden',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        padding: '14px 44px 14px 18px',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
          Tourist Spot
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
          {spot.name}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
          {spot.nameEn}
        </div>
      </div>
      <button onClick={onClose} style={{
        position: 'absolute', top: 10, right: 12,
        background: 'rgba(255,255,255,0.2)', border: 'none',
        color: '#fff', fontSize: 16, width: 28, height: 28,
        borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>
    </div>
  )
}

// ── GPS フック ────────────────────────────────────────────────────────────
function useLiveGPS(enabled) {
  const [pos, setPos]       = useState(null)
  const [status, setStatus] = useState('idle')
  useEffect(() => {
    if (!enabled) { setStatus('idle'); setPos(null); return }
    if (!navigator.geolocation) { setPos(TOKYO_STATION); setStatus('error'); return }
    setStatus('pending')
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => { setPos({ lat: coords.latitude, lng: coords.longitude }); setStatus('ok') },
      () => { setPos(TOKYO_STATION); setStatus('error') },
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])
  return { pos, status }
}

function GpsLocateButton({ status, onLocate }) {
  const cfg = {
    idle:    null,
    pending: { icon: '⌛', label: 'Locating…',    color: '#9ca3af', bg: '#f9fafb', disabled: true },
    ok:      { icon: '📍', label: 'My Location',  color: '#1d6ef5', bg: '#eff6ff', disabled: false },
    error:   { icon: '⚠️', label: 'Tokyo Sta.',   color: '#dc2626', bg: '#fef2f2', disabled: false },
  }
  const c = cfg[status]
  if (!c) return null
  return (
    <button
      onClick={c.disabled ? undefined : onLocate}
      style={{
        position: 'absolute', bottom: 24, right: 16, zIndex: 10,
        background: c.bg, border: `2px solid ${c.color}`,
        color: c.color, borderRadius: 16,
        padding: '6px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
        cursor: c.disabled ? 'default' : 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        fontSize: 13, fontWeight: 700, opacity: c.disabled ? 0.6 : 1,
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 16 }}>{c.icon}</span>
      <span>{c.label}</span>
    </button>
  )
}

// ── App ───────────────────────────────────────────────────────────────────
function App() {
  const [spots, setSpots]               = useState([])
  const [touristSpots, setTouristSpots] = useState([])
  const [selected, setSelected]         = useState(null)
  const [selectedTourist, setSelectedTourist] = useState(null)

  const [demoMode, setDemoMode]         = useState(true)
  const [playing, setPlaying]           = useState(false)
  const [startPos, setStartPos]         = useState(null)   // デモ中心点
  const [startPosMode, setStartPosMode] = useState(false)  // 位置指定待ち
  const [demoPos, setDemoPos]           = useState(null)   // 擬似マーカー位置

  const triggeredRef = useRef(new Set())
  const [locateTick, setLocateTick] = useState(0)
  const { pos: livePos, status: gpsStatus } = useLiveGPS(!demoMode)

  const [searchQuery, setSearchQuery]         = useState('')
  const [searchAnime, setSearchAnime]         = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [animateSearch, setAnimateSearch]     = useState(false)

  useEffect(() => {
    if (!searchAnime) { setAnimateSearch(false); return }
    setAnimateSearch(true)
    const t = setTimeout(() => setAnimateSearch(false), 2500)
    return () => clearTimeout(t)
  }, [searchAnime])

  const animeTitles = useMemo(() =>
    [...new Set(spots.map(s => s.anime_title_en))].sort(), [spots])

  const suggestions = useMemo(() =>
    searchQuery.length > 0
      ? animeTitles.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      : [],
    [searchQuery, animeTitles])


  // データ読み込み
  useEffect(() => {
    fetch('/tourist_spots.json').then(r => r.json()).then(setTouristSpots).catch(() => {})
  }, [])

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
        fetch(`${BACKEND_URL}/prefetch-intros`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.map(s => ({
            id: s.id, spot_name_en: s.spot_name_en,
            anime_title_en: s.anime_title_en,
            scene_description: s.scene_description, area: s.area,
          }))),
        })
          .then(r => r.json())
          .then(res => { if (res.intros) Object.assign(introCache, res.intros) })
          .catch(() => {})
      })
  }, [])

  // activePos: デモ中は擬似マーカー、ライブ中はGPS
  const activePos = demoMode ? demoPos : livePos

  // 近接判定（デモモードのみ自動開閉。LIVEモードはユーザー操作のみ）
  useEffect(() => {
    if (!activePos || !spots.length || !demoMode) return

    setSelected(prev => {
      if (prev && haversine(activePos, { lat: prev.lat, lng: prev.lng }) > PROXIMITY_METERS) {
        triggeredRef.current.delete(prev.id)
        return null
      }
      return prev
    })

    for (const spot of spots) {
      if (
        haversine(activePos, { lat: spot.lat, lng: spot.lng }) < PROXIMITY_METERS &&
        !triggeredRef.current.has(spot.id)
      ) {
        triggeredRef.current.add(spot.id)
        setSelected(spot)
        break
      }
    }
  }, [activePos, spots, demoMode])

  const handleReset = () => {
    setPlaying(false)
    setDemoPos(null)
    setStartPos(null)
    setStartPosMode(false)
    triggeredRef.current.clear()
    setSelected(null)
  }

  const handleSpotSelect = useCallback((spot) => {
    setSelected(spot)
  }, [])

  const handleMapClick = (e) => {
    const ll = e.detail?.latLng
    if (startPosMode) {
      if (!ll) return
      const lat = typeof ll.lat === 'function' ? ll.lat() : ll.lat
      const lng = typeof ll.lng === 'function' ? ll.lng() : ll.lng
      setStartPos({ lat, lng })
      setStartPosMode(false)
      setDemoPos({ lat, lng })
      triggeredRef.current.clear()
      setSelected(null)
    } else {
      // 地図タップで観光スポットポップアップだけ閉じる
      // 聖地カードは ✕ ボタンでのみ閉じる（パン後の遅延クリックでの誤閉じ防止）
      setSelectedTourist(null)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={TOKYO}
          defaultZoom={6}
          minZoom={5}
          gestureHandling="greedy"
          disableDefaultUI={true}
          zoomControl={true}
          restriction={{
            latLngBounds: { north: 46.5, south: 23.0, west: 121.0, east: 155.0 },
            strictBounds: false,
          }}
          styles={MAP_STYLES}
          onClick={handleMapClick}
        >
          {demoMode && startPos && (
            <DemoEngine
              spots={spots}
              startPos={startPos}
              playing={playing}
              onPosChange={setDemoPos}
              selectedId={selected?.id ?? null}
            />
          )}
          {!demoMode && (
            <LiveCamera livePos={livePos} selected={selected} locateTick={locateTick} />
          )}

          {/* 観光スポットピン */}
          {touristSpots.map(t => (
            <Marker
              key={t.id}
              position={{ lat: t.lat, lng: t.lng }}
              title={t.name}
              icon={{ path: 0, fillColor: '#f97316', fillOpacity: 0.9,
                strokeColor: '#fff', strokeWeight: 2, scale: 5 }}
              onClick={() => { setSelectedTourist(t); setSelected(null) }}
            />
          ))}

          {/* 聖地ピン（クラスタリング、検索ヒットは除外） */}
          <ClusteredSpotMarkers
            spots={spots}
            selectedId={selected?.id}
            onSelect={demoMode ? null : handleSpotSelect}
            highlightAnime={searchAnime}
          />

          {/* 検索ヒットピン（クラスタリングなし・赤ピン） */}
          {searchAnime && spots
            .filter(s => s.anime_title_en === searchAnime && s.id !== selected?.id)
            .map(s => (
              <Marker
                key={s.id}
                position={{ lat: s.lat, lng: s.lng }}
                title={s.spot_name_en}
                icon={RED_PIN_ICON}
                zIndex={50}
                animation={animateSearch ? google.maps.Animation.BOUNCE : null}
                onClick={() => handleSpotSelect(s)}
              />
            ))
          }
          {selected && (
            <SelectedSpotMarker spot={selected} onClick={() => {}} />
          )}

          {/* 現在地マーカー */}
          {activePos && (
            <Marker
              position={activePos}
              title="You are here"
              zIndex={999}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: demoMode ? THEME : '#1d6ef5',
                fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3, scale: 10,
              }}
            />
          )}
        </Map>
      </APIProvider>

      {/* 検索バー（既存ヘッダー右側に重ねる） */}
      <div style={{
        position: 'fixed', top: 0, left: 145, right: 8, height: 50,
        display: 'flex', alignItems: 'center',
        zIndex: 2000,
      }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <span style={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            placeholder="Search here"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchAnime(null); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={e => { if (e.key === 'Escape') { setShowSuggestions(false); e.target.blur() } }}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: 'none', borderRadius: 14, padding: '6px 26px 6px 26px',
              fontSize: 16,
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onMouseDown={e => {
                e.preventDefault()
                setSearchQuery(''); setSearchAnime(null); setShowSuggestions(false)
              }}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
                fontSize: 13, cursor: 'pointer', padding: 0, lineHeight: 1,
              }}
            >✕</button>
          )}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, width: 220, marginTop: 4,
            background: 'white', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', overflow: 'hidden', zIndex: 2001,
          }}>
            {suggestions.slice(0, 6).map(title => (
              <div
                key={title}
                onMouseDown={e => {
                  e.preventDefault()
                  setSearchQuery(title); setSearchAnime(title); setShowSuggestions(false)
                }}
                onTouchEnd={() => {
                  setSearchQuery(title); setSearchAnime(title); setShowSuggestions(false)
                }}
                style={{
                  padding: '10px 12px', cursor: 'pointer', fontSize: 14,
                  color: '#333', borderBottom: '1px solid #f3f4f6',
                }}
              >
                {title}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* コントロールバー */}
      <div style={{
        position: 'absolute', bottom: 8, left: 12,
        background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '5px 8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
        display: 'flex', gap: 4, alignItems: 'center',
        zIndex: 10, userSelect: 'none',
        maxWidth: 'calc(100vw - 24px)', flexWrap: 'wrap',
      }}>
        {/* DEMO / LIVE 切替 */}
        <button
          onClick={() => { setDemoMode(m => !m); handleReset() }}
          style={{
            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
            border: 'none', cursor: 'pointer',
            background: demoMode ? THEME : '#e0e0e0',
            color: demoMode ? '#fff' : '#555',
          }}
        >
          {demoMode ? 'DEMO' : 'LIVE'}
        </button>

        {demoMode && (<>
          {/* 開始位置指定 */}
          <button
            onClick={() => setStartPosMode(m => !m)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: startPosMode ? '#f59e0b' : startPos ? '#ede9ff' : THEME,
              color: startPosMode ? '#fff' : startPos ? THEME : '#fff',
            }}
          >
            {startPosMode ? '📍 Tap…' : startPos ? '📍 Change' : '📍 Set Start'}
          </button>

          {/* 再生 / 一時停止 */}
          <button
            onClick={() => setPlaying(p => !p)}
            disabled={!startPos}
            style={{
              fontSize: 17, background: 'none', border: 'none', lineHeight: 1,
              cursor: startPos ? 'pointer' : 'default', opacity: startPos ? 1 : 0.35,
            }}
          >
            {playing ? '⏸' : '▶️'}
          </button>

        </>)}
      </div>

      {/* 初回ガイド：Set Start を促す吹き出し */}
      {demoMode && !startPos && !startPosMode && (
        <div style={{
          position: 'absolute', bottom: 44, left: 12,
          background: THEME, borderRadius: 12, padding: '7px 12px',
          color: '#fff', fontWeight: 700, fontSize: 13, zIndex: 10, whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          👆 Tap "📍 Set Start" to begin!
          {/* 下向き三角（吹き出しの矢印） */}
          <div style={{
            position: 'absolute', bottom: -7, left: 20,
            width: 0, height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: `7px solid ${THEME}`,
          }} />
        </div>
      )}

      {/* 位置指定中のオーバーレイヒント */}
      {startPosMode && (
        <div style={{
          position: 'absolute', bottom: 56, left: 12,
          background: 'rgba(245,158,11,0.95)', borderRadius: 16, padding: '8px 18px',
          color: '#fff', fontWeight: 700, fontSize: 13, zIndex: 10, whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          📍 Tap map to set start
        </div>
      )}

      {!demoMode && (
        <GpsLocateButton
          status={gpsStatus}
          onLocate={() => setLocateTick(t => t + 1)}
        />
      )}
      {selected && (
        <Card spot={selected} currentPos={activePos} onClose={() => setSelected(null)} />
      )}
      {!selected && selectedTourist && (
        <TouristPopup spot={selectedTourist} onClose={() => setSelectedTourist(null)} />
      )}
    </div>
  )
}

export default App
