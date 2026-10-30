import { Stack } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { getUnavailableFeature } from 'src/lib/unavailable-features'
import { useTheme } from 'tamagui'

export default function UnavailableFeatureScreen({ featureKey }: { featureKey: string }) {
  const feature = getUnavailableFeature(featureKey)
  const theme = useTheme()
  const textColor = theme.color?.val.default.val

  return (
    <View style={{ flex: 1, backgroundColor: theme.background?.val.default.val }}>
      <Stack.Screen options={{ title: feature.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
      >
        <View
          style={{
            gap: 16,
            padding: 20,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.borderColor?.val.default.val,
            backgroundColor: theme.background?.val.secondary.val,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>
            {feature.status}
          </Text>
          <Text style={{ fontSize: 18, color: textColor }} selectable>
            {feature.description}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
