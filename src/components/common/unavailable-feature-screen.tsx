import Feather from '@expo/vector-icons/Feather'
import { router, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { ComponentProps } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandHeader, IconButton, PawMark } from 'src/components/metvage/brand'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { getUnavailableFeature } from 'src/lib/unavailable-features'

const artwork: Record<
  string,
  { icon: ComponentProps<typeof Feather>['name']; title: string; caption: string }
> = {
  shop: {
    icon: 'shopping-bag',
    title: '把日常，\n过得更舒服',
    caption: '陪它过好每一个温柔的日常。',
  },
  explore: {
    icon: 'compass',
    title: '下一站，\n和它一起发现',
    caption: '宠物友好地点与附近探索，正在准备中。',
  },
  nearby: {
    icon: 'map-pin',
    title: '带上它，\n看看身边的世界',
    caption: '未来在这里发现适合一起前往的地方。',
  },
  'daily-inspiration': {
    icon: 'sun',
    title: '每一次陪伴，\n都是爱的日常',
    caption: '按自己的节奏，留下你和它的故事。',
  },
  tasks: {
    icon: 'check-circle',
    title: '今天，\n也和它在一起',
    caption: '日常任务尚未开放，现在就可以自由记录。',
  },
  growth: {
    icon: 'award',
    title: '慢慢长大，\n好好陪伴',
    caption: '成长等级尚未开放，回忆一直值得珍藏。',
  },
  messages: {
    icon: 'message-circle',
    title: '分享这份\n小小的快乐',
    caption: '私信尚未开放，公开笔记中仍可点赞和评论。',
  },
  'auto-book': {
    icon: 'book-open',
    title: '把每一刻，\n收藏成一本回忆',
    caption: '自动成册尚未开放，先把日常好好记录。',
  },
}

export default function UnavailableFeatureScreen({ featureKey }: { featureKey: string }) {
  const feature = getUnavailableFeature(featureKey)
  const visual = artwork[featureKey] ?? artwork.explore
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: c.background }}
    >
      <Stack.Screen options={{ headerShown: false, title: feature.title }} />
      <StatusBar style="dark" backgroundColor={c.background} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <BrandHeader>
          <IconButton name="x" label="返回" onPress={() => router.back()} />
        </BrandHeader>
        <View style={{ paddingHorizontal: 16, gap: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: c.text, fontSize: 23, fontWeight: '700' }}>
              {feature.title}
            </Text>
            <Text
              style={{
                color: c.green,
                backgroundColor: c.softGreen,
                paddingHorizontal: 13,
                paddingVertical: 6,
                borderRadius: 14,
                fontSize: 13,
              }}
            >
              未开放
            </Text>
          </View>
          <View
            style={{
              backgroundColor: featureKey === 'messages' ? c.softGreen : c.softPeach,
              borderRadius: 24,
              padding: 28,
              minHeight: 270,
              justifyContent: 'space-between',
              gap: 28,
            }}
          >
            <View style={{ alignItems: 'flex-end' }}>
              <Feather name={visual.icon} size={58} color={c.green} />
            </View>
            <View style={{ gap: 12 }}>
              <Text
                style={{
                  color: c.green,
                  fontSize: 31,
                  lineHeight: 43,
                  fontWeight: '700',
                }}
              >
                {visual.title}
              </Text>
              <Text style={{ color: c.secondaryText, fontSize: 15, lineHeight: 24 }}>
                {visual.caption}
              </Text>
            </View>
          </View>
          <View
            style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 4 }}
          >
            <PawMark size={25} />
            <Text
              style={{ color: c.secondaryText, fontSize: 15, lineHeight: 24, flex: 1 }}
            >
              {feature.description} 开放后会在这里与你见面。
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              backgroundColor: c.green,
              padding: 16,
              borderRadius: 28,
              alignItems: 'center',
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text style={{ color: c.surface, fontWeight: '600', fontSize: 17 }}>
              返回继续逛逛
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
