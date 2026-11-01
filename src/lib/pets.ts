import { router } from 'expo-router'
import { metvageApi } from './metvage-request'

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

function petRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  return metvageApi<T>(`/pets${path}`, {
    method,
    body,
    origin: 'signed-in',
    auth: 'required',
    loginMessage: '请先登录',
  })
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
