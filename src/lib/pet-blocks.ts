import { Storage } from 'src/state/cache'
import { instanceOrigin } from './instanceOrigin'
import type { PetProfile } from './pets'

export type PetAccountBlock = {
  id: number
  pet: PetProfile | null
}

async function blockRequest<T>(path: string, method = 'GET'): Promise<T> {
  const host = Storage.getString('app.instance')
  const token = Storage.getString('app.token')
  if (!host || !token) throw new Error('请先登录')

  const response = await fetch(`${instanceOrigin(host)}/api/v1/metvage${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || `请求失败 (${response.status})`)
  }
  return response.json()
}

export const getPetAccountBlocks = () =>
  blockRequest<{ blocks: PetAccountBlock[] }>('/blocks')

export const getPetBlockStatus = (petId: number) =>
  blockRequest<{ blocked: boolean }>(`/pets/${petId}/block`)

export const blockPetAccount = (petId: number) =>
  blockRequest<{ blocked: boolean }>(`/pets/${petId}/block`, 'POST')

export const unblockPetAccount = (petId: number) =>
  blockRequest<{ blocked: boolean }>(`/pets/${petId}/block`, 'DELETE')

export const removePetAccountBlock = (blockId: number) =>
  blockRequest<{ blocked: false }>(`/blocks/${blockId}`, 'DELETE')
