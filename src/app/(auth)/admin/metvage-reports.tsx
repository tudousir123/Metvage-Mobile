import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { getTeamPetReports } from 'src/lib/petReports'
import { useAuth, useUserCache } from 'src/state/AuthProvider'

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
      <Stack.Screen options={{ title: '待处理举报' }} />
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
          {data.reports.length === 0 && <Text>还没有待处理举报。</Text>}
          {data.reports.map((report) => (
            <View
              key={report.id}
              style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, gap: 5 }}
            >
              <Text style={{ fontWeight: '700' }}>
                {report.target_type === 'record' ? '公开笔记' : '宠物身份'} #
                {report.target_id}
              </Text>
              <Text>举报账号 #{report.reporter_id}</Text>
              <Text>{report.reason}</Text>
              <Text>待处理</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}
