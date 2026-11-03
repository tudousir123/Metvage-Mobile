import { Redirect, Stack } from 'expo-router'
import { useAuth } from 'src/state/AuthProvider'

export default function AuthLayout() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  // Remove protected screens in the same render that clears their cached profile.
  if (!user) return <Redirect href="/handleLogin" />

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  )
}
