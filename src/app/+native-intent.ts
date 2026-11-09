import { type Href, router } from 'expo-router'
import { getShareExtensionKey } from 'expo-share-intent'
import { Platform } from 'react-native'

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string
  initial: boolean
}) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return '/camera'
    }
    if (Platform.OS === 'android' && !initial) {
      const url = new URL(path, 'pixelfed:///')
      if (url.protocol === 'http:' || url.protocol === 'https:') return path
      const pathname = `${url.hostname ? `/${url.hostname}` : ''}${url.pathname}`
      if (pathname !== '/login') {
        // Preserve Back history without moving an already mounted native screen.
        router.push(`${pathname}${url.search}${url.hash}` as Href)
        return null
      }
    }
    return path
  } catch {
    return '/'
  }
}
