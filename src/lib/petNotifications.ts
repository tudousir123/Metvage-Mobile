import { metvageApi } from './metvage-request'

export type PetNotification = {
  id: number
  type: 'follow' | 'like' | 'comment'
  actor_pet: { id: number; nickname: string; species: 'cat' | 'dog' }
  target_pet_id: number | null
  target_record_id: number | null
  created_at: string
}

export async function getPetNotifications(page = 1): Promise<{
  notifications: PetNotification[]
  next_page: number | null
}> {
  return metvageApi(`/notifications?page=${page}`, { errorPrefix: '通知加载失败' })
}
