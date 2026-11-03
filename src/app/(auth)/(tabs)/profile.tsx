import Feather from '@expo/vector-icons/Feather'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandHeader, IconButton, PetAvatar } from 'src/components/metvage/brand'
import { PetTimeline } from 'src/components/metvage/pet-timeline'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { getPets, selectCurrentPet } from 'src/lib/pets'
import { getPetTimeline, recordPhotoUrl } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

export default function ProfileScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'timeline' | 'about' | 'photos'>('timeline')
  const [switching, setSwitching] = useState(false)
  const pets = useQuery({
    queryKey: ['metvage-pets', user?.server, user?.token],
    queryFn: getPets,
    enabled: !!user,
  })
  const current = pets.data?.pets.find((pet) => pet.id === pets.data.current_pet_id)
  const records = useQuery({
    queryKey: ['metvage-records', current?.id, user?.server, user?.token],
    queryFn: () => getPetTimeline(current!.id),
    enabled: !!user && !!current,
  })
  const select = useMutation({
    mutationFn: selectCurrentPet,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['metvage-pets'] })
      setSwitching(false)
      setTab('timeline')
    },
  })
  useFocusEffect(
    useCallback(() => {
      pets.refetch()
      if (current) records.refetch()
    }, [pets.refetch, records.refetch, current?.id])
  )
  const items = records.isError ? [] : (records.data?.records ?? [])
  const photos = items.flatMap((record) =>
    record.photos.map((photo) => ({ ...photo, recordId: record.id }))
  )
  const other = pets.data?.pets.find((pet) => pet.id !== current?.id)
  const photoSource = (url: string) => ({
    uri: recordPhotoUrl(url),
    headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
  })
  const editProfile = () =>
    router.push(`/settings/pets?edit=${current?.id}` as Parameters<typeof router.push>[0])
  const addRecord = (mode = 'public') =>
    router.push(
      `/records/new?mode=${mode}&pet_id=${current?.id}` as Parameters<
        typeof router.push
      >[0]
    )

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            tintColor={c.green}
            refreshing={pets.isRefetching || records.isRefetching}
            onRefresh={() => {
              pets.refetch()
              if (current) records.refetch()
            }}
          />
        }
      >
        <BrandHeader>
          {current && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: switching }}
              onPress={() => setSwitching(!switching)}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: 'row',
                gap: 7,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.softPeach,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 22,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Feather name="repeat" size={16} color={c.text} />
              <Text style={{ color: c.text, fontSize: 12 }}>切换宠物</Text>
            </Pressable>
          )}
          <IconButton
            name="settings"
            label="设置"
            onPress={() => router.push('/settings')}
          />
        </BrandHeader>
        {pets.fetchStatus === 'paused' && !pets.data && (
          <Text accessibilityRole="alert" style={{ color: c.secondaryText, padding: 24 }}>
            等待网络连接，恢复后会自动加载宠物档案。
          </Text>
        )}
        {pets.isLoading && (
          <ActivityIndicator color={c.green} accessibilityLabel="正在加载宠物档案" />
        )}
        {pets.error && (
          <View style={{ padding: 24, gap: 12 }}>
            <Text style={{ color: c.error }}>{pets.error.message}</Text>
            <Pressable accessibilityRole="button" onPress={() => pets.refetch()}>
              <Text style={{ color: c.green }}>重试加载</Text>
            </Pressable>
          </View>
        )}
        {pets.data && !current && (
          <View style={{ padding: 24, gap: 20, alignItems: 'center' }}>
            <PetAvatar name="宠物" size={100} />
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 24 }}>
              让故事，从它开始
            </Text>
            <Text style={{ color: c.secondaryText, lineHeight: 24, textAlign: 'center' }}>
              为猫咪或狗狗建立档案，把每一次陪伴好好收藏。
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/settings/pets')}
              style={({ pressed }) => ({
                backgroundColor: c.green,
                borderRadius: 28,
                paddingVertical: 16,
                paddingHorizontal: 28,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ color: c.surface, fontWeight: '600' }}>
                {pets.data.pets.length ? '选择宠物身份' : '建立宠物档案'}
              </Text>
            </Pressable>
          </View>
        )}
        {current && (
          <>
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                <View
                  style={{
                    width: '45%',
                    aspectRatio: 1.05,
                    alignSelf: 'flex-start',
                    borderRadius: 20,
                    overflow: 'hidden',
                    backgroundColor: c.softPeach,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {photos[0] ? (
                    <Image
                      source={photoSource(photos[0].url)}
                      cachePolicy="none"
                      contentFit="cover"
                      accessibilityLabel={`${current.nickname}的记录封面`}
                      style={{ position: 'absolute', width: '100%', height: '100%' }}
                    />
                  ) : (
                    <>
                      <PetAvatar
                        name={current.nickname}
                        species={current.species}
                        size={88}
                      />
                      <Text
                        style={{ color: c.secondaryText, fontSize: 12, marginTop: 12 }}
                      >
                        等一张它的照片
                      </Text>
                    </>
                  )}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={{
                        color: c.text,
                        fontSize: 28,
                        fontWeight: '700',
                        flexShrink: 1,
                      }}
                    >
                      {current.nickname}
                    </Text>
                    <IconButton
                      name="edit-2"
                      label="编辑宠物档案"
                      onPress={editProfile}
                    />
                  </View>
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: c.softPeach,
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: c.green, fontSize: 13 }}>
                      {current.species === 'cat' ? '猫咪' : '狗狗'}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{ color: c.secondaryText, fontSize: 14, lineHeight: 20 }}
                  >
                    {current.bio || '一起生活，一起留下温柔的日常。'}
                  </Text>
                  {other && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`切换到${other.nickname}`}
                      disabled={select.isPending}
                      onPress={() => select.mutate(other.id)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        alignSelf: 'flex-start',
                        gap: 8,
                        backgroundColor: c.surface,
                        padding: 5,
                        borderRadius: 14,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <PetAvatar
                        name={other.nickname}
                        species={other.species}
                        size={24}
                      />
                      <Text style={{ color: c.text, fontSize: 13, flexShrink: 1 }}>
                        {other.nickname}
                      </Text>
                      <Feather name="chevron-right" size={15} color={c.secondaryText} />
                    </Pressable>
                  )}
                </View>
              </View>
              {switching && (
                <View
                  style={{
                    backgroundColor: c.surface,
                    borderRadius: 18,
                    padding: 12,
                    gap: 8,
                  }}
                >
                  {pets.data?.pets.map((pet) => (
                    <Pressable
                      key={pet.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: current.id === pet.id }}
                      disabled={select.isPending}
                      onPress={() => select.mutate(pet.id)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: current.id === pet.id ? c.softGreen : c.surface,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <PetAvatar name={pet.nickname} species={pet.species} size={36} />
                      <Text style={{ color: c.text, flex: 1 }}>{pet.nickname}</Text>
                      {current.id === pet.id && (
                        <Feather name="check" size={18} color={c.green} />
                      )}
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/settings/pets')}
                    style={{ padding: 12 }}
                  >
                    <Text style={{ color: c.green }}>添加或管理宠物</Text>
                  </Pressable>
                </View>
              )}
              {select.error && (
                <Text accessibilityRole="alert" style={{ color: c.error }}>
                  {select.error.message}
                </Text>
              )}
              <View
                style={{
                  backgroundColor: c.softPeach,
                  borderRadius: 18,
                  flexDirection: 'row',
                  padding: 12,
                  gap: 14,
                  alignItems: 'center',
                }}
              >
                <Feather name="book-open" size={25} color={c.coral} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.secondaryText, fontSize: 12 }}>珍藏日常</Text>
                  <Text style={{ color: c.text, fontWeight: '700', fontSize: 23 }}>
                    {records.isError || !records.data ? '—' : items.length}{' '}
                    <Text style={{ fontSize: 13, fontWeight: '400' }}>篇记录</Text>
                  </Text>
                </View>
                <View style={{ width: 1, height: 36, backgroundColor: c.border }} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/unavailable/growth')}
                  style={{ flex: 1, alignItems: 'center', gap: 3 }}
                >
                  <Text style={{ color: c.text, fontSize: 14 }}>成长等级</Text>
                  <Text style={{ color: c.secondaryText, fontSize: 12 }}>未开放</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={editProfile}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: c.field,
                    borderColor: c.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingVertical: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Feather name="file-text" size={20} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 16 }}>编辑档案</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => addRecord()}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: c.green,
                    borderRadius: 14,
                    paddingVertical: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Feather name="plus-circle" size={20} color={c.surface} />
                  <Text style={{ color: c.surface, fontSize: 16 }}>添加记录</Text>
                </Pressable>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                borderBottomWidth: 1,
                borderBottomColor: c.border,
                marginTop: 10,
                marginBottom: 12,
              }}
            >
              {(['timeline', 'about', 'photos'] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === value }}
                  onPress={() => setTab(value)}
                  style={{ flex: 1, alignItems: 'center', paddingTop: 14, gap: 10 }}
                >
                  <Text
                    style={{
                      color: tab === value ? c.text : c.secondaryText,
                      fontSize: 17,
                      fontWeight: tab === value ? '700' : '400',
                    }}
                  >
                    {value === 'timeline'
                      ? '时间线'
                      : value === 'about'
                        ? '关于它'
                        : '照片'}
                  </Text>
                  <View
                    style={{
                      height: 3,
                      width: 40,
                      borderRadius: 2,
                      backgroundColor: tab === value ? c.green : 'transparent',
                    }}
                  />
                </Pressable>
              ))}
            </View>
            {tab === 'about' ? (
              <View style={{ padding: 24, gap: 18 }}>
                <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>
                  关于{current.nickname}
                </Text>
                <Text style={{ color: c.secondaryText, fontSize: 16, lineHeight: 26 }}>
                  {current.bio || '还没有填写介绍。写下它的性格，或你们的相遇吧。'}
                </Text>
                <Pressable accessibilityRole="button" onPress={editProfile}>
                  <Text style={{ color: c.green }}>完善它的档案</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => addRecord('private')}
                >
                  <Text style={{ color: c.green }}>添加一份仅自己可见的记录</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {records.fetchStatus === 'paused' && !records.data && (
                  <Text
                    accessibilityRole="alert"
                    style={{ color: c.secondaryText, padding: 24 }}
                  >
                    等待网络连接，恢复后会自动加载记录。
                  </Text>
                )}
                {records.isLoading && (
                  <ActivityIndicator
                    color={c.green}
                    accessibilityLabel="正在加载宠物记录"
                  />
                )}
                {records.error && (
                  <View style={{ padding: 24, gap: 12 }}>
                    <Text style={{ color: c.error }}>{records.error.message}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => records.refetch()}
                    >
                      <Text style={{ color: c.green }}>重试加载记录</Text>
                    </Pressable>
                  </View>
                )}
                {records.data &&
                  !records.isError &&
                  (tab === 'timeline' ? (
                    <PetTimeline records={items} isOwner />
                  ) : (
                    <View
                      style={{
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      {photos.map((photo) => (
                        <Pressable
                          key={`${photo.recordId}-${photo.id}`}
                          accessibilityRole="button"
                          accessibilityLabel="查看照片所在记录"
                          onPress={() =>
                            router.push(
                              `/records/${photo.recordId}/edit` as Parameters<
                                typeof router.push
                              >[0]
                            )
                          }
                          style={{ width: '31.5%', aspectRatio: 1 }}
                        >
                          <Image
                            source={photoSource(photo.url)}
                            cachePolicy="none"
                            contentFit="cover"
                            style={{ width: '100%', height: '100%', borderRadius: 12 }}
                          />
                        </Pressable>
                      ))}
                      {!photos.length && (
                        <Text style={{ color: c.secondaryText, padding: 20 }}>
                          还没有照片，记录它的第一个可爱瞬间吧。
                        </Text>
                      )}
                    </View>
                  ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
