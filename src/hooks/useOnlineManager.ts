import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import * as React from 'react'
import { Platform } from 'react-native'
import { isLocalTestInstance } from 'src/lib/instanceOrigin'
import { metvageInstanceHost } from 'src/lib/metvage-request'
import { Storage } from 'src/state/cache'

export function useOnlineManager() {
  React.useEffect(() => {
    // React Query already supports on reconnect auto refetch in web browser.
    if (Platform.OS === 'web') return

    let network: NetInfoState | null = null
    const update = () => {
      const signedInHost = Storage.getString('app.instance')
      const localTest =
        isLocalTestInstance(metvageInstanceHost()) &&
        (!signedInHost || isLocalTestInstance(signedInHost))
      // USB-forwarded localhost does not depend on Android's external Internet
      // probe. A stopped test server still produces a normal request failure.
      onlineManager.setOnline(
        localTest ||
          (network?.isConnected === true && network.isInternetReachable !== false)
      )
    }
    const unsubscribe = NetInfo.addEventListener((state) => {
      network = state
      update()
    })
    const storageListener = Storage.addOnValueChangedListener((key) => {
      if (key === 'app.instance') update()
    })
    return () => {
      unsubscribe()
      storageListener.remove()
    }
  }, [])
}
