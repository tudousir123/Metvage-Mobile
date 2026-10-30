import { Link, router, Stack } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { PublicRecordFeed } from 'src/components/metvage/public-record-feed'

export default function GuestFeed() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Metvage · 公开笔记' }} />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 20,
          padding: 14,
          backgroundColor: '#fff',
        }}
      >
        <Link href="/public-search" asChild>
          <Pressable accessibilityRole="button">
            <Text style={{ color: '#075e52', fontWeight: '700' }}>搜索</Text>
          </Pressable>
        </Link>
        <Pressable accessibilityRole="button" onPress={() => router.push('/handleLogin')}>
          <Text style={{ color: '#075e52', fontWeight: '700' }}>登录</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/handleSignup')}
        >
          <Text style={{ color: '#075e52', fontWeight: '700' }}>凭邀请注册</Text>
        </Pressable>
      </View>
      <PublicRecordFeed guest />
    </View>
  )
}
