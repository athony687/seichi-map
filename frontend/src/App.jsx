import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { APIProvider, Map, Marker, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import {
  addAlbumEntry,
  calculateQuestProgress,
  createAlbumPhotoFromFile,
  deleteAlbumEntry,
  getQuestKey,
  loadLocalQuestAlbum,
  loadQuestCompletions,
  saveQuestCompletions,
  updateAlbumEntry,
} from './questAlbum.js'

// ============================================================
// 汎用紹介文（AI生成失敗時・intro_short_en 未記入時のフォールバック）
// ここを編集してください ↓
const GENERIC_INTRO = `Welcome to this anime pilgrimage spot! This location appeared in a beloved anime series and draws fans from around the world. Come and experience the scenery that inspired the story.`
// ============================================================

const KANAGAWA_CENTER = { lat: 35.4478, lng: 139.6425 }
const YOKOHAMA_STATION = { lat: 35.4658, lng: 139.6223 }
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const PROXIMITY_METERS = 500
const MISSION_TRIGGER_METERS = 500  // ミッション発動半径（デモでも動くよう大きめ）
const THEME = '#7c3aed'
const THEME_DARK = '#4c1d95'
const DEMO_STEP = 0.001   // degrees per tick (≈110m)
const DEMO_TICK_MS = 600  // marker position update interval
const ARRIVE_DEG = 0.001  // ≈110m, spot "arrived"
const LOCATION_CONSENTED_KEY = 'seichi_location_consented'
const ENABLE_ONBOARDING_SURVEY = false

// ── スタンプラリー設定 ──────────────────────────────────────────────────────
const STAMP_KEY          = 'seichi_stamps'
const STAMP_CARD_KEY     = 'seichi_stamp_card'
const STAMP_RADIUS_METERS = 10000   // 10km 以内のスポットをカード対象に
const STAMP_CARD_SIZE    = 10       // 最大スタンプ数

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

const POP_HOOKS = [
  t => `You're literally inside ${t} right now 🌸`,
  t => `This is THAT scene from ${t} 🎬`,
  t => `${t} fans — this is your moment ✨`,
  t => `Step into the world of ${t} 🗾`,
  t => `${t} was filmed right here 🎌`,
  t => `Welcome to ${t} IRL 🌟`,
]

function getPopHook(spot) {
  const hash = spot.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return POP_HOOKS[hash % POP_HOOKS.length](spot.anime_title_en)
}

function ProximityLabel({ spot, onTap }) {
  return (
    <InfoWindow
      position={{ lat: spot.lat, lng: spot.lng }}
      pixelOffset={[0, -32]}
      disableAutoPan
      headerDisabled
      shouldFocus={false}
      onCloseClick={onTap}
    >
      <div
        onClick={onTap}
        style={{
          cursor: 'pointer',
          margin: '-6px -10px',
          padding: '8px 13px',
          background: `linear-gradient(135deg, ${THEME} 0%, ${THEME_DARK} 100%)`,
          borderRadius: 10,
          maxWidth: 230,
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
          {spot.anime_title_en}
        </div>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 800, lineHeight: 1.35 }}>
          {getPopHook(spot)}
        </div>
      </div>
    </InfoWindow>
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
      maxWidth: 400, margin: '0 auto',
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 24,
      boxShadow: '0 2px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.12), 0 24px 48px rgba(124,58,237,0.1)',
      border: '1px solid rgba(255,255,255,0.9)',
      zIndex: 10, overflow: 'hidden',
    }}>
      {/* ヘッダー */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          background: `linear-gradient(135deg, ${THEME} 0%, #6d28d9 50%, ${THEME_DARK} 100%)`,
          padding: '16px 80px 16px 20px', cursor: 'pointer',
          position: 'relative',
        }}
      >
        {/* アニメタイトル */}
        <div style={{
          fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5,
        }}>{spot.anime_title_en}</div>

        {/* スポット名 */}
        <div style={{ fontSize: 19, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 8 }}>
          {spot.spot_name_en}
        </div>

        {/* メタ情報チップ列 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {spot.area && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 600 }}>
              📍 {spot.area}
            </span>
          )}
          {distText && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 600 }}>
              · 🚶 {distText}
            </span>
          )}
          {spot.hours && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 600 }}>
              · 🕐 {spot.hours}
            </span>
          )}
        </div>

        {(() => { const msg = getWeatherMessage(spot.tags, weather); return msg ? (
          <div style={{
            marginTop: 8, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)',
            fontSize: 11, color: '#fff', display: 'inline-block', fontWeight: 600,
          }}>{msg}</div>
        ) : null })()}

        {/* 展開トグル */}
        <div style={{
          position: 'absolute', bottom: 14, right: expanded ? 76 : 14,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 10px', borderRadius: 20,
          background: 'rgba(255,255,255,0.18)',
          fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em',
          transition: 'right 0.2s',
        }}>
          {expanded ? '▲ CLOSE' : '▼ MORE'}
        </div>
      </div>

      {/* お気に入り＋閉じるボタン */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(spot.id) }}
          style={{
            background: 'rgba(255,255,255,0.22)', border: 'none',
            fontSize: 15, width: 30, height: 30,
            borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >{isFavorite ? '❤️' : '🤍'}</button>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.22)', border: 'none',
          color: '#fff', fontSize: 14, width: 30, height: 30,
          borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', fontWeight: 700,
        }}>✕</button>
      </div>

      {expanded && (
        <div>
          {spot.photo_url && (
            <img
              src={spot.photo_url}
              alt={spot.spot_name_en}
              style={{ width: '100%', maxHeight: 190, objectFit: 'cover', display: 'block' }}
            />
          )}
          <div style={{ padding: '14px 20px 4px' }}>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', paddingTop: 4 }}>
                  <div style={{
                    width: 14, height: 14, border: '2px solid #e5e7eb',
                    borderTop: `2px solid ${THEME}`, borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13 }}>Generating introduction…</span>
                </div>
              ) : intro}
            </div>
          </div>
          <div style={{ padding: '10px 16px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`}
              target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 16px', borderRadius: 22,
                background: `linear-gradient(135deg, ${THEME}, #a855f7)`,
                color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 3px 12px rgba(124,58,237,0.35)',
              }}
            >🗺️ Directions</a>
            {spot.official_url && (
              <a
                href={spot.official_url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 16px', borderRadius: 22,
                  background: '#f3f4f6', color: '#374151',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                  border: '1px solid #e5e7eb',
                }}
              >
                {spot.official_url.includes('youtube.com') || spot.official_url.includes('youtu.be')
                  ? '▶ Trailer' : '🌐 Official'}
              </a>
            )}
            <div style={{ fontSize: 10, color: '#d1d5db', marginLeft: 'auto', fontWeight: 600 }}>
              {!loading && (aiOk ? '✨ AI' : '📄')}
            </div>
          </div>
          <QuestPanel spot={spot} />
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
    if (!navigator.geolocation) { setPos(YOKOHAMA_STATION); setStatus('error'); return }
    setStatus('pending')
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => { setPos({ lat: coords.latitude, lng: coords.longitude }); setStatus('ok') },
      () => { setPos(YOKOHAMA_STATION); setStatus('error') },
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])
  return { pos, status }
}

