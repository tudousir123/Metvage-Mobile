import { Feather } from '@expo/vector-icons'
import { Link, Stack } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import {
  type UnavailableFeatureKey,
  unavailableFeatures,
} from 'src/lib/unavailable-features'
import { useTheme } from 'tamagui'

const plannedFeatures: UnavailableFeatureKey[] = [
  'nearby',
  'shop',
  'daily-inspiration',
  'tasks',
  'growth',
  'messages',
  'auto-book',
]

export default function ExploreScreen() {
  const theme = useTheme()
  const explore = unavailableFeatures.explore
  const backgroundColor = theme.background?.val.default.val
  const cardColor = theme.background?.val.secondary.val
  const textColor = theme.color?.val.default.val
  const secondaryColor = theme.color?.val.secondary.val
  const borderColor = theme.borderColor?.val.default.val

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen options={{ title: explore.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
      >
        <View
          style={{ gap: 8, padding: 16, borderRadius: 16, backgroundColor: cardColor }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>
            {explore.status}
          </Text>
          <Text style={{ fontSize: 16, color: textColor }} selectable>
            {explore.description}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>
            计划中的功能
          </Text>
          {plannedFeatures.map((key) => {
            const feature = unavailableFeatures[key]
            return (
              <Link
                key={key}
                href={{ pathname: '/unavailable/[feature]', params: { feature: key } }}
                asChild
              >
                <Pressable
                  accessibilityLabel={`${feature.title}，${feature.status}`}
                  style={{
                    padding: 16,
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 16,
                    backgroundColor: cardColor,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor }}>
                      {feature.title}
                    </Text>
                    <Text style={{ fontSize: 14, color: secondaryColor }}>
                      {feature.status}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={secondaryColor} />
                </Pressable>
              </Link>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
