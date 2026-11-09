import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { ActionButton } from 'src/components/metvage/secondary-ui'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
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
        queryClient.resetQueries({ queryKey: ['metvage-public-records'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-pet'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-pet-records'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-note'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-search'] }),
        queryClient.resetQueries({ queryKey: ['metvage-interactions'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-following-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-follows'] }),
      ])
      if (result.blocked) router.back()
    },
  })

  if (!user) {
    return (
      <View style={{ gap: m.gap }}>
        <PetFollowButton targetPetId={targetPetId} />
        <ActionButton
          title="登录后屏蔽"
          icon="slash"
          tone="secondary"
          onPress={() => router.push('/handleLogin')}
        />
      </View>
    )
  }
  if (pets.isLoading || status.isLoading) {
    return <ActivityIndicator color={c.green} accessibilityLabel="正在加载屏蔽状态" />
  }
  if (pets.data?.pets.some((pet) => pet.id === targetPetId)) {
    return <PetFollowButton targetPetId={targetPetId} />
  }

  return (
    <View style={{ gap: m.gap }}>
      {!status.data?.blocked && <PetFollowButton targetPetId={targetPetId} />}
      <ActionButton
        title={
          mutation.isPending
            ? '正在保存…'
            : status.data?.blocked
              ? '取消屏蔽'
              : '屏蔽此宠物的主人账号'
        }
        icon="slash"
        tone="destructive"
        busy={mutation.isPending}
        onPress={() => {
          if (status.data?.blocked) mutation.mutate()
          else
            Alert.alert('屏蔽这个宠物身份？', notice, [
              { text: '取消', style: 'cancel' },
              { text: '屏蔽', style: 'destructive', onPress: () => mutation.mutate() },
            ])
        }}
      />
      <Text style={{ color: c.secondaryText, fontSize: m.caption, lineHeight: 20 }}>
        {notice}
      </Text>
      {(pets.error || status.error || mutation.error) && (
        <Text accessibilityRole="alert" style={{ color: c.error, fontSize: m.cardTitle }}>
          {(pets.error || status.error || mutation.error)?.message}
        </Text>
      )}
    </View>
  )
}