function GpsLocateButton({ status, onLocate }) {
  const cfg = {
    idle:    null,
    pending: { icon: '⌛', label: 'Locating…',   dot: '#9ca3af', disabled: true },
    ok:      { icon: '⊕',  label: 'My Location', dot: '#1d6ef5', disabled: false },
    error:   { icon: '⚠',  label: 'Yokohama',    dot: '#f59e0b', disabled: false },
  }
  const c = cfg[status]
  if (!c) return null
  return (
    <button
      onClick={c.disabled ? undefined : onLocate}
      style={{
        position: 'absolute', bottom: 24, right: 16, zIndex: 10,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.8)',
        color: '#1a1a2e', borderRadius: 22,
        padding: '8px 14px 8px 10px',
        display: 'flex', alignItems: 'center', gap: 7,
        cursor: c.disabled ? 'default' : 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.1)',
        fontSize: 12, fontWeight: 700, opacity: c.disabled ? 0.5 : 1,
        userSelect: 'none', transition: 'opacity 0.2s',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
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

// ── スタンプラリー用 localStorage ─────────────────────────────────────────
const loadStamps    = () => { try { const r = localStorage.getItem(STAMP_KEY);     return r ? new Set(JSON.parse(r)) : new Set()  } catch { return new Set() } }
const saveStamps    = s  => { try { localStorage.setItem(STAMP_KEY,     JSON.stringify([...s])) } catch {} }
const loadStampCard = () => { try { const r = localStorage.getItem(STAMP_CARD_KEY); return r ? JSON.parse(r) : null               } catch { return null } }
const saveStampCard = c  => { try { localStorage.setItem(STAMP_CARD_KEY, JSON.stringify(c))    } catch {} }
const saveFavorites = f => localStorage.setItem(FAVORITES_KEY, JSON.stringify([...f]))

// ── ジャーナル IndexedDB ──────────────────────────────────────────────────
const JDB_NAME = 'seichi_journal'
const JDB_STORE = 'entries'
function openJDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(JDB_NAME, 1)
    r.onupgradeneeded = e => e.target.result.createObjectStore(JDB_STORE, { keyPath: 'spotId' })
    r.onsuccess = e => res(e.target.result)
    r.onerror = e => rej(e.target.error)
  })
}
async function jdbSave(entry) {
  const db = await openJDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(JDB_STORE, 'readwrite')
    tx.objectStore(JDB_STORE).put(entry)
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error)
  })
}
async function jdbGet(spotId) {
  const db = await openJDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(JDB_STORE, 'readonly')
    const r = tx.objectStore(JDB_STORE).get(spotId)
    r.onsuccess = e => res(e.target.result ?? null)
    r.onerror = e => rej(e.target.error)
  })
}
async function jdbGetAll() {
  const db = await openJDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(JDB_STORE, 'readonly')
    const r = tx.objectStore(JDB_STORE).getAll()
    r.onsuccess = e => res(e.target.result)
    r.onerror = e => rej(e.target.error)
  })
}

function QuestPanel({ spot }) {
  const quests = spot.quests || []
  const [completed, setCompleted] = useState(() => loadQuestCompletions())

  if (!quests.length) return null

  const completedCount = quests.filter((_, index) => completed.has(getQuestKey(spot.id, index))).length
  const allComplete = completedCount === quests.length

  const toggleQuest = index => {
    const key = getQuestKey(spot.id, index)
    setCompleted(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveQuestCompletions(next)
      return next
    })
  }

  return (
    <section style={{
      marginTop: 14,
      padding: '12px',
      borderRadius: 16,
      background: '#f8fafc',
      border: '1px solid #e5e7eb',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 850, color: THEME, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Quest
          </div>
          {spot.quest_title && (
            <div style={{ fontSize: 14, fontWeight: 850, color: '#1f2937', lineHeight: 1.25, marginTop: 2 }}>
              {spot.quest_title}
            </div>
          )}
        </div>
        {spot.quest_type && (
          <span style={{
            flexShrink: 0,
            maxWidth: 150,
            padding: '4px 8px',
            borderRadius: 999,
            background: '#ede9fe',
            color: THEME_DARK,
            fontSize: 10,
            fontWeight: 850,
            lineHeight: 1.25,
            textAlign: 'center',
          }}>
            {spot.quest_type}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {quests.map((quest, index) => {
          const isDone = completed.has(getQuestKey(spot.id, index))
          return (
            <div
              key={`${quest.category}-${quest.title}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                alignItems: 'start',
                padding: '10px',
                borderRadius: 12,
                background: isDone ? '#ecfdf5' : '#fff',
                border: `1px solid ${isDone ? '#bbf7d0' : '#edf2f7'}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: isDone ? '#16a34a' : '#f3f4f6',
                    color: isDone ? '#fff' : '#4b5563',
                    fontSize: 10,
                    fontWeight: 850,
                    textTransform: 'uppercase',
                  }}>
                    {quest.category}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 850, color: '#111827', lineHeight: 1.35 }}>
                    {quest.title}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.55 }}>
                  {quest.description}
                </div>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggleQuest(index) }}
                style={{
                  minWidth: 78,
                  padding: '7px 9px',
                  borderRadius: 10,
                  border: 'none',
                  background: isDone ? '#16a34a' : THEME,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 850,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isDone ? 'Done' : 'Complete'}
              </button>
            </div>
          )
        })}
      </div>

      {allComplete && (
        <div style={{
          marginTop: 10,
          padding: '9px 10px',
          borderRadius: 12,
          background: '#dcfce7',
          color: '#166534',
          fontSize: 13,
          fontWeight: 850,
          textAlign: 'center',
        }}>
          Quest Complete!
        </div>
      )}

      <div style={{ marginTop: 10, color: '#8a94a6', fontSize: 10.5, lineHeight: 1.45 }}>
        Good to know: Some food and souvenir quests are based on local experiences, not official scenes.
        Please check current store information before visiting.
      </div>
    </section>
  )
}

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

// ── ミッション定義（後で差し替え可能） ───────────────────────────────────
// spot を受け取り { title, description, hint } を返す。
// 本物のミッション内容・判定ロジックはここだけ変更すれば差し込める。
function getMission(spot) {
  return {
    title: '📸 フォトミッション',
    description: `この場所で写真を撮ろう！\n"${spot.spot_name_en}" に来た証拠を残そう。`,
    hint: 'Tip: アニメのシーンと同じアングルを探してみよう',
  }
}

// ── ミッション画面 ────────────────────────────────────────────────────────
function MissionScreen({ spot, onComplete }) {
  const mission = getMission(spot)
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9600,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 12px 32px',
      animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <div style={{
        width: 'min(440px, 100%)',
        background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 100%)',
        borderRadius: 24, padding: '24px 20px 20px',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.5)',
        border: '1.5px solid rgba(167,139,250,0.35)',
      }}>
        {/* バッジ */}
        <div style={{
          display: 'inline-block', background: 'rgba(167,139,250,0.25)',
          borderRadius: 8, padding: '3px 10px', fontSize: 10, fontWeight: 800,
          letterSpacing: '0.18em', color: '#c4b5fd', textTransform: 'uppercase', marginBottom: 12,
        }}>MISSION</div>

        {/* スポット情報 */}
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
          {spot.anime_title_en}
        </div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 900, marginBottom: 18, lineHeight: 1.3 }}>
          {spot.spot_name_en}
        </div>

        {/* ミッション内容（差し替えポイント） */}
        <div style={{
          background: 'rgba(255,255,255,0.08)', borderRadius: 14,
          padding: '14px 16px', marginBottom: 8,
        }}>
          <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            {mission.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-line' }}>
            {mission.description}
          </div>
        </div>

        {mission.hint && (
          <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginBottom: 22, paddingLeft: 2 }}>
            {mission.hint}
          </div>
        )}

        {/* 完了ボタン（ここが完了判定のトリガー。後でロジックを差し込む） */}
        <button
          onClick={onComplete}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
            letterSpacing: '0.04em',
          }}
        >✅ ミッション完了！</button>
      </div>
    </div>
  )
}

