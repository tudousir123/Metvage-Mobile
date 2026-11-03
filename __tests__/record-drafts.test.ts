import {
  discardRecordDraft,
  loadRecordDraft,
  saveRecordDraft,
} from '../src/lib/record-drafts'

const mockValues = new Map<string, string>()
const mockFiles = new Set<string>()
let mockCopyFails = false
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn(() => ({
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
    delete: (key: string) => mockValues.delete(key),
  })),
}))
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    if (mockCopyFails || !mockFiles.has(from)) throw new Error('copy failed')
    mockFiles.add(to)
  }),
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri) })),
  deleteAsync: jest.fn(async (uri: string) => {
    for (const file of mockFiles) if (file.startsWith(uri)) mockFiles.delete(file)
  }),
}))

const owner = { server: 'pets.example', accountId: 'owner' }
const draft = {
  title: '午后',
  text: '一起散步',
  petId: 3,
  visibility: 'private' as const,
  clientRequestId: 'same-request-after-restart',
  photos: [
    { uri: 'file:///cache/photo.jpg', mimeType: 'image/jpeg', fileName: 'photo.jpg' },
  ],
}

beforeEach(() => {
  mockValues.clear()
  mockFiles.clear()
  mockCopyFails = false
})

test('a saved draft restores its contents and photos after picker cache is removed', async () => {
  mockFiles.add(draft.photos[0].uri)
  await saveRecordDraft(owner, draft)
  mockFiles.delete(draft.photos[0].uri)
  const restored = await loadRecordDraft(owner)
  expect(restored).toMatchObject({
    title: '午后',
    text: '一起散步',
    petId: 3,
    visibility: 'private',
    clientRequestId: 'same-request-after-restart',
    missingPhotos: 0,
  })
  expect(restored?.photos).toHaveLength(1)
  expect(restored?.photos[0].uri).toMatch(/^file:\/\/\/documents\//)
})

test('drafts are isolated by both server and account and clearing one preserves another', async () => {
  await saveRecordDraft(owner, { ...draft, photos: [] })
  const other = { ...owner, accountId: 'other' }
  await saveRecordDraft(other, { ...draft, text: '另一位主人的回忆', photos: [] })
  expect(await loadRecordDraft({ ...owner, server: 'another.example' })).toBeNull()
  expect((await loadRecordDraft(owner))?.text).toBe('一起散步')
  await discardRecordDraft(owner)
  expect(await loadRecordDraft(owner)).toBeNull()
  expect((await loadRecordDraft(other))?.text).toBe('另一位主人的回忆')
})

test('failed photo persistence keeps the previous saved draft available', async () => {
  await saveRecordDraft(owner, { ...draft, text: '已保存的回忆', photos: [] })
  mockCopyFails = true
  await expect(saveRecordDraft(owner, draft)).rejects.toThrow('草稿保存失败')
  expect((await loadRecordDraft(owner))?.text).toBe('已保存的回忆')
})

test('a missing saved photo does not prevent restoring the text and visibility', async () => {
  mockFiles.add(draft.photos[0].uri)
  await saveRecordDraft(owner, draft)
  mockFiles.clear()
  expect(await loadRecordDraft(owner)).toMatchObject({
    text: '一起散步',
    visibility: 'private',
    photos: [],
    missingPhotos: 1,
  })
})
