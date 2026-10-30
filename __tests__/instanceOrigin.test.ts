import Constants from 'expo-constants'
import { instanceOrigin, isLocalTestInstance } from '../src/lib/instanceOrigin'

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}))

const extra = Constants.expoConfig!.extra!

afterEach(() => { delete extra.localInstanceHost })

test('normal builds use HTTPS for every instance', () => {
  expect(instanceOrigin('metvage.example')).toBe('https://metvage.example')
  expect(instanceOrigin('localhost:18080')).toBe('https://localhost:18080')
})

test('local acceptance build uses HTTP only for the configured loopback host', () => {
  extra.localInstanceHost = 'localhost:18080'
  expect(instanceOrigin('localhost:18080')).toBe('http://localhost:18080')
  expect(isLocalTestInstance('localhost:18080')).toBe(true)
  expect(instanceOrigin('localhost:18080@evil.test')).toBe('https://localhost:18080@evil.test')
  expect(instanceOrigin('metvage.example')).toBe('https://metvage.example')
})

test('missing instance fails before a request is sent', () => {
  expect(() => instanceOrigin(null)).toThrow('Instance host is missing')
})
