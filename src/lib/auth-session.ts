import { Storage } from 'src/state/cache'
import { instanceOrigin } from './instanceOrigin'

export class SessionExpiredError extends Error {
  constructor() {
    super('登录已失效，请重新登录')
    this.name = 'SessionExpiredError'
  }
}

const listeners = new Set<() => void>()

export function onSessionExpired(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function expireSession(server: string, token: string): boolean {
  const currentServer = Storage.getString('app.instance')
  if (
    !currentServer ||
    instanceOrigin(currentServer) !== instanceOrigin(server) ||
    Storage.getString('app.token') !== token
  ) {
    return false
  }

  // Keep the instance address and local drafts available to visitors.
  for (const key of [
    'app.token',
    'app.refresh_token',
    'app.token_created_at',
    'app.expires_in',
    'app.credentials_verified_at',
    'user.profile',
  ]) {
    Storage.delete(key)
  }
  for (const listener of listeners) listener()
  return true
}
