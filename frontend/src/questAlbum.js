export const LOCAL_QUEST_ALBUM_KEY = 'seichi_local_quest_album_v1'
export const LEGACY_QUEST_COMPLETIONS_KEY = 'seichi_quest_completions'

export function getQuestKey(spotId, questIndex) {
  return `${spotId}:${questIndex}`
}

export function createEmptyQuestAlbum() {
  return {
    version: 1,
    entries: [],
    completions: [],
    stamps: [],
  }
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

export function normalizeQuestAlbum(value) {
  if (!value || typeof value !== 'object') return createEmptyQuestAlbum()

  const entries = Array.isArray(value.entries)
    ? value.entries.filter(entry => entry && typeof entry === 'object' && typeof entry.id === 'string')
    : []

  const completionSet = new Set([
    ...normalizeStringArray(value.completions),
    ...entries.map(entry => entry.questKey).filter(Boolean),
  ])
  const stampSet = new Set([
    ...normalizeStringArray(value.stamps),
    ...entries.map(entry => entry.questStamp?.questKey || entry.questKey).filter(Boolean),
  ])

  return {
    version: 1,
    entries,
    completions: [...completionSet],
    stamps: [...stampSet],
  }
}

// ── IndexedDB ─────────────────────────────────────────────────────────────
const QA_DB_NAME = 'seichi_quest_album'
const QA_DB_STORE = 'data'
let memoryAlbum = createEmptyQuestAlbum()

function openQADB() {
  return new Promise((res, rej) => {
    const r = globalThis.indexedDB.open(QA_DB_NAME, 1)
    r.onupgradeneeded = e => e.target.result.createObjectStore(QA_DB_STORE)
    r.onsuccess = e => res(e.target.result)
    r.onerror = e => rej(e.target.error)
  })
}

async function qadbLoad() {
  if (!globalThis.indexedDB) return normalizeQuestAlbum(memoryAlbum)
  const db = await openQADB()
  return new Promise((res, rej) => {
    const tx = db.transaction(QA_DB_STORE, 'readonly')
    const r = tx.objectStore(QA_DB_STORE).get('album')
    r.onsuccess = e => res(normalizeQuestAlbum(e.target.result ?? null))
    r.onerror = e => rej(e.target.error)
  })
}

async function qadbSave(album) {
  const normalized = normalizeQuestAlbum(album)
  if (!globalThis.indexedDB) {
    memoryAlbum = normalized
    return normalized
  }
  const db = await openQADB()
  return new Promise((res, rej) => {
    const tx = db.transaction(QA_DB_STORE, 'readwrite')
    tx.objectStore(QA_DB_STORE).put(normalized, 'album')
    tx.oncomplete = () => res(normalized)
    tx.onerror = e => rej(e.target.error)
  })
}

// localStorage からの一回限りの移行
async function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_QUEST_ALBUM_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    const album = normalizeQuestAlbum(parsed)
    if (album.entries.length > 0 || album.completions.length > 0) {
      await qadbSave(album)
    }
    localStorage.removeItem(LOCAL_QUEST_ALBUM_KEY)
    localStorage.removeItem(LEGACY_QUEST_COMPLETIONS_KEY)
  } catch {
    // 移行失敗は無視
  }
}

let _migratedOnce = false

export async function loadLocalQuestAlbum() {
  if (!_migratedOnce) {
    _migratedOnce = true
    await migrateFromLocalStorage()
  }
  return qadbLoad()
}

export async function saveLocalQuestAlbum(album) {
  return qadbSave(album)
}

export async function loadQuestCompletions() {
  const album = await loadLocalQuestAlbum()
  return new Set(album.completions)
}

export async function saveQuestCompletions(completions) {
  const completionSet = new Set(completions)
  const album = await loadLocalQuestAlbum()
  const nextAlbum = {
    ...album,
    completions: [...completionSet],
    stamps: [...completionSet],
    entries: album.entries.filter(entry => completionSet.has(entry.questKey)),
  }
  return qadbSave(nextAlbum)
}

function createAlbumEntryId(questKey, completedAt) {
  const safeQuestKey = String(questKey).replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `${safeQuestKey}-${completedAt}`
}

export function createAlbumEntry(input) {
  const completedAt = input.completedAt || new Date().toISOString()
  const questKey = input.questKey || getQuestKey(input.spotId, input.questIndex)
  const questStamp = {
    questKey,
    awardedAt: completedAt,
  }

  return {
    id: input.id || createAlbumEntryId(questKey, completedAt),
    questKey,
    questId: input.questId || questKey,
    spotId: input.spotId,
    questIndex: input.questIndex,
    animeTitle: input.animeTitle,
    spotName: input.spotName,
    questTitle: input.questTitle,
    area: input.area || '',
    lat: input.lat,
    lng: input.lng,
    completedAt,
    albumPhoto: input.albumPhoto,
    questType: input.questType || input.quest_type || 'Photo',
    drivingLog: input.drivingLog,
    impression: input.impression || '',
    questStamp,
  }
}

export async function addAlbumEntry(input) {
  const entry = createAlbumEntry(input)
  const album = await loadLocalQuestAlbum()
  const entries = album.entries.filter(existing => existing.questKey !== entry.questKey)
  const completions = new Set(album.completions)
  const stamps = new Set(album.stamps)

  completions.add(entry.questKey)
  stamps.add(entry.questKey)

  return saveLocalQuestAlbum({
    ...album,
    entries: [...entries, entry],
    completions: [...completions],
    stamps: [...stamps],
  })
}

export async function updateAlbumEntry(entryId, updates) {
  const album = await loadLocalQuestAlbum()
  const entries = album.entries.map(entry => (
    entry.id === entryId
      ? { ...entry, ...updates, id: entry.id, questKey: entry.questKey, questStamp: entry.questStamp }
      : entry
  ))
  return saveLocalQuestAlbum({ ...album, entries })
}

export async function deleteAlbumEntry(entryId) {
  const album = await loadLocalQuestAlbum()
  const removedEntry = album.entries.find(entry => entry.id === entryId)
  if (!removedEntry) return album

  const entries = album.entries.filter(entry => entry.id !== entryId)
  const completions = album.completions.filter(questKey => questKey !== removedEntry.questKey)
  const stamps = album.stamps.filter(questKey => questKey !== removedEntry.questKey)

  return saveLocalQuestAlbum({ ...album, entries, completions, stamps })
}

export function calculateQuestProgress(totalQuestCount, albumOrCompletions) {
  const completedCount = albumOrCompletions instanceof Set
    ? albumOrCompletions.size
    : normalizeQuestAlbum(albumOrCompletions).completions.length

  return {
    completedCount,
    totalQuestCount,
    remainingCount: Math.max(totalQuestCount - completedCount, 0),
  }
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load image'))
    image.src = src
  })
}

export async function createAlbumPhotoFromFile(file, options = {}) {
  const maxEdge = options.maxEdge || 1400
  const quality = options.quality || 0.82
  const sourceDataUrl = await readFileAsDataUrl(file)

  if (typeof document === 'undefined') {
    return {
      dataUrl: sourceDataUrl,
      width: null,
      height: null,
      mimeType: file.type || 'image/jpeg',
      source: 'resized',
    }
  }

  const image = await loadImage(sourceDataUrl)
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return {
    dataUrl,
    width,
    height,
    mimeType: 'image/jpeg',
    source: 'resized',
  }
}
