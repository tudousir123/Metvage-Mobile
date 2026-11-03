/** @jest-environment jsdom */

import Constants from 'expo-constants'
import { router } from 'expo-router'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Alert } from 'react-native'
import Settings from '../src/app/(auth)/settings'
import Legal from '../src/app/(auth)/settings/legal'
import { openBrowserAsync } from '../src/utils'

let mockHost = 'pets.example'
const mockLogout = jest.fn()

jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0' }))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}))
jest.mock('react-native', () => {
  const React = require('react')
  const View = ({ children }) => React.createElement('div', null, children)
  const Text = ({ children }) => React.createElement('span', null, children)
  const Pressable = ({ children, onPress, disabled, accessibilityLabel }) =>
    React.createElement(
      'button',
      { onClick: onPress, disabled, 'aria-label': accessibilityLabel },
      children
    )
  return { View, Text, Pressable, ScrollView: View, Alert: { alert: jest.fn() } }
})
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}))
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useNavigation: () => ({ setOptions: jest.fn() }),
  Link: ({ children }) => children,
}))
jest.mock('../src/state/AuthProvider', () => ({
  useAuth: () => ({ logout: mockLogout }),
  useUserCache: () => ({ username: 'owner', locked: true }),
}))
jest.mock('../src/state/cache', () => ({ Storage: { getString: () => mockHost } }))
jest.mock('../src/utils', () => ({ openBrowserAsync: jest.fn() }))
jest.mock('@expo/vector-icons/Feather', () => () => null)
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }))

let root
let container
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  jest.clearAllMocks()
  mockHost = 'pets.example'
  Constants.expoConfig.extra = {}
  openBrowserAsync.mockReset()
  openBrowserAsync.mockResolvedValue(undefined)
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
})

async function press(label) {
  const button = [...container.querySelectorAll('button')].find(
    (item) => item.textContent === label || item.getAttribute('aria-label') === label
  )
  expect(button).toBeDefined()
  await act(async () => button.click())
}

test('Metvage settings routes to pet ownership and account-wide blocks without legacy account privacy or appearance controls', async () => {
  await act(async () => root.render(<Settings />))
  expect(container.textContent).not.toContain('Privacy & Relationships')
  expect(container.textContent).not.toContain('Avatar, Bio and Display Name')
  expect(container.textContent).not.toContain('Appearance')
  await press('我的宠物')
  expect(router.push).toHaveBeenLastCalledWith('/settings/pets')
  await press('屏蔽关系')
  expect(router.push).toHaveBeenLastCalledWith('/settings/blocked-pets')
})

test('legal pages use the enabled local-test origin instead of forcing HTTPS', async () => {
  mockHost = 'localhost:18080'
  Constants.expoConfig.extra.localInstanceHost = 'localhost:18080'
  await act(async () => root.render(<Legal />))
  await press('隐私政策')
  expect(openBrowserAsync).toHaveBeenLastCalledWith('http://localhost:18080/e/privacy')
  await press('服务条款')
  expect(openBrowserAsync).toHaveBeenLastCalledWith('http://localhost:18080/e/terms')
})

test('account security and deletion open current-instance pages without deleting or logging out', async () => {
  await act(async () => root.render(<Settings />))
  await press('安全设置')
  expect(openBrowserAsync).toHaveBeenLastCalledWith(
    'https://pets.example/settings/security'
  )
  await press('修改密码')
  expect(openBrowserAsync).toHaveBeenLastCalledWith(
    'https://pets.example/settings/password'
  )
  await press('删除账号')
  expect(openBrowserAsync).toHaveBeenLastCalledWith(
    'https://pets.example/settings/remove/request/permanent'
  )
  expect(mockLogout).not.toHaveBeenCalled()
  await press('法律与隐私')
  expect(router.push).toHaveBeenLastCalledWith('/settings/legal')
})

test('browser failures stay on the legal page with a retryable error', async () => {
  openBrowserAsync.mockRejectedValueOnce(new Error('Browser unavailable'))
  await act(async () => root.render(<Legal />))
  await press('隐私政策')
  expect(container.textContent).toContain('无法打开页面，请检查服务地址或网络后重试。')
  await press('隐私政策')
  expect(openBrowserAsync).toHaveBeenCalledTimes(2)
  expect(container.textContent).not.toContain('无法打开页面')
})

test('missing instance settings do not open a malformed account deletion URL', async () => {
  mockHost = undefined
  await act(async () => root.render(<Settings />))
  await press('删除账号')
  expect(openBrowserAsync).not.toHaveBeenCalled()
  expect(container.textContent).toContain('无法打开页面')
})

test('logout only runs after its confirmation and keeps cancellation available', async () => {
  await act(async () => root.render(<Settings />))
  await press('退出登录')
  expect(mockLogout).not.toHaveBeenCalled()
  const options = Alert.alert.mock.calls.at(-1)[2]
  expect(options.find((option) => option.text === '取消').style).toBe('cancel')
  await act(async () => options.find((option) => option.text === '退出登录').onPress())
  expect(mockLogout).toHaveBeenCalledTimes(1)
})