// ── 未収集スタンプ最近接バー ─────────────────────────────────────────────
function NearestStampBar({ spot, onTap }) {
  if (!spot) return null
  return (
    <div
      onClick={onTap}
      style={{
        position: 'fixed', bottom: 82, left: '50%', transform: 'translateX(-50%)',
        width: 'min(390px, calc(100vw - 24px))', zIndex: 20, cursor: 'pointer',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 22, padding: '10px 14px 10px 10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 12px 32px rgba(124,58,237,0.12)',
        border: '1px solid rgba(167,139,250,0.25)',
        display: 'flex', alignItems: 'center', gap: 11,
        animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 14, flexShrink: 0,
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 19, boxShadow: '0 4px 12px rgba(124,58,237,0.35)',
      }}>🎯</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>
          Next stamp · {formatDistance(spot.dist)}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {spot.spot_name_en}
        </div>
        <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {spot.anime_title_en}
        </div>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#7c3aed', fontWeight: 800,
      }}>›</div>
    </div>
  )
}

// ── 位置情報・コンパス許可カード ─────────────────────────────────────────
function LocationPermissionCard({ onAllow, onSkip }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10,8,28,0.6)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: '32px 32px 0 0',
        padding: '32px 24px 52px', width: '100%', maxWidth: 480,
        boxShadow: '0 -2px 4px rgba(0,0,0,0.04), 0 -16px 64px rgba(0,0,0,0.2)',
      }}>
        {/* アイコン */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          {['📍', '🧭'].map((icon, i) => (
            <div key={i} style={{
              width: 56, height: 56, borderRadius: 18,
              background: i === 0 ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'linear-gradient(135deg,#0ea5e9,#2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, boxShadow: `0 6px 20px ${i === 0 ? 'rgba(124,58,237,0.3)' : 'rgba(37,99,235,0.3)'}`,
            }}>{icon}</div>
          ))}
        </div>

        <div style={{ fontWeight: 900, fontSize: 22, textAlign: 'center', marginBottom: 10, color: '#111827' }}>
          Location & Compass
        </div>
        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.8, textAlign: 'center', marginBottom: 28 }}>
          Detects <strong style={{ color: '#374151' }}>nearby anime spots</strong> and shows
          the <strong style={{ color: '#374151' }}>direction</strong> you're facing.
        </div>

        <button
          onClick={onAllow}
          style={{
            display: 'block', width: '100%', padding: '16px', borderRadius: 18, border: 'none',
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(124,58,237,0.4)', marginBottom: 10,
            letterSpacing: '0.02em',
          }}
        >Allow Access</button>
        <button
          onClick={onSkip}
          style={{
            display: 'block', width: '100%', padding: '14px', borderRadius: 18,
            border: '1px solid #f3f4f6', background: '#fafafa',
            color: '#9ca3af', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >Continue without location</button>
      </div>
    </div>
  )
}

// ── スタンプカード全画面 ────────────────────────────────────────────────────
function StampCardScreen({ spots, stampCardIds, acquiredStamps, onClose, onOpenJournal, journaledIds }) {
  const cardSpots = stampCardIds
    ? spots.filter(s => stampCardIds.includes(s.id))
    : []
  const total     = stampCardIds?.length ?? 0
  const collected = stampCardIds ? [...acquiredStamps].filter(id => stampCardIds.includes(id)).length : 0
  const remaining = total - collected
  const isComplete = total > 0 && collected === total

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'linear-gradient(160deg, #0f0a2a 0%, #1e1b4b 40%, #312e81 80%, #4c1d95 100%)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* ヘッダー */}
      <div style={{ padding: '24px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{
            display: 'inline-block', background: 'rgba(167,139,250,0.25)', borderRadius: 8,
            padding: '3px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
            color: '#c4b5fd', textTransform: 'uppercase', marginBottom: 10,
          }}>STAMP MISSION</div>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 900, lineHeight: 1.2, marginBottom: 8 }}>
            Your Anime<br />Stamp Rally
          </div>
          <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13, lineHeight: 1.6 }}>
            Your mission: collect every stamp nearby.
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 22, color: '#fff', fontSize: 12, fontWeight: 800,
            padding: '9px 18px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >View Map →</button>
      </div>

      {/* 進捗バー */}
      <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${total > 0 ? (collected / total) * 100 : 0}%`,
            background: isComplete
              ? 'linear-gradient(90deg, #fde68a, #fb923c)'
              : 'linear-gradient(90deg, #a78bfa, #f472b6)',
            borderRadius: 99, transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
        </div>
        <div style={{ color: isComplete ? '#fde68a' : '#fff', fontSize: 15, fontWeight: 900, flexShrink: 0 }}>
          {collected}/{total}
        </div>
      </div>

      {/* ステータスメッセージ */}
      <div style={{ padding: '8px 20px 16px', fontSize: 13, fontWeight: 700, color: isComplete ? '#fde68a' : 'rgba(255,255,255,0.6)' }}>
        {isComplete
          ? '🎉 All stamps collected! You\'re a true pilgrimage champion!'
          : stampCardIds === null
          ? 'Generating your stamp card…'
          : `${remaining} stamp${remaining !== 1 ? 's' : ''} left to collect`}
      </div>

      {/* スタンプグリッド */}
      <div style={{ padding: '0 14px 32px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {stampCardIds === null ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '40px 0', fontSize: 14 }}>
            Loading spots…
          </div>
        ) : cardSpots.map(spot => {
          const done = acquiredStamps.has(spot.id)
          return (
            <div key={spot.id} style={{
              background: done ? 'rgba(167,139,250,0.22)' : 'rgba(255,255,255,0.06)',
              border: `1.5px solid ${done ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.09)'}`,
              borderRadius: 16, padding: '13px 14px',
              position: 'relative', overflow: 'hidden',
              transition: 'all 0.35s',
            }}>
              {done && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                  padding: '0 10px 8px 0', pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: 32, opacity: 0.25 }}>✅</span>
                </div>
              )}
              <div style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: 5,
                color: done ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{spot.anime_title_en}</div>
              <div style={{
                fontSize: 13, fontWeight: 800, lineHeight: 1.35,
                color: done ? '#fff' : 'rgba(255,255,255,0.58)',
              }}>{spot.spot_name_en}</div>
              {spot.area && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 5 }}>
                  {spot.area}
                </div>
              )}
              {done && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'inline-block', background: 'rgba(167,139,250,0.4)', borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.06em' }}>
                    STAMPED ✓
                  </div>
                  {onOpenJournal && (
                    <button
                      onClick={e => { e.stopPropagation(); onOpenJournal(spot) }}
                      style={{
                        background: journaledIds?.has(spot.id) ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.12)',
                        border: 'none', borderRadius: 8, padding: '2px 8px',
                        fontSize: 10, fontWeight: 800, color: '#fff', cursor: 'pointer',
                        letterSpacing: '0.04em',
                      }}
                    >{journaledIds?.has(spot.id) ? '📝 メモあり' : '📝 メモ'}</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 完了時の祝い演出 */}
      {isComplete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: 72, animation: 'slideUp 0.5s ease-out',
            textAlign: 'center',
          }}>🎊<br /><span style={{ fontSize: 28, color: '#fde68a', fontWeight: 900 }}>Complete!</span></div>
        </div>
      )}
    </div>
  )
}

