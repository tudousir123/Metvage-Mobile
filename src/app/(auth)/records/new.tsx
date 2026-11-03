import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMetvageColors } from 'src/lib/metvage-colors'
import { getPets } from 'src/lib/pets'
import { createPetRecord, type RecordVisibility } from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export default function NewRecordScreen() {
  const colors = useMetvageColors()
  const { mode, pet_id } = useLocalSearchParams<{ mode?: string; pet_id?: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([])
  const requestId = useRef(
    `record-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  )
  const [visibility, setVisibility] = useState<RecordVisibility>(
    mode === 'private' ? 'private' : 'public'
  )
  useEffect(() => {
    setVisibility(mode === 'private' ? 'private' : 'public')
  }, [mode])
  const [chosenPetId, setChosenPetId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')

  const pickPhotos = async () => {
    setFormError('')
    try {
      const remaining = 9 - photos.length
      if (remaining <= 0) {
        setFormError('每条记录最多添加 9 张照片。')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      })
      if (result.canceled) return
      if (result.assets.length > remaining) {
        setFormError('每条记录最多添加 9 张照片，请减少选择数量。')
        return
      }
      setPhotos((previous) => [...previous, ...result.assets])
    } catch {
      setFormError('无法打开相册，请检查照片权限后重试。')
    }
  }
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
      if (!content && photos.length === 0) throw new Error('请写下记录内容或添加照片')
      if (title.length > 50) throw new Error('标题最多 50 个字')
      if (photos.length > 9) throw new Error('每条记录最多添加 9 张照片')
      return createPetRecord({
        pet_id: selectedPetId,
        text: content,
        title: title.trim(),
        visibility,
        photos: photos.map(({ uri, fileName, mimeType }) => ({
          uri,
          fileName,
          mimeType,
        })),
        client_request_id: requestId.current,
      })
    },
    onSuccess: async ({ record }) => {
      await queryClient.invalidateQueries()
      router.replace(
        `/pets/${record.pet_id}/records` as Parameters<typeof router.replace>[0]
      )
    },
    onError: (failure) => setFormError(failure.message),
  })

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
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
          <Text style={{ color: colors.error }}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => refetch()}>
            <Text style={{ color: colors.link }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {data?.pets.length === 0 && (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text }}>
            发布或添加私人记录前，请先建立一只猫或狗的宠物档案。
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/pets')}
          >
            <Text style={{ color: colors.link }}>去建立宠物档案</Text>
          </Pressable>
        </View>
      )}
      {data && data.pets.length > 0 && (
        <>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              选择宠物身份
            </Text>
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
                <Text style={{ color: '#17352f' }}>
                  {pet.species === 'cat' ? '🐈' : '🐕'} {pet.nickname}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="记录标题（可选）"
            placeholder="标题（可选，最多 50 字）"
            placeholderTextColor="#63746f"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
            style={{
              padding: 14,
              color: '#17352f',
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#ccd8d2',
              borderRadius: 10,
            }}
          />
          <TextInput
            accessibilityLabel="记录内容"
            placeholder="写下这一刻…（可只发照片）"
            placeholderTextColor="#63746f"
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            style={{
              minHeight: 160,
              padding: 14,
              color: '#17352f',
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#ccd8d2',
              borderRadius: 10,
            }}
          />
          <View style={{ gap: 10 }}>
            <Pressable accessibilityRole="button" onPress={pickPhotos}>
              <Text style={{ color: colors.link, fontWeight: '700' }}>
                添加照片（{photos.length}/9）
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {photos.map((photo, index) => (
                <View key={`${photo.uri}-${index}`} style={{ gap: 4 }}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={{ width: 96, height: 96, borderRadius: 8 }}
                    contentFit="cover"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`移除第 ${index + 1} 张照片`}
                    onPress={() =>
                      setPhotos((current) => current.filter((_, item) => item !== index))
                    }
                  >
                    <Text style={{ color: colors.error }}>移除</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              谁能看到
            </Text>
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
                <Text style={{ color: '#17352f' }}>
                  {value === 'public'
                    ? '公开笔记 · 访客也能看到'
                    : '私人记录 · 仅自己可见'}
                </Text>
              </Pressable>
            ))}
          </View>
          {formError !== '' && <Text style={{ color: colors.error }}>{formError}</Text>}
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
