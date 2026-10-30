import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { blockPetAccount, getPetBlockStatus, unblockPetAccount } from 'src/lib/pet-blocks'
import { getPets } from 'src/lib/pets'
import { useAuth } from 'src/state/AuthProvider'
import { PetFollowButton } from './pet-follow-button'

const notice = '屏蔽覆盖对方账号管理的所有宠物。未登录访客仍可能浏览双方公开的内容。'

export function PetSocialControls({ targetPetId }: { targetPetId: number }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const pets = useQuery({
    queryKey: ['metvage-pets', user?.server, user?.token],
    queryFn: getPets,
    enabled: !!user,
  })
  const status = useQuery({
    queryKey: ['metvage-block-status', user?.server, user?.token, targetPetId],
    queryFn: () => getPetBlockStatus(targetPetId),
    enabled: !!user && !pets.data?.pets.some((pet) => pet.id === targetPetId),
  })
  const mutation = useMutation({
    mutationFn: () =>
      status.data?.blocked
        ? unblockPetAccount(targetPetId)
        : blockPetAccount(targetPetId),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['metvage-block-status'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-blocks'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-public-records'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-public-pet'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-public-pet-records'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-public-search'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-following-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-follows'] }),
      ])
      if (result.blocked) router.back()
    },
  })

  if (!user) {
    return (
      <View style={{ gap: 8 }}>
        <PetFollowButton targetPetId={targetPetId} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/handleLogin')}>
          <Text style={{ color: '#075e52', fontWeight: '700' }}>登录后屏蔽</Text>
        </Pressable>
      </View>
    )
  }
  if (pets.isLoading || status.isLoading) {
    return <ActivityIndicator accessibilityLabel="正在加载屏蔽状态" />
  }
  if (pets.data?.pets.some((pet) => pet.id === targetPetId)) {
    return <PetFollowButton targetPetId={targetPetId} />
  }

  return (
    <View style={{ gap: 8 }}>
      {!status.data?.blocked && <PetFollowButton targetPetId={targetPetId} />}
      <Pressable
        accessibilityRole="button"
        disabled={mutation.isPending}
        onPress={() => {
          if (status.data?.blocked) {
            mutation.mutate()
          } else {
            Alert.alert('屏蔽这个宠物身份？', notice, [
              { text: '取消', style: 'cancel' },
              { text: '屏蔽', style: 'destructive', onPress: () => mutation.mutate() },
            ])
          }
        }}
      >
        <Text style={{ color: '#9f2c25', fontWeight: '700' }}>
          {mutation.isPending
            ? '正在保存…'
            : status.data?.blocked
              ? '取消屏蔽'
              : '屏蔽此宠物的主人账号'}
        </Text>
      </Pressable>
      <Text style={{ color: '#536a64', fontSize: 13 }}>{notice}</Text>
      {(pets.error || status.error || mutation.error) && (
        <Text style={{ color: '#b42318' }}>
          {(pets.error || status.error || mutation.error)?.message}
        </Text>
      )}
    </View>
  )
}
