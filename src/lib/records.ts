import Constants from 'expo-constants'
import { Storage } from 'src/state/cache'
import type { PetProfile } from './pets'

export type RecordVisibility = 'public' | 'private'

export type PetRecord = {
  id: number
  pet_id: number
  pet: PetProfile
  text: string
  visibility: RecordVisibility
  created_at: string
  published_at: string | null
}

async function recordRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const server = Storage.getString('app.instance')
  const token = Storage.getString('app.token')
  if (!server || !token) throw new Error('请先登录')

  const localTestServer =
    server === 'localhost:18080' &&
    Constants.expoConfig?.extra?.localInstanceHost === 'localhost:18080'
  const origin = `${localTestServer ? 'http' : 'https'}://${server}`
  const response = await fetch(`${origin}/api/v1/metvage${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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

export const createTextRecord = (input: {
  pet_id: number
  text: string
  visibility: RecordVisibility
}) => recordRequest<{ record: PetRecord }>('/records', 'POST', input)

export const getPetTimeline = (petId: number) =>
  recordRequest<{ records: PetRecord[] }>(`/pets/${petId}/records`)

export const updateRecordVisibility = (recordId: number, visibility: RecordVisibility) =>
  recordRequest<{ record: PetRecord }>(`/records/${recordId}/visibility`, 'PATCH', {
    visibility,
  })
