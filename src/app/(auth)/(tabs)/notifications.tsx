import Feather from '@expo/vector-icons/Feather'
import { useInfiniteQuery } from '@tanstack/react-query'
import { router, Stack, useFocusEffect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandHeader, PetAvatar } from 'src/components/metvage/brand'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
import { getPetNotifications, type PetNotification } from 'src/lib/petNotifications'
import { useAuth } from 'src/state/AuthProvider'

const notificationPresentation = {
  follow: { text: '关注了你的宠物', icon: 'user-plus', color: c.green },
  like: { text: '赞了你的公开笔记', icon: 'heart', color: c.coral },
  comment: { text: '评论了你的公开笔记', icon: 'message-circle', color: c.green },
} as const

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
        contentContainerStyle={{ padding: m.edge, paddingBottom: 32, flexGrow: 1 }}
        refreshing={notificationsQuery.isRefetching}
        onRefresh={() => notificationsQuery.refetch()}
        onEndReached={() => {
          if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
            notificationsQuery.fetchNextPage()
          }
        }}
        ListHeaderComponent={
          <View style={{ gap: m.edge, paddingBottom: m.edge }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: m.petName, fontWeight: '700', color: c.text }}>
                消息
              </Text>
              <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
                每一份喜欢，都有回响
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="私信 · 未开放"
              onPress={() => router.push('/unavailable/messages')}
              style={({ pressed }) => ({
                padding: m.inset,
                borderRadius: 14,
                backgroundColor: pressed ? c.softGreen : c.surface,
                minHeight: m.touch,
                flexDirection: 'row',
                alignItems: 'center',
                gap: m.inset,
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: c.softGreen,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="message-circle" size={18} color={c.green} />
              </View>
              <Text
                style={{
                  flex: 1,
                  color: c.text,
                  fontSize: m.cardTitle,
                  fontWeight: '600',
                }}
              >
                私信
              </Text>
              <Text style={{ color: c.secondaryText, fontSize: m.caption }}>未开放</Text>
              <Feather name="chevron-right" size={16} color={c.secondaryText} />
            </Pressable>
            <Text style={{ color: c.text, fontSize: m.cardTitle, fontWeight: '600' }}>
              互动通知
            </Text>
            {notificationsQuery.isLoading && (
              <ActivityIndicator color={c.green} accessibilityLabel="正在加载站内通知" />
            )}
            {notificationsQuery.error && (
              <View
                style={{
                  gap: m.gap,
                  backgroundColor: c.surface,
                  borderRadius: 14,
                  padding: m.inset,
                }}
              >
                <Text style={{ color: c.error, fontSize: m.cardTitle }}>
                  {notificationsQuery.error.message}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => notificationsQuery.refetch()}
                  style={({ pressed }) => ({
                    minHeight: m.touch,
                    paddingHorizontal: m.inset,
                    alignSelf: 'flex-start',
                    justifyContent: 'center',
                    borderRadius: 24,
                    backgroundColor: c.softGreen,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{ color: c.green, fontSize: m.cardTitle, fontWeight: '600' }}
                  >
                    重试加载
                  </Text>
                </Pressable>
              </View>
            )}
            {notificationsQuery.isFetching && notifications.length > 0 && (
              <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
                正在同步…
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          notificationsQuery.data && !notificationsQuery.error ? (
            <View
              style={{
                paddingVertical: 48,
                paddingHorizontal: m.edge,
                alignItems: 'center',
                gap: m.inset,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: c.softPeach,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="bell" size={26} color={c.coral} />
              </View>
              <Text style={{ color: c.text, fontSize: m.body, fontWeight: '600' }}>
                还没有站内通知
              </Text>
              <Text
                style={{
                  color: c.secondaryText,
                  fontSize: m.caption,
                  lineHeight: 18,
                  textAlign: 'center',
                }}
              >
                有人关注、点赞或评论时，这份心意会出现在这里。
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const presentation = notificationPresentation[item.type]
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => openNotification(item)}
              style={({ pressed }) => ({
                paddingVertical: m.edge,
                paddingHorizontal: m.gap,
                borderBottomWidth: 0.5,
                borderBottomColor: c.border,
                backgroundColor: pressed ? c.field : c.background,
                gap: m.inset,
                flexDirection: 'row',
                alignItems: 'flex-start',
              })}
            >
              <View>
                <PetAvatar
                  name={item.actor_pet.nickname}
                  species={item.actor_pet.species}
                  size={42}
                />
                <View
                  style={{
                    position: 'absolute',
                    right: -3,
                    bottom: -3,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: c.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather
                    name={presentation.icon}
                    size={12}
                    color={presentation.color}
                  />
                </View>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.text, fontSize: m.cardTitle, fontWeight: '700' }}>
                  {item.actor_pet.nickname}
                </Text>
                <Text style={{ color: c.text, fontSize: m.cardTitle }}>
                  {presentation.text}
                </Text>
                <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
                  {new Date(item.created_at).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={c.secondaryText}
                style={{ marginTop: 12 }}
              />
            </Pressable>
          )
        }}
        ListFooterComponent={
          notificationsQuery.isFetchingNextPage ? (
            <ActivityIndicator color={c.green} accessibilityLabel="正在加载更多通知" />
          ) : null
        }
      />
    </SafeAreaView>
  )
}
