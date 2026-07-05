import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addAlbumEntry,
  calculateQuestProgress,
  createEmptyQuestAlbum,
  createAlbumEntry,
  deleteAlbumEntry,
  getQuestKey,
  loadLocalQuestAlbum,
  saveLocalQuestAlbum,
  updateAlbumEntry,
} from './questAlbum.js'

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

test('stores album entries, completions, and stamps', async () => {
  await saveLocalQuestAlbum(createEmptyQuestAlbum())

  const album = await addAlbumEntry({
    spotId: 'enoshima-01',
    questIndex: 0,
    animeTitle: 'Tsuritama',
    spotName: 'Benzaiten Nakamise-dori',
    questTitle: 'Shopping Street Quest',
    completedAt: '2026-07-05T12:00:00.000Z',
    albumPhoto,
  })

  assert.equal(album.entries.length, 1)
  assert.deepEqual(album.completions, ['enoshima-01:0'])
  assert.deepEqual(album.stamps, ['enoshima-01:0'])

  const loaded = await loadLocalQuestAlbum()
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

test('deleting an album entry removes completion and stamp state', async () => {
  await saveLocalQuestAlbum(createEmptyQuestAlbum())
  const album = await addAlbumEntry({
    spotId: 'enoshima-01',
    questIndex: 0,
    animeTitle: 'Tsuritama',
    spotName: 'Benzaiten Nakamise-dori',
    questTitle: 'Shopping Street Quest',
    completedAt: '2026-07-05T12:00:00.000Z',
    albumPhoto,
  })

  const next = await deleteAlbumEntry(album.entries[0].id)

  assert.equal(next.entries.length, 0)
  assert.deepEqual(next.completions, [])
  assert.deepEqual(next.stamps, [])
})

test('updates an album entry without creating a duplicate', async () => {
  await saveLocalQuestAlbum(createEmptyQuestAlbum())
  const album = await addAlbumEntry({
    spotId: 'enoshima-01',
    questIndex: 0,
    animeTitle: 'Tsuritama',
    spotName: 'Benzaiten Nakamise-dori',
    questTitle: 'Shopping Street Quest',
    completedAt: '2026-07-05T12:00:00.000Z',
    albumPhoto,
  })

  const next = await updateAlbumEntry(album.entries[0].id, {
    impression: 'The evening light was perfect.',
  })

  assert.equal(next.entries.length, 1)
  assert.equal(next.entries[0].impression, 'The evening light was perfect.')
  assert.deepEqual(next.completions, ['enoshima-01:0'])
  assert.deepEqual(next.stamps, ['enoshima-01:0'])
})
