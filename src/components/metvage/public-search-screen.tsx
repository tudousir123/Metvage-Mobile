import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { searchPublicPetsAndRecords } from 'src/lib/metvage-public'
import type { PetProfile } from 'src/lib/pets'
import type { PetRecord } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

type Result = { kind: 'pet'; value: PetProfile } | { kind: 'record'; value: PetRecord }

const ink = '#18332f'
const green = '#075e52'

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
      if (term) {
        queryClient.invalidateQueries({ queryKey: ['metvage-public-search', term] })
      }
    }, [queryClient, term])
  )
  const loading = query.trim() !== term || search.isLoading
  const sections: { title: string; data: Result[] }[] = []
  if (!search.isError && search.data?.pets.length) {
    sections.push({
      title: '宠物档案',
      data: search.data.pets.map((value) => ({ kind: 'pet', value })),
    })
  }
  if (!search.isError && search.data?.records.length) {
    sections.push({
      title: '公开笔记',
      data: search.data.records.map((value) => ({ kind: 'record', value })),
    })
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f8f6' }}>
      <Stack.Screen options={{ title: '搜索公开内容' }} />
      <View style={{ padding: 16, backgroundColor: '#fff' }}>
        <TextInput
          accessibilityLabel="搜索公开笔记和宠物档案"
          autoFocus
          maxLength={100}
          value={query}
          onChangeText={setQuery}
          placeholder="搜索公开笔记或宠物昵称"
          placeholderTextColor="#667b76"
          style={{
            padding: 12,
            borderWidth: 1,
            borderColor: '#afc6be',
            borderRadius: 12,
            color: ink,
            fontSize: 16,
          }}
        />
      </View>
      {term.length === 0 ? (
        <Text style={{ padding: 20, color: '#536a64' }}>输入关键词查找公开内容。</Text>
      ) : loading ? (
        <ActivityIndicator accessibilityLabel="正在搜索" style={{ marginTop: 24 }} />
      ) : search.isError ? (
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ color: '#b42318' }}>搜索失败：{search.error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => search.refetch()}>
            <Text style={{ color: green }}>重试</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <Text style={{ padding: 20, color: '#536a64' }}>
          没有找到公开结果，试试其他关键词。
        </Text>
      ) : (
        <SectionList
          keyboardShouldPersistTaps="handled"
          sections={sections}
          keyExtractor={(item) => `${item.kind}-${item.value.id}`}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                color: '#536a64',
                fontSize: 14,
                fontWeight: '700',
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  (item.kind === 'pet'
                    ? `/pet/${item.value.id}`
                    : `/note/${item.value.id}`) as Parameters<typeof router.push>[0]
                )
              }
              style={{ padding: 16, backgroundColor: '#fff', gap: 4 }}
            >
              <Text style={{ color: ink, fontSize: 16, fontWeight: '700' }}>
                {item.kind === 'pet'
                  ? item.value.nickname
                  : item.value.title || item.value.text || '照片笔记'}
              </Text>
              <Text style={{ color: '#536a64' }}>
                {item.kind === 'pet'
                  ? item.value.species === 'cat'
                    ? '猫咪'
                    : '狗狗'
                  : `${item.value.pet.nickname}的公开笔记`}
              </Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: '#e1ebe6' }} />
          )}
          onRefresh={() => search.refetch()}
          refreshing={search.isRefetching}
        />
      )}
    </View>
  )
}
