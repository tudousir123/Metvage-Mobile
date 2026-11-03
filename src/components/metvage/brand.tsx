import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import type { ComponentProps, ReactNode } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Svg, { Ellipse, Path } from 'react-native-svg'
import { metvagePalette as c } from 'src/lib/metvage-colors'

export function PawMark({
  size = 24,
  color = c.coral,
}: {
  size?: number
  color?: string
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden>
      <Ellipse cx="7" cy="12" rx="4" ry="5" fill={color} transform="rotate(-24 7 12)" />
      <Ellipse cx="14" cy="6" rx="4" ry="5" fill={color} />
      <Ellipse cx="23" cy="8" rx="4" ry="5" fill={color} transform="rotate(20 23 8)" />
      <Ellipse
        cx="28"
        cy="16"
        rx="3.5"
        ry="4.5"
        fill={color}
        transform="rotate(30 28 16)"
      />
      <Path
        d="M8 23c0-5 5-11 9-11s10 7 10 12c0 4-4 5-8 3-2-1-3-1-5 0-4 2-6 0-6-4Z"
        fill={color}
      />
    </Svg>
  )
}

export function BrandWordmark() {
  return (
    <View
      accessible
      accessibilityLabel="Metvage"
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}
    >
      <Text
        style={{
          color: c.green,
          fontSize: 34,
          fontWeight: '700',
          letterSpacing: -1.4,
          fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        }}
      >
        Metvage
      </Text>
      <View style={{ marginLeft: -2, marginTop: 1 }}>
        <PawMark size={19} />
      </View>
    </View>
  )
}

export function BrandHeader({ children }: { children?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
        gap: 8,
      }}
    >
      <BrandWordmark />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {children}
      </View>
    </View>
  )
}

export function IconButton({
  name,
  label,
  onPress,
  tone = 'plain',
}: {
  name: ComponentProps<typeof Feather>['name']
  label: string
  onPress: () => void
  tone?: 'plain' | 'green' | 'coral'
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'plain' ? 'transparent' : c[tone],
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Feather
        name={name}
        size={tone === 'plain' ? 25 : 28}
        color={tone === 'plain' ? c.text : c.surface}
      />
    </Pressable>
  )
}

export function PetAvatar({
  name,
  species,
  uri,
  size = 40,
}: {
  name: string
  species?: 'cat' | 'dog'
  uri?: string
  size?: number
}) {
  if (uri)
    return (
      <Image
        accessibilityLabel={`${name}的照片`}
        source={{ uri }}
        contentFit="cover"
        cachePolicy="none"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  return (
    <View
      accessibilityLabel={`${name} · ${species === 'cat' ? '猫' : species === 'dog' ? '狗' : '宠物'}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.softPeach,
      }}
    >
      <PawMark size={size * 0.46} color={c.green} />
    </View>
  )
}
