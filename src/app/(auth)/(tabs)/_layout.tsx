import Feather from '@expo/vector-icons/Feather'
import { useAuth } from '@state/AuthProvider'
import { Redirect, router, Tabs } from 'expo-router'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { metvagePalette as c, metvageMetrics as m } from 'src/lib/metvage-colors'

export default function AppLayout() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const { fontScale } = useWindowDimensions()
  // Keep the compact default height while reserving extra space for scaled labels.
  const labelGrowth = Math.ceil(20 * Math.max(0, fontScale - 1))
  if (!user) return <Redirect href="/handleLogin" />
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.green,
        tabBarInactiveTintColor: c.secondaryText,
        tabBarLabelStyle: { fontSize: m.caption, marginTop: 2 },
        tabBarItemStyle: { minHeight: m.touch },
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
          height: 58 + labelGrowth + insets.bottom,
          paddingBottom: 4 + insets.bottom,
          paddingTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <Feather name="home" size={m.icon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '探索',
          tabBarIcon: ({ color }) => (
            <Feather name="compass" size={m.icon} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        listeners={{
          tabPress: (event) => {
            event.preventDefault()
            router.push('/records/new?mode=public')
          },
        }}
        options={{
          title: '发布',
          tabBarIcon: () => (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: c.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="plus" size={24} color={c.surface} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: '消息',
          tabBarIcon: ({ color }) => (
            <Feather name="message-circle" size={m.icon} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <Feather name="user" size={m.icon} color={color} />,
        }}
      />
    </Tabs>
  )
}
