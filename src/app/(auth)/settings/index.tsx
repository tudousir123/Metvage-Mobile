import Feather from '@expo/vector-icons/Feather'
import { useAuth, useUserCache } from '@state/AuthProvider'
import * as Application from 'expo-application'
import { router, Stack } from 'expo-router'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { InstancePageRow, SettingsRow } from 'src/components/metvage/settings-row'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'

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
        contentContainerStyle={{ padding: m.edge, gap: 24, paddingBottom: 32 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: m.inset }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.softGreen,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="user" size={22} color={c.green} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.text, fontSize: m.title, fontWeight: '700' }}>
              我的账号
            </Text>
            <Text style={{ color: c.secondaryText, fontSize: m.caption }}>
              @{username}
            </Text>
          </View>
        </View>
        <View style={{ gap: m.gap }}>
          <Text style={{ color: c.secondaryText, fontSize: m.caption }}>宠物与记录</Text>
          <View
            style={{ backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden' }}
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
        </View>
        <View style={{ gap: m.gap }}>
          <Text style={{ color: c.secondaryText, fontSize: m.caption }}>账号与安全</Text>
          <View
            style={{ backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden' }}
          >
            <InstancePageRow icon="shield" title="安全设置" path="settings/security" />
            <InstancePageRow icon="key" title="修改密码" path="settings/password" />
            <SettingsRow
              icon="file-text"
              title="法律与隐私"
              onPress={() => router.push('/settings/legal')}
            />
          </View>
        </View>
        <View style={{ gap: m.inset, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: m.gap }}>
            <Feather name="lock" size={16} color={c.green} />
            <Text style={{ color: c.green, fontSize: m.cardTitle, fontWeight: '600' }}>
              谁能看到我的记录？
            </Text>
          </View>
          <Text style={{ color: c.secondaryText, fontSize: m.caption, lineHeight: 18 }}>
            每条记录单独设置可见范围：公开笔记可被未登录访客浏览；私人记录仅账号持有人可见。可在发布时选择，或在宠物时间线中修改。
          </Text>
          <Text style={{ color: c.secondaryText, fontSize: m.caption, lineHeight: 18 }}>
            屏蔽按用户账号生效，覆盖双方管理的所有宠物身份。屏蔽无法阻止对方退出登录后浏览你主动公开的内容。
          </Text>
        </View>
        <View style={{ gap: m.gap }}>
          <View
            style={{ backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden' }}
          >
            <InstancePageRow
              icon="trash-2"
              title="删除账号"
              path="settings/remove/request/permanent"
              destructive
            />
          </View>
          <Text
            style={{
              color: c.secondaryText,
              fontSize: m.caption,
              lineHeight: 18,
              paddingHorizontal: 4,
            }}
          >
            安全设置、修改密码和删除账号将在当前服务的网页中继续操作，可能需要重新登录。打开页面不会直接删除账号。
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={confirmLogout}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 24,
            minHeight: m.touch,
            padding: m.inset,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? c.field : c.surface,
          })}
        >
          <Text style={{ color: c.green, fontSize: m.cardTitle, fontWeight: '600' }}>
            退出登录
          </Text>
        </Pressable>
        <Text
          style={{ color: c.secondaryText, fontSize: m.caption, textAlign: 'center' }}
        >
          Metvage · {Application.nativeApplicationVersion || '开发版'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
