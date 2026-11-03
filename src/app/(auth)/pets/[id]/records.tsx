import Feather from '@expo/vector-icons/Feather'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { PetTimeline } from 'src/components/metvage/pet-timeline'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { getPets } from 'src/lib/pets'
import { getPetTimeline } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

export default function PetTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const petId = Number(id)
  const valid = Number.isSafeInteger(petId) && petId > 0
  const records = useQuery({
    queryKey: ['metvage-records', petId, user?.server, user?.token],
    queryFn: () => getPetTimeline(petId),
    enabled: !!user && valid,
  })
  const pets = useQuery({
    queryKey: ['metvage-pets', user?.server, user?.token],
    queryFn: getPets,
    enabled: !!user,
  })
  const pet = pets.data?.pets.find((item) => item.id === petId)
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          tintColor={c.green}
          refreshing={records.isRefetching}
          onRefresh={() => records.refetch()}
        />
      }
    >
      <Stack.Screen
        options={{
          title: pet ? `${pet.nickname}的时间线` : '宠物时间线',
          headerTintColor: c.green,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
        }}
      />
      <View style={{ padding: 20, gap: 8 }}>
        <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>
          把陪伴，写成故事
        </Text>
        <Text style={{ color: c.secondaryText, lineHeight: 22 }}>
          每一个平凡的日子，都有值得珍藏的瞬间。
        </Text>
      </View>
      {!valid && <Text style={{ color: c.error, padding: 20 }}>宠物档案地址无效。</Text>}
      {records.fetchStatus === 'paused' && !records.data && (
        <Text accessibilityRole="alert" style={{ color: c.secondaryText, padding: 20 }}>
          等待网络连接，恢复后会自动加载宠物时间线。
        </Text>
      )}
      {records.isLoading && (
        <ActivityIndicator accessibilityLabel="正在加载宠物时间线" color={c.green} />
      )}
      {records.error && (
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ color: c.error }}>{records.error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => records.refetch()}>
            <Text style={{ color: c.green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {records.data && !records.isError && (
        <PetTimeline records={records.data.records} isOwner={!!pet} />
      )}
      {pet && (
        <View style={{ padding: 20, gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                `/records/new?mode=public&pet_id=${petId}` as Parameters<
                  typeof router.push
                >[0]
              )
            }
            style={({ pressed }) => ({
              backgroundColor: c.green,
              padding: 16,
              borderRadius: 26,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Feather name="plus" size={20} color={c.surface} />
            <Text style={{ color: c.surface, fontSize: 16, fontWeight: '600' }}>
              发布笔记
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                `/records/new?mode=private&pet_id=${petId}` as Parameters<
                  typeof router.push
                >[0]
              )
            }
            style={({ pressed }) => ({
              padding: 14,
              alignItems: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: c.green }}>添加私人记录 · 仅自己可见</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}
