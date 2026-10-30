import Constants from 'expo-constants'
import { Storage } from 'src/state/cache'

export type SpeciesApplication = {
  id: number
  applicant_id?: number
  species: string
  note: string | null
  created_at: string
}

async function speciesRequest<T>(
  path: string,
  method = 'GET',
  body?: object
): Promise<T> {
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

export const getSpeciesApplications = () =>
  speciesRequest<{ requests: SpeciesApplication[] }>('species-requests')

export const submitSpeciesApplication = (input: { species: string; note?: string }) =>
  speciesRequest<{ message: string; request: SpeciesApplication }>(
    'species-requests',
    'POST',
    input
  )

export const getTeamSpeciesApplications = () =>
  speciesRequest<{ requests: SpeciesApplication[] }>('admin/species-requests')
