import { useAuth } from '@state/AuthProvider'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { metvageInstanceHost } from 'src/lib/metvage-public'

export default function LoginScreen() {
  const params = useLocalSearchParams<{ server?: string }>()
  const configuredHost = metvageInstanceHost()
  const [server, setServer] = useState(params.server || configuredHost || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()

  const submit = async () => {
    if (loading) return
    const host = server
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
    if (!host) {
      setError('请填写 Metvage 服务地址。')
      return
    }
    setError('')
    setLoading(true)
    try {
      const accepted = await login(host, 'read write follow push')
      if (!accepted) setError('无法连接到 Metvage 服务，请检查地址。')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '登录失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 24, gap: 18 }}
    >
      <Stack.Screen options={{ title: '登录 Metvage' }} />
      <Text style={{ fontSize: 26, fontWeight: '700', color: '#18332f' }}>欢迎回来</Text>
      <Text style={{ color: '#536a64' }}>
        登录后可以发布和互动；浏览公开笔记不需要账号。
      </Text>
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#18332f' }}>Metvage 服务地址</Text>
        <TextInput
          accessibilityLabel="Metvage 服务地址"
          autoCapitalize="none"
          autoCorrect={false}
          value={server}
          onChangeText={setServer}
          editable={!configuredHost}
          style={{
            borderWidth: 1,
            borderColor: '#afc6be',
            borderRadius: 10,
            padding: 13,
            color: '#18332f',
          }}
        />
      </View>
      {!!error && <Text style={{ color: '#b42318' }}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={submit}
        style={{
          padding: 15,
          borderRadius: 12,
          backgroundColor: '#075e52',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>
            登录
          </Text>
        )}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/handleSignup')}>
        <Text style={{ color: '#075e52', textAlign: 'center' }}>有邀请码？注册试用</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/feed')}>
        <Text style={{ color: '#075e52', textAlign: 'center' }}>继续以访客身份浏览</Text>
      </Pressable>
    </ScrollView>
  )
}
