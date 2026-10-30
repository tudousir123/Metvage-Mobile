import { router } from 'expo-router'
import { Storage } from 'src/state/cache'

export type PetSpecies = 'cat' | 'dog'

export type PetProfile = {
  id: number
  nickname: string
  species: PetSpecies
  bio: string | null
}

export type PetsResponse = {
  pets: PetProfile[]
  current_pet_id: number | null
}

async function petRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const server = Storage.getString('app.instance')
  const token = Storage.getString('app.token')
  if (!server || !token) throw new Error('请先登录')

  const origin = (
    server.startsWith('http://') || server.startsWith('https://')
      ? server
      : `https://${server}`
  ).replace(/\/+$/, '')

  const response = await fetch(`${origin}/api/v1/metvage/pets${path}`, {
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

export const getPets = () => petRequest<PetsResponse>('')

export const createPet = (input: { nickname: string; species: PetSpecies }) =>
  petRequest<{ pet: PetProfile }>('', 'POST', input)

export const updatePet = (
  id: number,
  input: { nickname: string; species: PetSpecies; bio: string | null }
) => petRequest<{ pet: PetProfile }>(`/${id}`, 'PATCH', input)

export const selectCurrentPet = (petId: number) =>
  petRequest<{ current_pet_id: number }>('/current', 'PUT', { pet_id: petId })

export async function requireCurrentPet(): Promise<void> {
  const { pets, current_pet_id } = await getPets()
  if (pets.some((pet) => pet.id === current_pet_id)) return

  router.push('/settings/pets' as Parameters<typeof router.push>[0])
  throw new Error('请先建立并选定宠物身份')
}
