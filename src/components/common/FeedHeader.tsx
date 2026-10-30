import { Feather } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { Text as NativeText, View as NativeView, Platform, Pressable } from 'react-native'
import { Text, useTheme, XStack } from 'tamagui'

export default function FeedHeader({ title = 'Home', user }) {
  const theme = useTheme()
  const textColor = theme.color.val.default.val

  return (
    <XStack
      px="$3"
      pb="$3"
      pt={Platform.OS === 'android' ? '$3' : 0}
      backgroundColor="$background.default"
      justifyContent="space-between"
      alignItems="center"
      zIndex={100}
      borderBottomWidth={0}
    >
      <XStack alignItems="center" gap="$1">
        <Text
          color={textColor}
          fontSize={title === 'Pixelfed' ? 25 : 19}
          lineHeight={30}
          fontWeight="bold"
          letterSpacing={-0.5}
          allowFontScaling={false}
        >
          {title}
        </Text>
      </XStack>
      <XStack gap="$5">
        {title === 'Pixelfed' ? (
          <Link href="/feeds/network" asChild>
            <Pressable hitSlop={12}>
              <Feather name="globe" size={26} color={textColor} />
            </Pressable>
          </Link>
        ) : (
          <Link href="/" asChild>
            <Pressable hitSlop={12}>
              <Feather name="home" size={26} color={textColor} />
            </Pressable>
          </Link>
        )}
        <Link href="/chats" asChild>
          <Pressable hitSlop={8} accessibilityLabel="私信，未开放">
            <NativeView style={{ alignItems: 'center' }}>
              <Feather name="mail" size={23} color={textColor} />
              <NativeText style={{ fontSize: 10, color: textColor }}>未开放</NativeText>
            </NativeView>
          </Pressable>
        </Link>
        <Link href="/search" asChild>
          <Pressable hitSlop={12}>
            <Feather name="search" size={26} color={textColor} />
          </Pressable>
        </Link>
      </XStack>
    </XStack>
  )
}
