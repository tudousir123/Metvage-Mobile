import { useMutation } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { type PetReportTargetType, submitPetReport } from 'src/lib/petReports'

const green = '#075e52'

export default function NewPetReportScreen() {
  const { target_type, target_id } = useLocalSearchParams<{
    target_type?: string
    target_id?: string
  }>()
  const targetId = Number(target_id)
  const validTarget = target_type === 'record' || target_type === 'pet'
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const submit = useMutation({
    mutationFn: () => {
      if (!validTarget || !Number.isSafeInteger(targetId) || targetId < 1) {
        throw new Error('举报对象无效')
      }
      if (!reason.trim()) throw new Error('请填写举报原因')
      return submitPetReport({
        target_type: target_type as PetReportTargetType,
        target_id: targetId,
        reason: reason.trim(),
      })
    },
    onError: (failure) => setError(failure.message),
  })

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, gap: 18 }}
    >
      <Stack.Screen options={{ title: '举报' }} />
      {!validTarget || !Number.isSafeInteger(targetId) || targetId < 1 ? (
        <Text>举报对象无效，请返回内容页面重试。</Text>
      ) : submit.data ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: green }}>已收到</Text>
          <Text>团队已收到你的举报，会查看这条内容。</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: green }}>返回</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>
            {target_type === 'record' ? '举报公开笔记' : '举报宠物身份'}
          </Text>
          <Text>请描述你看到的问题。举报不会让你看到对方的私人记录。</Text>
          <TextInput
            accessibilityLabel="举报原因"
            placeholder="填写举报原因"
            value={reason}
            onChangeText={setReason}
            multiline
            textAlignVertical="top"
            maxLength={500}
            style={{
              minHeight: 140,
              borderWidth: 1,
              borderColor: '#ccd8d2',
              borderRadius: 10,
              padding: 14,
            }}
          />
          {error !== '' && <Text style={{ color: '#b42318' }}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={submit.isPending}
            onPress={() => {
              setError('')
              submit.mutate()
            }}
            style={{
              backgroundColor: green,
              padding: 16,
              borderRadius: 10,
              alignItems: 'center',
              opacity: submit.isPending ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {submit.isPending ? '正在提交…' : '提交举报'}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  )
}
