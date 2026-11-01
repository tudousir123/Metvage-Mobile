import { metvageApi } from './metvage-request'

export type PetReportTargetType = 'record' | 'pet' | 'comment'
export type PetReportAction =
  | 'none'
  | 'hide'
  | 'restore'
  | 'delete'
  | 'suspend'
  | 'unsuspend'

export type PetReport = {
  id: number
  target_type: PetReportTargetType
  target_id: number
  reason: string
  status: 'pending' | 'resolved'
  action?: PetReportAction | null
  resolution?: string | null
  created_at: string
  reporter_id?: number
}

function reportRequest<T>(path: string, method = 'GET', body?: object): Promise<T> {
  return metvageApi<T>(`/${path}`, {
    method,
    body,
    origin: 'configured',
    auth: 'required',
    loginMessage: '请先登录当前社区账号',
  })
}

export const submitPetReport = (input: {
  target_type: PetReportTargetType
  target_id: number
  reason: string
}) => reportRequest<{ message: string; report: PetReport }>('reports', 'POST', input)

export const getTeamPetReports = () =>
  reportRequest<{ reports: PetReport[] }>('admin/reports')

export const resolvePetReport = (
  id: number,
  input: { action: PetReportAction; resolution: string }
) => reportRequest<{ report: PetReport }>(`admin/reports/${id}`, 'PATCH', input)
