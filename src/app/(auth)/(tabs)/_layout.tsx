import Feather from '@expo/vector-icons/Feather'
import { useAuth } from '@state/AuthProvider'
import { Redirect, router, Tabs } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { metvagePalette as c } from 'src/lib/metvage-colors'

export default function AppLayout() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  if (!user) return <Redirect href="/handleLogin" />
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.green,
        tabBarInactiveTintColor: c.secondaryText,
        tabBarLabelStyle: { fontSize: 12, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 7,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <Feather name="home" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '探索',
          tabBarIcon: ({ color }) => <Feather name="compass" size={26} color={color} />,
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
                width: 38,
                height: 38,
                borderRadius: 20,
                backgroundColor: c.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="plus" size={30} color={c.surface} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: '消息',
          tabBarIcon: ({ color }) => (
            <Feather name="message-circle" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <Feather name="user" size={26} color={color} />,
        }}
      />
    </Tabs>
  )
}
