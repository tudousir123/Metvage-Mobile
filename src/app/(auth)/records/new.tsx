import Feather from '@expo/vector-icons/Feather'
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
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { getPets } from 'src/lib/pets'
import {
  discardRecordDraft,
  loadRecordDraft,
  type RecordDraft,
  saveRecordDraft,
} from 'src/lib/record-drafts'
import {
  createPetRecord,
  type RecordPhotoInput,
  type RecordVisibility,
} from 'src/lib/records'
import { useAuth } from 'src/state/AuthProvider'

export default function NewRecordScreen() {
  const { mode, pet_id } = useLocalSearchParams<{ mode?: string; pet_id?: string }>()
  const { user, userCache } = useAuth()
  const accountId = userCache?.id ? String(userCache.id) : null
  const owner = user && accountId ? { server: user.server, accountId } : null
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [photos, setPhotos] = useState<RecordPhotoInput[]>([])
  const requestId = useRef(
    `record-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  )
  const [visibility, setVisibility] = useState<RecordVisibility>(
    mode === 'private' ? 'private' : 'public'
  )
  const [chosenPetId, setChosenPetId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [savedDraft, setSavedDraft] = useState<
    (RecordDraft & { missingPhotos: number }) | null
  >(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const draftLock = useRef(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!user || !accountId) return
    let active = true
    loadRecordDraft({ server: user.server, accountId })
      .then((draft) => {
        if (active) {
          setSavedDraft(draft)
          setDraftReady(true)
        }
      })
      .catch(() => {
        if (active) {
          setFormError('无法读取本机草稿，请稍后重新打开页面。')
          setDraftReady(true)
        }
      })
    return () => {
      active = false
    }
  }, [user?.server, accountId])

  const { data, error, isLoading, fetchStatus, refetch } = useQuery({
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

  const leave = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(auth)/(tabs)')
  }
  const persistDraft = async (exitAfter = false) => {
    if (!owner || draftLock.current) return
    draftLock.current = true
    setSavingDraft(true)
    setFormError('')
    setNotice('')
    try {
      const saved = await saveRecordDraft(owner, {
        text,
        title,
        petId: selectedPetId,
        visibility,
        photos,
        clientRequestId: requestId.current,
      })
      setPhotos(saved.photos)
      setNotice('草稿已保存在本机，下次发布时可继续编辑。')
      if (exitAfter) leave()
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : '草稿保存失败，请重试。')
    } finally {
      draftLock.current = false
      setSavingDraft(false)
    }
  }
  const cancel = () => {
    if (save.isPending || savingDraft) return
    if (!text && !title && photos.length === 0) {
      leave()
      return
    }
    Alert.alert('保留这份回忆？', '可以存为本机草稿，稍后继续编辑。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '不保存离开', style: 'destructive', onPress: leave },
      ...(owner
        ? [
            {
              text: '存草稿并离开',
              onPress: () => {
                void persistDraft(true)
              },
            },
          ]
        : []),
    ])
  }
  const pickPhotos = async () => {
    setFormError('')
    setNotice('')
    const remaining = 9 - photos.length
    if (remaining <= 0) return
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      })
      if (result.canceled) return
      if (result.assets.length > remaining) {
        setFormError('每条记录最多添加 9 张照片。')
        return
      }
      setPhotos((previous) => [
        ...previous,
        ...result.assets.map(({ uri, fileName, mimeType }) => ({
          uri,
          fileName,
          mimeType,
        })),
      ])
    } catch {
      setFormError('无法打开相册，请检查照片权限后重试。')
    }
  }
  const save = useMutation({
    mutationFn: async () => {
      if (!data?.pets.some((pet) => pet.id === selectedPetId) || selectedPetId === null)
        throw new Error('请先建立并选定宠物身份')
      if (!text.trim() && photos.length === 0) throw new Error('请写下记录内容或添加照片')
      if (title.length > 50) throw new Error('标题最多 50 个字')
      if (photos.length > 9) throw new Error('每条记录最多添加 9 张照片')
      return createPetRecord({
        pet_id: selectedPetId,
        text: text.trim(),
        title: title.trim(),
        visibility,
        photos,
        client_request_id: requestId.current,
      })
    },
    onSuccess: async ({ record }) => {
      if (owner) await discardRecordDraft(owner)
      await queryClient.invalidateQueries()
      router.replace(
        `/pets/${record.pet_id}/records` as Parameters<typeof router.replace>[0]
      )
    },
    onError: (failure) => setFormError(failure.message),
  })
  const busy = save.isPending || savingDraft
  const restore = () => {
    if (!savedDraft) return
    setText(savedDraft.text)
    setTitle(savedDraft.title)
    setPhotos(savedDraft.photos)
    setChosenPetId(savedDraft.petId)
    setVisibility(savedDraft.visibility)
    requestId.current = savedDraft.clientRequestId
    setNotice(
      savedDraft.missingPhotos
        ? `${savedDraft.missingPhotos} 张草稿照片已不可用，请重新添加。文字已恢复。`
        : '已恢复本机草稿。'
    )
    setSavedDraft(null)
  }

  const canCompose = !!data && data.pets.length > 0 && draftReady && !savedDraft

  return (
    <ComposerPage
      title={visibility === 'private' ? '添加私人记录' : '发布笔记'}
      onCancel={cancel}
      footer={
        canCompose ? (
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
              title={
                save.isPending
                  ? '正在保存…'
                  : visibility === 'public'
                    ? '发布'
                    : '保存私人记录'
              }
              busy={busy}
              onPress={() => {
                setFormError('')
                setNotice('')
                save.mutate()
              }}
            />
          </View>
        ) : undefined
      }
      headerAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="保存本机草稿"
          accessibilityState={{
            disabled: busy || !owner || !draftReady || !!savedDraft,
            busy: savingDraft,
          }}
          disabled={busy || !owner || !draftReady || !!savedDraft}
          onPress={() => {
            void persistDraft()
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            borderWidth: 1,
            borderColor: c.green,
            borderRadius: 22,
            paddingHorizontal: 10,
            paddingVertical: 10,
            opacity: busy || pressed ? 0.6 : 1,
          })}
        >
          <Feather name="save" size={17} color={c.text} />
          <Text style={{ color: c.text, fontSize: 13 }}>
            {savingDraft ? '保存中' : '存草稿'}
          </Text>
        </Pressable>
      }
    >
      {(isLoading || !draftReady) && (
        <ActivityIndicator color={c.green} accessibilityLabel="正在准备编辑器" />
      )}
      {!data && fetchStatus === 'paused' && (
        <Text accessibilityRole="alert" style={{ color: c.secondaryText }}>
          正在等待网络连接，恢复后会继续加载宠物档案。
        </Text>
      )}
      {error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.error }}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => refetch()}>
            <Text style={{ color: c.green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {formError !== '' && !canCompose && (
        <Text accessibilityRole="alert" style={{ color: c.error }}>
          {formError}
        </Text>
      )}
      {notice !== '' && (
        <Text accessibilityRole="alert" style={{ color: c.green }}>
          {notice}
        </Text>
      )}
      {savedDraft && (
        <View
          style={{ padding: 18, backgroundColor: c.softGreen, borderRadius: 16, gap: 12 }}
        >
          <Text style={{ fontWeight: '700', fontSize: 18, color: c.text }}>
            还有一份未发布的回忆
          </Text>
          <Text style={{ color: c.secondaryText }}>
            恢复这份草稿，或放弃后开始新记录。
          </Text>
          <ComposerSubmit title="恢复草稿" busy={false} onPress={restore} />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert('放弃已存草稿？', '本机保存的文字和照片将被移除。', [
                { text: '取消', style: 'cancel' },
                {
                  text: '放弃草稿',
                  style: 'destructive',
                  onPress: () => {
                    if (owner)
                      void discardRecordDraft(owner).then(() => setSavedDraft(null))
                  },
                },
              ])
            }
            style={{ padding: 8 }}
          >
            <Text style={{ textAlign: 'center', color: c.error }}>放弃草稿</Text>
          </Pressable>
        </View>
      )}
      {data?.pets.length === 0 && (
        <View style={{ gap: 16, paddingVertical: 30 }}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>
            先认识一下你的宠物
          </Text>
          <Text style={{ color: c.secondaryText, lineHeight: 24 }}>
            建立一只猫或狗的档案，就能以它的身份留下第一份回忆。
          </Text>
          <ComposerSubmit
            title="去建立宠物档案"
            busy={false}
            onPress={() => router.push('/settings/pets')}
          />
        </View>
      )}
      {data && data.pets.length > 0 && draftReady && !savedDraft && (
        <ComposerFields
          pets={data.pets}
          petId={selectedPetId}
          onPetChange={setChosenPetId}
          photos={photos.map((photo, index) => ({
            key: `${photo.uri}-${index}`,
            uri: photo.uri,
            onRemove: () =>
              setPhotos((items) => items.filter((_, item) => item !== index)),
          }))}
          onAddPhotos={pickPhotos}
          title={title}
          onTitleChange={setTitle}
          text={text}
          onTextChange={setText}
          visibility={visibility}
          onVisibilityChange={setVisibility}
          busy={busy}
        />
      )}
    </ComposerPage>
  )
}
