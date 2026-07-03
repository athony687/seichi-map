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

// ── スポットカード（距離表示付き）────────────────────────────────────────
const isPlaceholder = t => !t || t.startsWith('PLACEHOLDER')

function Card({ spot, currentPos, onClose, userPrefs, isFavorite, onToggleFavorite, weather }) {
  const staticIntro = spot.generic_intro_en || (!isPlaceholder(spot.intro_short_en) ? spot.intro_short_en : GENERIC_INTRO)
  const [intro, setIntro]   = useState(introCache[spot.id] || staticIntro)
  const [loading, setLoading] = useState(!introCache[spot.id])
  const [aiOk, setAiOk]     = useState(!!introCache[spot.id])
  const [expanded, setExpanded] = useState(false)

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

// ── 設定画面 ──────────────────────────────────────────────────────────────
function SettingsScreen({ userPrefs, onSave, onReset, onClose }) {
  const p = userPrefs || {}
  const [nickname,    setNickname]    = useState(p.nickname    || '')
  const [familiarity, setFamiliarity] = useState(p.familiarity || '')
  const [mood,        setMood]        = useState(p.mood        || '')
  const [travelStyle, setTravelStyle] = useState(p.travelStyle || '')
  const [confirmReset, setConfirmReset] = useState(false)

  const selBtn = (current, value, emoji, label, setter) => {
    const active = current === value
    return (
      <button key={value} onClick={() => setter(active ? '' : value)} style={{
        padding: '9px 12px', borderRadius: 10, cursor: 'pointer', marginRight: 8, marginBottom: 8,
        border: `2px solid ${active ? THEME : '#e5e7eb'}`,
        background: active ? '#ede9ff' : '#fff',
        color: active ? THEME : '#444',
        fontSize: 13, fontWeight: active ? 700 : 500,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <span>{emoji}</span>{label}
      </button>
    )
  }

  const section = (title, children) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: '#fff', overflowY: 'auto' }}>
      {/* ヘッダー */}
      <div style={{
        position: 'sticky', top: 0, background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid #f0f0f0', zIndex: 1,
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a' }}>Settings</div>
        <button onClick={onClose} style={{
          background: '#f3f4f6', border: 'none', borderRadius: '50%',
          width: 32, height: 32, cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      <div style={{ padding: '24px 20px' }}>

        {/* ニックネーム */}
        {section('Nickname', <>
          <input
            type="text" placeholder="Your nickname…" value={nickname}
            onChange={e => setNickname(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '2px solid #e5e7eb', borderRadius: 10,
              padding: '10px 12px', fontSize: 16, outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = THEME}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>
            Leave blank to remove your nickname.
          </div>
        </>)}

        {/* アニメ詳しさ */}
        {section('Anime familiarity', <div>
          {selBtn(familiarity, 'Newcomer',   '🌱', 'Newcomer',   setFamiliarity)}
          {selBtn(familiarity, 'Casual fan', '😊', 'Casual fan', setFamiliarity)}
          {selBtn(familiarity, 'Big fan',    '⭐', 'Big fan',    setFamiliarity)}
        </div>)}

        {/* 好きな雰囲気 */}
        {section('Favorite mood', <div>
          {selBtn(mood, 'Emotional',    '😢', 'Emotional',    setMood)}
          {selBtn(mood, 'Exciting',     '⚡', 'Exciting',     setMood)}
          {selBtn(mood, 'Heartwarming', '🌸', 'Heartwarming', setMood)}
          {selBtn(mood, 'Romance',      '💕', 'Romance',      setMood)}
        </div>)}

        {/* 旅スタイル */}
        {section('Travel style', <div>
          {selBtn(travelStyle, 'Taking photos',       '📸', 'Taking photos',       setTravelStyle)}
          {selBtn(travelStyle, 'Relaxed walking',     '🚶', 'Relaxed walking',     setTravelStyle)}
          {selBtn(travelStyle, 'Visiting many spots', '🗺️', 'Visiting many spots', setTravelStyle)}
        </div>)}

        {/* 保存ボタン */}
        <button
          onClick={() => onSave({ nickname: nickname.trim(), familiarity, mood, travelStyle })}
          style={{
            width: '100%', padding: '13px', borderRadius: 12,
            background: THEME, color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16,
          }}
        >Save changes</button>

        {/* リセット */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} style={{
              width: '100%', padding: '11px', borderRadius: 12,
              background: 'none', border: '2px solid #fca5a5',
              color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>🗑 Reset all preferences</button>
          ) : (
            <div style={{ background: '#fef2f2', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 13, color: '#991b1b', fontWeight: 600, marginBottom: 12 }}>
                Are you sure? This will clear all saved preferences and show the welcome survey again.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onReset} style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: '#ef4444', color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>Yes, reset</button>
                <button onClick={() => setConfirmReset(false)} style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: '#fff', border: '2px solid #e5e7eb',
                  color: '#555', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── アンケート（localStorage） ────────────────────────────────────────────
const SURVEY_KEY = 'seichi_prefs'
const loadPrefs  = () => { try { const r = localStorage.getItem(SURVEY_KEY); return r ? JSON.parse(r) : null } catch { return null } }
const savePrefs  = p  => localStorage.setItem(SURVEY_KEY, JSON.stringify(p))

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

// ── App ───────────────────────────────────────────────────────────────────
function App() {
  const [spots, setSpots]               = useState([])
  const [touristSpots, setTouristSpots] = useState([])
  const [selected, setSelected]         = useState(null)
  const [selectedTourist, setSelectedTourist] = useState(null)

  const [demoMode, setDemoMode]         = useState(false)
  const [playing, setPlaying]           = useState(false)
  const [startPos, setStartPos]         = useState(null)   // デモ中心点
  const [startPosMode, setStartPosMode] = useState(false)  // 位置指定待ち
  const [demoPos, setDemoPos]           = useState(null)   // 擬似マーカー位置

  const triggeredRef = useRef(new Set())
  const [locateTick, setLocateTick] = useState(0)
  const { pos: livePos, status: gpsStatus } = useLiveGPS(!demoMode)

  const [gpsReady, setGpsReady] = useState(false)
  useEffect(() => {
    if (gpsReady) return
    if (demoMode || gpsStatus === 'ok' || gpsStatus === 'error') {
      setGpsReady(true); return
    }
    const t = setTimeout(() => setGpsReady(true), 8000)
    return () => clearTimeout(t)
  }, [gpsStatus, demoMode])

  const [userPrefs, setUserPrefs]   = useState(() => loadPrefs())
  const [showSurvey, setShowSurvey] = useState(() => !loadPrefs())
  const [showSettings, setShowSettings] = useState(false)
  const [showWeatherMenu, setShowWeatherMenu] = useState(false)
  const [weather, setWeather] = useState('sunny')

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

  const handleAnimeSelect = title => {
    setSearchQuery(title)
    setSearchAnime(title)
    setShowSuggestions(false)
    setShowSpotList(true)
  }

  const handleSearchSpotSelect = spot => {
    setSelectedTourist(null)
    setSelected(spot)
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
      // 地図タップで観光スポットポップアップ・天気メニューを閉じる
      // 聖地カードは ✕ ボタンでのみ閉じる（パン後の遅延クリックでの誤閉じ防止）
      setSelectedTourist(null)
      setShowWeatherMenu(false)
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

          {/* 現在地マーカー */}
          {activePos && window.google?.maps?.SymbolPath?.CIRCLE && (
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
        position: 'absolute', bottom: 10, left: 12,
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

        {/* 天気ボタン（ドロップアップ式） */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowWeatherMenu(m => !m)}
            title="Weather"
            style={{
              width: 36, height: 30, borderRadius: 10,
              background: showWeatherMenu ? '#ede9ff' : 'rgba(0,0,0,0.06)',
              border: `1.5px solid ${showWeatherMenu ? THEME : 'transparent'}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15 }}>{{ sunny:'☀️', cloudy:'☁️', rainy:'🌧️', evening:'🌇' }[weather]}</span>
            <span style={{ fontSize: 8, color: showWeatherMenu ? THEME : '#888', lineHeight: 1 }}>{showWeatherMenu ? '▴' : '▾'}</span>
          </button>

          {showWeatherMenu && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 16, padding: '8px 8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid rgba(255,255,255,0.7)',
              display: 'flex', gap: 6,
            }}>
              {[['sunny','☀️','Sunny'],['cloudy','☁️','Cloudy'],['rainy','🌧️','Rainy'],['evening','🌇','Evening']].map(([key, emoji, label]) => (
                <button
                  key={key}
                  onClick={() => { setWeather(key); setShowWeatherMenu(false) }}
                  style={{
                    width: 40, height: 44, borderRadius: 12,
                    background: weather === key ? THEME : 'rgba(0,0,0,0.05)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 2,
                    boxShadow: weather === key ? `0 2px 8px rgba(124,58,237,0.35)` : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{emoji}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: weather === key ? '#fff' : '#888', letterSpacing: '0.03em' }}>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
        <Card spot={selected} currentPos={activePos} onClose={() => setSelected(null)} userPrefs={userPrefs} isFavorite={favorites.has(selected.id)} onToggleFavorite={toggleFavorite} weather={weather} />
      )}
      {/* GPSローディングオーバーレイ */}
      {!gpsReady && (
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

      {showSurvey && (
        <OnboardingSurvey onComplete={prefs => { setUserPrefs(prefs); setShowSurvey(false) }} />
      )}
      {showSettings && (
        <SettingsScreen
          userPrefs={userPrefs}
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
