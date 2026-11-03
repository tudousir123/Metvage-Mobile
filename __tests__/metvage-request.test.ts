import Constants from 'expo-constants'
import { ApiContext } from '../src/lib/api-context'
import { onSessionExpired } from '../src/lib/auth-session'
import { metvageApi } from '../src/lib/metvage-request'
import { verifyCredentials } from '../src/requests'

const values: Record<string, string | undefined> = {}
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}))
jest.mock('src/state/cache', () => ({
  Storage: {
    getString: (key: string) => values[key],
    delete: (key: string) => {
      delete values[key]
    },
  },
}))

const fetchMock = jest.fn()
global.fetch = fetchMock

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ records: [] }),
  })
  for (const key of Object.keys(values)) delete values[key]
  Constants.expoConfig!.extra!.localInstanceHost = 'metvage.example'
})

afterAll(() => {
  delete Constants.expoConfig!.extra!.localInstanceHost
})

test('owner history read sends the token only to the signed-in Metvage host', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'owner-token'

  await metvageApi('/records/4/interactions', { origin: 'configured', auth: 'optional' })

  expect(fetchMock).toHaveBeenCalledWith(
    'https://metvage.example/api/v1/metvage/records/4/interactions',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer owner-token' }),
    })
  )
})

test('another instance token is never sent to the configured Metvage host', async () => {
  values['app.instance'] = 'other.example'
  values['app.token'] = 'other-token'

  await metvageApi('/records/4/interactions', { origin: 'configured', auth: 'optional' })
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  await expect(
    metvageApi('/admin/reports', { origin: 'configured', auth: 'required' })
  ).rejects.toThrow('请先登录')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('a rejected login asks for sign-in again while public browsing keeps its instance', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'expired-token'
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })

  await expect(metvageApi('/pets')).rejects.toThrow('登录已失效，请重新登录')
  await expect(metvageApi('/pets')).rejects.toThrow('请先登录')
  await expect(
    metvageApi('/records', { origin: 'configured', auth: 'optional' })
  ).resolves.toEqual({ records: [] })
  expect(fetchMock.mock.calls[1][0]).toBe(
    'https://metvage.example/api/v1/metvage/records'
  )
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined()
})

test('an expired optional login still lets the same public read finish as a visitor', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'expired-token'
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })

  await expect(
    metvageApi('/records', { origin: 'configured', auth: 'optional' })
  ).resolves.toEqual({ records: [] })
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined()
})

test('credential verification invalidates a rejected session before offline fallback can restore it', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'expired-token'
  values['app.credentials_verified_at'] = 'previously-verified'
  const expired = jest.fn()
  const unsubscribe = onSessionExpired(expired)
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
  try {
    await expect(verifyCredentials('metvage.example', 'expired-token')).rejects.toThrow(
      '登录已失效，请重新登录'
    )
    expect(expired).toHaveBeenCalledTimes(1)
    await expect(metvageApi('/pets')).rejects.toThrow('请先登录')
  } finally {
    unsubscribe()
  }
})

test('a permission denial keeps the login and reports the actual error', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'owner-token'
  values['app.credentials_verified_at'] = 'verified'
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 403,
    json: async () => ({ error: 'Administrator access required' }),
  })

  await expect(
    new ApiContext('metvage.example', 'owner-token').get('/api/v1/admin/reports')
  ).rejects.toThrow('Administrator access required')
  await metvageApi('/pets')
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer owner-token')
  expect(values['app.credentials_verified_at']).toBe('verified')
})

test.each([403, 500])('a %s response does not expire a valid session', async (status) => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'owner-token'
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ message: 'Unavailable' }),
  })
  await expect(metvageApi('/pets')).rejects.toThrow('Unavailable')
  await metvageApi('/pets')
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer owner-token')
})

test('offline credential verification preserves the existing session for retry', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'owner-token'
  fetchMock.mockRejectedValueOnce(new Error('Network unavailable'))
  await expect(verifyCredentials('metvage.example', 'owner-token')).rejects.toThrow(
    'Network unavailable'
  )
  await metvageApi('/pets')
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer owner-token')
})

test('a guest-only endpoint cannot expire a stored login', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'owner-token'
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
  await expect(
    metvageApi('/records', { origin: 'configured', auth: 'none' })
  ).rejects.toThrow()
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  await metvageApi('/pets')
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer owner-token')
})

test('a late rejection for a previous login cannot log out the replacement session', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'old-token'
  let rejectOld: (response: object) => void = () => {}
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      rejectOld = resolve
    })
  )
  const oldRequest = metvageApi('/pets')
  values['app.token'] = 'new-token'
  rejectOld({ ok: false, status: 401 })
  await expect(oldRequest).rejects.toThrow('登录已失效，请重新登录')
  await metvageApi('/pets')
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new-token')
})

test('legacy API requests invalidate the same rejected session', async () => {
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'expired-token'
  values['record.draft'] = 'unsaved note'
  const expired = jest.fn()
  const unsubscribe = onSessionExpired(expired)
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
  try {
    await expect(
      new ApiContext('metvage.example', 'expired-token').get(
        '/api/v1/accounts/verify_credentials'
      )
    ).rejects.toThrow('登录已失效，请重新登录')
    expect(expired).toHaveBeenCalledTimes(1)
    await expect(metvageApi('/pets')).rejects.toThrow('请先登录')
    expect(values['record.draft']).toBe('unsaved note')
  } finally {
    unsubscribe()
  }
})
