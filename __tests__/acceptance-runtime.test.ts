import { reportAcceptanceRuntime } from '../src/lib/acceptance-runtime'

jest.mock('expo-application', () => ({ applicationId: 'com.metvage.acceptance.phone' }))
const originalFetch = global.fetch
const originalDev = __DEV__
const valid = {
  url: 'http://localhost:18082/proof',
  nonce: 'a'.repeat(32),
  source: 'b'.repeat(64),
}

beforeEach(() => {
  Object.defineProperty(global, '__DEV__', {
    value: true,
    writable: true,
    configurable: true,
  })
  global.fetch = jest.fn().mockResolvedValue({ status: 204 })
})
afterEach(() => {
  global.fetch = originalFetch
  Object.defineProperty(global, '__DEV__', { value: originalDev })
})

test('the loaded development bundle acknowledges its source and native package only', async () => {
  await reportAcceptanceRuntime(JSON.stringify(valid))
  expect(fetch).toHaveBeenCalledWith(
    valid.url,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        nonce: valid.nonce,
        source: valid.source,
        package: 'com.metvage.acceptance.phone',
      }),
    })
  )
})

test('production builds never send the diagnostic acknowledgement', async () => {
  Object.defineProperty(global, '__DEV__', { value: false })
  await reportAcceptanceRuntime(JSON.stringify(valid))
  expect(fetch).not.toHaveBeenCalled()
})

test('invalid or remote proof endpoints never receive requests', async () => {
  await reportAcceptanceRuntime(
    JSON.stringify({ ...valid, url: 'https://example.test/proof' })
  )
  await reportAcceptanceRuntime('malformed')
  expect(fetch).not.toHaveBeenCalled()
})

test('a refused acknowledgement does not break App startup', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'))
  await expect(reportAcceptanceRuntime(JSON.stringify(valid))).resolves.toBeUndefined()
})

test('valid JSON with the wrong proof shape cannot break startup', async () => {
  for (const encoded of ['null', '{}', '123', '{"url":{}}']) {
    await expect(reportAcceptanceRuntime(encoded)).resolves.toBeUndefined()
  }
  expect(fetch).not.toHaveBeenCalled()
})
