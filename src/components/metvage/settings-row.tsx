import Feather from '@expo/vector-icons/Feather'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { instanceOrigin } from 'src/lib/instanceOrigin'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'
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
        minHeight: m.touch,
        paddingHorizontal: m.inset,
        paddingVertical: m.inset,
        flexDirection: 'row',
        alignItems: 'center',
        gap: m.inset,
        borderBottomWidth: 0.5,
        borderBottomColor: c.border,
        backgroundColor: pressed ? c.field : c.surface,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          backgroundColor: destructive ? c.softPeach : c.softGreen,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={17} color={destructive ? c.error : c.green} />
      </View>
      <Text style={{ flex: 1, color, fontSize: m.cardTitle }}>{title}</Text>
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
          style={{
            color: c.error,
            paddingHorizontal: m.inset,
            paddingVertical: m.inset,
            fontSize: m.caption,
            lineHeight: 18,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  )
}
