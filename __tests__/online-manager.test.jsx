/** @jest-environment jsdom */
import { onlineManager, QueryClient } from '@tanstack/react-query'
import Constants from 'expo-constants'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useOnlineManager } from '../src/hooks/useOnlineManager'

let mockNetworkListener
let mockStorageListener
const mockValues = {}
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (listener) => {
      mockNetworkListener = listener
      return () => {
        mockNetworkListener = undefined
      }
    },
  },
}))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}))
jest.mock('src/state/cache', () => ({
  Storage: {
    getString: (key) => mockValues[key],
    addOnValueChangedListener: (listener) => {
      mockStorageListener = listener
      return {
        remove: () => {
          mockStorageListener = undefined
        },
      }
    },
  },
}))

function NetworkGate() {
  useOnlineManager()
  return null
}

let root
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  for (const key of Object.keys(mockValues)) delete mockValues[key]
  delete Constants.expoConfig.extra.localInstanceHost
  delete process.env.EXPO_PUBLIC_METVAGE_INSTANCE_HOST
  onlineManager.setOnline(true)
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<NetworkGate />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  onlineManager.setOnline(true)
})

test('an explicitly configured loopback test query runs without external Internet validation', async () => {
  Constants.expoConfig.extra.localInstanceHost = 'localhost:18080'
  mockValues['app.instance'] = 'localhost:18080'
  mockNetworkListener({ isConnected: true, isInternetReachable: false })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const fetchRecords = jest.fn().mockResolvedValue({ records: [{ id: 7 }] })
  const request = client.fetchQuery({
    queryKey: ['local-records'],
    queryFn: fetchRecords,
  })
  await Promise.resolve()
  expect(fetchRecords).toHaveBeenCalledTimes(1)
  await expect(request).resolves.toEqual({ records: [{ id: 7 }] })
  client.clear()
})

test('a production server remains paused when external Internet is unavailable', () => {
  process.env.EXPO_PUBLIC_METVAGE_INSTANCE_HOST = 'community.example'
  mockValues['app.instance'] = 'community.example'
  mockNetworkListener({ isConnected: true, isInternetReachable: false })
  expect(onlineManager.isOnline()).toBe(false)
  mockNetworkListener({ isConnected: true, isInternetReachable: true })
  expect(onlineManager.isOnline()).toBe(true)
})

test('local build configuration cannot bypass offline gating for a different signed-in server', () => {
  Constants.expoConfig.extra.localInstanceHost = 'localhost:18080'
  mockValues['app.instance'] = 'community.example'
  mockNetworkListener({ isConnected: true, isInternetReachable: false })
  expect(onlineManager.isOnline()).toBe(false)
})

test('switching away from the local test server reapplies offline gating immediately', () => {
  Constants.expoConfig.extra.localInstanceHost = 'localhost:18080'
  mockValues['app.instance'] = 'localhost:18080'
  mockNetworkListener({ isConnected: true, isInternetReachable: false })
  expect(onlineManager.isOnline()).toBe(true)
  mockValues['app.instance'] = 'community.example'
  mockStorageListener('app.instance')
  expect(onlineManager.isOnline()).toBe(false)
})
