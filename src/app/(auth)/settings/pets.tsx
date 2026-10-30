import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  createPet,
  getPets,
  type PetProfile,
  type PetSpecies,
  selectCurrentPet,
  updatePet,
} from 'src/lib/pets'
import { useAuth } from 'src/state/AuthProvider'

const ink = '#17352f'
const green = '#075e52'

export default function PetsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['metvage-pets', user?.server, user?.token]
  const { data, error, isFetching, refetch } = useQuery({
    queryKey,
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

  function openCreate() {
    setEditing(null)
    setNickname('')
    setSpecies('dog')
    setBio('')
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(pet: PetProfile) {
    setEditing(pet)
    setNickname(pet.nickname)
    setSpecies(pet.species)
    setBio(pet.bio ?? '')
    setFormError('')
    setFormOpen(true)
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    >
      <Stack.Screen options={{ title: '我的宠物' }} />
      <Text style={{ color: ink, fontSize: 15 }}>
        登录后可先浏览。发布或互动前，请建立并选定一只猫或狗作为宠物身份。
      </Text>

      {data === undefined && !error && (
        <ActivityIndicator accessibilityLabel="正在加载宠物档案" />
      )}
      {error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#b42318' }}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => refetch()}>
            <Text style={{ color: green }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {data && (
        <>
          {isFetching && <Text style={{ color: '#63746f' }}>正在同步…</Text>}
          {data.pets.length === 0 && (
            <Text style={{ color: '#63746f' }}>还没有宠物档案。只需昵称即可开始。</Text>
          )}
          {data.pets.map((pet) => {
            const current = data.current_pet_id === pet.id
            return (
              <View
                key={pet.id}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 16,
                  gap: 10,
                }}
              >
                <Text style={{ color: ink, fontSize: 20, fontWeight: '700' }}>
                  {pet.species === 'cat' ? '🐈' : '🐕'} {pet.nickname}
                  {current ? ' · 当前身份' : ''}
                </Text>
                <Text style={{ color: '#63746f' }}>
                  {pet.species === 'cat' ? '猫' : '狗'}
                  {pet.bio ? ` · ${pet.bio}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 20 }}>
                  {!current && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={select.isPending}
                      onPress={() => select.mutate(pet.id)}
                    >
                      <Text style={{ color: green }}>设为当前宠物</Text>
                    </Pressable>
                  )}
                  <Pressable accessibilityRole="button" onPress={() => openEdit(pet)}>
                    <Text style={{ color: green }}>编辑档案</Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
          {select.error && (
            <Text style={{ color: '#b42318' }}>{select.error.message}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={openCreate}
            style={{
              backgroundColor: green,
              borderRadius: 10,
              padding: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>添加宠物</Text>
          </Pressable>
        </>
      )}

      {formOpen && (
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 }}>
          <Text style={{ color: ink, fontSize: 18, fontWeight: '700' }}>
            {editing ? '编辑宠物档案' : '建立宠物档案'}
          </Text>
          <TextInput
            accessibilityLabel="宠物昵称"
            placeholder="宠物昵称"
            value={nickname}
            onChangeText={setNickname}
            maxLength={50}
            style={{
              borderWidth: 1,
              borderColor: '#ccd8d2',
              borderRadius: 8,
              padding: 12,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(['cat', 'dog'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: species === value }}
                onPress={() => setSpecies(value)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: species === value ? '#e7f4ee' : '#f5f5f5',
                }}
              >
                <Text>{value === 'cat' ? '🐈 猫' : '🐕 狗'}</Text>
              </Pressable>
            ))}
          </View>
          {editing && (
            <TextInput
              accessibilityLabel="公开介绍"
              placeholder="公开介绍（选填）"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
              style={{
                borderWidth: 1,
                borderColor: '#ccd8d2',
                borderRadius: 8,
                padding: 12,
                minHeight: 70,
              }}
            />
          )}
          {formError !== '' && <Text style={{ color: '#b42318' }}>{formError}</Text>}
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <Pressable accessibilityRole="button" onPress={() => setFormOpen(false)}>
              <Text style={{ color: '#63746f' }}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={save.isPending}
              onPress={() => save.mutate()}
            >
              <Text style={{ color: green }}>
                {save.isPending ? '正在保存…' : '保存'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  )
}
