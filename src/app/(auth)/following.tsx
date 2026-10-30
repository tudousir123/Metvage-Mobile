import { Stack } from 'expo-router'
import { FollowingRecordFeed } from 'src/components/metvage/following-record-feed'

export default function FollowingScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '关注' }} />
      <FollowingRecordFeed />
    </>
  )
}
