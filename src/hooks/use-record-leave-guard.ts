import { useNavigation, usePreventRemove } from '@react-navigation/native'
import { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'

/** Protect every stack removal, including native back and the custom cancel button. */
export function useRecordLeaveGuard({
  dirty,
  busy,
  editing = false,
  saveDraft,
}: {
  dirty: boolean
  busy: boolean
  editing?: boolean
  saveDraft?: () => Promise<boolean>
}) {
  const navigation = useNavigation()
  const promptOpen = useRef(false)
  const [exit, setExit] = useState<{ run: () => void } | null>(null)
  const leaveAfterSave = (run: () => void) => setExit({ run })

  usePreventRemove(!exit && (dirty || busy), ({ data }) => {
    if (busy || promptOpen.current) return
    promptOpen.current = true
    const keepEditing = () => {
      promptOpen.current = false
    }
    const leave = () => leaveAfterSave(() => navigation.dispatch(data.action))
    Alert.alert(
      editing ? '放弃这次更改？' : '保留这份回忆？',
      editing ? '已保存的原记录不会改变。' : '可以存为本机草稿，稍后继续编辑。',
      [
        { text: '继续编辑', style: 'cancel', onPress: keepEditing },
        {
          text: editing ? '放弃更改' : '不保存离开',
          style: 'destructive',
          onPress: leave,
        },
        ...(saveDraft
          ? [
              {
                text: '存草稿并离开',
                onPress: async () => {
                  if (await saveDraft()) leave()
                  else keepEditing()
                },
              },
            ]
          : []),
      ],
      { cancelable: true, onDismiss: keepEditing }
    )
  })

  // Disable native-stack's removal protection before a confirmed/successful exit.
  useEffect(() => {
    exit?.run()
  }, [exit])

  return leaveAfterSave
}
