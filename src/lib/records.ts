import Constants from 'expo-constants'
import { Storage } from 'src/state/cache'
import type { PetProfile } from './pets'

export type RecordVisibility = 'public' | 'private'

export type PetRecord = {
  id: number
  pet_id: number
  pet: PetProfile
  text: string | null
  title: string | null
  photos: { id: number; url: string }[]
  visibility: RecordVisibility
  created_at: string
  published_at: string | null
}

export type RecordPhotoInput = {
  uri: string
  fileName?: string | null
  mimeType?: string | null
}

function recordOrigin(): string {
  const server = Storage.getString('app.instance')
  if (!server) throw new Error('请先登录')
  const localTestServer =
    server === 'localhost:18080' &&
    Constants.expoConfig?.extra?.localInstanceHost === 'localhost:18080'
  return `${localTestServer ? 'http' : 'https'}://${server}`
}

export function recordPhotoUrl(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '')
  return `${recordOrigin()}${path}`
}

async function recordRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const token = Storage.getString('app.token')
  if (!token) throw new Error('请先登录')

  const response = await fetch(`${recordOrigin()}/api/v1/metvage${path}`, {
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

export async function createPetRecord(input: {
  pet_id: number
  text: string
  title: string
  visibility: RecordVisibility
  photos: RecordPhotoInput[]
  client_request_id: string
}): Promise<{ record: PetRecord }> {
  const token = Storage.getString('app.token')
  if (!token) throw new Error('请先登录')

  const form = new FormData()
  form.append('pet_id', String(input.pet_id))
  form.append('visibility', input.visibility)
  form.append('text', input.text)
  form.append('title', input.title)
  form.append('client_request_id', input.client_request_id)
  input.photos.forEach((photo, index) => {
    form.append(`photos[${index}]`, {
      uri: photo.uri,
      name: photo.fileName || `photo-${index + 1}.jpg`,
      type: photo.mimeType || 'image/jpeg',
    } as unknown as Blob)
  })

  let response: Response
  try {
    response = await fetch(`${recordOrigin()}/api/v1/metvage/records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: form,
    })
  } catch {
    throw new Error('照片或记录上传失败，请检查网络后重试。内容已保留。')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const photoValidationFailed =
      response.status === 422 &&
      error?.errors &&
      Object.keys(error.errors).some(
        (field) => field === 'photos' || field.startsWith('photos.')
      )
    if (photoValidationFailed) {
      throw new Error('照片上传失败，请选择 JPG、PNG 或 WebP 图片，每张不超过 10 MB。')
    }
    throw new Error(error?.message || `保存失败 (${response.status})，请重试。`)
  }

  return response.json()
}
