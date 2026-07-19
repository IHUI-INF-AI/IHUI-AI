import { useEffect } from 'react'
import { View, Text } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuth } from '../context/AuthContext'
import { useNotificationWebSocket } from '../hooks/use-websocket'
import { NotificationProvider, useNotificationStore } from '../stores/notification'
import NotificationPanel from '../components/NotificationPanel'
import { LoginScreen } from '../screens/LoginScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { ChatScreen } from '../screens/ChatScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { CourseScreen } from '../screens/CourseScreen'
import { CourseDetailScreen } from '../screens/CourseDetailScreen'
import { VideoPlayerScreen } from '../screens/VideoPlayerScreen'
import { LiveScreen } from '../screens/LiveScreen'
import { LiveDetailScreen } from '../screens/LiveDetailScreen'
import { OrderScreen } from '../screens/OrderScreen'
import { WalletScreen } from '../screens/WalletScreen'
import SettingsScreen from '../screens/SettingsScreen'
import { FavoritesScreen } from '../screens/FavoritesScreen'
import { FollowingScreen } from '../screens/FollowingScreen'
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen'
import { AgentScreen } from '../screens/AgentScreen'
import { useI18n } from '../i18n'

export type RootStackParamList = {
  Login: undefined
  Tabs: undefined
  Chat: undefined
  CourseDetail: { id: string }
  VideoPlayer: { courseId: string; lessonId: string; title?: string }
  LiveDetail: { id: string }
  Order: undefined
  Wallet: undefined
  Settings: undefined
  Favorites: undefined
  Following: undefined
  Subscriptions: undefined
  Agent: undefined
}

export type HomeStackParamList = {
  HomeMain: undefined
  CourseDetail: { id: string }
  VideoPlayer: { courseId: string; lessonId: string; title?: string }
  LiveDetail: { id: string }
}

export type CourseStackParamList = {
  CourseMain: undefined
  CourseDetail: { id: string }
  VideoPlayer: { courseId: string; lessonId: string; title?: string }
}

export type LiveStackParamList = {
  LiveMain: undefined
  LiveDetail: { id: string }
}

export type ProfileStackParamList = {
  ProfileMain: undefined
  Order: undefined
  Favorites: undefined
  Following: undefined
  Subscriptions: undefined
  Wallet: undefined
  Settings: undefined
  Agent: undefined
}

const RootStack = createNativeStackNavigator<RootStackParamList>()
const Tabs = createBottomTabNavigator()
const HomeStack = createNativeStackNavigator<HomeStackParamList>()
const CourseStack = createNativeStackNavigator<CourseStackParamList>()
const LiveStack = createNativeStackNavigator<LiveStackParamList>()
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>()

function HomeTabStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <HomeStack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
      <HomeStack.Screen name="LiveDetail" component={LiveDetailScreen} />
    </HomeStack.Navigator>
  )
}

function CourseTabStack() {
  return (
    <CourseStack.Navigator screenOptions={{ headerShown: false }}>
      <CourseStack.Screen name="CourseMain" component={CourseScreen} />
      <CourseStack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <CourseStack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
    </CourseStack.Navigator>
  )
}

function LiveTabStack() {
  return (
    <LiveStack.Navigator screenOptions={{ headerShown: false }}>
      <LiveStack.Screen name="LiveMain" component={LiveScreen} />
      <LiveStack.Screen name="LiveDetail" component={LiveDetailScreen} />
    </LiveStack.Navigator>
  )
}

function ProfileTabStack() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="Order" component={OrderScreen} />
      <ProfileStack.Screen name="Favorites" component={FavoritesScreen} />
      <ProfileStack.Screen name="Following" component={FollowingScreen} />
      <ProfileStack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <ProfileStack.Screen name="Wallet" component={WalletScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
      <ProfileStack.Screen name="Agent" component={AgentScreen} />
    </ProfileStack.Navigator>
  )
}

function MainTabs() {
  const { t } = useI18n()
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#737373',
        tabBarStyle: { backgroundColor: 'white' },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="HomeTab"
        component={HomeTabStack}
        options={{ title: t('nav.home'), tabBarLabel: t('nav.home') }}
      />
      <Tabs.Screen
        name="CourseTab"
        component={CourseTabStack}
        options={{ title: t('nav.courses'), tabBarLabel: t('nav.courses') }}
      />
      <Tabs.Screen
        name="LiveTab"
        component={LiveTabStack}
        options={{ title: t('nav.live'), tabBarLabel: t('nav.live') }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileTabStack}
        options={{ title: t('nav.profile'), tabBarLabel: t('nav.profile') }}
      />
    </Tabs.Navigator>
  )
}

function RootNavigatorInner() {
  const { token, ready } = useAuth()
  const ws = useNotificationWebSocket(token)
  const { setConnected, addFromWs } = useNotificationStore()

  useEffect(() => {
    setConnected(ws.connected)
  }, [ws.connected, setConnected])

  useEffect(() => {
    addFromWs(ws.lastMessage)
  }, [ws.lastMessage, addFromWs])

  if (!ready) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <RootStack.Screen name="Tabs" component={MainTabs} />
            <RootStack.Screen name="Chat" component={ChatScreen} />
          </>
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
      <NotificationPanel />
    </>
  )
}

export function RootNavigator() {
  return (
    <NotificationProvider>
      <RootNavigatorInner />
    </NotificationProvider>
  )
}
