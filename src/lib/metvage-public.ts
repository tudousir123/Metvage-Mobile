import Constants from 'expo-constants'
import { Storage } from 'src/state/cache'
import { instanceOrigin } from './instanceOrigin'
import type { PetProfile } from './pets'
import type { PetRecord } from './records'

export function metvageInstanceHost(): string | null {
  const configured = process.env.EXPO_PUBLIC_METVAGE_INSTANCE_HOST?.trim()
  const local = Constants.expoConfig?.extra?.localInstanceHost
  return (
    configured ||
    (typeof local === 'string' ? local : null) ||
    Storage.getString('app.instance') ||
    null
  )
}

export function metvageOrigin(): string {
  const host = metvageInstanceHost()
  if (!host) throw new Error('未配置 Metvage 服务地址')
  return instanceOrigin(host)
}

export function publicRecordPhotoUrl(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '')
  return `${metvageOrigin()}${path}`
}

async function publicRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${metvageOrigin()}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || `请求失败 (${response.status})`)
  }
  return response.json()
}

export const getPublicRecords = (page = 1) =>
  publicRequest<{ records: PetRecord[]; next_page: number | null }>(
    `/api/v1/metvage/records?page=${page}`
  )

export const getPublicRecord = (id: number) =>
  publicRequest<{ record: PetRecord }>(`/api/v1/metvage/records/${id}`)

export const getPublicPet = (id: number) =>
  publicRequest<PetProfile>(`/api/v1/metvage/pets/${id}`)

export const getPublicPetRecords = (id: number) =>
  publicRequest<{ records: PetRecord[] }>(`/api/v1/metvage/pets/${id}/records`)

export const searchPublicPetsAndRecords = (query: string) =>
  publicRequest<{ records: PetRecord[]; pets: PetProfile[] }>(
    `/api/v1/metvage/search?q=${encodeURIComponent(query.trim())}`
  )

export async function verifyInvitation(code: string): Promise<void> {
  const response = await fetch(`${metvageOrigin()}/api/v1.1/auth/invite/admin/verify`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: code }),
  })
  if (response.ok) return
  if (response.status === 404) throw new Error('邀请码无效，请核对后重试。')
  if (response.status === 400) throw new Error('邀请码已过期或使用次数已满。')
  throw new Error('暂时无法核验邀请码，请稍后重试。')
}

export function invitationRegistrationUrl(code: string): string {
  return `${metvageOrigin()}/auth/invite/a/${encodeURIComponent(code)}`
}
