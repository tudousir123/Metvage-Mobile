import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { getPublicPet, getPublicPetRecords } from 'src/lib/metvage-public'

export default function PublicPet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const petId = Number(id)
  const profile = useQuery({
    queryKey: ['metvage-public-pet', petId],
    queryFn: () => getPublicPet(petId),
    enabled: Number.isInteger(petId) && petId > 0,
  })
  const timeline = useQuery({
    queryKey: ['metvage-public-pet-records', petId],
    queryFn: () => getPublicPetRecords(petId),
    enabled: Number.isInteger(petId) && petId > 0,
  })

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 14 }}
    >
      <Stack.Screen options={{ title: '宠物公开档案' }} />
      {(profile.isLoading || timeline.isLoading) && (
        <ActivityIndicator accessibilityLabel="正在加载宠物档案" />
      )}
      {(profile.isError || timeline.isError) && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#b42318' }}>暂时无法查看宠物档案。</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              profile.refetch()
              timeline.refetch()
            }}
          >
            <Text style={{ color: '#075e52' }}>重试</Text>
          </Pressable>
        </View>
      )}
      {profile.data && (
        <>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#18332f' }}>
            {profile.data.nickname}
          </Text>
          <Text style={{ color: '#536a64' }}>
            {profile.data.species === 'cat' ? '猫咪' : '狗狗'}
          </Text>
          {!!profile.data.bio && (
            <Text style={{ color: '#18332f' }}>{profile.data.bio}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/handleLogin')}
          >
            <Text style={{ color: '#075e52', fontWeight: '700' }}>关注 · 登录后参与</Text>
          </Pressable>
        </>
      )}
      {timeline.data?.records.length === 0 && (
        <Text style={{ color: '#536a64' }}>还没有公开笔记。</Text>
      )}
      {timeline.data?.records.map((record) => (
        <Pressable
          key={record.id}
          accessibilityRole="button"
          onPress={() =>
            router.push(`/note/${record.id}` as Parameters<typeof router.push>[0])
          }
          style={{ padding: 16, borderRadius: 14, backgroundColor: '#f5f8f6' }}
        >
          <Text style={{ color: '#18332f' }}>{record.text}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}
