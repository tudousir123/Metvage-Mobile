import Constants from 'expo-constants'
import { metvageApi } from '../src/lib/metvage-request'

const values: Record<string, string | undefined> = {}
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}))
jest.mock('src/state/cache', () => ({
  Storage: { getString: (key: string) => values[key] },
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
  delete values['app.instance']
  delete values['app.token']
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
