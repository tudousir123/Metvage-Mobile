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
import { useMetvageColors } from 'src/lib/metvage-colors'
import { getSpeciesApplications, submitSpeciesApplication } from 'src/lib/speciesRequests'
import { useAuth } from 'src/state/AuthProvider'

const green = '#075e52'

export default function SpeciesRequestPage() {
  const colors = useMetvageColors()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['metvage-species-requests', user?.server, user?.token]
  const { data, error, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: getSpeciesApplications,
    enabled: !!user,
  })
  const [species, setSpecies] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [receipt, setReceipt] = useState('')
  const submit = useMutation({
    mutationFn: () => {
      const name = species.trim()
      if (!name) throw new Error('请填写希望支持的物种')
      return submitSpeciesApplication({ species: name, note: note.trim() })
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey })
      setSpecies('')
      setNote('')
      setFormError('')
      setReceipt(result.message)
    },
    onError: (failure) => setFormError(failure.message),
  })

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    >
      <Stack.Screen options={{ title: '申请其他物种' }} />
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
        希望记录其他宠物？
      </Text>
      <Text style={{ color: colors.text }}>
        首版仅支持猫和狗建档。告诉我们希望后续支持的物种；申请不会立即开放建档。
      </Text>
      <TextInput
        accessibilityLabel="希望支持的物种"
        placeholder="例如：兔子"
        placeholderTextColor={colors.secondaryText}
        maxLength={80}
        value={species}
        onChangeText={setSpecies}
        style={{
          color: colors.text,
          borderWidth: 1,
          borderColor: '#ccd8d2',
          borderRadius: 8,
          padding: 12,
        }}
      />
      <TextInput
        accessibilityLabel="补充说明"
        placeholder="补充说明（选填）"
        placeholderTextColor={colors.secondaryText}
        multiline
        maxLength={500}
        value={note}
        onChangeText={setNote}
        style={{
          color: colors.text,
          borderWidth: 1,
          borderColor: '#ccd8d2',
          borderRadius: 8,
          padding: 12,
          minHeight: 80,
        }}
      />
      {formError !== '' && <Text style={{ color: colors.error }}>{formError}</Text>}
      {receipt !== '' && (
        <Text accessibilityRole="alert" style={{ color: colors.link }}>
          {receipt}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={submit.isPending}
        onPress={() => {
          setReceipt('')
          submit.mutate()
        }}
        style={{
          backgroundColor: green,
          borderRadius: 10,
          padding: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {submit.isPending ? '正在提交…' : '提交申请'}
        </Text>
      </Pressable>

      <Text
        style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 }}
      >
        我的申请
      </Text>
      {data === undefined && !error && (
        <ActivityIndicator accessibilityLabel="正在加载申请" />
      )}
      {error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.error }}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => refetch()}>
            <Text style={{ color: colors.link }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {data && (
        <>
          {isFetching && <Text style={{ color: colors.text }}>正在同步…</Text>}
          {data.requests.length === 0 && (
            <Text style={{ color: colors.text }}>还没有申请。</Text>
          )}
          {data.requests.map((application) => (
            <View
              key={application.id}
              style={{
                backgroundColor: colors.background,
                borderRadius: 10,
                padding: 14,
                gap: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {application.species} · 已收到
              </Text>
              {application.note && (
                <Text style={{ color: colors.text }}>{application.note}</Text>
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}
