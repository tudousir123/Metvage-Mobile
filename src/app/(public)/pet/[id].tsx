import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { PetSocialControls } from 'src/components/pets/pet-block-button'
import {
  getPublicPet,
  getPublicPetRecords,
  publicRecordPhotoUrl,
} from 'src/lib/metvage-public'
import { useAuth } from 'src/state/AuthProvider'

export default function PublicPet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const petId = Number(id)
  const profile = useQuery({
    queryKey: ['metvage-public-pet', petId, user?.server, user?.token],
    queryFn: () => getPublicPet(petId),
    enabled: Number.isInteger(petId) && petId > 0,
  })
  const timeline = useQuery({
    queryKey: ['metvage-public-pet-records', petId, user?.server, user?.token],
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
      {!profile.isError && profile.data && (
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
          <PetSocialControls targetPetId={petId} />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                user
                  ? (`/reports/new?target_type=pet&target_id=${petId}` as Parameters<
                      typeof router.push
                    >[0])
                  : '/handleLogin'
              )
            }
          >
            <Text style={{ color: '#b42318' }}>举报这个宠物身份</Text>
          </Pressable>
        </>
      )}
      {!timeline.isError && timeline.data?.records.length === 0 && (
        <Text style={{ color: '#536a64' }}>还没有公开笔记。</Text>
      )}
      {!timeline.isError &&
        timeline.data?.records.map((record) => (
          <Pressable
            key={record.id}
            accessibilityRole="button"
            onPress={() =>
              router.push(`/note/${record.id}` as Parameters<typeof router.push>[0])
            }
            style={{ padding: 16, borderRadius: 14, backgroundColor: '#f5f8f6' }}
          >
            {record.title && (
              <Text style={{ color: '#18332f', fontWeight: '700' }}>{record.title}</Text>
            )}
            {record.text && <Text style={{ color: '#18332f' }}>{record.text}</Text>}
            {record.photos[0] && (
              <Image
                source={{ uri: publicRecordPhotoUrl(record.photos[0].url) }}
                cachePolicy="none"
                contentFit="cover"
                style={{ width: '100%', height: 180, borderRadius: 8 }}
              />
            )}
          </Pressable>
        ))}
    </ScrollView>
  )
}
