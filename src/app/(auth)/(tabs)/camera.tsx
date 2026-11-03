import { router } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useMetvageColors } from 'src/lib/metvage-colors'

const green = '#075e52'

export default function PublishEntryScreen() {
  const colors = useMetvageColors()
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
    >
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700' }}>
        记录宠物生活
      </Text>
      <Text style={{ color: colors.secondaryText }}>
        选择分享给大家，或只留给自己。提交前还能更改可见范围。
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push('/records/new?mode=public' as Parameters<typeof router.push>[0])
        }
        style={{ backgroundColor: green, borderRadius: 12, padding: 18 }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>发布笔记</Text>
        <Text style={{ color: '#fff' }}>默认公开，未登录访客也能看到</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push('/records/new?mode=private' as Parameters<typeof router.push>[0])
        }
        style={{ backgroundColor: '#e7f4ee', borderRadius: 12, padding: 18 }}
      >
        <Text style={{ color: green, fontSize: 18, fontWeight: '700' }}>
          添加私人记录
        </Text>
        <Text style={{ color: '#17352f' }}>默认仅自己可见</Text>
      </Pressable>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.secondaryText }}>
          记录会保存在所选宠物的时间线中。
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings/pets')}
        >
          <Text style={{ color: colors.link }}>管理宠物档案和时间线</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
