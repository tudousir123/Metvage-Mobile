import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ActivityIndicator, Text, View } from 'react-native'
import { ActionButton } from 'src/components/metvage/secondary-ui'
import { followPet, getPetFollows, unfollowPet } from 'src/lib/follows'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
import { getPets } from 'src/lib/pets'
import { useAuth } from 'src/state/AuthProvider'

export function PetFollowButton({ targetPetId }: { targetPetId: number }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const pets = useQuery({
    queryKey: ['metvage-pets', user?.server, user?.token],
    queryFn: getPets,
    enabled: !!user,
  })
  const hasCurrentPet = pets.data?.pets.some((pet) => pet.id === pets.data.current_pet_id)
  const ownPet = pets.data?.pets.some((pet) => pet.id === targetPetId)
  const follows = useQuery({
    queryKey: ['metvage-follows', user?.server, user?.token, pets.data?.current_pet_id],
    queryFn: getPetFollows,
    enabled: !!user && !!hasCurrentPet && !ownPet,
  })
  const followed = follows.data?.follows.some(
    (item) => item.target_pet.id === targetPetId
  )
  const mutation = useMutation({
    mutationFn: async () => {
      if (followed) await unfollowPet(targetPetId)
      else await followPet(targetPetId)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['metvage-follows'] }),
        queryClient.invalidateQueries({ queryKey: ['metvage-following-feed'] }),
      ])
    },
  })

  if (!user) {
    return (
      <ActionButton
        title="登录后关注"
        icon="user-plus"
        onPress={() => router.push('/handleLogin')}
      />
    )
  }
  if (pets.isLoading)
    return <ActivityIndicator color={c.green} accessibilityLabel="正在加载宠物身份" />
  if (pets.error && !pets.data) {
    return (
      <ActionButton
        title="宠物身份加载失败，点此重试"
        tone="secondary"
        onPress={() => pets.refetch()}
      />
    )
  }
  if (ownPet)
    return (
      <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
        这是你自己的宠物
      </Text>
    )
  if (hasCurrentPet && follows.isLoading) {
    return <ActivityIndicator color={c.green} accessibilityLabel="正在加载关注状态" />
  }
  if (hasCurrentPet && follows.error && !follows.data) {
    return (
      <ActionButton
        title="关注状态加载失败，点此重试"
        tone="secondary"
        onPress={() => follows.refetch()}
      />
    )
  }

  return (
    <View style={{ gap: m.gap }}>
      <ActionButton
        title={
          !hasCurrentPet
            ? '建立宠物后关注'
            : mutation.isPending
              ? '正在保存…'
              : followed
                ? '取消关注'
                : '关注宠物'
        }
        icon={followed ? 'user-check' : 'user-plus'}
        tone={followed ? 'secondary' : 'primary'}
        busy={mutation.isPending}
        disabled={hasCurrentPet && follows.isLoading}
        onPress={() => {
          if (!hasCurrentPet) router.push('/settings/pets')
          else mutation.mutate()
        }}
      />
      {(pets.error || follows.error || mutation.error) && (
        <Text accessibilityRole="alert" style={{ color: c.error, fontSize: m.cardTitle }}>
          {(pets.error || follows.error || mutation.error)?.message}
        </Text>
      )}
    </View>
  )
}
