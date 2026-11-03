import { Feather } from '@expo/vector-icons'
import { useAuth } from '@state/AuthProvider'
import { Redirect, Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// enum here to prevent typos in id when used in multiple places (typescript checkable)
enum TabName {
  Index = 'index',
  Network = 'network',
  Explore = 'explore',
  Camera = 'camera',
  Discover = 'discover',
  Profile = 'profile',
  Notifications = 'notifications',
}

export default function AppLayout() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

  // Only require authentication within the (app) group's layout as users
  // need to be able to access the (auth) group and sign in again.
  if (!user) {
    return <Redirect href="/handleLogin" />
  }

  return (
    <Tabs
      initialRouteName={TabName.Index}
      backBehavior="history"
      screenOptions={{
        tabBarStyle: {
          height: (Platform.OS === 'ios' ? 54 : 60) + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name={TabName.Index}
        options={{
          title: '首页',
          tabBarLabel: '首页',
          headerShown: true,
          tabBarIcon: ({ color }) => <Feather name="home" size={26} color={color} />,
        }}
      />

      <Tabs.Screen
        name={TabName.Explore}
        options={{
          tabBarLabel: '探索',
          headerShown: true,
          tabBarIcon: ({ color }) => <Feather name="compass" size={26} color={color} />,
        }}
      />

      <Tabs.Screen
        name={TabName.Camera}
        options={{
          title: '发布',
          tabBarLabel: '发布',
          headerShown: true,
          tabBarIcon: ({ color }) => <Feather name="camera" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name={TabName.Notifications}
        options={{
          tabBarLabel: '消息',
          headerShown: true,
          tabBarIcon: ({ color }) => <Feather name="bell" size={26} color={color} />,
        }}
      />

      <Tabs.Screen
        name={TabName.Profile}
        options={{
          tabBarLabel: '我的',
          headerShown: false,
          tabBarIcon: ({ color }) => <Feather name="user" size={26} color={color} />,
        }}
      />
    </Tabs>
  )
}
