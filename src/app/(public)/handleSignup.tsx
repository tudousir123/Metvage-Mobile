import { router, Stack } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput } from 'react-native'
import { invitationRegistrationUrl, verifyInvitation } from 'src/lib/metvage-public'

export default function InvitationSignup() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [opened, setOpened] = useState(false)

  const continueRegistration = async () => {
    const invitation = code.trim()
    if (loading) return
    if (!invitation) {
      setError('请输入邀请码。')
      return
    }
    setError('')
    setLoading(true)
    try {
      await verifyInvitation(invitation)
      await WebBrowser.openBrowserAsync(invitationRegistrationUrl(invitation))
      setOpened(true)
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : '暂时无法核验邀请码，请重试。'
      )
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
      <Stack.Screen options={{ title: '凭邀请注册' }} />
      <Text style={{ fontSize: 26, fontWeight: '700', color: '#18332f' }}>
        加入 Metvage 试用
      </Text>
      <Text style={{ color: '#536a64', lineHeight: 23 }}>
        首版仅接受邀请注册。没有邀请码也可以浏览公开笔记；注册后无需立即建立宠物档案。
      </Text>
      <TextInput
        accessibilityLabel="邀请码"
        placeholder="输入邀请码"
        autoCapitalize="none"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
        style={{
          borderWidth: 1,
          borderColor: '#afc6be',
          borderRadius: 10,
          padding: 13,
          color: '#18332f',
        }}
      />
      {!!error && <Text style={{ color: '#b42318' }}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={continueRegistration}
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
            核验邀请码并继续
          </Text>
        )}
      </Pressable>
      {opened && (
        <Text style={{ color: '#536a64' }}>注册页面已打开。完成注册后返回这里登录。</Text>
      )}
      <Pressable accessibilityRole="button" onPress={() => router.push('/handleLogin')}>
        <Text style={{ color: '#075e52', textAlign: 'center' }}>已有账号？登录</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/feed')}>
        <Text style={{ color: '#075e52', textAlign: 'center' }}>先浏览公开笔记</Text>
      </Pressable>
    </ScrollView>
  )
}
