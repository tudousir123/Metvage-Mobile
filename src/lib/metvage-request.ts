import Constants from 'expo-constants'
import { Storage } from 'src/state/cache'
import { expireSession, SessionExpiredError } from './auth-session'
import { instanceOrigin } from './instanceOrigin'

export function metvageInstanceHost(): string | null {
  const configured = process.env.EXPO_PUBLIC_METVAGE_INSTANCE_HOST?.trim()
  const local = Constants.expoConfig?.extra?.localInstanceHost
  return (
    configured ||
    (typeof local === 'string' ? local : null) ||
    Storage.getString('app.instance') ||
    null
  )
}

export function metvageOrigin(): string {
  const host = metvageInstanceHost()
  if (!host) throw new Error('未配置 Metvage 服务地址')
  return instanceOrigin(host)
}

export function signedInOrigin(): string {
  const host = Storage.getString('app.instance')
  if (!host) throw new Error('请先登录')
  return instanceOrigin(host)
}

export type MetvageRequestOptions = {
  method?: string
  body?: object | FormData
  origin?: 'signed-in' | 'configured'
  auth?: 'required' | 'optional' | 'none'
  loginMessage?: string
  errorPrefix?: string
}

export async function metvageFetch(
  path: string,
  options: MetvageRequestOptions = {}
): Promise<Response> {
  const origin = options.origin === 'configured' ? metvageOrigin() : signedInOrigin()
  const server = Storage.getString('app.instance')
  const token =
    server && instanceOrigin(server) === origin ? Storage.getString('app.token') : null
  if ((options.auth ?? 'required') === 'required' && !token) {
    throw new Error(options.loginMessage || '请先登录')
  }
  const body = options.body
  const response = await fetch(`${origin}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(token && options.auth !== 'none' ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  if (response.status === 401 && token && server && options.auth !== 'none') {
    expireSession(server, token)
    if (options.auth === 'optional' && (options.method ?? 'GET') === 'GET') {
      return fetch(`${origin}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    }
    throw new SessionExpiredError()
  }
  return response
}

export async function metvageRequest<T>(
  path: string,
  options: MetvageRequestOptions = {}
): Promise<T> {
  const response = await metvageFetch(path, options)
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const validation = error?.errors
      ? Object.values(error.errors).flat().join('；')
      : null
    throw new Error(
      validation ||
        error?.message ||
        `${options.errorPrefix || '请求失败'} (${response.status})`
    )
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export function metvageApi<T>(
  path: string,
  options: MetvageRequestOptions = {}
): Promise<T> {
  return metvageRequest<T>(`/api/v1/metvage${path}`, options)
}
