import { useInfiniteQuery } from '@tanstack/react-query'
import { router, Stack, useFocusEffect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandHeader, PetAvatar } from 'src/components/metvage/brand'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { getPetNotifications, type PetNotification } from 'src/lib/petNotifications'
import { useAuth } from 'src/state/AuthProvider'

const green = c.green

function notificationText(notification: PetNotification): string {
  switch (notification.type) {
    case 'follow':
      return '关注了你的宠物'
    case 'like':
      return '赞了你的公开笔记'
    case 'comment':
      return '评论了你的公开笔记'
  }
}

export default function NotificationsScreen() {
  const { user } = useAuth()
  const notificationsQuery = useInfiniteQuery({
    queryKey: ['metvage-notifications', user?.server, user?.token],
    queryFn: ({ pageParam }) => getPetNotifications(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next_page ?? undefined,
    enabled: !!user,
  })
  useFocusEffect(
    useCallback(() => {
      notificationsQuery.refetch()
    }, [notificationsQuery.refetch])
  )
  const notifications =
    notificationsQuery.data?.pages.flatMap((page) => page.notifications) ?? []

  const openNotification = (notification: PetNotification) => {
    if (notification.type === 'follow' && notification.target_pet_id) {
      router.push(
        `/pet/${notification.target_pet_id}` as Parameters<typeof router.push>[0]
      )
    } else if (notification.target_record_id) {
      router.push(
        `/note/${notification.target_record_id}` as Parameters<typeof router.push>[0]
      )
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style="dark" backgroundColor={c.background} />
      <BrandHeader />
      <Stack.Screen options={{ title: '消息', headerShown: false }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={notifications}
        keyExtractor={(notification) => String(notification.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12, flexGrow: 1 }}
        refreshing={notificationsQuery.isRefetching}
        onRefresh={() => notificationsQuery.refetch()}
        onEndReached={() => {
          if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
            notificationsQuery.fetchNextPage()
          }
        }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>
              站内通知
            </Text>
            <Text style={{ color: c.secondaryText }}>关注、点赞和评论会显示在这里。</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/unavailable/messages')}
              style={{ padding: 14, borderRadius: 12, backgroundColor: c.softGreen }}
            >
              <Text style={{ color: green, fontWeight: '700' }}>私信 · 未开放</Text>
            </Pressable>
            {notificationsQuery.isLoading && (
              <ActivityIndicator accessibilityLabel="正在加载站内通知" />
            )}
            {notificationsQuery.error && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: c.error }}>{notificationsQuery.error.message}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => notificationsQuery.refetch()}
                >
                  <Text style={{ color: green }}>重试加载</Text>
                </Pressable>
              </View>
            )}
            {notificationsQuery.isFetching && notifications.length > 0 && (
              <Text style={{ color: c.secondaryText }}>正在同步…</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          notificationsQuery.data && !notificationsQuery.error ? (
            <Text style={{ color: c.secondaryText }}>还没有站内通知。</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => openNotification(item)}
            style={{
              padding: 16,
              borderRadius: 18,
              backgroundColor: c.surface,
              gap: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <PetAvatar
              name={item.actor_pet.nickname}
              species={item.actor_pet.species}
              size={44}
            />
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: c.text, fontWeight: '700' }}>
                {item.actor_pet.nickname} {notificationText(item)}
              </Text>
              <Text style={{ color: c.secondaryText }}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          notificationsQuery.isFetchingNextPage ? (
            <ActivityIndicator accessibilityLabel="正在加载更多通知" />
          ) : null
        }
      />
    </SafeAreaView>
  )
}
