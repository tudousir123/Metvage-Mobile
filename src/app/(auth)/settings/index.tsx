import { useAuth, useUserCache } from '@state/AuthProvider'
import * as Application from 'expo-application'
import { router, Stack } from 'expo-router'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { InstancePageRow, SettingsRow } from 'src/components/metvage/settings-row'
import { metvagePalette as c } from 'src/lib/metvage-colors'

export default function SettingsScreen() {
  const { username } = useUserCache()
  const { logout } = useAuth()
  const confirmLogout = () =>
    Alert.alert('退出登录？', '退出后仍可作为访客浏览公开笔记。', [
      { text: '取消', style: 'cancel' },
      { text: '退出登录', style: 'destructive', onPress: logout },
    ])
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: '设置',
          headerTintColor: c.green,
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 36 }}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>
            记录与账号
          </Text>
          <Text style={{ color: c.secondaryText }}>当前账号 · @{username}</Text>
        </View>
        <View
          style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden' }}
        >
          <SettingsRow
            icon="heart"
            title="我的宠物"
            onPress={() => router.push('/settings/pets')}
          />
          <SettingsRow
            icon="slash"
            title="屏蔽关系"
            onPress={() => router.push('/settings/blocked-pets')}
          />
        </View>
        <View
          style={{ backgroundColor: c.softGreen, borderRadius: 18, padding: 18, gap: 10 }}
        >
          <Text style={{ color: c.green, fontSize: 17, fontWeight: '700' }}>
            谁能看到我的记录？
          </Text>
          <Text style={{ color: c.text, lineHeight: 23 }}>
            每条记录单独设置可见范围：公开笔记可被未登录访客浏览；私人记录仅账号持有人可见。可在发布时选择，或在宠物时间线中修改。
          </Text>
          <Text style={{ color: c.secondaryText, lineHeight: 22 }}>
            屏蔽按用户账号生效，覆盖双方管理的所有宠物身份。屏蔽无法阻止对方退出登录后浏览你主动公开的内容。
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.secondaryText, fontSize: 13 }}>账号与安全</Text>
          <View
            style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden' }}
          >
            <InstancePageRow icon="shield" title="安全设置" path="settings/security" />
            <InstancePageRow icon="key" title="修改密码" path="settings/password" />
            <SettingsRow
              icon="file-text"
              title="法律与隐私"
              onPress={() => router.push('/settings/legal')}
            />
            <InstancePageRow
              icon="trash-2"
              title="删除账号"
              path="settings/remove/request/permanent"
              destructive
            />
          </View>
          <Text style={{ color: c.secondaryText, fontSize: 12, lineHeight: 20 }}>
            安全设置、修改密码和删除账号将在当前服务的网页中继续操作，可能需要重新登录。打开页面不会直接删除账号。
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={confirmLogout}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 28,
            padding: 16,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: c.green, fontSize: 16, fontWeight: '600' }}>
            退出登录
          </Text>
        </Pressable>
        <Text style={{ color: c.secondaryText, fontSize: 12, textAlign: 'center' }}>
          Metvage · {Application.nativeApplicationVersion || '开发版'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
