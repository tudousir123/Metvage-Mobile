import { useFocusEffect } from '@react-navigation/native'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from 'expo-router'
import { type ReactElement, useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { getFollowingFeed, getPetFollows } from 'src/lib/follows'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { useAuth } from 'src/state/AuthProvider'
import { RecordPreviewCard } from './record-preview-card'

const green = c.green

export function FollowingRecordFeed({ header }: { header?: ReactElement }) {
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
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      numColumns={2}
      columnWrapperStyle={{ paddingHorizontal: 12, gap: 8, marginBottom: 10 }}
      data={records}
      keyExtractor={(record) => String(record.id)}
      renderItem={({ item }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>
          <RecordPreviewCard record={item} />
        </View>
      )}
      ListHeaderComponent={
        <View style={{ gap: 8, paddingBottom: 12 }}>
          {header}
          {follows.data && (
            <Text style={{ color: c.secondaryText }}>
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
              <Text style={{ color: c.error }}>{error.message}</Text>
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
        feed.isPending && feed.fetchStatus === 'paused' ? (
          <Text accessibilityRole="alert" style={{ color: c.secondaryText, padding: 24 }}>
            等待网络连接，恢复后会自动加载关注的笔记。
          </Text>
        ) : feed.isPending ? (
          <ActivityIndicator accessibilityLabel="正在加载关注流" />
        ) : !error ? (
          <Text style={{ color: c.secondaryText }}>
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
