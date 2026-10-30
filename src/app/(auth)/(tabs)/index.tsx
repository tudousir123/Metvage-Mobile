import { Link, Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { FollowingRecordFeed } from 'src/components/metvage/following-record-feed'
import { PublicRecordFeed } from 'src/components/metvage/public-record-feed'

export default function HomeScreen() {
  const [feed, setFeed] = useState<'recommended' | 'following'>('recommended')

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: '首页' }} />
      <View
        style={{ flexDirection: 'row', gap: 12, padding: 12, backgroundColor: '#fff' }}
      >
        <Link href="/unavailable/daily-inspiration" asChild>
          <Pressable
            accessibilityRole="button"
            style={{
              flex: 1,
              padding: 10,
              borderWidth: 1,
              borderRadius: 10,
              borderColor: '#afc6be',
            }}
          >
            <Text style={{ color: '#075e52', textAlign: 'center' }}>
              每日灵感 · 未开放
            </Text>
          </Pressable>
        </Link>
        <Link href="/unavailable/tasks" asChild>
          <Pressable
            accessibilityRole="button"
            style={{
              flex: 1,
              padding: 10,
              borderWidth: 1,
              borderRadius: 10,
              borderColor: '#afc6be',
            }}
          >
            <Text style={{ color: '#075e52', textAlign: 'center' }}>任务 · 未开放</Text>
          </Pressable>
        </Link>
      </View>
      <View
        style={{ flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12 }}
      >
        {(['recommended', 'following'] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: feed === tab }}
            onPress={() => setFeed(tab)}
            style={{ flex: 1, alignItems: 'center', padding: 12 }}
          >
            <Text
              style={{ color: feed === tab ? '#075e52' : '#536a64', fontWeight: '700' }}
            >
              {tab === 'recommended' ? '推荐' : '关注'}
            </Text>
          </Pressable>
        ))}
      </View>
      {feed === 'recommended' ? <PublicRecordFeed /> : <FollowingRecordFeed />}
    </View>
  )
}
