import { router } from 'expo-router'
import { Text } from 'react-native'
import { ComposerPage, ComposerSubmit } from 'src/components/records/record-composer'
import { metvagePalette as c } from 'src/lib/metvage-colors'

// The center tab normally opens the full-screen composer. Keep this route useful
// for restored navigation state and direct links as well.
export default function PublishEntryScreen() {
  return (
    <ComposerPage title="留下一份回忆" onCancel={() => router.replace('/(auth)/(tabs)')}>
      <Text style={{ color: c.secondaryText, fontSize: 16, lineHeight: 26 }}>
        一张照片，一段小事。记录你和它的日常故事。
      </Text>
      <ComposerSubmit
        title="发布笔记"
        busy={false}
        onPress={() => router.push('/records/new?mode=public')}
      />
      <ComposerSubmit
        title="添加私人记录"
        busy={false}
        onPress={() => router.push('/records/new?mode=private')}
      />
    </ComposerPage>
  )
}
