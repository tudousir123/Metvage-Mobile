import Constants from 'expo-constants'

// HTTP is only available for the explicitly enabled loopback acceptance instance.
export function isLocalTestInstance(host: string | null | undefined): boolean {
  return (
    Constants.expoConfig?.extra?.localInstanceHost === 'localhost:18080' &&
    host === 'localhost:18080'
  )
}

export function instanceOrigin(host: string | null | undefined): string {
  if (!host) throw new Error('Instance host is missing')
  return `${isLocalTestInstance(host) ? 'http' : 'https'}://${host}`
}
