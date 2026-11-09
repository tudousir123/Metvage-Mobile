import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import {
  ComposerFields,
  ComposerPage,
  ComposerSubmit,
} from 'src/components/records/record-composer'
import { useRecordLeaveGuard } from 'src/hooks/use-record-leave-guard'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { getPets } from 'src/lib/pets'
import {
  deletePetRecord,
  getPetRecord,
  recordPhotoUrl,
  updatePetRecord,
} from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

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
  const mutationLock = useRef(false)

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
  }, [record, user])

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
      leaveAfterSave(() =>
        router.dismissTo(
          `/pets/${updated.pet_id}/records` as Parameters<typeof router.dismissTo>[0]
        )
      )
    },
    onError: (failure) => setFormError(failure.message),
    onSettled: () => {
      mutationLock.current = false
    },
  })
  const remove = useMutation({
    mutationFn: () => deletePetRecord(recordId),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      leaveAfterSave(() =>
        router.dismissTo(
          `/pets/${record?.pet_id}/records` as Parameters<typeof router.dismissTo>[0]
        )
      )
    },
    onError: (failure) => setFormError(failure.message),
    onSettled: () => {
      mutationLock.current = false
    },
  })

  const confirmDelete = () => {
    Alert.alert('删除这条记录？', '删除后无法通过列表或旧链接找回。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          if (mutationLock.current) return
          mutationLock.current = true
          remove.mutate()
        },
      },
    ])
  }

  const busy = save.isPending || remove.isPending
  const existingPhotos =
    record?.photos.filter((photo) => keptPhotoIds.includes(photo.id)) ?? []

  const leave = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(auth)/(tabs)/profile')
  }
  const changed =
    !!record &&
    (text !== (record.text ?? '') ||
      title !== (record.title ?? '') ||
      petId !== record.pet_id ||
      newPhotos.length > 0 ||
      keptPhotoIds.length !== record.photos.length)
  const leaveAfterSave = useRecordLeaveGuard({ dirty: changed, busy, editing: true })

  return (
    <ComposerPage
      title="编辑记录"
      onCancel={leave}
      footer={
        record && petsQuery.data && isOwner ? (
          <View style={{ gap: 8 }}>
            {formError !== '' && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={{ color: c.error, fontSize: 14, lineHeight: 20 }}
              >
                {formError}
              </Text>
            )}
            <ComposerSubmit
              title={save.isPending ? '正在保存…' : '保存更改'}
              busy={busy}
              onPress={() => {
                if (mutationLock.current) return
                mutationLock.current = true
                setFormError('')
                save.mutate()
              }}
            />
          </View>
        ) : undefined
      }
    >
      {((!record && recordQuery.fetchStatus === 'paused') ||
        (!petsQuery.data && petsQuery.fetchStatus === 'paused')) && (
        <Text accessibilityRole="alert" style={{ color: c.secondaryText }}>
          正在等待网络连接，恢复后会继续加载记录。
        </Text>
      )}
      {(recordQuery.isLoading || petsQuery.isLoading) && (
        <ActivityIndicator color={c.green} accessibilityLabel="正在加载记录" />
      )}
      {(recordQuery.error || petsQuery.error) && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.error }}>
            {recordQuery.error?.message || petsQuery.error?.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              recordQuery.refetch()
              petsQuery.refetch()
            }}
          >
            <Text style={{ color: c.green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {record && petsQuery.data && !isOwner && (
        <Text style={{ color: c.error }}>只有记录主人可以编辑或删除。</Text>
      )}
      {record && petsQuery.data && isOwner && (
        <>
          <ComposerFields
            pets={petsQuery.data.pets}
            petId={petId}
            onPetChange={setPetId}
            photos={[
              ...existingPhotos.map((photo) => ({
                key: `saved-${photo.id}`,
                uri: recordPhotoUrl(photo.url),
                headers: user?.token
                  ? { Authorization: `Bearer ${user.token}` }
                  : undefined,
                onRemove: () =>
                  setKeptPhotoIds((ids) => ids.filter((id) => id !== photo.id)),
              })),
              ...newPhotos.map((photo, index) => ({
                key: `${photo.uri}-${index}`,
                uri: photo.uri,
                onRemove: () =>
                  setNewPhotos((photos) => photos.filter((_, item) => item !== index)),
              })),
            ]}
            onAddPhotos={pickPhotos}
            title={title}
            onTitleChange={setTitle}
            text={text}
            onTextChange={setText}
            visibility={record.visibility}
            busy={busy}
          />

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={confirmDelete}
            style={({ pressed }) => ({ padding: 14, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: c.error, textAlign: 'center' }}>
              {remove.isPending ? '正在删除…' : '删除记录'}
            </Text>
          </Pressable>
        </>
      )}
    </ComposerPage>
  )
}
