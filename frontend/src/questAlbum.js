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

function getStorage(storage) {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  return window.localStorage
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

export function loadLocalQuestAlbum(storage) {
  const localStorage = getStorage(storage)
  if (!localStorage) return createEmptyQuestAlbum()

  try {
    const raw = localStorage.getItem(LOCAL_QUEST_ALBUM_KEY)
    return normalizeQuestAlbum(raw ? JSON.parse(raw) : null)
  } catch {
    return createEmptyQuestAlbum()
  }
}

export function saveLocalQuestAlbum(album, storage) {
  const localStorage = getStorage(storage)
  const normalized = normalizeQuestAlbum(album)
  if (!localStorage) return normalized

  try {
    localStorage.setItem(LOCAL_QUEST_ALBUM_KEY, JSON.stringify(normalized))
  } catch {
    // Browsers can reject localStorage writes in private mode or when quota is full.
  }
  return normalized
}

export function loadLegacyQuestCompletions(storage) {
  const localStorage = getStorage(storage)
  if (!localStorage) return new Set()

  try {
    const raw = localStorage.getItem(LEGACY_QUEST_COMPLETIONS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveLegacyQuestCompletions(completions, storage) {
  const localStorage = getStorage(storage)
  if (!localStorage) return

  try {
    localStorage.setItem(LEGACY_QUEST_COMPLETIONS_KEY, JSON.stringify([...completions]))
  } catch {
    // Keep quest completion updates non-fatal when localStorage is unavailable.
  }
}

export function loadQuestCompletions(storage) {
  const album = loadLocalQuestAlbum(storage)
  return new Set([...loadLegacyQuestCompletions(storage), ...album.completions])
}

export function saveQuestCompletions(completions, storage) {
  const completionSet = new Set(completions)
  const album = loadLocalQuestAlbum(storage)
  const nextAlbum = {
    ...album,
    completions: [...completionSet],
    stamps: [...completionSet],
    entries: album.entries.filter(entry => completionSet.has(entry.questKey)),
  }

  saveLegacyQuestCompletions(completionSet, storage)
  return saveLocalQuestAlbum(nextAlbum, storage)
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
    impression: input.impression || '',
    questStamp,
  }
}

export function addAlbumEntry(input, storage) {
  const entry = createAlbumEntry(input)
  const album = loadLocalQuestAlbum(storage)
  const entries = album.entries.filter(existing => existing.questKey !== entry.questKey)
  const completions = new Set(album.completions)
  const stamps = new Set(album.stamps)

  completions.add(entry.questKey)
  stamps.add(entry.questKey)

  const savedAlbum = saveLocalQuestAlbum({
    ...album,
    entries: [...entries, entry],
    completions: [...completions],
    stamps: [...stamps],
  }, storage)
  saveLegacyQuestCompletions(new Set(savedAlbum.completions), storage)
  return savedAlbum
}

export function updateAlbumEntry(entryId, updates, storage) {
  const album = loadLocalQuestAlbum(storage)
  const entries = album.entries.map(entry => (
    entry.id === entryId
      ? {
          ...entry,
          ...updates,
          id: entry.id,
          questKey: entry.questKey,
          questStamp: entry.questStamp,
        }
      : entry
  ))

  return saveLocalQuestAlbum({
    ...album,
    entries,
  }, storage)
}

export function deleteAlbumEntry(entryId, storage) {
  const album = loadLocalQuestAlbum(storage)
  const removedEntry = album.entries.find(entry => entry.id === entryId)
  if (!removedEntry) return album

  const entries = album.entries.filter(entry => entry.id !== entryId)
  const completions = album.completions.filter(questKey => questKey !== removedEntry.questKey)
  const stamps = album.stamps.filter(questKey => questKey !== removedEntry.questKey)

  const savedAlbum = saveLocalQuestAlbum({
    ...album,
    entries,
    completions,
    stamps,
  }, storage)
  saveLegacyQuestCompletions(new Set(savedAlbum.completions), storage)
  return savedAlbum
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
