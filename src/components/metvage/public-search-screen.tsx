import Feather from '@expo/vector-icons/Feather'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
import { publicRecordPhotoUrl, searchPublicPetsAndRecords } from 'src/lib/metvage-public'
import type { PetProfile } from 'src/lib/pets'
import type { PetRecord } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'
import { PetAvatar } from './brand'
import { ActionButton, ScreenMessage, secondaryScreenOptions } from './secondary-ui'

type Result = { kind: 'pet'; value: PetProfile } | { kind: 'record'; value: PetRecord }

export function PublicSearchScreen() {
  const { initialQuery } = useLocalSearchParams<{ initialQuery?: string }>()
  const [query, setQuery] = useState(initialQuery ?? '')
  const [term, setTerm] = useState(query.trim())
  const queryClient = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  const search = useQuery({
    queryKey: ['metvage-public-search', term, user?.server, user?.token],
    queryFn: () => searchPublicPetsAndRecords(term),
    enabled: term.length > 0,
    refetchOnMount: 'always',
  })
  useFocusEffect(
    useCallback(() => {
      if (term)
        queryClient.invalidateQueries({ queryKey: ['metvage-public-search', term] })
    }, [queryClient, term])
  )
  const loading = query.trim() !== term || (term.length > 0 && search.isLoading)
  const sections: { title: string; data: Result[] }[] = []
  if (!search.isError && !loading && term) {
    if (search.data?.pets.length)
      sections.push({
        title: '宠物档案',
        data: search.data.pets.map((value) => ({ kind: 'pet', value })),
      })
    if (search.data?.records.length)
      sections.push({
        title: '公开笔记',
        data: search.data.records.map((value) => ({ kind: 'record', value })),
      })
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ ...secondaryScreenOptions, title: '搜索公开内容' }} />
      <View style={{ padding: m.edge, gap: m.inset }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: c.field,
            borderRadius: 24,
            paddingLeft: m.edge,
            gap: m.gap,
          }}
        >
          <Feather name="search" size={m.icon} color={c.green} />
          <TextInput
            accessibilityLabel="搜索公开笔记和宠物档案"
            autoFocus
            maxLength={100}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => setTerm(query.trim())}
            placeholder="笔记内容或宠物昵称"
            placeholderTextColor={c.secondaryText}
            style={{
              flex: 1,
              minHeight: m.touch,
              paddingVertical: m.inset,
              color: c.text,
              fontSize: m.cardTitle,
            }}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清空搜索"
              onPress={() => {
                setQuery('')
                setTerm('')
              }}
              style={({ pressed }) => ({
                minWidth: m.touch,
                minHeight: m.touch,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Feather name="x" size={20} color={c.secondaryText} />
            </Pressable>
          ) : (
            <View style={{ width: m.inset }} />
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: m.gap }}>
          <Feather name="globe" size={14} color={c.secondaryText} />
          <Text style={{ flex: 1, color: c.secondaryText, fontSize: m.caption }}>
            只搜索公开笔记和宠物档案
          </Text>
        </View>
      </View>
      {term.length === 0 ? (
        <ScreenMessage icon="search" title="发现它们的小小世界">
          <Text
            style={{
              color: c.secondaryText,
              fontSize: m.cardTitle,
              textAlign: 'center',
              lineHeight: 23,
            }}
          >
            输入关键词，寻找宠物和它们的公开故事。
          </Text>
        </ScreenMessage>
      ) : loading ? (
        <ActivityIndicator
          color={c.green}
          accessibilityLabel="正在搜索"
          style={{ marginTop: 24 }}
        />
      ) : search.isError ? (
        <ScreenMessage icon="wifi-off" title="暂时无法搜索">
          <Text
            accessibilityRole="alert"
            style={{ color: c.error, fontSize: m.cardTitle, textAlign: 'center' }}
          >
            {search.error.message}
          </Text>
          <ActionButton title="重试" icon="rotate-cw" onPress={() => search.refetch()} />
        </ScreenMessage>
      ) : sections.length === 0 ? (
        <ScreenMessage icon="search" title="没有找到公开结果">
          <Text
            style={{ color: c.secondaryText, fontSize: m.cardTitle, textAlign: 'center' }}
          >
            换个关键词，再找找看。
          </Text>
        </ScreenMessage>
      ) : (
        <SectionList
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          sections={sections}
          contentContainerStyle={{ paddingHorizontal: m.edge, paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
          keyExtractor={(item) => `${item.kind}-${item.value.id}`}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                paddingVertical: m.inset,
                color: c.text,
                fontSize: m.section,
                fontWeight: '700',
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => {
            const record = item.kind === 'record' ? item.value : undefined
            const pet = item.kind === 'pet' ? item.value : item.value.pet
            const photo = (
              record ?? search.data?.records.find((note) => note.pet_id === pet.id)
            )?.photos[0]
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  record
                    ? `阅读${pet.nickname}的公开笔记：${record.title || record.text || '照片笔记'}`
                    : `查看${pet.nickname}的宠物档案`
                }
                onPress={() =>
                  router.push(
                    (record ? `/note/${record.id}` : `/pet/${pet.id}`) as Parameters<
                      typeof router.push
                    >[0]
                  )
                }
                style={({ pressed }) => ({
                  minHeight: m.touch,
                  paddingVertical: m.inset,
                  gap: m.inset,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: pressed ? c.field : c.background,
                })}
              >
                {record ? (
                  photo ? (
                    <Image
                      source={{ uri: publicRecordPhotoUrl(photo.url) }}
                      contentFit="cover"
                      cachePolicy="none"
                      style={{ width: 80, height: 96, borderRadius: 12 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 80,
                        height: 96,
                        borderRadius: 12,
                        backgroundColor: c.softGreen,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="file-text" size={26} color={c.green} />
                    </View>
                  )
                ) : (
                  <PetAvatar
                    name={pet.nickname}
                    species={pet.species}
                    uri={photo ? publicRecordPhotoUrl(photo.url) : undefined}
                    size={52}
                  />
                )}
                <View style={{ flex: 1, gap: m.gap }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: c.text,
                      fontSize: m.cardTitle,
                      fontWeight: '600',
                      lineHeight: 22,
                    }}
                  >
                    {record ? record.title || record.text || '照片笔记' : pet.nickname}
                  </Text>
                  {record?.title && record.text && (
                    <Text
                      numberOfLines={2}
                      style={{
                        color: c.secondaryText,
                        fontSize: m.caption,
                        lineHeight: 20,
                      }}
                    >
                      {record.text}
                    </Text>
                  )}
                  <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
                    {record
                      ? `${pet.nickname} · 公开笔记`
                      : pet.species === 'cat'
                        ? '猫咪'
                        : '狗狗'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={c.secondaryText} />
              </Pressable>
            )
          }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 0.5, backgroundColor: c.border }} />
          )}
          onRefresh={() => search.refetch()}
          refreshing={search.isRefetching}
        />
      )}
    </View>
  )
}
