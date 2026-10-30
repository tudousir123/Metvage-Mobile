import Constants from 'expo-constants'
import { Storage } from 'src/state/cache'
import type { PetProfile } from './pets'
import type { PetRecord } from './records'

export type PetFollow = {
  actor_pet: PetProfile
  target_pet: PetProfile
}

async function followRequest<T>(path: string, method = 'GET'): Promise<T> {
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
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || `请求失败 (${response.status})`)
  }

  return response.json()
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
