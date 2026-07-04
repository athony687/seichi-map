import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { APIProvider, Map, Marker, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { MarkerClusterer } from '@googlemaps/markerclusterer'

// ============================================================
// 汎用紹介文（AI生成失敗時・intro_short_en 未記入時のフォールバック）
// ここを編集してください ↓
const GENERIC_INTRO = `Welcome to this anime pilgrimage spot! This location appeared in a beloved anime series and draws fans from around the world. Come and experience the scenery that inspired the story.`
// ============================================================

const TOKYO = { lat: 35.6762, lng: 139.6503 }
const TOKYO_STATION = { lat: 35.6812, lng: 139.7671 }
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const PROXIMITY_METERS = 500
const THEME = '#7c3aed'
const THEME_DARK = '#4c1d95'
const DEMO_STEP = 0.001   // degrees per tick (≈110m)
const DEMO_TICK_MS = 600  // marker position update interval
const ARRIVE_DEG = 0.001  // ≈110m, spot "arrived"
const LOCATION_CONSENTED_KEY = 'seichi_location_consented'

const MAP_STYLES_LIGHT = [
  { featureType: 'landscape',          elementType: 'geometry', stylers: [{ color: '#fefdf5' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#fdfbec' }] },
  { featureType: 'water', elementType: 'geometry',         stylers: [{ color: '#ade8f4' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a7ab5' }] },
  { featureType: 'road.highway',  elementType: 'geometry',       stylers: [{ color: '#fde68a' }] },
  { featureType: 'road.highway',  elementType: 'geometry.stroke', stylers: [{ color: '#fbbf24' }] },
  { featureType: 'road.arterial', elementType: 'geometry',       stylers: [{ color: '#fef9e7' }] },
  { featureType: 'road.local',    elementType: 'geometry',       stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi.park', elementType: 'geometry',         stylers: [{ color: '#d4f5a0' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3a7d1e' }] },
  { featureType: 'poi',      elementType: 'labels.icon',      stylers: [{ saturation: 20 }] },
  { featureType: 'transit.line',    elementType: 'geometry', stylers: [{ color: '#fde68a' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#fefce8' }] },
]

const MAP_STYLES_DARK = [
  { elementType: 'geometry',           stylers: [{ color: '#1e2140' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8896b3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1e2140' }] },
  { featureType: 'landscape',          elementType: 'geometry', stylers: [{ color: '#23284a' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1e2242' }] },
  { featureType: 'water', elementType: 'geometry',         stylers: [{ color: '#0d1333' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d5a8a' }] },
  { featureType: 'road',         elementType: 'geometry',        stylers: [{ color: '#2c3260' }] },
  { featureType: 'road',         elementType: 'geometry.stroke',  stylers: [{ color: '#1a1e3c' }] },
  { featureType: 'road',         elementType: 'labels.text.fill', stylers: [{ color: '#6b7aa1' }] },
  { featureType: 'road.highway', elementType: 'geometry',        stylers: [{ color: '#4a3580' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke',  stylers: [{ color: '#2e1f5e' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'poi.park', elementType: 'geometry',         stylers: [{ color: '#1a2e28' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3d6b56' }] },
  { featureType: 'poi', elementType: 'labels.icon',      stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#4a5580' }] },
  { featureType: 'transit.line',    elementType: 'geometry',         stylers: [{ color: '#3a2d6e' }] },
  { featureType: 'transit.station', elementType: 'geometry',         stylers: [{ color: '#2a2550' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#7c6ab8' }] },
  { featureType: 'administrative',  elementType: 'geometry.stroke',  stylers: [{ color: '#334070' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#5a6a99' }] },
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

const FAVORITE_SPOT_ICON = {
  path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  fillColor: '#ff0099',
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 2,
  scale: 1.3,
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

function getWeatherMessage(tags = [], weather) {
  const t = new Set(tags)
  if (t.has('sunset') && weather === 'evening') return "🌇 A beautiful time for the sunset view."
  if (t.has('indoor')) {
    if (weather === 'rainy')   return "☔ Sheltered spot — comfortable even in the rain."
    if (weather === 'sunny')   return "☀️ Great day — pop in and enjoy."
    if (weather === 'cloudy')  return "☁️ Cosy indoors — a solid pick for today."
    if (weather === 'evening') return "🌆 Open in the evening — good timing to visit."
  }
  if (weather === 'rainy')   return "☔ Watch your step — this spot is outdoors."
  if (weather === 'sunny')   return "☀️ Perfect weather for a stroll here."
  if (weather === 'cloudy')  return "☁️ Mild weather — good for a relaxed visit."
  if (weather === 'evening') return "🌇 Lovely time for an evening walk here."
  return null
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
function ClusteredSpotMarkers({ spots, selectedId, onSelect, highlightAnime, favorites }) {
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
      .filter(s => s.id !== selectedId && !(highlightAnime && s.anime_title_en === highlightAnime) && !favorites?.has(s.id))
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
  }, [spots, selectedId, onSelect, highlightAnime, favorites])

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

// ── 検索カメラ（検索ヒット時に該当ピンへズーム）────────────────────────
function SearchCamera({ spots, searchAnime }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !searchAnime) return
    const matches = spots.filter(s => s.anime_title_en === searchAnime)
    if (!matches.length) return
    if (matches.length === 1) {
      map.panTo({ lat: matches[0].lat, lng: matches[0].lng })
      map.setZoom(15)
    } else {
      const bounds = new google.maps.LatLngBounds()
      matches.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }))
      map.fitBounds(bounds, 80)
    }
  }, [searchAnime, map])
  return null
}

// ── AIキャッシュ ─────────────────────────────────────────────────────────
const introCache = {}

// ── 近接ラベル（ピン真上に浮かぶチップ）────────────────────────────────
const isPlaceholder = t => !t || t.startsWith('PLACEHOLDER')

function ProximityLabel({ spot, onTap }) {
  return (
    <AdvancedMarker
      position={{ lat: spot.lat, lng: spot.lng }}
      onClick={onTap}
      zIndex={20}
    >
      <div style={{
        transform: 'translateY(-52px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'pointer', pointerEvents: 'auto',
        animation: 'slideUp 0.28s cubic-bezier(0.34,1.4,0.64,1)',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: `1.5px solid ${THEME}`,
          borderRadius: 20,
          padding: '5px 12px',
          boxShadow: '0 3px 12px rgba(124,58,237,0.25)',
          maxWidth: 180,
        }}>
          <div style={{ fontSize: 9, color: THEME, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {spot.anime_title_en}
          </div>
          <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 700,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {spot.spot_name_en}
          </div>
        </div>
        {/* 下向き三角 */}
        <div style={{
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `6px solid ${THEME}`,
          marginTop: -1,
        }} />
      </div>
    </AdvancedMarker>
  )
}

// ── スポットカード（距離表示付き）────────────────────────────────────────
function Card({ spot, currentPos, onClose, userPrefs, isFavorite, onToggleFavorite, weather, defaultExpanded }) {
  const staticIntro = spot.generic_intro_en || (!isPlaceholder(spot.intro_short_en) ? spot.intro_short_en : GENERIC_INTRO)
  const [intro, setIntro]   = useState(introCache[spot.id] || staticIntro)
  const [loading, setLoading] = useState(!introCache[spot.id])
  const [aiOk, setAiOk]     = useState(!!introCache[spot.id])
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)

  const distText = currentPos
    ? formatDistance(haversine(currentPos, { lat: spot.lat, lng: spot.lng }))
    : null

  useEffect(() => {
    const hasPersonalization = !!(userPrefs?.nickname || userPrefs?.familiarity || userPrefs?.mood || userPrefs?.travelStyle)
    if (!hasPersonalization && introCache[spot.id]) {
      setIntro(introCache[spot.id]); setLoading(false); setAiOk(true); return
    }
    setIntro(''); setLoading(true); setAiOk(false)

    const controller = new AbortController()
    let fullText = ''

    ;(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/generate-intro-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: spot.id, spot_name_en: spot.spot_name_en,
            anime_title_en: spot.anime_title_en,
            scene_description: spot.scene_description, area: spot.area,
            prefs: userPrefs || {},
          }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error()
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') { setAiOk(true); if (!hasPersonalization) introCache[spot.id] = fullText; return }
            try {
              const { text, error } = JSON.parse(data)
              if (error) throw new Error(error)
              if (text) { fullText += text; setIntro(fullText); setLoading(false) }
            } catch { /* malformed chunk, skip */ }
          }
        }
      } catch (err) {
        if (err?.name === 'AbortError') return
        setIntro(staticIntro); setAiOk(false)
      } finally {
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [spot.id])

  return (
    <div style={{
      position: 'absolute', bottom: 84, left: 12, right: 12,
      maxWidth: 380, margin: '0 auto',
      background: 'white', borderRadius: 20,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
      zIndex: 10, overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          background: `linear-gradient(135deg, ${THEME} 0%, ${THEME_DARK} 100%)`,
          padding: '14px 88px 14px 18px', cursor: 'pointer',
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
        {spot.hours && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            🕐 {spot.hours}
          </div>
        )}
        {(() => { const msg = getWeatherMessage(spot.tags, weather); return msg ? (
          <div style={{
            marginTop: 6, padding: '4px 10px', borderRadius: 10,
            background: 'rgba(255,255,255,0.18)',
            fontSize: 12, color: '#fff', display: 'inline-block',
          }}>{msg}</div>
        ) : null })()}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginTop: 8, padding: '4px 10px', borderRadius: 20,
          background: 'rgba(255,255,255,0.25)',
          fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.03em',
        }}>
          {expanded ? '▲ close' : '▼ read more'}
        </div>
      </div>

      {/* ❤️ と ✕ を flex で横並び（重なり防止） */}
      <div style={{
        position: 'absolute', top: 10, right: 12,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(spot.id) }}
          style={{
            background: 'rgba(255,255,255,0.2)', border: 'none',
            fontSize: 15, width: 28, height: 28,
            borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{isFavorite ? '❤️' : '🤍'}</button>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none',
          color: '#fff', fontSize: 16, width: 28, height: 28,
          borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      {expanded && (
        <div style={{ padding: '0 0 12px' }}>
          {/* 写真エリア（photo_url が設定されていれば表示） */}
          {spot.photo_url && (
            <img
              src={spot.photo_url}
              alt={spot.spot_name_en}
              style={{
                width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block',
              }}
            />
          )}
          <div style={{ padding: '12px 18px 0' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 20,
                  background: THEME, color: '#fff',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                }}
              >🗺️ Get directions</a>
              {spot.official_url && (
                <a
                  href={spot.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', borderRadius: 20,
                    background: '#f3f4f6', color: '#374151',
                    fontSize: 12, fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  {spot.official_url.includes('youtube.com') || spot.official_url.includes('youtu.be')
                    ? '▶ Watch trailer'
                    : '🌐 Official site'}
                </a>
              )}
              <div style={{ fontSize: 11, color: '#bbb', marginLeft: 'auto' }}>
                {!loading && (aiOk ? '✨ AI generated' : '📄 description')}
              </div>
            </div>
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
      position: 'absolute', bottom: 84, left: 12, right: 12,
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

// ── 天気自動取得 ──────────────────────────────────────────────────────────
const _wxCache = {}
const WX_GRID  = 0.5           // 0.5° グリッド単位でキャッシュ
const WX_TTL   = 20 * 60 * 1000  // 20分

function _wmoMap(code, isDay) {
  if (!isDay)             return 'evening'
  if (code <= 1)          return 'sunny'
  if (code <= 3 || code === 45 || code === 48) return 'cloudy'
  return 'rainy'
}

function useAutoWeather(pos, skip) {
  const [auto, setAuto] = useState(null)
  const fetching = useRef(null)
  const gridLat = pos ? Math.round(pos.lat / WX_GRID) * WX_GRID : null
  const gridLng = pos ? Math.round(pos.lng / WX_GRID) * WX_GRID : null
  useEffect(() => {
    if (skip || gridLat === null) return
    const key = `${gridLat},${gridLng}`
    const hit = _wxCache[key]
    if (hit && Date.now() - hit.ts < WX_TTL) { setAuto(hit.w); return }
    if (fetching.current === key) return
    fetching.current = key
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${gridLat}&longitude=${gridLng}&current=weathercode,is_day&timezone=auto`)
      .then(r => r.json())
      .then(d => {
        const w = _wmoMap(d.current.weathercode, d.current.is_day === 1)
        _wxCache[key] = { w, ts: Date.now() }
        setAuto(w)
        fetching.current = null
      })
      .catch(() => { fetching.current = null })
  }, [gridLat, gridLng, skip])
  return auto
}

// ── デバイス方向（コンパス）フック ───────────────────────────────────────
function useDeviceHeading() {
  const [heading, setHeading]               = useState(null)
  const [permissionNeeded, setPermissionNeeded] = useState(false)
  const handlerRef   = useRef(null)
  const rawRef       = useRef(null)   // センサー生値
  const smoothRef    = useRef(null)   // 補間済み値
  const displayedRef = useRef(null)   // 最後に setState した値
  const rafRef       = useRef(null)

  // RAF ループで平滑補間（震え防止）
  useEffect(() => {
    const tick = () => {
      if (rawRef.current != null) {
        if (smoothRef.current == null) {
          smoothRef.current = rawRef.current
        } else {
          // 角度の折り返し（350°→10° を正しく補間）
          const diff = ((rawRef.current - smoothRef.current + 540) % 360) - 180
          smoothRef.current = (smoothRef.current + diff * 0.12 + 360) % 360
        }
        const rounded = Math.round(smoothRef.current)
        if (rounded !== displayedRef.current) {
          displayedRef.current = rounded
          setHeading(rounded)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // センサーリスナー登録
  useEffect(() => {
    if (typeof DeviceOrientationEvent === 'undefined') return
    const handler = (e) => {
      if (e.webkitCompassHeading != null) {
        rawRef.current = e.webkitCompassHeading        // iOS: 真北からの時計回り度数
      } else if (e.alpha != null) {
        rawRef.current = (360 - e.alpha) % 360         // Android
      }
    }
    handlerRef.current = handler
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      setPermissionNeeded(true)                        // iOS 13+: ユーザー操作が必要
    } else {
      window.addEventListener('deviceorientation', handler, true)
    }
    return () => window.removeEventListener('deviceorientation', handler, true)
  }, [])

  const requestPermission = useCallback(async () => {
    if (!handlerRef.current) return
    try {
      const result = await DeviceOrientationEvent.requestPermission()
      if (result === 'granted') {
        window.addEventListener('deviceorientation', handlerRef.current, true)
        setPermissionNeeded(false)
      }
    } catch {}
  }, [])

  return { heading, permissionNeeded, requestPermission }
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

// ── 設定画面 ──────────────────────────────────────────────────────────────
function SettingsScreen({ userPrefs, weather, weatherIsAuto, onWeatherChange, mapTheme, onMapThemeChange, onSave, onReset, onClose }) {
  const p = userPrefs || {}
  const [nickname,     setNickname]    = useState(p.nickname    || '')
  const [familiarity,  setFamiliarity] = useState(p.familiarity || '')
  const [mood,         setMood]        = useState(p.mood        || '')
  const [travelStyle,  setTravelStyle] = useState(p.travelStyle || '')
  const [confirmReset, setConfirmReset] = useState(false)
  const [openSection,  setOpenSection] = useState(null)

  const toggle = key => setOpenSection(o => o === key ? null : key)

  const wxEmoji = { sunny:'☀️', cloudy:'☁️', rainy:'🌧️', evening:'🌇' }

  const chip = (current, value, emoji, label, setter) => {
    const active = current === value
    return (
      <button key={value} onClick={() => setter(active ? '' : value)} style={{
        padding: '5px 10px', borderRadius: 20, cursor: 'pointer', marginRight: 6, marginBottom: 6,
        border: `1.5px solid ${active ? THEME : '#e5e7eb'}`,
        background: active ? '#ede9ff' : '#f3f4f6',
        color: active ? THEME : '#555',
        fontSize: 12, fontWeight: active ? 700 : 500,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        {emoji} {label}
      </button>
    )
  }

  // アコーディオン行
  const row = (key, label, summary, children, isLast = false) => {
    const open = openSection === key
    return (
      <div key={key}>
        <button
          onClick={() => toggle(key)}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{label}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {summary && <span style={{ fontSize: 12, color: '#aaa' }}>{summary}</span>}
            <span style={{ fontSize: 11, color: '#c0c0c0', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
          </span>
        </button>
        {open && (
          <div style={{ padding: '4px 16px 14px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            {children}
          </div>
        )}
        {!isLast && <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginLeft: 16 }} />}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: '#f2f2f7', overflowY: 'auto' }}>
      {/* ヘッダー */}
      <div style={{
        position: 'sticky', top: 0,
        background: 'rgba(242,242,247,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)', zIndex: 1,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>Settings</div>
        <button onClick={onClose} style={{
          background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: '50%',
          width: 30, height: 30, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      <div style={{ padding: '20px 14px 32px' }}>

        {/* パーソナライズ設定グループ */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Personalisation</div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {row('nickname', 'Nickname', nickname || 'Not set',
            <>
              <input
                type="text" placeholder="Your nickname…" value={nickname}
                onChange={e => setNickname(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', marginTop: 8,
                  border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fafafa',
                  padding: '9px 11px', fontSize: 14, outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = THEME}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
              <div style={{ fontSize: 10, color: '#bbb', marginTop: 5 }}>Used to personalise your spot introductions.</div>
            </>
          )}
          {row('familiarity', 'Anime familiarity', familiarity || 'Not set',
            <div style={{ paddingTop: 8 }}>
              {chip(familiarity, 'Newcomer',   '🌱', 'Newcomer',   setFamiliarity)}
              {chip(familiarity, 'Casual fan', '😊', 'Casual fan', setFamiliarity)}
              {chip(familiarity, 'Big fan',    '⭐', 'Big fan',    setFamiliarity)}
            </div>
          )}
          {row('mood', 'Favorite mood', mood || 'Not set',
            <div style={{ paddingTop: 8 }}>
              {chip(mood, 'Emotional',    '😢', 'Emotional',    setMood)}
              {chip(mood, 'Exciting',     '⚡', 'Exciting',     setMood)}
              {chip(mood, 'Heartwarming', '🌸', 'Heartwarming', setMood)}
              {chip(mood, 'Romance',      '💕', 'Romance',      setMood)}
            </div>
          )}
          {row('travelStyle', 'Travel style', travelStyle || 'Not set',
            <div style={{ paddingTop: 8 }}>
              {chip(travelStyle, 'Taking photos',       '📸', 'Taking photos',       setTravelStyle)}
              {chip(travelStyle, 'Relaxed walking',     '🚶', 'Relaxed walking',     setTravelStyle)}
              {chip(travelStyle, 'Visiting many spots', '🗺️', 'Visiting many spots', setTravelStyle)}
            </div>
          , true)}
        </div>

        {/* 表示グループ */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Display</div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {row('mapTheme', 'Map theme', mapTheme === 'dark' ? '🌙 Dark' : '☀️ Light',
            <div style={{ paddingTop: 8 }}>
              {[['light', '☀️', 'Light'], ['dark', '🌙', 'Dark']].map(([key, emoji, label]) => {
                const active = mapTheme === key
                return (
                  <button key={key} onClick={() => onMapThemeChange(key)} style={{
                    padding: '5px 10px', borderRadius: 20, cursor: 'pointer', marginRight: 6, marginBottom: 6,
                    border: `1.5px solid ${active ? THEME : '#e5e7eb'}`,
                    background: active ? '#ede9ff' : '#f3f4f6',
                    color: active ? THEME : '#555',
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>{emoji} {label}</button>
                )
              })}
            </div>
          , true)}
        </div>

        {/* 天気グループ */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Weather</div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {row('weather', 'Current weather',
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {wxEmoji[weather]}
              {weatherIsAuto
                ? <span style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 5px' }}>AUTO</span>
                : <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4, padding: '1px 5px' }}>MANUAL</span>
              }
            </span>,
            <div style={{ paddingTop: 8 }}>
              {[['sunny','☀️','Sunny'],['cloudy','☁️','Cloudy'],['rainy','🌧️','Rainy'],['evening','🌇','Evening']].map(([key, emoji, label]) => {
                const active = weather === key
                return (
                  <button key={key} onClick={() => onWeatherChange(!weatherIsAuto && active ? null : key)} style={{
                    padding: '5px 10px', borderRadius: 20, cursor: 'pointer', marginRight: 6, marginBottom: 6,
                    border: `1.5px solid ${active ? (weatherIsAuto ? '#22c55e' : THEME) : '#e5e7eb'}`,
                    background: active ? (weatherIsAuto ? '#f0fdf4' : '#ede9ff') : '#f3f4f6',
                    color: active ? (weatherIsAuto ? '#16a34a' : THEME) : '#555',
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>{emoji} {label}</button>
                )
              })}
              {!weatherIsAuto && (
                <button onClick={() => onWeatherChange(null)} style={{
                  padding: '5px 10px', borderRadius: 20, cursor: 'pointer', marginRight: 6, marginBottom: 6,
                  border: '1.5px solid #bbf7d0', background: '#f0fdf4',
                  color: '#16a34a', fontSize: 12, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>🌐 Auto</button>
              )}
            </div>
          , true)}
        </div>

        {/* 保存ボタン */}
        <button
          onClick={() => onSave({ nickname: nickname.trim(), familiarity, mood, travelStyle })}
          style={{
            width: '100%', padding: '12px', borderRadius: 12,
            background: THEME, color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 20,
          }}
        >Save changes</button>

        {/* About グループ */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>About</div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {row('about', 'About this app', null,
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7, paddingTop: 8 }}>
              <p style={{ margin: '0 0 8px' }}>
                <strong>Seichi Map</strong> is an anime pilgrimage guide for visitors to Japan.
                Tap any pin to discover which anime scene was filmed there, and get a personalised introduction powered by AI.
              </p>
              <p style={{ margin: '0 0 8px' }}>
                Spot introductions are generated by <strong>Claude</strong> (Anthropic) and are for informational purposes only.
              </p>
              <p style={{ margin: 0, color: '#aaa' }}>
                Anime titles and related trademarks belong to their respective rights holders.
                All location information is used solely to help fans enjoy their visit to Japan.
                We do not reproduce any copyrighted images or video content.
              </p>
            </div>
          , true)}
        </div>

        {/* リセット */}
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} style={{
            width: '100%', padding: '11px', borderRadius: 12,
            background: 'none', border: '1.5px solid #fca5a5',
            color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>🗑 Reset all preferences</button>
        ) : (
          <div style={{ background: '#fef2f2', borderRadius: 12, padding: '14px' }}>
            <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600, marginBottom: 10 }}>
              This will clear all saved preferences and show the welcome survey again.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onReset} style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: '#ef4444', color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Yes, reset</button>
              <button onClick={() => setConfirmReset(false)} style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: '#fff', border: '1.5px solid #e5e7eb',
                color: '#555', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── アンケート（localStorage） ────────────────────────────────────────────
const SURVEY_KEY = 'seichi_prefs'
const loadPrefs  = () => { try { const r = localStorage.getItem(SURVEY_KEY); return r ? JSON.parse(r) : null } catch { return null } }
const savePrefs  = p  => localStorage.setItem(SURVEY_KEY, JSON.stringify(p))

const MAP_THEME_KEY = 'seichi_map_theme'
const loadMapTheme = () => { try { return localStorage.getItem(MAP_THEME_KEY) || 'light' } catch { return 'light' } }

const FAVORITES_KEY = 'seichi_favorites'
const loadFavorites = () => { try { const r = localStorage.getItem(FAVORITES_KEY); return r ? new Set(JSON.parse(r)) : new Set() } catch { return new Set() } }
const saveFavorites = f => localStorage.setItem(FAVORITES_KEY, JSON.stringify([...f]))

function OnboardingSurvey({ onComplete }) {
  const [step, setStep]           = useState(0)
  const [nickname, setNickname]   = useState('')
  const [familiarity, setFamiliarity] = useState('')
  const [mood, setMood]           = useState('')

  const finish = travelStyle => {
    const prefs = { nickname: nickname.trim(), familiarity, mood, travelStyle }
    savePrefs(prefs)
    onComplete(prefs)
  }

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 5000,
    background: 'rgba(0,0,0,0.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  }
  const card = {
    background: '#fff', borderRadius: 20, padding: '28px 24px',
    maxWidth: 340, width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  }
  const progress = n => (
    <div style={{ fontSize: 11, color: '#bbb', fontWeight: 700, marginBottom: 10 }}>{n} / 4</div>
  )
  const title = t => (
    <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.45, marginBottom: 18 }}>{t}</div>
  )
  const optBtn = (onClick, emoji, label, desc) => (
    <button key={label} onClick={onClick} style={{
      width: '100%', padding: '12px 14px', borderRadius: 12,
      border: '2px solid #e5e7eb', background: '#fff',
      cursor: 'pointer', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = THEME}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#999' }}>{desc}</div>
      </div>
    </button>
  )
  const nextBtn = (label, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '11px', borderRadius: 12,
      background: disabled ? '#e5e7eb' : THEME,
      color: disabled ? '#aaa' : '#fff',
      border: 'none', fontSize: 14, fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer', marginBottom: 8,
    }}>{label}</button>
  )
  const skipBtn = onClick => (
    <button onClick={onClick} style={{
      width: '100%', padding: '9px', borderRadius: 12,
      background: 'none', border: '2px solid #e5e7eb',
      color: '#999', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    }}>Skip</button>
  )

  if (step === 0) return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🗾</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a', marginBottom: 10 }}>Welcome to Seichi Map!</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>
            We would love to personalize your<br />experience. Could you spare a moment<br />to answer a few quick questions?
          </div>
        </div>
        {nextBtn("Sure, let's go! 🎌", () => setStep(1), false)}
        {skipBtn(() => finish(''))}
      </div>
    </div>
  )

  if (step === 1) return (
    <div style={overlay}>
      <div style={card}>
        {progress(1)}
        {title("What's your nickname?")}
        <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
          We'll use it to personalize your spot descriptions.
        </div>
        <input
          type="text" placeholder="Your nickname…" value={nickname}
          onChange={e => setNickname(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '2px solid #e5e7eb', borderRadius: 10,
            padding: '10px 12px', fontSize: 16, outline: 'none', marginBottom: 12,
          }}
          onFocus={e => e.target.style.borderColor = THEME}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        {nextBtn('Next →', () => setStep(2), !nickname.trim())}
        {skipBtn(() => { setNickname(''); setStep(2) })}
      </div>
    </div>
  )

  if (step === 2) return (
    <div style={overlay}>
      <div style={card}>
        {progress(2)}
        {title('How familiar are you with anime?')}
        {optBtn(() => { setFamiliarity('Newcomer');   setStep(3) }, '🌱', 'Newcomer',    'Just getting started')}
        {optBtn(() => { setFamiliarity('Casual fan'); setStep(3) }, '😊', 'Casual fan',  'I watch some anime')}
        {optBtn(() => { setFamiliarity('Big fan');    setStep(3) }, '⭐', 'Big fan',     'I know my stuff!')}
      </div>
    </div>
  )

  if (step === 3) return (
    <div style={overlay}>
      <div style={card}>
        {progress(3)}
        {title('What kind of stories do you love?')}
        {optBtn(() => { setMood('Emotional');    setStep(4) }, '😢', 'Emotional',    'Stories that move me')}
        {optBtn(() => { setMood('Exciting');     setStep(4) }, '⚡', 'Exciting',     'Action & adventure')}
        {optBtn(() => { setMood('Heartwarming'); setStep(4) }, '🌸', 'Heartwarming', 'Cozy & uplifting')}
        {optBtn(() => { setMood('Romance');      setStep(4) }, '💕', 'Romance',      'Love & beauty')}
      </div>
    </div>
  )

  return (
    <div style={overlay}>
      <div style={card}>
        {progress(4)}
        {title("What's your travel style?")}
        {optBtn(() => finish('Taking photos'),      '📸', 'Taking photos',      'I live for the perfect shot')}
        {optBtn(() => finish('Relaxed walking'),    '🚶', 'Relaxed walking',    'Slow and scenic')}
        {optBtn(() => finish('Visiting many spots'),'🗺️', 'Visiting many spots','Covering as much as possible')}
      </div>
    </div>
  )
}

// ── アプリ概要ダッシュボード ──────────────────────────────────────────────
const DASHBOARD_FEATURES = [
  ['📍', 'Live GPS tracking with compass direction'],
  ['🎌', '35 anime pilgrimage spots across Japan'],
  ['🔔', 'Auto-alert when within 100 m of a spot'],
  ['🤖', 'AI introductions powered by Claude Haiku'],
  ['🔍', 'Search by anime title'],
  ['🌤️', 'Real-time weather visit tips'],
  ['🎮', 'Demo mode — walk any route virtually'],
  ['❤️', 'Save your favourite spots'],
]

function AppOverviewDashboard({ spots, currentPos, onExplore }) {
  const pos = currentPos || TOKYO_STATION
  const usingFallback = !currentPos

  const spotsWithDist = useMemo(() => {
    if (!spots.length) return []
    return spots
      .map(s => ({ ...s, dist: haversine(pos, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.dist - b.dist)
  }, [spots, pos.lat, pos.lng])

  const nearby = spotsWithDist.filter(s => s.dist <= 3000)
  const displaySpots = nearby.length > 0 ? nearby.slice(0, 5) : spotsWithDist.slice(0, 3)
  const hasNearby = nearby.length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#fff',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>

      {/* ── Hero ── */}
      <div style={{
        padding: '56px 24px 32px',
        background: 'linear-gradient(150deg, #faf5ff 0%, #ede9fe 100%)',
        borderBottom: '1px solid rgba(124,58,237,0.1)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 装飾円 */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 260, height: 260,
          borderRadius: '50%', background: 'rgba(124,58,237,0.08)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40, width: 160, height: 160,
          borderRadius: '50%', background: 'rgba(124,58,237,0.05)', pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(124,58,237,0.1)', borderRadius: 20,
          padding: '4px 12px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13 }}>🗾</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: THEME,
            letterSpacing: '0.08em', textTransform: 'uppercase' }}>Anime Pilgrimage · Japan</span>
        </div>

        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-0.03em',
          lineHeight: 1.05, color: '#1a1033', marginBottom: 12 }}>
          Animap<span style={{ color: THEME }}>.jp</span>
        </div>

        <p style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.7, margin: '0 0 24px',
          maxWidth: 300 }}>
          Your GPS guide to anime sacred spots across Japan — AI introductions appear
          automatically as you walk.
        </p>

        <button onClick={onExplore} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 22px', borderRadius: 50,
          background: `linear-gradient(135deg, ${THEME} 0%, ${THEME_DARK} 100%)`,
          color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
        }}>
          Explore the Map <span style={{ fontSize: 11 }}>▶</span>
        </button>
      </div>

      <div style={{ padding: '0 16px 120px' }}>

        {/* ── Features ── */}
        <div style={{ padding: '24px 0 4px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
            color: '#9ca3af', textTransform: 'uppercase', marginBottom: 14 }}>
            Main Features
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DASHBOARD_FEATURES.map(([icon, label]) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', borderRadius: 16,
                background: '#faf5ff',
                border: '1px solid rgba(124,58,237,0.1)',
              }}>
                <span style={{ fontSize: 19, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.45,
                  fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Nearby Spots ── */}
        <div style={{ paddingTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline',
            justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
              color: '#9ca3af', textTransform: 'uppercase' }}>
              {hasNearby ? 'Nearby Spots' : 'Closest Spots'}
            </div>
            {hasNearby && (
              <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>
                within 3 km
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#c4b5fd', marginBottom: 14 }}>
            {usingFallback
              ? 'Based on Tokyo Station · GPS pending'
              : hasNearby
                ? `${nearby.length} spot${nearby.length !== 1 ? 's' : ''} near you`
                : `No spots within 3 km · showing nearest ${displaySpots.length}`}
          </div>

          {spotsWithDist.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0',
              fontSize: 13, color: '#d1d5db' }}>Loading…</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {displaySpots.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 4px',
                borderBottom: i < displaySpots.length - 1
                  ? '1px solid #f3f4f6' : 'none',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                  background: i === 0 && hasNearby
                    ? `linear-gradient(135deg, ${THEME} 0%, ${THEME_DARK} 100%)`
                    : 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                  color: i === 0 && hasNearby ? '#fff' : THEME,
                }}>★</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 14, color: '#111827',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.spot_name_en}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.anime_title_en}</div>
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  color: i === 0 && hasNearby ? THEME : '#d1d5db',
                }}>{formatDistance(s.dist)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticky CTA ── */}
      <div style={{
        position: 'sticky', bottom: 0,
        padding: '12px 16px 36px',
        background: 'linear-gradient(to top, #fff 65%, transparent)',
      }}>
        <button onClick={onExplore} style={{
          display: 'block', width: '100%', padding: '17px',
          borderRadius: 20, border: 'none',
          background: `linear-gradient(135deg, ${THEME} 0%, ${THEME_DARK} 100%)`,
          color: '#fff', fontWeight: 800, fontSize: 17, cursor: 'pointer',
          boxShadow: '0 8px 28px rgba(124,58,237,0.38)',
          letterSpacing: '0.01em',
        }}>Explore the Map  ▶</button>
      </div>
    </div>
  )
}

// ── 位置情報・コンパス許可カード ─────────────────────────────────────────
function LocationPermissionCard({ onAllow, onSkip }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: '28px 28px 0 0',
        padding: '36px 28px 56px', width: '100%', maxWidth: 480,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 18 }}>📍🧭</div>
        <div style={{ fontWeight: 800, fontSize: 21, textAlign: 'center', marginBottom: 12, color: '#1a1a2e' }}>
          Location & Compass
        </div>
        <div style={{ fontSize: 14, color: '#555', lineHeight: 1.75, textAlign: 'center', marginBottom: 32 }}>
          This app uses your <strong>location</strong> to detect nearby anime spots,
          and your <strong>compass</strong> to show the direction you're facing.
        </div>
        <button
          onClick={onAllow}
          style={{
            display: 'block', width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: `linear-gradient(135deg, ${THEME} 0%, ${THEME_DARK} 100%)`,
            color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(124,58,237,0.4)', marginBottom: 12,
          }}
        >Allow</button>
        <button
          onClick={onSkip}
          style={{
            display: 'block', width: '100%', padding: '14px', borderRadius: 16,
            border: '1.5px solid #e5e7eb', background: '#fff',
            color: '#888', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >Use without location</button>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────
function App() {
  const [spots, setSpots]               = useState([])
  const [touristSpots, setTouristSpots] = useState([])
  const [selected, setSelected]         = useState(null)
  const [cardExpanded, setCardExpanded] = useState(false)
  const [nearbySpots, setNearbySpots]   = useState([])
  const [selectedTourist, setSelectedTourist] = useState(null)

  useEffect(() => { setCardExpanded(false) }, [selected?.id])

  const [demoMode, setDemoMode]         = useState(false)
  const [playing, setPlaying]           = useState(false)
  const [startPos, setStartPos]         = useState(null)   // デモ中心点
  const [startPosMode, setStartPosMode] = useState(false)  // 位置指定待ち
  const [demoPos, setDemoPos]           = useState(null)   // 擬似マーカー位置

  const triggeredRef = useRef(new Set())
  const [locateTick, setLocateTick] = useState(0)

  // locationPermissionAsked はセッションごとにリセット（毎起動カードを出す）
  // → requestPermission() が必ずボタン押下（ユーザージェスチャー）から呼ばれる
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false)
  const [gpsConsented, setGpsConsented] = useState(
    () => { try { return !!localStorage.getItem(LOCATION_CONSENTED_KEY) } catch { return false } }
  )

  const { pos: livePos, status: gpsStatus } = useLiveGPS(!demoMode && gpsConsented)
  const { heading, requestPermission } = useDeviceHeading()

  const handleLocationAllow = useCallback(async () => {
    try { localStorage.setItem(LOCATION_CONSENTED_KEY, 'true') } catch {}
    // 位置情報の許可をボタン押下（ユーザージェスチャー）から明示的にトリガー
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true })
    }
    // コンパス許可（iOS）もジェスチャー内で実行
    await requestPermission()
    setGpsConsented(true)
    setLocationPermissionAsked(true)
  }, [requestPermission])

  const handleLocationSkip = useCallback(() => {
    setLocationPermissionAsked(true)
  }, [])

  const [gpsReady, setGpsReady] = useState(false)
  useEffect(() => {
    if (demoMode || !gpsConsented) { setGpsReady(true); return }
    if (gpsStatus === 'ok' || gpsStatus === 'error') { setGpsReady(true); return }
    setGpsReady(false)
    const t = setTimeout(() => setGpsReady(true), 8000)
    return () => clearTimeout(t)
  }, [gpsStatus, demoMode, gpsConsented])

  const [showDashboard, setShowDashboard] = useState(true)
  const [userPrefs, setUserPrefs]   = useState(() => loadPrefs())
  const [showSurvey, setShowSurvey] = useState(() => !loadPrefs())
  const [showSettings, setShowSettings] = useState(false)
  const [mapTheme, setMapTheme] = useState(loadMapTheme)
  const [weatherOverride, setWeatherOverride] = useState(null)
  const wxPos = demoMode ? startPos : livePos
  const autoWeather = useAutoWeather(wxPos, weatherOverride !== null)
  const weather = weatherOverride ?? autoWeather ?? 'sunny'

  const [favorites, setFavorites] = useState(() => loadFavorites())
  const toggleFavorite = useCallback(id => {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      saveFavorites(next)
      return next
    })
  }, [])

  const handleSaveSettings = newPrefs => {
    savePrefs(newPrefs)
    setUserPrefs(newPrefs)
    Object.keys(introCache).forEach(k => delete introCache[k])
    setShowSettings(false)
  }

  const handleResetSettings = () => {
    localStorage.removeItem(SURVEY_KEY)
    setUserPrefs(null)
    Object.keys(introCache).forEach(k => delete introCache[k])
    setShowSettings(false)
    setShowSurvey(true)
  }

  const [searchQuery, setSearchQuery]         = useState('')
  const [searchAnime, setSearchAnime]         = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showSpotList, setShowSpotList]       = useState(false)
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

  const searchAnimeSpots = useMemo(() =>
    searchAnime
      ? spots
        .filter(s => s.anime_title_en === searchAnime)
        .sort((a, b) => a.spot_name_en.localeCompare(b.spot_name_en))
      : [],
    [spots, searchAnime])


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

  // 近接判定（ラベル表示用。DEMOは離れたらカードも自動クローズ）
  useEffect(() => {
    if (!activePos || !spots.length) return

    // 範囲内スポットをすべて nearbySpots に
    const nearby = spots.filter(
      s => haversine(activePos, { lat: s.lat, lng: s.lng }) < PROXIMITY_METERS
    )
    setNearbySpots(nearby)

    // DEMO: 選択中スポットが範囲外に出たら自動クローズ
    if (demoMode) {
      setSelected(prev => {
        if (prev && haversine(activePos, { lat: prev.lat, lng: prev.lng }) > PROXIMITY_METERS) {
          return null
        }
        return prev
      })
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
    setCardExpanded(true)
  }, [])

  const handleAnimeSelect = title => {
    setSearchQuery(title)
    setSearchAnime(title)
    setShowSuggestions(false)
    setShowSpotList(true)
  }

  const handleSearchSpotSelect = spot => {
    setSelectedTourist(null)
    setSelected(spot)
    setCardExpanded(true)
    setShowSpotList(false)
    setShowSuggestions(false)
  }

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
      // 地図タップで観光スポットポップアップを閉じる
      // 聖地カードは ✕ ボタンでのみ閉じる（パン後の遅延クリックでの誤閉じ防止）
      setSelectedTourist(null)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} language="en" region="JP">
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={TOKYO}
          defaultZoom={6}
          minZoom={5}
          gestureHandling="greedy"
          disableDefaultUI={true}
          keyboardShortcuts={false}
          restriction={{
            latLngBounds: { north: 46.5, south: 23.0, west: 121.0, east: 155.0 },
            strictBounds: false,
          }}
          styles={mapTheme === 'dark' ? MAP_STYLES_DARK : MAP_STYLES_LIGHT}
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
          <SearchCamera spots={spots} searchAnime={searchAnime} />

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
            favorites={favorites}
          />

          {/* お気に入りピン（クラスタリングなし・ピンク星） */}
          {spots
            .filter(s => favorites.has(s.id) && s.id !== selected?.id && !(searchAnime && s.anime_title_en === searchAnime))
            .map(s => (
              <Marker
                key={`fav-${s.id}`}
                position={{ lat: s.lat, lng: s.lng }}
                title={s.spot_name_en}
                icon={FAVORITE_SPOT_ICON}
                zIndex={60}
                onClick={() => handleSpotSelect(s)}
              />
            ))
          }

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

          {/* 近接ラベル（範囲内スポットのピン真上に表示） */}
          {nearbySpots
            .filter(s => !selected || s.id !== selected.id)
            .map(s => (
              <ProximityLabel
                key={s.id}
                spot={s}
                onTap={() => { setSelected(s); setCardExpanded(true) }}
              />
            ))
          }
          {/* 選択中スポットにも近接ラベルを表示（カード未展開時） */}
          {selected && !cardExpanded && nearbySpots.some(s => s.id === selected.id) && (
            <ProximityLabel
              spot={selected}
              onTap={() => setCardExpanded(true)}
            />
          )}

          {/* 現在地マーカー */}
          {activePos && window.google?.maps && (
            <Marker
              position={activePos}
              title="You are here"
              zIndex={999}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: demoMode ? THEME : '#1d6ef5',
                fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3, scale: 10,
              }}
            />
          )}

          {/* 方向コーン（LIVEモードかつ方位取得済みのとき） */}
          {/* 方向扇形（LIVEモードかつ方位取得済みのとき） */}
          {!demoMode && livePos && heading != null && window.google?.maps && (
            <Marker
              position={livePos}
              zIndex={998}
              icon={{
                // 約60°の扇形（上向き、中心から半径38px）
                path: 'M 0 0 L -19 -33 A 38 38 0 0 1 19 -33 Z',
                fillColor: '#1d6ef5',
                fillOpacity: 0.22,
                strokeColor: '#1d6ef5',
                strokeWeight: 0,
                scale: 1,
                anchor: { x: 0, y: 0 },
                rotation: heading,
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
            placeholder="Search by anime title"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchAnime(null); setShowSpotList(false); setShowSuggestions(true) }}
            onFocus={() => { if (searchAnime) setShowSpotList(true); else setShowSuggestions(true) }}
            onBlur={() => setTimeout(() => { setShowSuggestions(false); setShowSpotList(false) }, 200)}
            onKeyDown={e => { if (e.key === 'Escape') { setShowSuggestions(false); setShowSpotList(false); e.target.blur() } }}
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
                setSearchQuery(''); setSearchAnime(null); setShowSuggestions(false); setShowSpotList(false)
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
                  handleAnimeSelect(title)
                }}
                onTouchEnd={() => {
                  handleAnimeSelect(title)
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
        {showSpotList && searchAnime && searchAnimeSpots.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, width: 280, maxWidth: 'calc(100vw - 16px)',
            maxHeight: 280, marginTop: 4,
            background: 'white', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', overflowY: 'auto', zIndex: 2001,
          }}>
            <div style={{
              padding: '9px 12px', fontSize: 11, fontWeight: 700,
              color: '#777', borderBottom: '1px solid #f3f4f6',
              textTransform: 'uppercase',
            }}>
              {searchAnimeSpots.length} seichi spots
            </div>
            {searchAnimeSpots.map(spot => (
              <button
                key={spot.id}
                onMouseDown={e => {
                  e.preventDefault()
                  handleSearchSpotSelect(spot)
                }}
                onTouchEnd={() => handleSearchSpotSelect(spot)}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 14, color: '#222', fontWeight: 700, lineHeight: 1.35 }}>
                  {spot.spot_name_en}
                </div>
                {spot.area && (
                  <div style={{ fontSize: 12, color: '#777', marginTop: 2, lineHeight: 1.35 }}>
                    {spot.area}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* コントロールバー */}
      <div style={{
        position: 'absolute', bottom: 32, left: 12,
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 24, padding: '6px 10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)',
        border: '1px solid rgba(255,255,255,0.65)',
        display: 'flex', gap: 6, alignItems: 'center',
        zIndex: 10, userSelect: 'none',
        maxWidth: 'calc(100vw - 24px)',
      }}>
        {/* 設定ボタン */}
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          style={{
            width: 30, height: 30, borderRadius: 10,
            background: 'rgba(0,0,0,0.06)', border: 'none',
            cursor: 'pointer', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >⚙️</button>

        <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />

        {/* DEMO / LIVE 切替 */}
        <button
          onClick={() => { setDemoMode(m => !m); handleReset() }}
          style={{
            fontSize: 10, fontWeight: 800, padding: '5px 11px', borderRadius: 10,
            border: 'none', cursor: 'pointer', letterSpacing: '0.07em',
            background: demoMode ? THEME : 'rgba(0,0,0,0.07)',
            color: demoMode ? '#fff' : '#555',
            boxShadow: demoMode ? `0 2px 8px rgba(124,58,237,0.35)` : 'none',
            transition: 'all 0.18s',
          }}
        >{demoMode ? 'LIVE' : 'DEMO'}</button>

        {demoMode && (<>
          <span style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.1)' }} />
          {/* 開始位置指定 */}
          <button
            onClick={() => setStartPosMode(m => !m)}
            style={{
              fontSize: 10, fontWeight: 800, padding: '5px 10px', borderRadius: 10,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.04em',
              background: startPosMode ? '#f59e0b' : startPos ? '#ede9ff' : THEME,
              color: startPosMode ? '#fff' : startPos ? THEME : '#fff',
              boxShadow: startPos && !startPosMode ? 'none' : `0 2px 8px rgba(124,58,237,0.3)`,
              transition: 'all 0.18s',
            }}
          >{startPosMode ? '📍 Tap map…' : startPos ? '📍 Change' : '📍 Set Start'}</button>

          {/* 再生 / 一時停止 */}
          <button
            onClick={() => setPlaying(p => !p)}
            disabled={!startPos}
            style={{
              width: 30, height: 30, borderRadius: 10,
              background: startPos ? (playing ? '#fef3c7' : 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.04)',
              border: 'none', cursor: startPos ? 'pointer' : 'default',
              fontSize: 16, opacity: startPos ? 1 : 0.35,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >{playing ? '⏸' : '▶️'}</button>
        </>)}
      </div>

      {/* 初回ガイド：Set Start を促す吹き出し */}
      {demoMode && !startPos && !startPosMode && (
        <div style={{
          position: 'absolute', bottom: 82, left: 12,
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
          position: 'absolute', bottom: 82, left: 12,
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
      {selected && cardExpanded && (
        <Card spot={selected} currentPos={activePos} onClose={() => setSelected(null)} userPrefs={userPrefs} isFavorite={favorites.has(selected.id)} onToggleFavorite={toggleFavorite} weather={weather} defaultExpanded={true} />
      )}
      {/* GPSローディングオーバーレイ（同意後のみ表示） */}
      {!gpsReady && !demoMode && gpsConsented && (
        <div style={{
          position: 'fixed', inset: 0, background: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9998,
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%',
            border: '5px solid #f3f3f3', borderTop: `5px solid ${THEME}`,
            animation: 'spin 1s linear infinite', marginBottom: 16,
          }} />
          <div style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>Getting your location…</div>
        </div>
      )}

      {/* 位置情報・コンパス許可カード（初回LIVEモードのみ） */}
      {!demoMode && !locationPermissionAsked && (
        <LocationPermissionCard onAllow={handleLocationAllow} onSkip={handleLocationSkip} />
      )}

      {/* アプリ概要ダッシュボード（許可カード・サーベイより低い z-index） */}
      {showDashboard && (
        <AppOverviewDashboard
          spots={spots}
          currentPos={livePos}
          onExplore={() => setShowDashboard(false)}
        />
      )}

      {showSurvey && (
        <OnboardingSurvey onComplete={prefs => { setUserPrefs(prefs); setShowSurvey(false) }} />
      )}
      {showSettings && (
        <SettingsScreen
          userPrefs={userPrefs}
          weather={weather}
          weatherIsAuto={weatherOverride === null}
          onWeatherChange={setWeatherOverride}
          mapTheme={mapTheme}
          onMapThemeChange={t => { setMapTheme(t); localStorage.setItem(MAP_THEME_KEY, t) }}
          onSave={handleSaveSettings}
          onReset={handleResetSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {!selected && selectedTourist && (
        <TouristPopup spot={selectedTourist} onClose={() => setSelectedTourist(null)} />
      )}
    </div>
  )
}

export default App
