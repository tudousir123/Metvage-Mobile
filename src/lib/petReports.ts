import Constants from 'expo-constants'
import { Storage } from 'src/state/cache'

export type PetReportTargetType = 'record' | 'pet'

export type PetReport = {
  id: number
  target_type: PetReportTargetType
  target_id: number
  reason: string
  status: 'pending' | string
  created_at: string
  reporter_id?: number
}

async function reportRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const server = Storage.getString('app.instance')
  const token = Storage.getString('app.token')
  if (!server || !token) throw new Error('请先登录')

  const localTestServer =
    server === 'localhost:18080' &&
    Constants.expoConfig?.extra?.localInstanceHost === 'localhost:18080'
  const origin = `${localTestServer ? 'http' : 'https'}://${server}`
  const response = await fetch(`${origin}/api/v1/metvage/${path}`, {
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
    const validationMessage = error?.errors
      ? Object.values(error.errors).flat().join('；')
      : null
    throw new Error(
      validationMessage || error?.message || `请求失败 (${response.status})`
    )
  }

  return response.json()
}

export const submitPetReport = (input: {
  target_type: PetReportTargetType
  target_id: number
  reason: string
}) => reportRequest<{ message: string; report: PetReport }>('reports', 'POST', input)

export const getTeamPetReports = () =>
  reportRequest<{ reports: PetReport[] }>('admin/reports')
