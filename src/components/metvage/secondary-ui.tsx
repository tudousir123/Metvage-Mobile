import Feather from '@expo/vector-icons/Feather'
import type { ComponentProps, ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'

export const secondaryScreenOptions = {
  headerTintColor: c.green,
  headerStyle: { backgroundColor: c.background },
  headerShadowVisible: false,
  headerTitleStyle: { fontSize: m.body, fontWeight: '600' as const },
}

export function ActionButton({
  title,
  icon,
  onPress,
  tone = 'primary',
  busy = false,
  disabled = false,
}: {
  title: string
  icon?: ComponentProps<typeof Feather>['name']
  onPress: () => void
  tone?: 'primary' | 'secondary' | 'destructive'
  busy?: boolean
  disabled?: boolean
}) {
  const color =
    tone === 'primary' ? c.surface : tone === 'destructive' ? c.error : c.green
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: m.touch,
        minWidth: m.touch,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: m.gap,
        paddingHorizontal: m.edge,
        paddingVertical: m.gap,
        borderRadius: 24,
        backgroundColor:
          tone === 'primary'
            ? c.green
            : tone === 'destructive'
              ? c.softPeach
              : c.softGreen,
        opacity: disabled || busy ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        icon && <Feather name={icon} size={18} color={color} />
      )}
      <Text style={{ color, fontSize: m.cardTitle, fontWeight: '600', flexShrink: 1 }}>
        {title}
      </Text>
    </Pressable>
  )
}

export function ScreenMessage({
  icon,
  title,
  children,
}: {
  icon: ComponentProps<typeof Feather>['name']
  title: string
  children?: ReactNode
}) {
  return (
    <View
      style={{ alignItems: 'center', padding: m.edge, paddingVertical: 32, gap: m.inset }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.softGreen,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={26} color={c.green} />
      </View>
      <Text
        style={{
          color: c.text,
          fontSize: m.body,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}
