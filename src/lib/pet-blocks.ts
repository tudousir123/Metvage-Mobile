import { metvageApi } from './metvage-request'
import type { PetProfile } from './pets'

export type PetAccountBlock = {
  id: number
  pet: PetProfile | null
}

function blockRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  return metvageApi<T>(`${path}`, {
    method,
    body,
    origin: 'signed-in',
    auth: 'required',
    loginMessage: '请先登录',
  })
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
