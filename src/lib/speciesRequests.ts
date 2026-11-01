import { metvageApi } from './metvage-request'

export type SpeciesApplication = {
  id: number
  applicant_id?: number
  species: string
  note: string | null
  created_at: string
}

function speciesRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  return metvageApi<T>(`/${path}`, {
    method,
    body,
    origin: 'signed-in',
    auth: 'required',
    loginMessage: '请先登录',
  })
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
