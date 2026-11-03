import { useLocalSearchParams } from 'expo-router'
import UnavailableFeatureScreen from 'src/components/common/unavailable-feature-screen'

export default function PlannedFeature() {
  const { feature } = useLocalSearchParams<{ feature: string }>()
  return <UnavailableFeatureScreen featureKey={feature} />
}
