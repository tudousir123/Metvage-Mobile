import { router, Stack } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

export default function WelcomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 28,
        backgroundColor: '#f5f8f6',
        gap: 18,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ fontSize: 38, fontWeight: '700', color: '#18332f' }}>Metvage</Text>
      <Text style={{ fontSize: 17, lineHeight: 25, color: '#536a64' }}>
        记录宠物的日常，分享它们的故事。公开笔记无需登录即可浏览。
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/feed')}
        style={{ backgroundColor: '#075e52', padding: 15, borderRadius: 12 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>
          以访客身份浏览
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/handleLogin')}
        style={{ padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#075e52' }}
      >
        <Text style={{ color: '#075e52', textAlign: 'center', fontWeight: '700' }}>
          登录
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/handleSignup')}>
        <Text style={{ color: '#075e52', textAlign: 'center' }}>凭邀请码注册</Text>
      </Pressable>
      <Text style={{ color: '#536a64', textAlign: 'center' }}>
        首版采用邀请试用。主动公开的笔记仍可被访客看到。
      </Text>
    </View>
  )
}
