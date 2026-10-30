import { useInfiniteQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { getPublicRecords, publicRecordPhotoUrl } from 'src/lib/metvage-public'
import type { PetRecord } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const ink = '#18332f'
const green = '#075e52'

export function promptLogin(): void {
  router.push('/handleLogin')
}

export function PublicRecordFeed({ guest = false }: { guest?: boolean }) {
  const { user } = useAuth()
  const feed = useInfiniteQuery({
    queryKey: ['metvage-public-records', user?.server, user?.token],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getPublicRecords(pageParam),
    getNextPageParam: (page) => page.next_page ?? undefined,
  })
  const records = feed.isError
    ? []
    : (feed.data?.pages.flatMap((page) => page.records) ?? [])

  const renderItem = ({ item }: { item: PetRecord }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`阅读${item.pet.nickname}的公开笔记`}
      onPress={() => router.push(`/note/${item.id}` as Parameters<typeof router.push>[0])}
      style={{
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        gap: 10,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={(event) => {
          event.stopPropagation()
          router.push(`/pet/${item.pet_id}` as Parameters<typeof router.push>[0])
        }}
      >
        <Text style={{ color: green, fontWeight: '700', fontSize: 16 }}>
          {item.pet.nickname} · {item.pet.species === 'cat' ? '猫咪' : '狗狗'}
        </Text>
      </Pressable>
      {item.title && (
        <Text style={{ color: ink, fontSize: 18, fontWeight: '700' }}>{item.title}</Text>
      )}
      {item.text && (
        <Text style={{ color: ink, fontSize: 16, lineHeight: 24 }}>{item.text}</Text>
      )}
      {item.photos[0] && (
        <Image
          source={{ uri: publicRecordPhotoUrl(item.photos[0].url) }}
          cachePolicy="none"
          contentFit="cover"
          style={{ width: '100%', height: 220, borderRadius: 10 }}
        />
      )}
      <Text style={{ color: '#667b76', fontSize: 12 }}>
        {item.published_at ? new Date(item.published_at).toLocaleString() : ''}
      </Text>
      {guest && (
        <Pressable
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation()
            promptLogin()
          }}
        >
          <Text style={{ color: green, fontWeight: '600' }}>点赞或评论 · 登录后参与</Text>
        </Pressable>
      )}
    </Pressable>
  )

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: '#f5f8f6' }}
      data={records}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      ListHeaderComponent={
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={{ color: ink, fontSize: 25, fontWeight: '700' }}>公开笔记</Text>
          <Text style={{ color: '#536a64' }}>
            看看宠物们的新故事。公开内容可供访客浏览。
          </Text>
          {guest && (
            <Pressable
              accessibilityRole="button"
              onPress={promptLogin}
              style={{ paddingVertical: 9 }}
            >
              <Text style={{ color: green, fontWeight: '700' }}>
                发布笔记 · 登录后参与
              </Text>
            </Pressable>
          )}
        </View>
      }
      ListEmptyComponent={
        feed.isLoading ? (
          <ActivityIndicator accessibilityLabel="正在加载公开笔记" />
        ) : feed.isError ? (
          <View style={{ padding: 20, gap: 8 }}>
            <Text style={{ color: '#b42318' }}>{feed.error.message}</Text>
            <Pressable accessibilityRole="button" onPress={() => feed.refetch()}>
              <Text style={{ color: green }}>重试</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ padding: 20, color: '#536a64' }}>还没有公开笔记。</Text>
        )
      }
      ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator /> : null}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage()
      }}
      onEndReachedThreshold={0.4}
      refreshing={feed.isRefetching && !feed.isFetchingNextPage}
      onRefresh={() => feed.refetch()}
    />
  )
}
