import { useFocusEffect } from '@react-navigation/native'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, Stack } from 'expo-router'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { getFollowingFeed, getPetFollows } from 'src/lib/follows'
import type { PetRecord } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export default function FollowingFeedScreen() {
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
    <>
      <Stack.Screen options={{ title: '关注' }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        data={records}
        keyExtractor={(record) => String(record.id)}
        renderItem={({ item }: { item: PetRecord }) => (
          <View
            style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 }}
          >
            <Text style={{ color: green, fontWeight: '700' }}>
              {item.pet.nickname} · {item.pet.species === 'cat' ? '猫' : '狗'}
            </Text>
            <Text style={{ fontSize: 16 }}>{item.text}</Text>
            <Text style={{ color: '#63746f' }}>
              {new Date(item.published_at ?? item.created_at).toLocaleString()}
            </Text>
          </View>
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
    </>
  )
}
