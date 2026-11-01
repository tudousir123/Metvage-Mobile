import { metvageApi } from './metvage-request'
import type { PetProfile } from './pets'
import type { PetRecord } from './records'

export type PetFollow = {
  actor_pet: PetProfile
  target_pet: PetProfile
}

function followRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  return metvageApi<T>(`${path}`, {
    method,
    body,
    origin: 'signed-in',
    auth: 'required',
    loginMessage: '请先登录',
  })
}

export const getPetFollows = () => followRequest<{ follows: PetFollow[] }>('/follows')

export const followPet = (targetPetId: number) =>
  followRequest<{ follow: PetFollow; created: boolean }>(
    `/pets/${targetPetId}/follow`,
    'POST'
  )

export const unfollowPet = (targetPetId: number) =>
  followRequest<{ following: false }>(`/pets/${targetPetId}/follow`, 'DELETE')

export const getFollowingFeed = (page = 1) =>
  followRequest<{ records: PetRecord[]; next_page_url: string | null }>(
    `/feed/following?page=${page}`
  )
