import Feather from '@expo/vector-icons/Feather'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { PetAvatar } from 'src/components/metvage/brand'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import {
  createPet,
  getPets,
  type PetProfile,
  type PetSpecies,
  selectCurrentPet,
  updatePet,
} from 'src/lib/pets'
import { useAuth } from 'src/state/AuthProvider'

export default function PetsPage() {
  const { user } = useAuth()
  const { edit } = useLocalSearchParams<{ edit?: string }>()
  const handledEdit = useRef<string | undefined>()
  const scroll = useRef<ScrollView>(null)
  const queryClient = useQueryClient()
  const pets = useQuery({
    queryKey: ['metvage-pets', user?.server, user?.token],
    queryFn: getPets,
    enabled: !!user,
  })
  const [editing, setEditing] = useState<PetProfile | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [nickname, setNickname] = useState('')
  const [species, setSpecies] = useState<PetSpecies>('dog')
  const [bio, setBio] = useState('')
  const [formError, setFormError] = useState('')
  const save = useMutation({
    mutationFn: () => {
      const name = nickname.trim()
      if (!name) throw new Error('请填写宠物昵称')
      return editing
        ? updatePet(editing.id, { nickname: name, species, bio: bio.trim() || null })
        : createPet({ nickname: name, species })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['metvage-pets'] })
      setFormOpen(false)
      setFormError('')
    },
    onError: (failure) => setFormError(failure.message),
  })
  const select = useMutation({
    mutationFn: selectCurrentPet,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['metvage-pets'] }),
  })

  function openForm(pet?: PetProfile) {
    setEditing(pet ?? null)
    setNickname(pet?.nickname ?? '')
    setSpecies(pet?.species ?? 'dog')
    setBio(pet?.bio ?? '')
    setFormError('')
    setFormOpen(true)
    scroll.current?.scrollTo({ y: 0, animated: true })
  }
  useEffect(() => {
    if (!edit || handledEdit.current === edit) return
    const pet = pets.data?.pets.find((item) => item.id === Number(edit))
    if (!pet) return
    handledEdit.current = edit
    setEditing(pet)
    setNickname(pet.nickname)
    setSpecies(pet.species)
    setBio(pet.bio ?? '')
    setFormError('')
    setFormOpen(true)
  }, [edit, pets.data])

  const inputStyle = {
    color: c.text,
    backgroundColor: c.field,
    borderRadius: 14,
    padding: 15,
    fontSize: 16,
  }
  return (
    <ScrollView
      ref={scroll}
      style={{ backgroundColor: c.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}
    >
      <Stack.Screen
        options={{
          title: '我的宠物',
          headerTintColor: c.green,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
        }}
      />
      <Text style={{ color: c.text, fontSize: 27, fontWeight: '700' }}>
        每一只，都是家人
      </Text>
      <Text style={{ color: c.secondaryText, lineHeight: 23 }}>
        选择它的身份，记录它的小小世界。猫咪和狗狗只需一个昵称，就能开始。
      </Text>
      {formOpen && (
        <View
          style={{ backgroundColor: c.surface, borderRadius: 20, padding: 18, gap: 15 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <PetAvatar name={nickname || '宠物'} species={species} size={48} />
            <Text style={{ color: c.text, fontSize: 19, fontWeight: '700' }}>
              {editing ? '编辑宠物档案' : '建立宠物档案'}
            </Text>
          </View>
          <TextInput
            accessibilityLabel="宠物昵称"
            placeholder="它的名字"
            placeholderTextColor={c.secondaryText}
            value={nickname}
            onChangeText={setNickname}
            maxLength={50}
            style={inputStyle}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(['cat', 'dog'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: species === value }}
                onPress={() => setSpecies(value)}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: species === value ? c.green : c.border,
                  backgroundColor: species === value ? c.softGreen : c.surface,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: c.green, fontSize: 16 }}>
                  {value === 'cat' ? '猫咪' : '狗狗'}
                </Text>
              </Pressable>
            ))}
          </View>
          {editing && (
            <TextInput
              accessibilityLabel="公开介绍"
              placeholder="它的性格，你们的故事…（选填）"
              placeholderTextColor={c.secondaryText}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
              style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
            />
          )}
          {!!formError && (
            <Text accessibilityRole="alert" style={{ color: c.error }}>
              {formError}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              disabled={save.isPending}
              onPress={() => setFormOpen(false)}
              style={({ pressed }) => ({
                padding: 14,
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: c.secondaryText }}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={save.isPending}
              accessibilityState={{ busy: save.isPending, disabled: save.isPending }}
              onPress={() => save.mutate()}
              style={({ pressed }) => ({
                flex: 1,
                padding: 15,
                backgroundColor: c.green,
                borderRadius: 25,
                alignItems: 'center',
                opacity: pressed || save.isPending ? 0.65 : 1,
              })}
            >
              <Text style={{ color: c.surface, fontWeight: '600' }}>
                {save.isPending ? '正在保存…' : '保存档案'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
      {pets.fetchStatus === 'paused' && !pets.data && (
        <Text accessibilityRole="alert" style={{ color: c.secondaryText, padding: 20 }}>
          等待网络连接，恢复后会自动加载宠物档案。
        </Text>
      )}
      {pets.isLoading && (
        <ActivityIndicator color={c.green} accessibilityLabel="正在加载宠物档案" />
      )}
      {pets.error && (
        <View style={{ gap: 12 }}>
          <Text style={{ color: c.error }}>{pets.error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => pets.refetch()}>
            <Text style={{ color: c.green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {pets.data && (
        <>
          {pets.data.pets.map((pet) => (
            <View
              key={pet.id}
              style={{
                backgroundColor: c.surface,
                borderRadius: 20,
                padding: 16,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <PetAvatar name={pet.nickname} species={pet.species} size={62} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>
                    {pet.nickname}
                  </Text>
                  <Text style={{ color: c.secondaryText, lineHeight: 21 }}>
                    {pet.species === 'cat' ? '猫咪' : '狗狗'}
                    {pet.bio ? ` · ${pet.bio}` : ''}
                  </Text>
                </View>
                {pets.data.current_pet_id === pet.id && (
                  <View
                    style={{ backgroundColor: c.softGreen, padding: 7, borderRadius: 16 }}
                  >
                    <Feather name="check" size={17} color={c.green} />
                  </View>
                )}
              </View>
              {pets.data.current_pet_id === pet.id && (
                <Text style={{ color: c.green, fontSize: 12 }}>当前宠物身份</Text>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      `/pets/${pet.id}/records` as Parameters<typeof router.push>[0]
                    )
                  }
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    backgroundColor: c.field,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: c.green }}>查看时间线</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openForm(pet)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    backgroundColor: c.field,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: c.green }}>编辑档案</Text>
                </Pressable>
                {pets.data.current_pet_id !== pet.id && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={select.isPending}
                    onPress={() => select.mutate(pet.id)}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 20,
                      backgroundColor: c.softGreen,
                      opacity: pressed || select.isPending ? 0.6 : 1,
                    })}
                  >
                    <Text style={{ color: c.green }}>设为当前宠物</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          {!pets.data.pets.length && !formOpen && (
            <Text style={{ color: c.secondaryText, textAlign: 'center', padding: 22 }}>
              还没有宠物档案。一起留下第一份回忆吧。
            </Text>
          )}
          {select.error && (
            <Text accessibilityRole="alert" style={{ color: c.error }}>
              {select.error.message}
            </Text>
          )}
          {!formOpen && (
            <Pressable
              accessibilityRole="button"
              onPress={() => openForm()}
              style={({ pressed }) => ({
                backgroundColor: c.green,
                padding: 16,
                borderRadius: 28,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Feather name="plus" size={21} color={c.surface} />
              <Text style={{ color: c.surface, fontSize: 16, fontWeight: '600' }}>
                添加宠物
              </Text>
            </Pressable>
          )}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/settings/species-request')}
        style={{ paddingVertical: 10 }}
      >
        <Text style={{ color: c.green }}>养其他宠物？申请支持其他物种</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/following')}
        style={{ paddingVertical: 8 }}
      >
        <Text style={{ color: c.green }}>查看当前宠物的关注流</Text>
      </Pressable>
    </ScrollView>
  )
}
