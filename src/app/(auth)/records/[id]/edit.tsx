import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { getPets } from 'src/lib/pets'
import {
  deletePetRecord,
  getPetRecord,
  recordPhotoUrl,
  updatePetRecord,
} from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export default function EditRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const recordId = Number(id)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [petId, setPetId] = useState<number | null>(null)
  const [keptPhotoIds, setKeptPhotoIds] = useState<number[]>([])
  const [newPhotos, setNewPhotos] = useState<ImagePicker.ImagePickerAsset[]>([])
  const [formError, setFormError] = useState('')
  const initializedRecordKey = useRef<string | null>(null)

  const recordQuery = useQuery({
    queryKey: ['metvage-record', recordId, user?.server, user?.token],
    queryFn: () => getPetRecord(recordId),
    enabled: !!user && Number.isSafeInteger(recordId) && recordId > 0,
  })
  const petsQuery = useQuery({
    queryKey: ['metvage-pets', user?.server, user?.token],
    queryFn: getPets,
    enabled: !!user,
  })
  const record = recordQuery.data?.record
  const isOwner =
    record !== undefined &&
    (petsQuery.data?.pets.some((pet) => pet.id === record.pet_id) ?? false)

  useEffect(() => {
    if (!record || !user) return
    const recordKey = `${user.server}:${user.token}:${record.id}`
    if (initializedRecordKey.current === recordKey) return
    initializedRecordKey.current = recordKey
    setText(record.text ?? '')
    setTitle(record.title ?? '')
    setPetId(record.pet_id)
    setKeptPhotoIds(record.photos.map((photo) => photo.id))
  }, [record])

  const pickPhotos = async () => {
    setFormError('')
    const remaining = 9 - keptPhotoIds.length - newPhotos.length
    if (remaining <= 0) {
      setFormError('每条记录最多添加 9 张照片。')
      return
    }
    try {
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
      setNewPhotos((current) => [...current, ...result.assets])
    } catch {
      setFormError('无法打开相册，请检查照片权限后重试。')
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!record || !isOwner || petId === null) throw new Error('无权编辑这条记录')
      if (!text.trim() && keptPhotoIds.length + newPhotos.length === 0) {
        throw new Error('请填写文字或保留至少一张照片')
      }
      if (title.length > 50) throw new Error('标题最多 50 个字')
      return updatePetRecord(record.id, {
        pet_id: petId,
        text: text.trim(),
        title: title.trim(),
        remove_photo_ids: record.photos
          .filter((photo) => !keptPhotoIds.includes(photo.id))
          .map((photo) => photo.id),
        photos: newPhotos.map(({ uri, fileName, mimeType }) => ({
          uri,
          fileName,
          mimeType,
        })),
      })
    },
    onSuccess: async ({ record: updated }) => {
      await queryClient.invalidateQueries()
      router.replace(
        `/pets/${updated.pet_id}/records` as Parameters<typeof router.replace>[0]
      )
    },
    onError: (failure) => setFormError(failure.message),
  })
  const remove = useMutation({
    mutationFn: () => deletePetRecord(recordId),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      router.replace(
        `/pets/${record?.pet_id}/records` as Parameters<typeof router.replace>[0]
      )
    },
    onError: (failure) => setFormError(failure.message),
  })

  const confirmDelete = () => {
    Alert.alert('删除这条记录？', '删除后无法通过列表或旧链接找回。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => remove.mutate() },
    ])
  }

  const busy = save.isPending || remove.isPending
  const existingPhotos =
    record?.photos.filter((photo) => keptPhotoIds.includes(photo.id)) ?? []

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}
    >
      <Stack.Screen options={{ title: '编辑宠物记录' }} />
      {(recordQuery.isLoading || petsQuery.isLoading) && (
        <ActivityIndicator accessibilityLabel="正在加载记录" />
      )}
      {(recordQuery.error || petsQuery.error) && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#b42318' }}>
            {recordQuery.error?.message || petsQuery.error?.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              recordQuery.refetch()
              petsQuery.refetch()
            }}
          >
            <Text style={{ color: green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {record && petsQuery.data && !isOwner && (
        <Text style={{ color: '#b42318' }}>只有记录主人可以编辑或删除。</Text>
      )}
      {record && petsQuery.data && isOwner && (
        <>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>关联宠物</Text>
          {petsQuery.data.pets.map((pet) => (
            <Pressable
              key={pet.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: petId === pet.id }}
              onPress={() => setPetId(pet.id)}
              style={{
                padding: 12,
                borderRadius: 10,
                backgroundColor: petId === pet.id ? '#e7f4ee' : '#f4f5f4',
              }}
            >
              <Text>
                {pet.species === 'cat' ? '🐈' : '🐕'} {pet.nickname}
              </Text>
            </Pressable>
          ))}
          <TextInput
            accessibilityLabel="记录标题（可选）"
            placeholder="标题（可选，最多 50 字）"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
            style={{
              padding: 14,
              borderWidth: 1,
              borderColor: '#ccd8d2',
              borderRadius: 10,
            }}
          />
          <TextInput
            accessibilityLabel="记录内容"
            placeholder="写下这一刻…（可只留照片）"
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
          <Text style={{ fontSize: 18, fontWeight: '700' }}>
            照片（{existingPhotos.length + newPhotos.length}/9）
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {existingPhotos.map((photo) => (
              <View key={photo.id} style={{ gap: 4 }}>
                <Image
                  source={{
                    uri: recordPhotoUrl(photo.url),
                    headers: user?.token
                      ? { Authorization: `Bearer ${user.token}` }
                      : undefined,
                  }}
                  cachePolicy="none"
                  style={{ width: 96, height: 96, borderRadius: 8 }}
                  contentFit="cover"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`移除照片 ${photo.id}`}
                  onPress={() =>
                    setKeptPhotoIds((ids) => ids.filter((id) => id !== photo.id))
                  }
                >
                  <Text style={{ color: '#b42318' }}>移除</Text>
                </Pressable>
              </View>
            ))}
            {newPhotos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} style={{ gap: 4 }}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: 96, height: 96, borderRadius: 8 }}
                  contentFit="cover"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`移除新增照片 ${index + 1}`}
                  onPress={() =>
                    setNewPhotos((photos) => photos.filter((_, item) => item !== index))
                  }
                >
                  <Text style={{ color: '#b42318' }}>移除</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={pickPhotos}>
            <Text style={{ color: green, fontWeight: '700' }}>添加照片</Text>
          </Pressable>
          {formError !== '' && <Text style={{ color: '#b42318' }}>{formError}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setFormError('')
              save.mutate()
            }}
            style={{
              backgroundColor: green,
              borderRadius: 10,
              padding: 16,
              alignItems: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {save.isPending ? '正在保存…' : '保存更正'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={confirmDelete}>
            <Text style={{ color: '#b42318', textAlign: 'center' }}>
              {remove.isPending ? '正在删除…' : '删除记录'}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}
