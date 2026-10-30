import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { getPets } from 'src/lib/pets'
import { createTextRecord, type RecordVisibility } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export default function NewRecordScreen() {
  const { mode, pet_id } = useLocalSearchParams<{ mode?: string; pet_id?: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<RecordVisibility>(
    mode === 'private' ? 'private' : 'public'
  )
  useEffect(() => {
    setVisibility(mode === 'private' ? 'private' : 'public')
  }, [mode])
  const [chosenPetId, setChosenPetId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['metvage-pets', user?.server, user?.token],
    queryFn: getPets,
    enabled: !!user,
  })

  const requestedPetId = Number(pet_id)
  const selectedPetId =
    chosenPetId ??
    (data?.pets.some((pet) => pet.id === requestedPetId) ? requestedPetId : null) ??
    data?.current_pet_id ??
    null

  const save = useMutation({
    mutationFn: async () => {
      if (selectedPetId === null) throw new Error('请先建立并选定宠物身份')
      const content = text.trim()
      if (!content) throw new Error('请写下记录内容')
      return createTextRecord({ pet_id: selectedPetId, text: content, visibility })
    },
    onSuccess: async ({ record }) => {
      await queryClient.invalidateQueries({
        queryKey: ['metvage-records', record.pet_id],
      })
      router.replace(
        `/pets/${record.pet_id}/records` as Parameters<typeof router.replace>[0]
      )
    },
    onError: (failure) => setFormError(failure.message),
  })

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}
    >
      <Stack.Screen
        options={{ title: mode === 'private' ? '添加私人记录' : '发布笔记' }}
      />
      {isLoading && <ActivityIndicator accessibilityLabel="正在加载宠物档案" />}
      {error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#b42318' }}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => refetch()}>
            <Text style={{ color: green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {data?.pets.length === 0 && (
        <View style={{ gap: 10 }}>
          <Text>发布或添加私人记录前，请先建立一只猫或狗的宠物档案。</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/pets')}
          >
            <Text style={{ color: green }}>去建立宠物档案</Text>
          </Pressable>
        </View>
      )}
      {data && data.pets.length > 0 && (
        <>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>选择宠物身份</Text>
            {data.pets.map((pet) => (
              <Pressable
                key={pet.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedPetId === pet.id }}
                onPress={() => setChosenPetId(pet.id)}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: selectedPetId === pet.id ? '#e7f4ee' : '#f4f5f4',
                }}
              >
                <Text>
                  {pet.species === 'cat' ? '🐈' : '🐕'} {pet.nickname}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="记录内容"
            placeholder="写下这一刻…"
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            style={{
              minHeight: 160,
              padding: 14,
              borderWidth: 1,
              borderColor: '#ccd8d2',
              borderRadius: 10,
            }}
          />
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>谁能看到</Text>
            {(['public', 'private'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: visibility === value }}
                onPress={() => setVisibility(value)}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: visibility === value ? '#e7f4ee' : '#f4f5f4',
                }}
              >
                <Text>
                  {value === 'public'
                    ? '公开笔记 · 访客也能看到'
                    : '私人记录 · 仅自己可见'}
                </Text>
              </Pressable>
            ))}
          </View>
          {formError !== '' && <Text style={{ color: '#b42318' }}>{formError}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={save.isPending}
            onPress={() => {
              setFormError('')
              save.mutate()
            }}
            style={{
              backgroundColor: green,
              borderRadius: 10,
              padding: 16,
              alignItems: 'center',
              opacity: save.isPending ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {save.isPending ? '正在保存…' : '保存记录'}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}
