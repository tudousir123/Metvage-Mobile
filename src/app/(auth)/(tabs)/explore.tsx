import Feather from '@expo/vector-icons/Feather'
import { router, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandHeader } from 'src/components/metvage/brand'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import {
  type UnavailableFeatureKey,
  unavailableFeatures,
} from 'src/lib/unavailable-features'

const plans: UnavailableFeatureKey[] = [
  'nearby',
  'shop',
  'daily-inspiration',
  'tasks',
  'growth',
  'messages',
  'auto-book',
]
export default function ExploreScreen() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" backgroundColor={c.background} />
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <BrandHeader>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="map-pin" size={20} color={c.green} />
            <Text style={{ color: c.text, fontSize: 16 }}>附近</Text>
          </View>
        </BrandHeader>
        <View style={{ paddingHorizontal: 16, gap: 20 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/search')}
            style={({ pressed }) => ({
              backgroundColor: c.field,
              borderRadius: 26,
              minHeight: 48,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Feather name="search" size={23} color={c.text} />
            <Text style={{ fontSize: 15, color: c.secondaryText }}>
              搜索公开笔记与宠物
            </Text>
          </Pressable>
          <View
            style={{
              borderRadius: 23,
              backgroundColor: c.softGreen,
              padding: 25,
              minHeight: 210,
              justifyContent: 'center',
              gap: 18,
            }}
          >
            <Feather name="map" size={44} color={c.green} />
            <Text style={{ fontSize: 27, fontWeight: '700', color: c.green }}>
              一起发现，更多好去处
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 23, color: c.secondaryText }}>
              附近地图与宠物友好地点尚未开放。{'\n'}先在公开笔记里，看看它们的日常。
            </Text>
          </View>
          <Text style={{ color: c.text, fontSize: 23, fontWeight: '700' }}>
            期待和它一起
          </Text>
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: 18,
              paddingHorizontal: 16,
            }}
          >
            {plans.map((key, index) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${unavailableFeatures[key].title}，未开放`}
                onPress={() => router.push(`/unavailable/${key}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 18,
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: c.border,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>
                  {unavailableFeatures[key].title}
                </Text>
                <Text style={{ color: c.secondaryText, marginRight: 8, fontSize: 13 }}>
                  未开放
                </Text>
                <Feather name="chevron-right" size={18} color={c.secondaryText} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
