import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { followPet, getPetFollows, unfollowPet } from 'src/lib/follows'
import { getPets } from 'src/lib/pets'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

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
      <Pressable accessibilityRole="button" onPress={() => router.push('/handleLogin')}>
        <Text style={{ color: green, fontWeight: '700' }}>登录后关注</Text>
      </Pressable>
    )
  }
  if (pets.isLoading) return <ActivityIndicator accessibilityLabel="正在加载宠物身份" />
  if (pets.error && !pets.data) {
    return (
      <Pressable accessibilityRole="button" onPress={() => pets.refetch()}>
        <Text style={{ color: '#b42318' }}>宠物身份加载失败，点此重试</Text>
      </Pressable>
    )
  }
  if (ownPet) return <Text style={{ color: '#63746f' }}>这是你自己的宠物</Text>
  if (hasCurrentPet && follows.isLoading) {
    return <ActivityIndicator accessibilityLabel="正在加载关注状态" />
  }
  if (hasCurrentPet && follows.error && !follows.data) {
    return (
      <Pressable accessibilityRole="button" onPress={() => follows.refetch()}>
        <Text style={{ color: '#b42318' }}>关注状态加载失败，点此重试</Text>
      </Pressable>
    )
  }

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        disabled={mutation.isPending || (hasCurrentPet && follows.isLoading)}
        onPress={() => {
          if (!hasCurrentPet) {
            router.push('/settings/pets')
          } else {
            mutation.mutate()
          }
        }}
      >
        <Text style={{ color: green, fontWeight: '700' }}>
          {!hasCurrentPet
            ? '建立宠物后关注'
            : mutation.isPending
              ? '正在保存…'
              : followed
                ? '取消关注'
                : '关注宠物'}
        </Text>
      </Pressable>
      {(pets.error || follows.error || mutation.error) && (
        <Text style={{ color: '#b42318' }}>
          {(pets.error || follows.error || mutation.error)?.message}
        </Text>
      )}
    </View>
  )
}
