import Constants from 'expo-constants'
import { Storage } from 'src/state/cache'
import type { PetProfile } from './pets'

export type RecordLike = { id: number; actor_pet: PetProfile }
export type RecordComment = {
  id: number
  text: string
  actor_pet: PetProfile
  created_at: string
  can_delete: boolean
}
export type RecordInteractions = { likes: RecordLike[]; comments: RecordComment[] }

async function interactionRequest<T>(
  path: string,
  method = 'GET',
  body?: object
): Promise<T> {
  const server = Storage.getString('app.instance')
  const token = Storage.getString('app.token')
  if (!server) throw new Error('请先选择服务')
  if (method !== 'GET' && !token) throw new Error('请先登录')

  const localTestServer =
    server === 'localhost:18080' &&
    Constants.expoConfig?.extra?.localInstanceHost === 'localhost:18080'
  const origin = `${localTestServer ? 'http' : 'https'}://${server}`
  const response = await fetch(`${origin}/api/v1/metvage${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || `请求失败 (${response.status})`)
  }
  return response.json()
}

export const getRecordInteractions = (recordId: number) =>
  interactionRequest<RecordInteractions>(`/records/${recordId}/interactions`)

export const likeRecord = (recordId: number) =>
  interactionRequest<{ like: RecordLike; created: boolean }>(
    `/records/${recordId}/likes`,
    'POST'
  )

export const unlikeRecord = (recordId: number) =>
  interactionRequest<{ liked: false }>(`/records/${recordId}/likes`, 'DELETE')

export const commentOnRecord = (recordId: number, text: string, requestId: string) =>
  interactionRequest<{ comment: RecordComment; created: boolean }>(
    `/records/${recordId}/comments`,
    'POST',
    { text, request_id: requestId }
  )

export const deleteRecordComment = (commentId: number) =>
  interactionRequest<{ deleted: true }>(`/comments/${commentId}`, 'DELETE')

export function newCommentRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16)
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
}
