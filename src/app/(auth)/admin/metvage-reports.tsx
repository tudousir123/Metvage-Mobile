import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  getTeamPetReports,
  type PetReport,
  type PetReportAction,
  resolvePetReport,
} from 'src/lib/petReports'
import { useAuth, useUserCache } from 'src/state/AuthProvider'

const actions: Record<
  PetReport['target_type'],
  { action: PetReportAction; label: string }[]
> = {
  record: [
    { action: 'none', label: '仅记录结果' },
    { action: 'hide', label: '隐藏笔记' },
    { action: 'restore', label: '恢复笔记' },
    { action: 'delete', label: '删除笔记' },
  ],
  comment: [
    { action: 'none', label: '仅记录结果' },
    { action: 'hide', label: '隐藏评论' },
    { action: 'restore', label: '恢复评论' },
    { action: 'delete', label: '删除评论' },
  ],
  pet: [
    { action: 'none', label: '仅记录结果' },
    { action: 'suspend', label: '暂停账号互动' },
    { action: 'unsuspend', label: '恢复账号互动' },
  ],
}

function ReportRow({ report }: { report: PetReport }) {
  const [resolution, setResolution] = useState(report.resolution ?? '')
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (action: PetReportAction) =>
      resolvePetReport(report.id, { action, resolution: resolution.trim() }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['metvage-team-reports'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-records'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-search'] }),
        queryClient.resetQueries({ queryKey: ['metvage-public-note'] }),
        queryClient.resetQueries({ queryKey: ['metvage-interactions'] }),
      ])
    },
  })

  function choose(action: PetReportAction) {
    if (!resolution.trim()) {
      Alert.alert('请先填写处理结果')
      return
    }
    if (action === 'delete' || action === 'suspend') {
      Alert.alert('确认执行处置？', '此操作会立即影响公开内容或账号互动。', [
        { text: '取消', style: 'cancel' },
        { text: '确认', style: 'destructive', onPress: () => mutation.mutate(action) },
      ])
      return
    }
    mutation.mutate(action)
  }

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, gap: 9 }}>
      <Text style={{ fontWeight: '700' }}>
        {report.target_type === 'record'
          ? '公开笔记'
          : report.target_type === 'comment'
            ? '评论'
            : '宠物身份'}{' '}
        #{report.target_id}
      </Text>
      <Text>举报账号 #{report.reporter_id}</Text>
      <Text>{report.reason}</Text>
      <Text>
        {report.status === 'pending'
          ? '待处理'
          : `已处理：${report.action ?? '仅记录结果'} · ${report.resolution ?? ''}`}
      </Text>
      <TextInput
        accessibilityLabel={`举报 ${report.id} 的处理结果`}
        placeholder="填写处理结果"
        value={resolution}
        onChangeText={setResolution}
        multiline
        maxLength={2000}
        style={{ borderWidth: 1, borderColor: '#afc6be', borderRadius: 8, padding: 10 }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {actions[report.target_type].map(({ action, label }) => (
          <Pressable
            key={action}
            accessibilityRole="button"
            disabled={mutation.isPending}
            onPress={() => choose(action)}
            style={{
              borderWidth: 1,
              borderColor: '#afc6be',
              borderRadius: 8,
              padding: 9,
            }}
          >
            <Text style={{ color: action === 'delete' ? '#b42318' : '#075e52' }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {mutation.isPending && <ActivityIndicator accessibilityLabel="正在保存处理结果" />}
      {mutation.error && (
        <Text style={{ color: '#b42318' }}>{mutation.error.message}</Text>
      )}
    </View>
  )
}

export default function TeamPetReportsScreen() {
  const { user } = useAuth()
  const { is_admin: isAdmin } = useUserCache()
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['metvage-team-reports', user?.server, user?.token],
    queryFn: getTeamPetReports,
    enabled: !!user && isAdmin,
  })

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 12 }}
    >
      <Stack.Screen options={{ title: '举报处理' }} />
      {!isAdmin && <Text>此页面仅供团队查看。</Text>}
      {isAdmin && isLoading && <ActivityIndicator accessibilityLabel="正在加载举报" />}
      {isAdmin && error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#b42318' }}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => refetch()}>
            <Text style={{ color: '#075e52' }}>重试加载</Text>
          </Pressable>
        </View>
      )}
      {isAdmin && data && (
        <>
          {isFetching && <Text>正在同步…</Text>}
          {data.reports.length === 0 && <Text>还没有举报。</Text>}
          {data.reports.map((report) => (
            <ReportRow key={report.id} report={report} />
          ))}
        </>
      )}
    </ScrollView>
  )
}
