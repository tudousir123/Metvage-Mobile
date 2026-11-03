import { useInfiniteQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import type { ReactElement } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { getPublicRecords } from 'src/lib/metvage-public'
import { useAuth } from 'src/state/AuthProvider'
import { PawMark } from './brand'
import { RecordPreviewCard } from './record-preview-card'

export function promptLogin(): void {
  router.push('/handleLogin')
}

export function PublicRecordFeed({
  guest = false,
  header,
}: {
  guest?: boolean
  header?: ReactElement
}) {
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
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      columnWrapperStyle={{ paddingHorizontal: 12, gap: 8, marginBottom: 10 }}
      numColumns={2}
      data={records}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>
          <RecordPreviewCard record={item} />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        feed.isLoading ? (
          <ActivityIndicator
            accessibilityLabel="正在加载公开笔记"
            color={c.green}
            style={{ margin: 40 }}
          />
        ) : feed.isError ? (
          <View style={{ padding: 28, gap: 14, alignItems: 'center' }}>
            <Text style={{ color: c.error }}>{feed.error.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => feed.refetch()}
              style={{ padding: 12 }}
            >
              <Text style={{ color: c.green }}>重新加载</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ padding: 36, gap: 14, alignItems: 'center' }}>
            <View style={{ padding: 22, backgroundColor: c.softPeach, borderRadius: 48 }}>
              <PawMark size={42} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: c.text }}>
              每个日常，都值得留下
            </Text>
            <Text style={{ color: c.secondaryText, textAlign: 'center', lineHeight: 23 }}>
              这里还没有公开笔记。
              {guest
                ? '先逛逛，或登录分享你和它的故事。'
                : '来分享你和它的第一个故事吧。'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                guest ? promptLogin() : router.push('/records/new?mode=public')
              }
              style={{
                paddingVertical: 13,
                paddingHorizontal: 26,
                backgroundColor: c.green,
                borderRadius: 25,
              }}
            >
              <Text style={{ color: c.surface, fontWeight: '600' }}>
                {guest ? '登录后记录' : '写下第一篇笔记'}
              </Text>
            </Pressable>
          </View>
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? <ActivityIndicator color={c.green} /> : null
      }
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage()
      }}
      onEndReachedThreshold={0.4}
      refreshing={feed.isRefetching && !feed.isFetchingNextPage}
      onRefresh={() => feed.refetch()}
    />
  )
}
