import * as FileSystem from 'expo-file-system'
import { MMKV } from 'react-native-mmkv'
import type { RecordPhotoInput, RecordVisibility } from './records'

// Separate storage keeps drafts through logout; every read is scoped to the
// authenticated account ID and server, never to a display name or bearer token.
const drafts = new MMKV({ id: 'metvage-record-drafts' })
export type DraftOwner = { server: string; accountId: string }
export type RecordDraft = {
  title: string
  text: string
  petId: number | null
  visibility: RecordVisibility
  clientRequestId: string
  photos: RecordPhotoInput[]
}
type SavedDraft = RecordDraft & { directory: string }
const keyFor = (owner: DraftOwner) => JSON.stringify([owner.server, owner.accountId])

export async function saveRecordDraft(owner: DraftOwner, draft: RecordDraft) {
  if (!FileSystem.documentDirectory) throw new Error('当前设备无法保存草稿。')
  const directory = `${FileSystem.documentDirectory}metvage-drafts/${Date.now()}-${Math.random().toString(36).slice(2)}/`
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
  try {
    const photos: RecordPhotoInput[] = []
    for (const [index, photo] of draft.photos.entries()) {
      const extension =
        photo.mimeType === 'image/png'
          ? 'png'
          : photo.mimeType === 'image/webp'
            ? 'webp'
            : 'jpg'
      const uri = `${directory}${index}.${extension}`
      await FileSystem.copyAsync({ from: photo.uri, to: uri })
      photos.push({ ...photo, uri })
    }
    const previous = drafts.getString(keyFor(owner))
    const saved: SavedDraft = { ...draft, photos, directory }
    drafts.set(keyFor(owner), JSON.stringify(saved))
    if (previous) {
      // Cleanup must never undo a newly saved draft.
      try {
        const old = JSON.parse(previous) as SavedDraft
        await FileSystem.deleteAsync(old.directory, { idempotent: true })
      } catch {}
    }
    return saved
  } catch {
    await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => {})
    throw new Error('草稿保存失败，请重试。编辑内容仍在当前页面。')
  }
}

export async function loadRecordDraft(owner: DraftOwner) {
  const raw = drafts.getString(keyFor(owner))
  if (!raw) return null
  const saved = JSON.parse(raw) as SavedDraft
  const photos: RecordPhotoInput[] = []
  for (const photo of saved.photos) {
    if ((await FileSystem.getInfoAsync(photo.uri)).exists) photos.push(photo)
  }
  return { ...saved, photos, missingPhotos: saved.photos.length - photos.length }
}

export async function discardRecordDraft(owner: DraftOwner) {
  const raw = drafts.getString(keyFor(owner))
  drafts.delete(keyFor(owner))
  if (raw) {
    const saved = JSON.parse(raw) as SavedDraft
    await FileSystem.deleteAsync(saved.directory, { idempotent: true }).catch(() => {})
  }
}
