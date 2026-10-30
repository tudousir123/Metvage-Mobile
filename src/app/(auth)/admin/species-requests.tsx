import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { getTeamSpeciesApplications } from 'src/lib/speciesRequests'
import { useAuth, useUserCache } from 'src/state/AuthProvider'

export default function TeamSpeciesRequestsPage() {
  const { user } = useAuth()
  const { is_admin: isAdmin } = useUserCache()
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['metvage-team-species-requests', user?.server, user?.token],
    queryFn: getTeamSpeciesApplications,
    enabled: !!user && isAdmin,
  })

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Stack.Screen options={{ title: '物种申请' }} />
      {!isAdmin && <Text>此页面仅供团队查看。</Text>}
      {isAdmin && data === undefined && !error && (
        <ActivityIndicator accessibilityLabel="正在加载物种申请" />
      )}
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
          {data.requests.length === 0 && <Text>还没有物种申请。</Text>}
          {data.requests.map((application) => (
            <View
              key={application.id}
              style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, gap: 5 }}
            >
              <Text style={{ fontWeight: '700' }}>{application.species}</Text>
              <Text>申请账号 #{application.applicant_id}</Text>
              {application.note && <Text>{application.note}</Text>}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}