// ── ジャーナルエディター（写真＋メモ入力） ───────────────────────────────────
function JournalEditor({ spot, onSave, onSkip }) {
  const [photoUrl, setPhotoUrl] = useState(null)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    jdbGet(spot.id).then(e => {
      if (!e) return
      if (e.photo) setPhotoUrl(e.photo)
      if (e.memo) setMemo(e.memo)
    })
  }, [spot.id])

  const handleFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target.result
      setPhotoUrl(url)
      jdbSave({ spotId: spot.id, spotNameEn: spot.spot_name_en, animeEn: spot.anime_title_en, photo: url, memo, timestamp: Date.now() })
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    await jdbSave({ spotId: spot.id, spotNameEn: spot.spot_name_en, animeEn: spot.anime_title_en, photo: photoUrl, memo, timestamp: Date.now() })
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9650, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 12px 32px' }}>
      <div style={{ width: 'min(440px,100%)', background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 100%)', borderRadius: 24, padding: '20px 18px', boxShadow: '0 -4px 40px rgba(0,0,0,0.5)', border: '1.5px solid rgba(167,139,250,0.35)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{spot.anime_title_en}</div>
        <div style={{ color: '#fff', fontSize: 17, fontWeight: 900, marginBottom: 16 }}>{spot.spot_name_en}</div>

        {/* 写真エリア */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
        {photoUrl ? (
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <img src={photoUrl} alt="" style={{ width: '100%', borderRadius: 14, maxHeight: 220, objectFit: 'cover', display: 'block' }} />
            <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 10px', cursor: 'pointer' }}>変更</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '22px 0', background: 'rgba(255,255,255,0.08)', border: '1.5px dashed rgba(167,139,250,0.4)', borderRadius: 14, color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>📷 写真を追加</button>
        )}

        {/* メモエリア */}
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="メモを書く（感想・気づきなど）"
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 12, padding: '10px 12px', color: '#fff', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 14 }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onSkip} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>スキップ</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.45)' }}>{saving ? '保存中…' : '💾 保存'}</button>
        </div>
      </div>
    </div>
  )
}

