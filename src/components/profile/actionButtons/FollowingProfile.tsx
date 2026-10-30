import { Alert, Pressable, Text } from 'react-native'
import { Button, useTheme, XStack } from 'tamagui'

export default function FollowingProfile({
  onPress,
  onSendMessage,
}: {
  onPress: () => void
  onSendMessage: () => void
}) {
  const theme = useTheme()
  const handleAction = () => {
    Alert.alert('Confirm Unfollow', 'Are you sure you want to unfollow this account?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: () => onPress(),
      },
    ])
  }
  return (
    <XStack w="100%" my="$3" gap="$2">
      <Button
        theme="light"
        size="$3"
        bg="transparent"
        color={theme.color?.val.default.val}
        borderWidth={1}
        borderColor={theme.borderColor?.val.default.val}
        fontWeight="bold"
        fontSize="$4"
        flexGrow={1}
        onPress={() => handleAction()}
      >
        Unfollow
      </Button>

      <Pressable
        style={{
          borderWidth: 1,
          borderColor: theme.borderColor?.val.default.val,
          borderRadius: 8,
          paddingHorizontal: 16,
          justifyContent: 'center',
        }}
        onPress={onSendMessage}
      >
        <Text
          style={{
            color: theme.color?.val.default.val,
            fontSize: 14,
            fontWeight: 'bold',
          }}
        >
          私信 · 未开放
        </Text>
      </Pressable>
    </XStack>
  )
}
