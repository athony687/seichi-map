import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LOCAL_QUEST_ALBUM_KEY,
  addAlbumEntry,
  calculateQuestProgress,
  createAlbumEntry,
  deleteAlbumEntry,
  getQuestKey,
  loadLocalQuestAlbum,
} from './questAlbum.js'

function createMemoryStorage() {
  const data = new Map()
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

const albumPhoto = {
  dataUrl: 'data:image/webp;base64,album-photo',
  width: 1200,
  height: 900,
  mimeType: 'image/webp',
  source: 'resized',
}

test('creates an album entry with quest metadata and stamp state', () => {
  const entry = createAlbumEntry({
    spotId: 'enoshima-01',
    questIndex: 0,
    animeTitle: 'Tsuritama',
    spotName: 'Benzaiten Nakamise-dori',
    questTitle: 'Shopping Street Quest',
    completedAt: '2026-07-05T12:00:00.000Z',
    albumPhoto,
    impression: '',
  })

  assert.equal(entry.questKey, getQuestKey('enoshima-01', 0))
  assert.equal(entry.questStamp.questKey, entry.questKey)
  assert.equal(entry.questStamp.awardedAt, entry.completedAt)
  assert.equal(entry.albumPhoto.source, 'resized')
  assert.equal(Object.hasOwn(entry, 'originalPhoto'), false)
})

test('stores album entries, completions, and stamps on local storage', () => {
  const storage = createMemoryStorage()

  const album = addAlbumEntry({
    spotId: 'enoshima-01',
    questIndex: 0,
    animeTitle: 'Tsuritama',
    spotName: 'Benzaiten Nakamise-dori',
    questTitle: 'Shopping Street Quest',
    completedAt: '2026-07-05T12:00:00.000Z',
    albumPhoto,
  }, storage)

  assert.equal(album.entries.length, 1)
  assert.deepEqual(album.completions, ['enoshima-01:0'])
  assert.deepEqual(album.stamps, ['enoshima-01:0'])
  assert.ok(storage.getItem(LOCAL_QUEST_ALBUM_KEY))

  const loaded = loadLocalQuestAlbum(storage)
  assert.equal(loaded.entries[0].questTitle, 'Shopping Street Quest')
})

test('calculates quest progress from completed quests', () => {
  const progress = calculateQuestProgress(3, {
    version: 1,
    entries: [],
    completions: ['enoshima-01:0', 'enoshima-01:1'],
    stamps: ['enoshima-01:0', 'enoshima-01:1'],
  })

  assert.deepEqual(progress, {
    completedCount: 2,
    totalQuestCount: 3,
    remainingCount: 1,
  })
})

test('deleting an album entry removes completion and stamp state', () => {
  const storage = createMemoryStorage()
  const album = addAlbumEntry({
    spotId: 'enoshima-01',
    questIndex: 0,
    animeTitle: 'Tsuritama',
    spotName: 'Benzaiten Nakamise-dori',
    questTitle: 'Shopping Street Quest',
    completedAt: '2026-07-05T12:00:00.000Z',
    albumPhoto,
  }, storage)

  const next = deleteAlbumEntry(album.entries[0].id, storage)

  assert.equal(next.entries.length, 0)
  assert.deepEqual(next.completions, [])
  assert.deepEqual(next.stamps, [])
})