// ── ジャーナルビューワー（記録一覧） ─────────────────────────────────────────
function JournalViewer({ spots, onOpenEditor, onClose }) {
  const [entries, setEntries] = useState([])
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    jdbGetAll().then(all => setEntries(all.sort((a, b) => b.timestamp - a.timestamp)))
  }, [])

  const spotById = useMemo(() => Object.fromEntries(spots.map(s => [s.id, s])), [spots])

  const fmt = ts => {
    const d = new Date(ts)
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
  }

  if (detail) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9550, background: 'linear-gradient(160deg,#0f0a2a,#1e1b4b)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '20px 18px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setDetail(null)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 800, padding: '7px 14px', cursor: 'pointer' }}>← 戻る</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700 }}>{detail.animeEn}</div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 900 }}>{detail.spotNameEn}</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{fmt(detail.timestamp)}</div>
        </div>
        {detail.photo && <img src={detail.photo} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', marginTop: 16 }} />}
        <div style={{ padding: '16px 18px', color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', flex: 1 }}>{detail.memo || '（メモなし）'}</div>
        {onOpenEditor && spotById[detail.spotId] && (
          <div style={{ padding: '0 18px 32px' }}>
            <button onClick={() => { setDetail(null); onOpenEditor(spotById[detail.spotId]) }} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'rgba(167,139,250,0.3)', color: '#c4b5fd', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>📝 編集する</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9550, background: 'linear-gradient(160deg,#0f0a2a,#1e1b4b)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '24px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-block', background: 'rgba(167,139,250,0.25)', borderRadius: 8, padding: '3px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: '#c4b5fd', textTransform: 'uppercase', marginBottom: 10 }}>JOURNAL</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>旅の記録</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 22, color: '#fff', fontSize: 12, fontWeight: 800, padding: '9px 18px', cursor: 'pointer' }}>閉じる</button>
      </div>

      {entries.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 14, padding: 40, textAlign: 'center' }}>
          まだ記録がありません。<br />スタンプを集めてメモを残そう！
        </div>
      ) : (
        <div style={{ padding: '16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map(e => (
            <div key={e.spotId} onClick={() => setDetail(e)} style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(167,139,250,0.2)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', display: 'flex', gap: 0 }}>
              {e.photo && <img src={e.photo} alt="" style={{ width: 80, height: 80, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>{e.animeEn}</div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 800, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.spotNameEn}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.memo || '（メモなし）'}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4 }}>{fmt(e.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── スタンプ進捗ミニバー（地図上に常時表示） ────────────────────────────────
function StampMinibar({ total, collected, onTap }) {
  if (!total) return null
  const isComplete = collected === total
  return (
    <div
      onClick={onTap}
      style={{
        position: 'fixed', top: 58, left: '50%', transform: 'translateX(-50%)',
        zIndex: 800, cursor: 'pointer',
        background: isComplete ? 'rgba(120,53,15,0.92)' : 'rgba(15,10,42,0.88)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderRadius: 22, padding: '6px 14px',
        display: 'flex', alignItems: 'center', gap: 9,
        boxShadow: '0 4px 18px rgba(0,0,0,0.28)',
        border: `1px solid ${isComplete ? 'rgba(253,230,138,0.4)' : 'rgba(167,139,250,0.3)'}`,
        transition: 'all 0.3s',
      }}
    >
      <span style={{ fontSize: 15 }}>🎫</span>
      <div style={{ width: 56, height: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(collected / total) * 100}%`,
          background: isComplete ? 'linear-gradient(90deg,#fde68a,#fb923c)' : 'linear-gradient(90deg,#a78bfa,#f472b6)',
          borderRadius: 99, transition: 'width 0.5s',
        }} />
      </div>
      <span style={{ color: isComplete ? '#fde68a' : '#e0d7ff', fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>
        {collected}/{total}{isComplete ? ' 🎉' : ''}
      </span>
    </div>
  )
}

function normalizeQuestForAlbum(quest, index) {
  return {
    ...quest,
    title: quest.title || `Photo Quest ${index + 1}`,
    category: quest.category || 'Photo Quest',
    photoPrompt: quest.photo_prompt || quest.photoPrompt || quest.description || 'Upload a photo you took with your phone camera.',
    impressionPrompt: quest.impression_prompt || quest.impressionPrompt || 'Add an optional comment about this memory.',
  }
}

function buildQuestSets(spots) {
  return spots
    .filter(spot => Array.isArray(spot.quests) && spot.quests.length > 0)
    .slice(0, 6)
    .map(spot => ({
      spot,
      quests: spot.quests.slice(0, 3).map(normalizeQuestForAlbum),
    }))
}

function getTotalQuestCount(questSets) {
  return questSets.reduce((sum, questSet) => sum + questSet.quests.length, 0)
}

function formatCompletionTime(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function QuestHomePanel({
  questSets,
  progress,
  albumEntries,
  uploadingQuestKey,
  onStartQuest,
  onShowAlbum,
  onShowAlbumMap,
  onUploadQuestPhoto,
  onClose,
}) {
  const [impressions, setImpressions] = useState({})
  const progressPercent = progress.totalQuestCount > 0
    ? Math.min(100, (progress.completedCount / progress.totalQuestCount) * 100)
    : 0

  const handleFile = (questSet, quest, questIndex, file) => {
    if (!file) return
    const questKey = getQuestKey(questSet.spot.id, questIndex)
    onUploadQuestPhoto(questSet.spot, quest, questIndex, file, impressions[questKey] || '')
  }

  return (
    <section style={{
      position: 'fixed',
      inset: '58px 10px 84px',
      maxWidth: 460,
      margin: '0 auto',
      zIndex: 2600,
      background: 'rgba(255,255,255,0.97)',
      border: '1px solid rgba(124,58,237,0.16)',
      borderRadius: 22,
      boxShadow: '0 18px 50px rgba(17,24,39,0.22)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }} aria-label="Kanagawa Quest Album home">
      <div style={{ padding: '16px 18px 14px', background: 'linear-gradient(135deg, #1f2937, #4c1d95)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.16em', color: '#c4b5fd', textTransform: 'uppercase' }}>
              Kanagawa Quest Album
            </div>
            <div style={{ fontSize: 24, fontWeight: 950, lineHeight: 1.05, marginTop: 5 }}>
              Quest Home
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              borderRadius: 999,
              padding: '7px 10px',
              fontSize: 11,
              fontWeight: 850,
              cursor: 'pointer',
            }}
          >
            Map
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: 12 }}>
          <div>
            <div style={{ fontSize: 38, fontWeight: 950, lineHeight: 1 }}>
              {progress.completedCount}<span style={{ color: '#c4b5fd' }}>/{progress.totalQuestCount}</span>
            </div>
            <div style={{ fontSize: 12, color: '#ddd6fe', fontWeight: 800, marginTop: 3 }}>
              quests cleared · {albumEntries.length} album memories
            </div>
          </div>
          <div style={{ fontSize: 26 }}>🎫</div>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.18)', overflow: 'hidden', marginTop: 12 }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg,#fbbf24,#f472b6)', borderRadius: 99 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, borderBottom: '1px solid #ede9fe' }}>
        <button
          type="button"
          onClick={onShowAlbum}
          style={{ border: 'none', borderRadius: 14, background: '#ede9fe', color: THEME_DARK, fontSize: 13, fontWeight: 900, padding: '10px 12px', cursor: 'pointer' }}
        >
          View Album
        </button>
        <button
          type="button"
          onClick={onShowAlbumMap}
          style={{ border: 'none', borderRadius: 14, background: '#111827', color: '#fff', fontSize: 13, fontWeight: 900, padding: '10px 12px', cursor: 'pointer' }}
        >
          Album Map
        </button>
      </div>

      <div style={{ padding: 12, overflowY: 'auto' }}>
        {questSets.length === 0 ? (
          <div style={{ padding: 18, borderRadius: 16, background: '#f8fafc', color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
            Curated Quest Data is not ready yet. Add one to three quests to a spot to start the album flow.
          </div>
        ) : questSets.map(questSet => (
          <article key={questSet.spot.id} style={{
            border: '1px solid #ede9fe',
            borderRadius: 18,
            padding: 12,
            marginBottom: 10,
            background: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 950, color: '#111827', lineHeight: 1.25 }}>
                  {questSet.spot.spot_name_en}
                </div>
                <div style={{ fontSize: 11, fontWeight: 850, color: THEME, marginTop: 2 }}>
                  {questSet.spot.anime_title_en}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onStartQuest(questSet.spot)}
                style={{
                  flexShrink: 0,
                  border: 'none',
                  borderRadius: 999,
                  background: '#f5f3ff',
                  color: THEME_DARK,
                  padding: '6px 9px',
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Start
              </button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {questSet.quests.map((quest, questIndex) => {
                const questKey = getQuestKey(questSet.spot.id, questIndex)
                const isDone = albumEntries.some(entry => entry.questKey === questKey)
                const isUploading = uploadingQuestKey === questKey
                return (
                  <div key={questKey} style={{
                    borderRadius: 14,
                    border: `1px solid ${isDone ? '#bbf7d0' : '#e5e7eb'}`,
                    background: isDone ? '#ecfdf5' : '#f8fafc',
                    padding: 10,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 900, color: isDone ? '#15803d' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {isDone ? 'Quest Clear!' : quest.category}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#111827', marginTop: 2 }}>
                          {quest.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45, marginTop: 4 }}>
                          {quest.photoPrompt}
                        </div>
                      </div>
                      <span style={{ fontSize: 20 }}>{isDone ? '✅' : '📸'}</span>
                    </div>
                    {!isDone && (
                      <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                        <input
                          type="text"
                          value={impressions[questKey] || ''}
                          onChange={e => setImpressions(prev => ({ ...prev, [questKey]: e.target.value }))}
                          placeholder={quest.impressionPrompt}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            border: '1px solid #e5e7eb',
                            borderRadius: 10,
                            padding: '8px 9px',
                            fontSize: 12,
                          }}
                        />
                        <label style={{
                          display: 'block',
                          textAlign: 'center',
                          borderRadius: 12,
                          background: isUploading ? '#9ca3af' : THEME,
                          color: '#fff',
                          padding: '9px 10px',
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: isUploading ? 'default' : 'pointer',
                        }}>
                          {isUploading ? 'Saving Album Photo...' : 'Upload Photo'}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploading}
                            onChange={e => handleFile(questSet, quest, questIndex, e.target.files?.[0])}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function AlbumEntryCard({ entry, onEditImpression, onReplacePhoto, onDelete, onShare }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.impression || '')

  useEffect(() => {
    setDraft(entry.impression || '')
  }, [entry.impression])

  return (
    <article style={{
      border: '1px solid #e5e7eb',
      borderRadius: 18,
      background: '#fff',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {entry.albumPhoto?.dataUrl && (
        <img
          src={entry.albumPhoto.dataUrl}
          alt={entry.questTitle}
          style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }}
        />
      )}
      <div style={{ padding: 13 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#16a34a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Quest Clear · Stamp acquired
        </div>
        <div style={{ fontSize: 16, fontWeight: 950, color: '#111827', marginTop: 4 }}>
          {entry.questTitle}
        </div>
        <div style={{ fontSize: 12, color: THEME, fontWeight: 850, marginTop: 2 }}>
          {entry.animeTitle}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
          {entry.spotName} · {formatCompletionTime(entry.completedAt)}
        </div>

        {editing ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={3}
              placeholder="Add an optional comment"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 10, padding: 9, fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { onEditImpression(entry.id, draft); setEditing(false) }}
                style={{ flex: 1, border: 'none', borderRadius: 10, background: THEME, color: '#fff', padding: 9, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setDraft(entry.impression || ''); setEditing(false) }}
                style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', color: '#64748b', padding: 9, fontSize: 12, fontWeight: 850, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: entry.impression ? '#334155' : '#94a3b8', lineHeight: 1.55, marginTop: 10 }}>
            {entry.impression || 'No comment yet.'}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => setEditing(true)} style={{ border: 'none', borderRadius: 10, background: '#f5f3ff', color: THEME_DARK, padding: 9, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
            Edit Comment
          </button>
          <label style={{ textAlign: 'center', border: 'none', borderRadius: 10, background: '#eef2ff', color: '#3730a3', padding: 9, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
            Change Photo
            <input
              type="file"
              accept="image/*"
              onChange={e => onReplacePhoto(entry.id, e.target.files?.[0])}
              style={{ display: 'none' }}
            />
          </label>
          <button type="button" onClick={() => onShare(entry)} style={{ border: 'none', borderRadius: 10, background: '#111827', color: '#fff', padding: 9, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
            Share Card
          </button>
          <button type="button" onClick={() => onDelete(entry.id)} style={{ border: '1px solid #fecaca', borderRadius: 10, background: '#fff1f2', color: '#be123c', padding: 9, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

function QuestAlbumPanel({ entries, onClose, onShowMap, onEditImpression, onReplacePhoto, onDelete, onShare }) {
  return (
    <section style={{
      position: 'fixed',
      inset: '58px 10px 84px',
      maxWidth: 460,
      margin: '0 auto',
      zIndex: 2700,
      background: 'rgba(248,250,252,0.98)',
      border: '1px solid #e5e7eb',
      borderRadius: 22,
      boxShadow: '0 18px 50px rgba(17,24,39,0.22)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }} aria-label="Local Quest Album">
      <div style={{ padding: 14, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: THEME, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Local Quest Album
          </div>
          <div style={{ fontSize: 20, fontWeight: 950, color: '#111827', marginTop: 2 }}>
            {entries.length} memories
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button type="button" onClick={onShowMap} style={{ border: 'none', borderRadius: 999, background: '#111827', color: '#fff', padding: '8px 11px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
            Map
          </button>
          <button type="button" onClick={onClose} style={{ border: '1px solid #e5e7eb', borderRadius: 999, background: '#fff', color: '#475569', padding: '8px 11px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
      <div style={{ padding: 12, overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div style={{ padding: 18, borderRadius: 16, background: '#fff', color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
            No album memories yet. Clear a Photo Quest from Quest Home to add your first Quest Stamp.
          </div>
        ) : entries.map(entry => (
          <AlbumEntryCard
            key={entry.id}
            entry={entry}
            onEditImpression={onEditImpression}
            onReplacePhoto={onReplacePhoto}
            onDelete={onDelete}
            onShare={onShare}
          />
        ))}
      </div>
    </section>
  )
}

function AlbumMapMarker({ entry, onSelect }) {
  if (typeof entry.lat !== 'number' || typeof entry.lng !== 'number') return null
  return (
    <Marker
      position={{ lat: entry.lat, lng: entry.lng }}
      title={entry.questTitle}
      label={{ text: '✓', color: '#fff', fontWeight: '900' }}
      zIndex={180}
      icon={window.google?.maps ? {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#16a34a',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
        scale: 10,
      } : undefined}
      onClick={() => onSelect(entry)}
    />
  )
}

function ShareCardPreview({ dataUrl, onClose }) {
  if (!dataUrl) return null
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9800,
      background: 'rgba(15,23,42,0.78)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    }}>
      <div style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.32)' }}>
        <img src={dataUrl} alt="Generated Share Card" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <a
            href={dataUrl}
            download="seichi-map-share-card.jpg"
            style={{ textAlign: 'center', textDecoration: 'none', borderRadius: 12, background: THEME, color: '#fff', padding: 10, fontSize: 13, fontWeight: 900 }}
          >
            Download
          </a>
          <button type="button" onClick={onClose} style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', color: '#475569', padding: 10, fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function loadImageForCanvas(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load share card image'))
    image.src = src
  })
}

async function generateShareCard(entry) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(44, 44, 992, 1262)

  if (entry.albumPhoto?.dataUrl) {
    const image = await loadImageForCanvas(entry.albumPhoto.dataUrl)
    const target = { x: 84, y: 84, width: 912, height: 700 }
    const sourceRatio = image.width / image.height
    const targetRatio = target.width / target.height
    let sx = 0
    let sy = 0
    let sw = image.width
    let sh = image.height
    if (sourceRatio > targetRatio) {
      sw = image.height * targetRatio
      sx = (image.width - sw) / 2
    } else {
      sh = image.width / targetRatio
      sy = (image.height - sh) / 2
    }
    ctx.drawImage(image, sx, sy, sw, sh, target.x, target.y, target.width, target.height)
  }

  ctx.fillStyle = '#4c1d95'
  ctx.fillRect(84, 820, 180, 42)
  ctx.fillStyle = '#fff'
  ctx.font = '700 24px system-ui, sans-serif'
  ctx.fillText('Quest Clear', 105, 849)

  ctx.fillStyle = '#111827'
  ctx.font = '800 52px system-ui, sans-serif'
  ctx.fillText(entry.questTitle || 'Kanagawa Quest', 84, 930, 900)
  ctx.fillStyle = '#7c3aed'
  ctx.font = '700 32px system-ui, sans-serif'
  ctx.fillText(entry.animeTitle || 'seichi-map', 84, 986, 900)
  ctx.fillStyle = '#475569'
  ctx.font = '600 28px system-ui, sans-serif'
  ctx.fillText(entry.spotName || 'Kanagawa', 84, 1034, 900)

  if (entry.impression) {
    ctx.fillStyle = '#334155'
    ctx.font = '500 30px system-ui, sans-serif'
    ctx.fillText(`"${entry.impression}"`, 84, 1110, 900)
  }

  ctx.fillStyle = '#111827'
  ctx.font = '800 28px system-ui, sans-serif'
  ctx.fillText('seichi-map Kanagawa Quest Album', 84, 1238)
  ctx.fillStyle = '#16a34a'
  ctx.font = '800 24px system-ui, sans-serif'
  ctx.fillText('Stamp acquired', 760, 1238)

  return canvas.toDataURL('image/jpeg', 0.9)
}

// ── App ───────────────────────────────────────────────────────────────────
function App() {
  const [spots, setSpots]               = useState([])
  const [touristSpots, setTouristSpots] = useState([])
  const [selected, setSelected]         = useState(null)
  const [cardExpanded, setCardExpanded] = useState(false)
  const [nearbySpots, setNearbySpots]   = useState([])
  const [selectedTourist, setSelectedTourist] = useState(null)


  const [demoMode, setDemoMode]         = useState(false)
  const [playing, setPlaying]           = useState(false)
  const [startPos, setStartPos]         = useState(null)   // デモ中心点
  const [startPosMode, setStartPosMode] = useState(false)  // 位置指定待ち
  const [demoPos, setDemoPos]           = useState(null)   // 擬似マーカー位置

  const triggeredRef = useRef(new Set())
  const [locateTick, setLocateTick] = useState(0)

  // Location permission is shown only after a location-based dashboard choice.
  // This keeps browser permission requests tied to an explicit user intent.
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false)
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)
  const [gpsConsented, setGpsConsented] = useState(
    () => { try { return !!localStorage.getItem(LOCATION_CONSENTED_KEY) } catch { return false } }
  )

  const { pos: livePos, status: gpsStatus } = useLiveGPS(!demoMode && gpsConsented)
  const { heading, requestPermission } = useDeviceHeading()

  // activePos / browsingPos を先に宣言して、以降のすべての useEffect deps で TDZ にならないようにする
  const activePos = demoMode ? demoPos : livePos
  const browsingPos = activePos || YOKOHAMA_STATION

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
    setShowLocationPrompt(false)
  }, [requestPermission])

  const handleLocationSkip = useCallback(() => {
    setLocationPermissionAsked(true)
    setShowLocationPrompt(false)
    setDemoMode(true)
    setStartPos(YOKOHAMA_STATION)
    setDemoPos(YOKOHAMA_STATION)
    setPlaying(false)
  }, [])

  useEffect(() => {
    const el = document.getElementById('splash')
    if (!el) return
    const t = setTimeout(() => {
      el.style.opacity = '0'
      el.addEventListener('transitionend', () => el.remove(), { once: true })
    }, 3000)
    return () => clearTimeout(t)
  }, [])

  const [gpsReady, setGpsReady] = useState(false)
  useEffect(() => {
    if (demoMode || !gpsConsented) { setGpsReady(true); return }
    if (gpsStatus === 'ok' || gpsStatus === 'error') { setGpsReady(true); return }
    setGpsReady(false)
    const t = setTimeout(() => setGpsReady(true), 8000)
    return () => clearTimeout(t)
  }, [gpsStatus, demoMode, gpsConsented])

  const [userPrefs, setUserPrefs]   = useState(() => loadPrefs())
  const [showSurvey, setShowSurvey] = useState(() => ENABLE_ONBOARDING_SURVEY && !loadPrefs())
  const [showSettings, setShowSettings] = useState(false)
  const [mapTheme, setMapTheme] = useState(loadMapTheme)
  const [weatherOverride, setWeatherOverride] = useState(null)
  const wxPos = demoMode ? startPos : livePos
  const autoWeather = useAutoWeather(wxPos, weatherOverride !== null)
  const weather = weatherOverride ?? autoWeather ?? 'sunny'

  const [journalTarget, setJournalTarget] = useState(null)
  const [showJournal, setShowJournal]     = useState(false)
  const [journaledIds, setJournaledIds]   = useState(new Set())

  useEffect(() => {
    jdbGetAll().then(all => setJournaledIds(new Set(all.map(e => e.spotId))))
  }, [])

  const refreshJournaledIds = useCallback(() => {
    jdbGetAll().then(all => setJournaledIds(new Set(all.map(e => e.spotId))))
  }, [])

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
    setShowSurvey(ENABLE_ONBOARDING_SURVEY)
  }

  const [searchQuery, setSearchQuery]         = useState('')
  const [searchAnime, setSearchAnime]         = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showSpotList, setShowSpotList]       = useState(false)
  const [animateSearch, setAnimateSearch]     = useState(false)
  const searchInputRef = useRef(null)

  // ── スタンプラリー state ─────────────────────────────────────────────────
  const stampCardGeneratedRef               = useRef(false)
  const [stampCardIds, setStampCardIds]     = useState(() => { const s = loadStampCard(); return s?.length > 0 ? s : null })
  const [acquiredStamps, setAcquiredStamps] = useState(() => loadStamps())
  const [showStampCard, setShowStampCard]   = useState(false)
  const [activeMission, setActiveMission]   = useState(null)  // 現在表示中のミッション対象スポット
  const [questAlbum, setQuestAlbum] = useState(() => loadLocalQuestAlbum())
  const [questHomeOpen, setQuestHomeOpen] = useState(true)
  const [questAlbumOpen, setQuestAlbumOpen] = useState(false)
  const [albumMapMode, setAlbumMapMode] = useState(false)
  const [selectedAlbumEntry, setSelectedAlbumEntry] = useState(null)
  const [uploadingQuestKey, setUploadingQuestKey] = useState(null)
  const [shareCardDataUrl, setShareCardDataUrl] = useState(null)

  const questSets = useMemo(() => buildQuestSets(spots), [spots])
  const totalQuestCount = useMemo(() => getTotalQuestCount(questSets), [questSets])
  const questProgress = useMemo(
    () => calculateQuestProgress(totalQuestCount, questAlbum),
    [totalQuestCount, questAlbum],
  )

  const handleQuestPhotoUpload = useCallback(async (spot, quest, questIndex, file, impression) => {
    if (!file) return
    const questKey = getQuestKey(spot.id, questIndex)
    setUploadingQuestKey(questKey)
    try {
      const albumPhoto = await createAlbumPhotoFromFile(file)
      const nextAlbum = addAlbumEntry({
        questKey,
        spotId: spot.id,
        questIndex,
        animeTitle: spot.anime_title_en,
        spotName: spot.spot_name_en,
        questTitle: quest.title,
        area: spot.area || '',
        lat: spot.lat,
        lng: spot.lng,
        albumPhoto,
        impression,
      })
      setQuestAlbum(nextAlbum)
      setSelectedAlbumEntry(nextAlbum.entries.find(entry => entry.questKey === questKey) || null)
      setAlbumMapMode(true)
    } finally {
      setUploadingQuestKey(null)
    }
  }, [])

  const handleEditAlbumImpression = useCallback((entryId, impression) => {
    setQuestAlbum(updateAlbumEntry(entryId, { impression }))
  }, [])

  const handleReplaceAlbumPhoto = useCallback(async (entryId, file) => {
    if (!file) return
    const albumPhoto = await createAlbumPhotoFromFile(file)
    setQuestAlbum(updateAlbumEntry(entryId, { albumPhoto }))
  }, [])

  const handleDeleteAlbumEntry = useCallback((entryId) => {
    const nextAlbum = deleteAlbumEntry(entryId)
    setQuestAlbum(nextAlbum)
    setSelectedAlbumEntry(prev => prev?.id === entryId ? null : prev)
  }, [])

  const handleShareAlbumEntry = useCallback(async (entry) => {
    const dataUrl = await generateShareCard(entry)
    setShareCardDataUrl(dataUrl)
  }, [])

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


  // ── スタンプカード生成（spots読み込み後に一度だけ実行） ────────────────────
  // 半径フィルタなし：距離順で近い順に最大 STAMP_CARD_SIZE 件を選ぶ
  useEffect(() => {
    if (stampCardIds?.length > 0 || stampCardGeneratedRef.current || !spots.length) return
    stampCardGeneratedRef.current = true
    const refPos = browsingPos
    const card = spots
      .map(s => ({ spot: s, dist: haversine(refPos, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, STAMP_CARD_SIZE)
      .map(({ spot }) => spot.id)
    setStampCardIds(card)
    saveStampCard(card)
  }, [spots]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ミッション発動（MISSION_TRIGGER_METERS 以内に未取得スタンプスポットが来たら表示） ──
  // ミッション中は新規発動しない。完了後に再判定する。
  useEffect(() => {
    if (!activePos || !stampCardIds?.length || activeMission) return
    const nearest = spots
      .filter(s =>
        stampCardIds.includes(s.id) &&
        !acquiredStamps.has(s.id) &&
        haversine(activePos, { lat: s.lat, lng: s.lng }) <= MISSION_TRIGGER_METERS
      )
      .map(s => ({ ...s, dist: haversine(activePos, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.dist - b.dist)[0]
    if (nearest) setActiveMission(nearest)
  }, [activePos, stampCardIds, spots, acquiredStamps, activeMission]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ミッション完了 → スタンプ付与 ─────────────────────────────────────
  const handleMissionComplete = useCallback(() => {
    if (!activeMission) return
    const completedSpot = activeMission
    setAcquiredStamps(prev => {
      const next = new Set([...prev, activeMission.id])
      saveStamps(next)
      return next
    })
    setActiveMission(null)
    setJournalTarget(completedSpot)
  }, [activeMission])

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

  // activePos / browsingPos はファイル先頭で宣言済み

  // スタンプ未収集の中で最も近いスポット
  const nearestUnstampedSpot = useMemo(() => {
    if (!stampCardIds?.length || !spots.length) return null
    return spots
      .filter(s => stampCardIds.includes(s.id) && !acquiredStamps.has(s.id))
      .map(s => ({ ...s, dist: haversine(browsingPos, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.dist - b.dist)[0] ?? null
  }, [stampCardIds, acquiredStamps, spots, browsingPos])

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


  const closeCard = useCallback(() => {
    setSelected(null)
    setCardExpanded(false)
  }, [])

  const handleReset = () => {
    setPlaying(false)
    setDemoPos(null)
    setStartPos(null)
    setStartPosMode(false)
    triggeredRef.current.clear()
    setSelected(null)
    setCardExpanded(false)
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
          defaultCenter={KANAGAWA_CENTER}
          defaultZoom={10}
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
              onClick={() => { setSelectedTourist(t); closeCard() }}
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
          {albumMapMode && questAlbum.entries.map(entry => (
            <AlbumMapMarker
              key={entry.id}
              entry={entry}
              onSelect={setSelectedAlbumEntry}
            />
          ))}
          {albumMapMode && selectedAlbumEntry && typeof selectedAlbumEntry.lat === 'number' && typeof selectedAlbumEntry.lng === 'number' && (
            <InfoWindow
              position={{ lat: selectedAlbumEntry.lat, lng: selectedAlbumEntry.lng }}
              onCloseClick={() => setSelectedAlbumEntry(null)}
            >
              <div style={{ width: 210, color: '#111827' }}>
                {selectedAlbumEntry.albumPhoto?.dataUrl && (
                  <img
                    src={selectedAlbumEntry.albumPhoto.dataUrl}
                    alt={selectedAlbumEntry.questTitle}
                    style={{ width: '100%', height: 92, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }}
                  />
                )}
                <div style={{ fontSize: 11, fontWeight: 900, color: '#16a34a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Quest Clear
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>
                  {selectedAlbumEntry.questTitle}
                </div>
                <div style={{ fontSize: 12, color: THEME, fontWeight: 800, marginTop: 2 }}>
                  {selectedAlbumEntry.animeTitle}
                </div>
                {selectedAlbumEntry.impression && (
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 1.4 }}>
                    {selectedAlbumEntry.impression}
                  </div>
                )}
              </div>
            </InfoWindow>
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
            ref={searchInputRef}
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
            position: 'absolute', top: '100%', right: 0, width: 230, marginTop: 6,
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 16, overflow: 'hidden', zIndex: 2001,
            boxShadow: '0 4px 6px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.18)',
            border: '1px solid rgba(255,255,255,0.8)',
          }}>
            {suggestions.slice(0, 6).map((title, i) => (
              <div
                key={title}
                onMouseDown={e => { e.preventDefault(); handleAnimeSelect(title) }}
                onTouchEnd={() => handleAnimeSelect(title)}
                style={{
                  padding: '11px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  color: '#1f2937',
                  borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}
              >{title}</div>
            ))}
          </div>
        )}
        {showSpotList && searchAnime && searchAnimeSpots.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, width: 290, maxWidth: 'calc(100vw - 16px)',
            maxHeight: 280, marginTop: 6,
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 16, overflowY: 'auto', zIndex: 2001,
            boxShadow: '0 4px 6px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.18)',
            border: '1px solid rgba(255,255,255,0.8)',
          }}>
            <div style={{
              padding: '9px 14px', fontSize: 10, fontWeight: 800,
              color: '#9ca3af', borderBottom: '1px solid #f3f4f6',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {searchAnimeSpots.length} spots
            </div>
            {searchAnimeSpots.map((spot, i) => (
              <button
                key={spot.id}
                onMouseDown={e => { e.preventDefault(); handleSearchSpotSelect(spot) }}
                onTouchEnd={() => handleSearchSpotSelect(spot)}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'transparent', border: 'none',
                  borderBottom: i < searchAnimeSpots.length - 1 ? '1px solid #f9fafb' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 13, color: '#111827', fontWeight: 700, lineHeight: 1.35 }}>
                  {spot.spot_name_en}
                </div>
                {spot.area && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{spot.area}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* コントロールバー */}
      <div style={{
        position: 'absolute', bottom: 32, left: 12,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 26, padding: '7px 12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid rgba(255,255,255,0.9)',
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

        {/* ジャーナルボタン */}
        <button
          onClick={() => setShowJournal(true)}
          title="Journal"
          style={{
            width: 30, height: 30, borderRadius: 10,
            background: 'rgba(0,0,0,0.06)', border: 'none',
            cursor: 'pointer', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >📔</button>

        <button
          onClick={() => {
            setQuestHomeOpen(true)
            setQuestAlbumOpen(false)
          }}
          title="Quest Home"
          style={{
            height: 30, padding: '0 10px', borderRadius: 10,
            border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 800,
            background: questHomeOpen ? '#ede9ff' : 'rgba(0,0,0,0.06)',
            color: questHomeOpen ? THEME : '#555',
            letterSpacing: '0.04em',
          }}
        >🎫 Quest</button>

        <button
          onClick={() => {
            setQuestAlbumOpen(true)
            setQuestHomeOpen(false)
          }}
          title="Quest Album"
          style={{
            height: 30, padding: '0 10px', borderRadius: 10,
            border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 800,
            background: questAlbumOpen ? '#dcfce7' : 'rgba(0,0,0,0.06)',
            color: questAlbumOpen ? '#166534' : '#555',
            letterSpacing: '0.04em',
          }}
        >✅ {questProgress.completedCount}/{questProgress.totalQuestCount || 0}</button>

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
        <Card spot={selected} currentPos={browsingPos} onClose={closeCard} userPrefs={userPrefs} isFavorite={favorites.has(selected.id)} onToggleFavorite={toggleFavorite} weather={weather} defaultExpanded={true} />
      )}
      {questHomeOpen && (
        <QuestHomePanel
          questSets={questSets}
          progress={questProgress}
          albumEntries={questAlbum.entries}
          uploadingQuestKey={uploadingQuestKey}
          onStartQuest={spot => {
            handleSpotSelect(spot)
            setQuestHomeOpen(false)
          }}
          onShowAlbum={() => {
            setQuestAlbumOpen(true)
            setQuestHomeOpen(false)
          }}
          onShowAlbumMap={() => {
            setAlbumMapMode(true)
            setQuestHomeOpen(false)
            setQuestAlbumOpen(false)
          }}
          onUploadQuestPhoto={handleQuestPhotoUpload}
          onClose={() => setQuestHomeOpen(false)}
        />
      )}
      {questAlbumOpen && (
        <QuestAlbumPanel
          entries={questAlbum.entries}
          onClose={() => setQuestAlbumOpen(false)}
          onShowMap={() => {
            setAlbumMapMode(true)
            setQuestAlbumOpen(false)
          }}
          onEditImpression={handleEditAlbumImpression}
          onReplacePhoto={handleReplaceAlbumPhoto}
          onDelete={handleDeleteAlbumEntry}
          onShare={handleShareAlbumEntry}
        />
      )}
      <ShareCardPreview
        dataUrl={shareCardDataUrl}
        onClose={() => setShareCardDataUrl(null)}
      />
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

      {/* 位置情報・コンパス許可カード（Near me 選択後のみ） */}
      {!demoMode && showLocationPrompt && !locationPermissionAsked && (
        <LocationPermissionCard onAllow={handleLocationAllow} onSkip={handleLocationSkip} />
      )}

      {/* スタンプラリー：ミニバー（地図表示中に常時表示） */}
      {!showStampCard && stampCardIds?.length > 0 && (
        <StampMinibar
          total={stampCardIds.length}
          collected={[...acquiredStamps].filter(id => stampCardIds.includes(id)).length}
          onTap={() => setShowStampCard(true)}
        />
      )}

      {/* 未収集スタンプ最近接バー（カード非展開・ミッション非表示時のみ） */}
      {!showStampCard && !cardExpanded && !activeMission && nearestUnstampedSpot && (
        <NearestStampBar
          spot={nearestUnstampedSpot}
          onTap={() => handleSpotSelect(nearestUnstampedSpot)}
        />
      )}

      {/* ミッション画面（スタンプカード非表示時のみ） */}
      {activeMission && !showStampCard && (
        <MissionScreen
          spot={activeMission}
          onComplete={handleMissionComplete}
        />
      )}

      {/* スタンプラリー：全画面カード */}
      {showStampCard && (
        <StampCardScreen
          spots={spots}
          stampCardIds={stampCardIds}
          acquiredStamps={acquiredStamps}
          onClose={() => {
            setShowStampCard(false)
            if (!gpsConsented && !locationPermissionAsked) setShowLocationPrompt(true)
          }}
          onOpenJournal={spot => { setShowStampCard(false); setJournalTarget(spot) }}
          journaledIds={journaledIds}
        />
      )}

      {/* ジャーナル一覧 */}
      {showJournal && (
        <JournalViewer
          spots={spots}
          onOpenEditor={spot => { setShowJournal(false); setJournalTarget(spot) }}
          onClose={() => setShowJournal(false)}
        />
      )}

      {/* ジャーナルエディター */}
      {journalTarget && (
        <JournalEditor
          spot={journalTarget}
          onSave={() => { setJournalTarget(null); refreshJournaledIds() }}
          onSkip={() => setJournalTarget(null)}
        />
      )}

      {ENABLE_ONBOARDING_SURVEY && showSurvey && (
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
