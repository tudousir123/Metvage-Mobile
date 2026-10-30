import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { getPublicRecord, publicRecordPhotoUrl } from 'src/lib/metvage-public'
import { useAuth } from 'src/state/AuthProvider'

export default function PublicNote() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const recordId = Number(id)
  const note = useQuery({
    queryKey: ['metvage-public-note', recordId],
    queryFn: () => getPublicRecord(recordId),
    enabled: Number.isInteger(recordId) && recordId > 0,
  })

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16 }}
    >
      <Stack.Screen options={{ title: '公开笔记' }} />
      {note.isLoading && <ActivityIndicator accessibilityLabel="正在加载笔记" />}
      {note.isError && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#b42318' }}>此笔记暂时无法查看。</Text>
          <Pressable accessibilityRole="button" onPress={() => note.refetch()}>
            <Text style={{ color: '#075e52' }}>重试</Text>
          </Pressable>
        </View>
      )}
      {note.data && (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                `/pet/${note.data.record.pet_id}` as Parameters<typeof router.push>[0]
              )
            }
          >
            <Text style={{ color: '#075e52', fontSize: 20, fontWeight: '700' }}>
              {note.data.record.pet.nickname}
            </Text>
          </Pressable>
          {note.data.record.title && (
            <Text style={{ color: '#18332f', fontSize: 22, fontWeight: '700' }}>
              {note.data.record.title}
            </Text>
          )}
          {note.data.record.text && (
            <Text style={{ color: '#18332f', fontSize: 17, lineHeight: 27 }}>
              {note.data.record.text}
            </Text>
          )}
          {note.data.record.photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: publicRecordPhotoUrl(photo.url) }}
              cachePolicy="none"
              contentFit="contain"
              style={{ width: '100%', height: 300, borderRadius: 10 }}
            />
          ))}
          <Text style={{ color: '#667b76' }}>
            {note.data.record.published_at
              ? new Date(note.data.record.published_at).toLocaleString()
              : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/handleLogin')}
          >
            <Text style={{ color: '#075e52', fontWeight: '700' }}>
              点赞或评论 · 登录后参与
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                user
                  ? (`/reports/new?target_type=record&target_id=${recordId}` as Parameters<
                      typeof router.push
                    >[0])
                  : '/handleLogin'
              )
            }
          >
            <Text style={{ color: '#b42318' }}>举报这篇公开笔记</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}
