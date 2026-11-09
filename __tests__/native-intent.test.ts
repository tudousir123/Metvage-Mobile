import { router } from 'expo-router'
import { Platform } from 'react-native'
import { redirectSystemPath } from '../src/app/+native-intent'

jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), push: jest.fn() } }))
jest.mock('expo-share-intent', () => ({ getShareExtensionKey: () => 'share-key' }))
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))

beforeEach(() => jest.clearAllMocks())

test.each([
  '/',
  '/feed',
  '/unavailable/shop',
  '/pets/20/records',
  '/settings/pets?edit=19',
  '/pet/17',
  '/note/26',
  '/records/26/edit',
  '/reports/new?target_type=record&target_id=26',
  '/following',
])('warm Android business link pushes a fresh screen: %s', (path) => {
  expect(redirectSystemPath({ path: `pixelfed://${path}`, initial: false })).toBeNull()
  expect(router.push).toHaveBeenCalledWith(path)
})

test('cold launch and OAuth callback retain normal Router handling', () => {
  for (const [path, initial] of [
    ['pixelfed:///note/26', true],
    ['pixelfed:///login?code=opaque', false],
  ] as const) {
    expect(redirectSystemPath({ path, initial })).toBe(path)
  }
  expect(router.push).not.toHaveBeenCalled()
})

test('iOS and share intents retain their existing handling', () => {
  Object.assign(Platform, { OS: 'ios' })
  try {
    expect(redirectSystemPath({ path: 'pixelfed:///note/26', initial: false })).toBe(
      'pixelfed:///note/26'
    )
    expect(
      redirectSystemPath({ path: 'pixelfed:///share?dataUrl=share-key', initial: false })
    ).toBe('/camera')
    expect(router.push).not.toHaveBeenCalled()
  } finally {
    Object.assign(Platform, { OS: 'android' })
  }
})

test.each(['pixelfed://note/26', 'metvagephone://note/26', '/note/26'])(
  'normalizes a business link without discarding its host path: %s',
  (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBeNull()
    expect(router.push).toHaveBeenCalledWith('/note/26')
  }
)

test('web links keep the default Router handling', () => {
  const path = 'https://example.test/note/26'
  expect(redirectSystemPath({ path, initial: false })).toBe(path)
  expect(router.push).not.toHaveBeenCalled()
})
