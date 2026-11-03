/** @jest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AuthLayout from '../src/app/(auth)/_layout'
import { metvageApi } from '../src/lib/metvage-request'
import AuthProvider, { useUserCache } from '../src/state/AuthProvider'

const values = {}
let mockRoute
const mockSegments = ['(auth)', 'settings']
jest.mock('expo-router', () => {
  const React = require('react')
  const Stack = () => mockRoute
  Stack.Screen = () => null
  return {
    Stack,
    useSegments: () => mockSegments,
    router: { replace: jest.fn() },
    Redirect: ({ href }) => React.createElement('div', null, `Redirect: ${href}`),
  }
})
jest.mock('src/state/cache', () => ({
  Storage: {
    getString: (key) => values[key],
    getNumber: (key) => values[key],
    set: (key, value) => {
      values[key] = value
    },
    delete: (key) => {
      delete values[key]
    },
  },
}))

function ProtectedScreen() {
  const profile = useUserCache()
  return <div>Settings for {profile.username}</div>
}

test('a mounted protected screen redirects to login without rendering with an expired profile', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true
  values['app.instance'] = 'metvage.example'
  values['app.token'] = 'old-token'
  values['app.credentials_verified_at'] = Date.now()
  values['user.profile'] = JSON.stringify({ id: '1', username: 'owner' })
  values['record.draft'] = 'unsaved note'
  mockRoute = <ProtectedScreen />
  const originalFetch = global.fetch
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 })
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(
        <AuthProvider>
          <AuthLayout />
        </AuthProvider>
      )
    })
    expect(container.textContent).toBe('Settings for owner')

    await act(async () => {
      await expect(metvageApi('/pets')).rejects.toThrow('登录已失效，请重新登录')
    })

    expect(container.textContent).toBe('Redirect: /handleLogin')
    expect(values['app.instance']).toBe('metvage.example')
    expect(values['record.draft']).toBe('unsaved note')
  } finally {
    await act(async () => root.unmount())
    global.fetch = originalFetch
  }
})
