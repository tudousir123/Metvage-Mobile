import { useFocusEffect } from '@react-navigation/native'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Link, router } from 'expo-router'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { getFollowingFeed, getPetFollows } from 'src/lib/follows'
import { publicRecordPhotoUrl } from 'src/lib/metvage-public'
import type { PetRecord } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export function FollowingRecordFeed() {
  const { user } = useAuth()
  const follows = useQuery({
    queryKey: ['metvage-follows', user?.server, user?.token],
    queryFn: getPetFollows,
    enabled: !!user,
  })
  const feed = useInfiniteQuery({
    queryKey: ['metvage-following-feed', user?.server, user?.token],
    queryFn: ({ pageParam }) => getFollowingFeed(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.next_page_url) return undefined
      const next = Number(new URL(lastPage.next_page_url).searchParams.get('page'))
      return Number.isSafeInteger(next) && next > 0 ? next : undefined
    },
    enabled: !!user,
  })

  useFocusEffect(
    useCallback(() => {
      follows.refetch()
      feed.refetch()
    }, [follows.refetch, feed.refetch])
  )

  const records = feed.data?.pages.flatMap((page) => page.records) ?? []
  const error = feed.error ?? follows.error

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
      data={records}
      keyExtractor={(record) => String(record.id)}
      renderItem={({ item }: { item: PetRecord }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`阅读${item.pet.nickname}的公开笔记`}
          onPress={() =>
            router.push(`/note/${item.id}` as Parameters<typeof router.push>[0])
          }
          style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation()
              router.push(`/pet/${item.pet_id}` as Parameters<typeof router.push>[0])
            }}
          >
            <Text style={{ color: green, fontWeight: '700' }}>
              {item.pet.nickname} · {item.pet.species === 'cat' ? '猫' : '狗'}
            </Text>
          </Pressable>
          {item.title && (
            <Text style={{ fontWeight: '700', fontSize: 17 }}>{item.title}</Text>
          )}
          {item.text && <Text style={{ fontSize: 16 }}>{item.text}</Text>}
          {item.photos[0] && (
            <Image
              source={{ uri: publicRecordPhotoUrl(item.photos[0].url) }}
              cachePolicy="none"
              contentFit="cover"
              style={{ width: '100%', height: 180, borderRadius: 8 }}
            />
          )}
          <Text style={{ color: '#63746f' }}>
            {new Date(item.published_at ?? item.created_at).toLocaleString()}
          </Text>
        </Pressable>
      )}
      ListHeaderComponent={
        <View style={{ gap: 8, paddingBottom: 8 }}>
          {follows.data && (
            <Text style={{ color: '#63746f' }}>
              当前宠物关注了 {follows.data.follows.length} 只宠物
            </Text>
          )}
          <Link href="/settings/pets" asChild>
            <Pressable accessibilityRole="button">
              <Text style={{ color: green }}>切换当前宠物</Text>
            </Pressable>
          </Link>
          {error && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: '#b42318' }}>{error.message}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  follows.refetch()
                  feed.refetch()
                }}
              >
                <Text style={{ color: green }}>重试加载</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        feed.isLoading ? (
          <ActivityIndicator accessibilityLabel="正在加载关注流" />
        ) : !error ? (
          <Text style={{ color: '#63746f' }}>
            还没有关注宠物的公开笔记。打开宠物公开档案即可关注。
          </Text>
        ) : null
      }
      ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator /> : null}
      refreshing={feed.isRefetching}
      onRefresh={() => {
        follows.refetch()
        feed.refetch()
      }}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage()
      }}
    />
  )
}
