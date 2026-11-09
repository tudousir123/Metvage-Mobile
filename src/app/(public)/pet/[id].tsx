import Feather from '@expo/vector-icons/Feather'
import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { PetAvatar } from 'src/components/metvage/brand'
import { RecordPreviewCard } from 'src/components/metvage/record-preview-card'
import {
  ActionButton,
  ScreenMessage,
  secondaryScreenOptions,
} from 'src/components/metvage/secondary-ui'
import { PetSocialControls } from 'src/components/pets/pet-block-button'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
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
  const failed = profile.isError || timeline.isError
  const records = failed ? [] : (timeline.data?.records ?? [])
  const photo = records.flatMap((record) => record.photos)[0]
  const refresh = () => {
    profile.refetch()
    timeline.refetch()
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ ...secondaryScreenOptions, title: '宠物公开档案' }} />
      <FlatList
        data={records}
        numColumns={2}
        keyExtractor={(record) => String(record.id)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: m.edge,
          paddingBottom: 32,
          gap: m.inset,
          flexGrow: 1,
        }}
        columnWrapperStyle={{ gap: m.gap }}
        refreshing={profile.isRefetching || timeline.isRefetching}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={{ gap: m.edge }}>
            {(profile.isLoading || timeline.isLoading) && (
              <ActivityIndicator color={c.green} accessibilityLabel="正在加载宠物档案" />
            )}
            {failed ? (
              <ScreenMessage icon="wifi-off" title="暂时无法查看宠物档案">
                <ActionButton title="重试" icon="rotate-cw" onPress={refresh} />
              </ScreenMessage>
            ) : (
              profile.data && (
                <>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: m.edge }}
                  >
                    <PetAvatar
                      name={profile.data.nickname}
                      species={profile.data.species}
                      uri={photo ? publicRecordPhotoUrl(photo.url) : undefined}
                      size={88}
                    />
                    <View style={{ flex: 1, gap: m.gap }}>
                      <Text
                        style={{ color: c.text, fontSize: m.petName, fontWeight: '700' }}
                      >
                        {profile.data.nickname}
                      </Text>
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          paddingHorizontal: m.inset,
                          paddingVertical: 4,
                          borderRadius: 16,
                          backgroundColor: c.softPeach,
                        }}
                      >
                        <Text style={{ color: c.green, fontSize: m.caption }}>
                          {profile.data.species === 'cat' ? '猫咪' : '狗狗'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {!!profile.data.bio && (
                    <Text
                      style={{ color: c.text, fontSize: m.cardTitle, lineHeight: 23 }}
                    >
                      {profile.data.bio}
                    </Text>
                  )}
                  <PetSocialControls targetPetId={petId} />
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: m.gap,
                      borderBottomWidth: 1,
                      borderBottomColor: c.border,
                    }}
                  >
                    <Text
                      style={{
                        color: c.text,
                        fontSize: m.section,
                        fontWeight: '700',
                        flexShrink: 1,
                      }}
                    >
                      公开笔记
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="举报这个宠物身份"
                      onPress={() =>
                        router.push(
                          user
                            ? (`/reports/new?target_type=pet&target_id=${petId}` as Parameters<
                                typeof router.push
                              >[0])
                            : '/handleLogin'
                        )
                      }
                      style={({ pressed }) => ({
                        minHeight: m.touch,
                        minWidth: m.touch,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: m.gap,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Feather name="flag" size={16} color={c.secondaryText} />
                      <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
                        举报
                      </Text>
                    </Pressable>
                  </View>
                </>
              )
            )}
          </View>
        }
        ListEmptyComponent={
          !failed && !profile.isLoading && !timeline.isLoading ? (
            <ScreenMessage icon="book-open" title="还没有公开笔记">
              <Text
                style={{
                  color: c.secondaryText,
                  fontSize: m.caption,
                  textAlign: 'center',
                }}
              >
                这里仅展示主人选择公开的宠物记录。
              </Text>
            </ScreenMessage>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: '50%' }}>
            <RecordPreviewCard record={item} />
          </View>
        )}
      />
    </View>
  )
}
