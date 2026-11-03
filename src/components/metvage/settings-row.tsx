import Feather from '@expo/vector-icons/Feather'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { instanceOrigin } from 'src/lib/instanceOrigin'
import { metvagePalette as c } from 'src/lib/metvage-colors'
import { Storage } from 'src/state/cache'
import { openBrowserAsync } from 'src/utils'

type SettingsRowProps = {
  title: string
  icon: ComponentProps<typeof Feather>['name']
  onPress: () => void
  disabled?: boolean
  destructive?: boolean
}

export function SettingsRow({
  title,
  icon,
  onPress,
  disabled,
  destructive,
}: SettingsRowProps) {
  const color = destructive ? c.error : c.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <Feather name={icon} size={20} color={destructive ? c.error : c.green} />
      <Text style={{ flex: 1, color, fontSize: 16 }}>{title}</Text>
      <Feather name="chevron-right" size={18} color={c.secondaryText} />
    </Pressable>
  )
}

export function InstancePageRow({
  title,
  icon,
  path,
  destructive,
}: Omit<SettingsRowProps, 'onPress' | 'disabled'> & {
  path:
    | 'settings/security'
    | 'settings/password'
    | 'settings/remove/request/permanent'
    | 'e/privacy'
    | 'e/terms'
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function openPage() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const origin = instanceOrigin(Storage.getString('app.instance'))
      await openBrowserAsync(`${origin}/${path}`)
    } catch {
      setError('无法打开页面，请检查服务地址或网络后重试。')
    } finally {
      setPending(false)
    }
  }
  return (
    <View>
      <SettingsRow
        title={title}
        icon={icon}
        onPress={openPage}
        disabled={pending}
        destructive={destructive}
      />
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: c.error, padding: 16, lineHeight: 22 }}
        >
          {error}
        </Text>
      )}
    </View>
  )
}
