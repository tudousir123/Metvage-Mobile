import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
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
        queryClient.invalidateQueries({ queryKey: ['metvage-public-records'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-public-pet'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-public-pet-records'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-public-search'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-following-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-follows'] }),
      ])
    },
  })

  return (
    <View style={{ padding: 16, backgroundColor: '#fff', gap: 8 }}>
      <Text style={{ color: '#18332f', fontSize: 17, fontWeight: '700' }}>
        {block.pet?.nickname ?? '已屏蔽的账号'}
      </Text>
      <Text style={{ color: '#536a64' }}>屏蔽范围包括此账号管理的所有宠物。</Text>
      <Pressable
        accessibilityRole="button"
        disabled={mutation.isPending}
        onPress={() => mutation.mutate()}
      >
        <Text style={{ color: '#075e52', fontWeight: '700' }}>
          {mutation.isPending ? '正在取消…' : '取消屏蔽'}
        </Text>
      </Pressable>
      {mutation.error && (
        <Text style={{ color: '#b42318' }}>{mutation.error.message}</Text>
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
    <View style={{ flex: 1, backgroundColor: '#f5f8f6' }}>
      <Stack.Screen options={{ title: '屏蔽关系' }} />
      <FlatList
        data={blocks.data?.blocks ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <BlockedPetRow block={item} />}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: '#e1ebe6' }} />
        )}
        ListHeaderComponent={
          <Text style={{ padding: 16, color: '#536a64' }}>
            登录后，双方账号及所有宠物身份不能继续接触。未登录访客仍可能浏览公开内容。
          </Text>
        }
        ListEmptyComponent={
          blocks.isLoading ? (
            <ActivityIndicator accessibilityLabel="正在加载屏蔽关系" />
          ) : blocks.isError ? (
            <View style={{ padding: 16, gap: 8 }}>
              <Text style={{ color: '#b42318' }}>{blocks.error.message}</Text>
              <Pressable accessibilityRole="button" onPress={() => blocks.refetch()}>
                <Text style={{ color: '#075e52' }}>重试</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ padding: 16, color: '#536a64' }}>当前没有屏蔽关系。</Text>
          )
        }
        refreshing={blocks.isRefetching}
        onRefresh={() => blocks.refetch()}
      />
    </View>
  )
}
