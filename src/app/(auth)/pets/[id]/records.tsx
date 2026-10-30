import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import {
  getPetTimeline,
  type RecordVisibility,
  updateRecordVisibility,
} from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export default function PetTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [visibilityError, setVisibilityError] = useState('')
  const petId = Number(id)
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['metvage-records', petId, user?.server, user?.token],
    queryFn: () => getPetTimeline(petId),
    enabled: !!user && Number.isSafeInteger(petId) && petId > 0,
  })
  const visibilityChange = useMutation({
    mutationFn: ({
      recordId,
      visibility,
    }: {
      recordId: number
      visibility: RecordVisibility
    }) => updateRecordVisibility(recordId, visibility),
    onSuccess: async () => {
      setVisibilityError('')
      await queryClient.invalidateQueries()
    },
    onError: (failure) => setVisibilityError(failure.message),
  })

  const changeVisibility = (recordId: number, visibility: RecordVisibility) => {
    if (visibilityChange.isPending) return
    setVisibilityError('')
    if (visibility === 'public') {
      Alert.alert('公开这条记录？', '公开后，未登录访客也能看到这条笔记。', [
        { text: '取消', style: 'cancel' },
        {
          text: '确认公开',
          onPress: () => visibilityChange.mutate({ recordId, visibility }),
        },
      ])
      return
    }
    visibilityChange.mutate({ recordId, visibility })
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
    >
      <Stack.Screen options={{ title: '宠物时间线' }} />
      {isLoading && <ActivityIndicator accessibilityLabel="正在加载宠物时间线" />}
      {error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#b42318' }}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => refetch()}>
            <Text style={{ color: green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {visibilityError !== '' && (
        <Text style={{ color: '#b42318' }}>{visibilityError}</Text>
      )}
      {data && (
        <>
          {isFetching && <Text style={{ color: '#63746f' }}>正在同步…</Text>}
          {data.records.length === 0 && <Text>还没有记录。保存第一段日常吧。</Text>}
          {data.records.map((record) => (
            <View
              key={record.id}
              style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 }}
            >
              <Text style={{ fontWeight: '700', color: green }}>
                {record.visibility === 'public' ? '公开笔记' : '私人记录 · 仅自己可见'}
              </Text>
              <Text style={{ fontSize: 16 }}>{record.text}</Text>
              <Text style={{ color: '#63746f' }}>
                {new Date(record.created_at).toLocaleString()}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  record.visibility === 'public' ? '改为私人记录' : '公开这条记录'
                }
                disabled={visibilityChange.isPending}
                onPress={() =>
                  changeVisibility(
                    record.id,
                    record.visibility === 'public' ? 'private' : 'public'
                  )
                }
                style={{ opacity: visibilityChange.isPending ? 0.6 : 1 }}
              >
                <Text style={{ color: green }}>
                  {record.visibility === 'public' ? '改为私人记录' : '公开这条记录'}
                </Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                `/records/new?mode=public&pet_id=${petId}` as Parameters<
                  typeof router.push
                >[0]
              )
            }
          >
            <Text style={{ color: green }}>发布笔记</Text>
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
          >
            <Text style={{ color: green }}>添加私人记录</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}
