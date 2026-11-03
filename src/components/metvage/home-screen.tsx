import Feather from '@expo/vector-icons/Feather'
import { router, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
import { BrandHeader, IconButton } from './brand'
import { FollowingRecordFeed } from './following-record-feed'
import { PublicRecordFeed } from './public-record-feed'

export function HomeScreen({ guest = false }: { guest?: boolean }) {
  const [feed, setFeed] = useState<'recommended' | 'following'>('recommended')
  const insets = useSafeAreaInsets()
  const login = () => router.push('/handleLogin')
  const planned = (feature: string) =>
    router.push(
      `${guest ? '/planned' : '/unavailable'}/${feature}` as Parameters<
        typeof router.push
      >[0]
    )
  const search = () => router.push(guest ? '/public-search' : '/search')
  const header = (
    <View>
      <BrandHeader>
        <IconButton
          name="bell"
          label="消息通知"
          onPress={() => (guest ? login() : router.push('/(auth)/(tabs)/notifications'))}
        />
        <IconButton
          name="plus"
          label="发布笔记"
          tone="coral"
          onPress={() => (guest ? login() : router.push('/records/new?mode=public'))}
        />
      </BrandHeader>
      <View style={{ paddingHorizontal: m.edge, paddingTop: 4, gap: m.gap }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="搜索宠物笔记"
          hitSlop={{ top: 4, bottom: 4 }}
          onPress={search}
          style={({ pressed }) => ({
            backgroundColor: c.field,
            borderRadius: 28,
            minHeight: 40,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: m.edge,
            gap: m.gap,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Feather name="search" size={m.icon} color={c.text} />
          <Text style={{ flex: 1, color: c.secondaryText, fontSize: m.body }}>
            搜索宠物笔记
          </Text>
          <Feather name="sliders" size={22} color={c.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(
            [
              {
                key: 'shop',
                title: '宠物商城',
                subtitle: '好物陪伴 · 未开放',
                icon: 'shopping-bag',
                background: c.softGreen,
              },
              {
                key: 'daily-inspiration',
                title: '每日灵感',
                subtitle: '养宠乐趣 · 未开放',
                icon: 'sun',
                background: c.softPeach,
              },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}，未开放`}
              onPress={() => planned(item.key)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: item.background,
                borderRadius: 17,
                minHeight: 52,
                padding: m.gap,
                gap: 6,
                flexDirection: 'row',
                alignItems: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Feather
                name={item.icon}
                size={m.icon}
                color={item.key === 'shop' ? c.green : c.coral}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.text, fontWeight: '600', fontSize: m.cardTitle }}>
                  {item.title}
                </Text>
                <Text style={{ color: c.secondaryText, fontSize: 10 }}>
                  {item.subtitle}
                </Text>
              </View>
              <Feather name="chevron-right" size={15} color={c.text} />
            </Pressable>
          ))}
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 38,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        {(
          [
            { key: 'recommended', title: '推荐' },
            { key: 'following', title: '关注' },
            { key: 'nearby', title: '附近' },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityState={{ selected: feed === tab.key }}
            onPress={() => {
              if (tab.key === 'nearby') planned('nearby')
              else if (guest && tab.key === 'following') login()
              else setFeed(tab.key)
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              minHeight: 40,
              paddingTop: 8,
              gap: 4,
            }}
          >
            <Text
              style={{
                color: feed === tab.key ? c.text : c.secondaryText,
                fontSize: m.section,
                fontWeight: feed === tab.key ? '700' : '400',
              }}
            >
              {tab.title}
            </Text>
            <View
              style={{
                width: 38,
                height: 3,
                borderRadius: 2,
                backgroundColor: feed === tab.key ? c.green : 'transparent',
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  )
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" backgroundColor={c.background} />
      {feed === 'recommended' ? (
        <PublicRecordFeed guest={guest} header={header} />
      ) : (
        <FollowingRecordFeed header={header} />
      )}
      {guest && (
        <View
          style={{
            flexDirection: 'row',
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 8),
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: c.background,
          }}
        >
          {(
            [
              { title: '首页', icon: 'home' },
              { title: '探索', icon: 'compass' },
              { title: '发布', icon: 'plus' },
              { title: '消息', icon: 'message-circle' },
              { title: '我的', icon: 'user' },
            ] as const
          ).map((tab, index) => (
            <Pressable
              key={tab.title}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === 0 }}
              onPress={() =>
                index === 0
                  ? setFeed('recommended')
                  : index === 1
                    ? planned('explore')
                    : login()
              }
              style={{ flex: 1, alignItems: 'center', minHeight: m.touch, gap: 2 }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: index === 2 ? c.green : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather
                  name={tab.icon}
                  size={index === 2 ? 24 : m.icon}
                  color={
                    index === 2 ? c.surface : index === 0 ? c.green : c.secondaryText
                  }
                />
              </View>
              <Text
                style={{
                  fontSize: m.caption,
                  color: index === 0 ? c.green : c.secondaryText,
                }}
              >
                {tab.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  )
}
