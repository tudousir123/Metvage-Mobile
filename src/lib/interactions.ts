import { metvageApi } from './metvage-request'
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

function interactionRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  return metvageApi<T>(`${path}`, {
    method,
    body,
    origin: 'configured',
    auth: method === 'GET' ? 'optional' : 'required',
    loginMessage: '请先登录',
  })
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
