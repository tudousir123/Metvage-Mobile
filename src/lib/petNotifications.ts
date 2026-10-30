import { instanceOrigin } from 'src/lib/instanceOrigin'
import { Storage } from 'src/state/cache'

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
  const server = Storage.getString('app.instance')
  const token = Storage.getString('app.token')
  if (!server || !token) throw new Error('请先登录')

  const response = await fetch(
    `${instanceOrigin(server)}/api/v1/metvage/notifications?page=${page}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    }
  )
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || `通知加载失败 (${response.status})`)
  }
  return response.json()
}
