import { metvageFetch, metvageOrigin, metvageRequest } from './metvage-request'

export { metvageInstanceHost, metvageOrigin } from './metvage-request'

import type { PetProfile } from './pets'
import type { PetRecord } from './records'

export function publicRecordPhotoUrl(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '')
  return `${metvageOrigin()}${path}`
}

function publicRequest<T>(path: string): Promise<T> {
  return metvageRequest<T>(path, { origin: 'configured', auth: 'optional' })
}

export const getPublicRecords = (page = 1) =>
  publicRequest<{ records: PetRecord[]; next_page: number | null }>(
    `/api/v1/metvage/records?page=${page}`
  )

export const getPublicRecord = (id: number) =>
  publicRequest<{ record: PetRecord }>(`/api/v1/metvage/records/${id}`)

export const getPublicPet = (id: number) =>
  publicRequest<PetProfile>(`/api/v1/metvage/pets/${id}`)

export async function getPublicPetRecords(id: number): Promise<{ records: PetRecord[] }> {
  const timeline = await publicRequest<{ records: PetRecord[] }>(
    `/api/v1/metvage/pets/${id}/records`
  )
  // This endpoint also returns private records to their owner. Public profiles
  // must still show only public notes without dropping authenticated block rules.
  return {
    ...timeline,
    records: timeline.records.filter((record) => record.visibility === 'public'),
  }
}

export const searchPublicPetsAndRecords = (query: string) =>
  publicRequest<{ records: PetRecord[]; pets: PetProfile[] }>(
    `/api/v1/metvage/search?q=${encodeURIComponent(query.trim())}`
  )

export async function verifyInvitation(code: string): Promise<void> {
  const response = await metvageFetch('/api/v1.1/auth/invite/admin/verify', {
    origin: 'configured',
    auth: 'none',
    method: 'POST',
    body: { token: code },
  })
  if (response.ok) return
  if (response.status === 404) throw new Error('邀请码无效，请核对后重试。')
  if (response.status === 400) throw new Error('邀请码已过期或使用次数已满。')
  throw new Error('暂时无法核验邀请码，请稍后重试。')
}

export function invitationRegistrationUrl(code: string): string {
  return `${metvageOrigin()}/auth/invite/a/${encodeURIComponent(code)}`
}
