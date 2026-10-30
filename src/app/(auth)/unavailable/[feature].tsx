import { useLocalSearchParams } from 'expo-router'
import UnavailableFeatureScreen from 'src/components/common/unavailable-feature-screen'

export default function UnavailableFeatureRoute() {
  const { feature } = useLocalSearchParams<{ feature: string }>()
  return (
    <UnavailableFeatureScreen
      featureKey={Array.isArray(feature) ? feature[0] : (feature ?? '')}
    />
  )
}
