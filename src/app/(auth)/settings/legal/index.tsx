import { Stack } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { InstancePageRow } from 'src/components/metvage/settings-row'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'

export default function LegalScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: '法律与隐私',
          headerTintColor: c.green,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: m.edge, gap: m.edge }}
      >
        <Text style={{ color: c.secondaryText, fontSize: m.cardTitle, lineHeight: 22 }}>
          查看当前服务提供的隐私政策与服务条款。
        </Text>
        <View
          style={{ backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden' }}
        >
          <InstancePageRow icon="shield" title="隐私政策" path="e/privacy" />
          <InstancePageRow icon="file-text" title="服务条款" path="e/terms" />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
