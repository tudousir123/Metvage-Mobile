import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import {
  ActionButton,
  ScreenMessage,
  secondaryScreenOptions,
} from 'src/components/metvage/secondary-ui'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
import {
  getPetAccountBlocks,
  type PetAccountBlock,
  removePetAccountBlock,
} from 'src/lib/pet-blocks'
import { useAuth } from 'src/state/AuthProvider'

function BlockedPetRow({ block }: { block: PetAccountBlock }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => removePetAccountBlock(block.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['metvage-blocks'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-block-status'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-records'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-pet'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-pet-records'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-note'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-search'] }),
        queryClient.resetQueries({ queryKey: ['metvage-interactions'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-following-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-follows'] }),
      ])
    },
  })

  return (
    <View
      style={{
        padding: m.edge,
        backgroundColor: c.surface,
        gap: m.inset,
        borderRadius: 16,
      }}
    >
      <Text style={{ color: c.text, fontSize: m.body, fontWeight: '600' }}>
        {block.pet?.nickname ?? '已屏蔽的账号'}
      </Text>
      <Text style={{ color: c.secondaryText, fontSize: m.caption, lineHeight: 20 }}>
        屏蔽范围包括此账号管理的所有宠物。
      </Text>
      <ActionButton
        title={mutation.isPending ? '正在取消…' : '取消屏蔽'}
        tone="secondary"
        icon="unlock"
        busy={mutation.isPending}
        onPress={() => mutation.mutate()}
      />
      {mutation.error && (
        <Text accessibilityRole="alert" style={{ color: c.error, fontSize: m.cardTitle }}>
          {mutation.error.message}
        </Text>
      )}
    </View>
  )
}

export default function BlockedPetsScreen() {
  const { user } = useAuth()
  const blocks = useQuery({
    queryKey: ['metvage-blocks', user?.server, user?.token],
    queryFn: getPetAccountBlocks,
    enabled: !!user,
  })

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ ...secondaryScreenOptions, title: '屏蔽关系' }} />
      <FlatList
        data={blocks.data?.blocks ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          padding: m.edge,
          paddingBottom: 32,
          gap: m.inset,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item }) => <BlockedPetRow block={item} />}
        ListHeaderComponent={
          <View style={{ gap: m.inset }}>
            <Text
              style={{ color: c.secondaryText, fontSize: m.cardTitle, lineHeight: 23 }}
            >
              登录后，双方账号及所有宠物身份不能继续接触。未登录访客仍可能浏览公开内容。
            </Text>
            {blocks.isError && (
              <ScreenMessage icon="wifi-off" title="暂时无法加载屏蔽关系">
                <Text
                  accessibilityRole="alert"
                  style={{ color: c.error, fontSize: m.cardTitle }}
                >
                  {blocks.error.message}
                </Text>
                <ActionButton
                  title="重试"
                  icon="rotate-cw"
                  onPress={() => blocks.refetch()}
                />
              </ScreenMessage>
            )}
          </View>
        }
        ListEmptyComponent={
          blocks.isLoading ? (
            <ActivityIndicator color={c.green} accessibilityLabel="正在加载屏蔽关系" />
          ) : !blocks.isError ? (
            <ScreenMessage icon="shield" title="当前没有屏蔽关系">
              <Text
                style={{
                  color: c.secondaryText,
                  fontSize: m.caption,
                  textAlign: 'center',
                }}
              >
                可从宠物公开档案中管理屏蔽。
              </Text>
            </ScreenMessage>
          ) : null
        }
        refreshing={blocks.isRefetching}
        onRefresh={() => blocks.refetch()}
      />
    </View>
  )
}
