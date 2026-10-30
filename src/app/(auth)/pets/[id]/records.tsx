import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { getPetTimeline, recordPhotoUrl } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export default function PetTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const petId = Number(id)
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['metvage-records', petId, user?.server, user?.token],
    queryFn: () => getPetTimeline(petId),
    enabled: !!user && Number.isSafeInteger(petId) && petId > 0,
  })

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
              {record.title && (
                <Text style={{ fontSize: 18, fontWeight: '700' }}>{record.title}</Text>
              )}
              {record.text && <Text style={{ fontSize: 16 }}>{record.text}</Text>}
              {record.photos.length > 0 && (
                <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
                  {record.photos.map((photo) => (
                    <Image
                      key={photo.id}
                      source={{
                        uri: recordPhotoUrl(photo.url),
                        headers: user?.token
                          ? { Authorization: `Bearer ${user.token}` }
                          : undefined,
                      }}
                      cachePolicy="none"
                      contentFit="cover"
                      style={{ width: 220, height: 220, borderRadius: 10 }}
                    />
                  ))}
                </ScrollView>
              )}
              <Text style={{ color: '#63746f' }}>
                {new Date(record.created_at).toLocaleString()}
              </Text>
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
