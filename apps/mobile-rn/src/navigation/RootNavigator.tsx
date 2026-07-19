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
import { RegisterScreen } from '../screens/RegisterScreen'
import { OrderRefundScreen } from '../screens/OrderRefundScreen'
import { PaymentScreen } from '../screens/PaymentScreen'
import { VipScreen } from '../screens/VipScreen'
import { CertificateScreen } from '../screens/CertificateScreen'
import { FollowScreen } from '../screens/FollowScreen'
import { FavoriteScreen } from '../screens/FavoriteScreen'
import { MessageCenterScreen } from '../screens/MessageCenterScreen'
import { ProfileEditScreen } from '../screens/ProfileEditScreen'
import { AIMultimodalScreen } from '../screens/AIMultimodalScreen'
import { CourseEnrollScreen } from '../screens/CourseEnrollScreen'
import { LivePlaybackScreen } from '../screens/LivePlaybackScreen'
import { NoteScreen } from '../screens/NoteScreen'
import { StudyRecordScreen } from '../screens/StudyRecordScreen'
import { ExamScreen } from '../screens/ExamScreen'
import { FinanceScreen } from '../screens/FinanceScreen'
import { WithdrawScreen } from '../screens/WithdrawScreen'
import { BankCardScreen } from '../screens/BankCardScreen'
import { RealNameAuthScreen } from '../screens/RealNameAuthScreen'
import { IdentityVerifyScreen } from '../screens/IdentityVerifyScreen'
import { SecuritySettingsScreen } from '../screens/SecuritySettingsScreen'
import { PrivacyScreen } from '../screens/PrivacyScreen'
import { AgreementScreen } from '../screens/AgreementScreen'
import { AboutScreen } from '../screens/AboutScreen'
import { HelpScreen } from '../screens/HelpScreen'
import { FeedbackScreen } from '../screens/FeedbackScreen'
import { CustomerServiceScreen } from '../screens/CustomerServiceScreen'
import { AnnouncementScreen } from '../screens/AnnouncementScreen'
import { ActivityScreen } from '../screens/ActivityScreen'
import { PromotionScreen } from '../screens/PromotionScreen'
import { ReferrerScreen } from '../screens/ReferrerScreen'
import { InviteScreen } from '../screens/InviteScreen'
import { QrCodeScreen } from '../screens/QrCodeScreen'
import { DebugScreen } from '../screens/DebugScreen'
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen'
import { CourseFilterScreen } from '../screens/CourseFilterScreen'
import { LiveListScreen } from '../screens/LiveListScreen'
import { LecturerDetailScreen } from '../screens/LecturerDetailScreen'
import { CouponScreen } from '../screens/CouponScreen'
import { PointsMallScreen } from '../screens/PointsMallScreen'
import { PointsRecordScreen } from '../screens/PointsRecordScreen'
import { TaskCenterScreen } from '../screens/TaskCenterScreen'
import { CheckInScreen } from '../screens/CheckInScreen'
import { RankingScreen } from '../screens/RankingScreen'
import { PromoteScreen } from '../screens/PromoteScreen'
import { DistributionScreen } from '../screens/DistributionScreen'
import { TeamScreen } from '../screens/TeamScreen'
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
  Register: undefined
  OrderRefund: undefined
  Payment: undefined
  Vip: undefined
  Certificate: undefined
  Follow: undefined
  Favorite: undefined
  MessageCenter: undefined
  ProfileEdit: undefined
  AIMultimodal: undefined
  CourseEnroll: undefined
  LivePlayback: undefined
  Note: undefined
  StudyRecord: undefined
  Exam: undefined
  CourseFilter: undefined
  LiveList: undefined
  LecturerDetail: { id: string }
  Coupon: undefined
  PointsMall: undefined
  PointsRecord: undefined
  TaskCenter: undefined
  CheckIn: undefined
  Ranking: undefined
  Promote: undefined
  Distribution: undefined
  Team: undefined
  Finance: undefined
  Withdraw: undefined
  BankCard: undefined
  RealNameAuth: undefined
  IdentityVerify: undefined
  SecuritySettings: undefined
  Privacy: undefined
  Agreement: undefined
  About: undefined
  Help: undefined
  Feedback: undefined
  CustomerService: undefined
  Announcement: undefined
  Activity: undefined
  Promotion: undefined
  Referrer: undefined
  Invite: undefined
  QrCode: undefined
  Debug: undefined
  NotificationSettings: undefined
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
  Certificate: undefined
  Follow: undefined
  Favorite: undefined
  MessageCenter: undefined
  ProfileEdit: undefined
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
      <ProfileStack.Screen name="Certificate" component={CertificateScreen} />
      <ProfileStack.Screen name="Follow" component={FollowScreen} />
      <ProfileStack.Screen name="Favorite" component={FavoriteScreen} />
      <ProfileStack.Screen name="MessageCenter" component={MessageCenterScreen} />
      <ProfileStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
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
            <RootStack.Screen name="OrderRefund" component={OrderRefundScreen} />
            <RootStack.Screen name="Payment" component={PaymentScreen} />
            <RootStack.Screen name="Vip" component={VipScreen} />
            <RootStack.Screen name="AIMultimodal" component={AIMultimodalScreen} />
            <RootStack.Screen name="CourseEnroll" component={CourseEnrollScreen} />
            <RootStack.Screen name="LivePlayback" component={LivePlaybackScreen} />
            <RootStack.Screen name="Note" component={NoteScreen} />
            <RootStack.Screen name="StudyRecord" component={StudyRecordScreen} />
            <RootStack.Screen name="Exam" component={ExamScreen} />
            <RootStack.Screen name="CourseFilter" component={CourseFilterScreen} />
            <RootStack.Screen name="LiveList" component={LiveListScreen} />
            <RootStack.Screen name="LecturerDetail" component={LecturerDetailScreen} />
            <RootStack.Screen name="Coupon" component={CouponScreen} />
            <RootStack.Screen name="PointsMall" component={PointsMallScreen} />
            <RootStack.Screen name="PointsRecord" component={PointsRecordScreen} />
            <RootStack.Screen name="TaskCenter" component={TaskCenterScreen} />
            <RootStack.Screen name="CheckIn" component={CheckInScreen} />
            <RootStack.Screen name="Ranking" component={RankingScreen} />
            <RootStack.Screen name="Promote" component={PromoteScreen} />
            <RootStack.Screen name="Distribution" component={DistributionScreen} />
            <RootStack.Screen name="Team" component={TeamScreen} />
            <RootStack.Screen name="Finance" component={FinanceScreen} />
            <RootStack.Screen name="Withdraw" component={WithdrawScreen} />
            <RootStack.Screen name="BankCard" component={BankCardScreen} />
            <RootStack.Screen name="RealNameAuth" component={RealNameAuthScreen} />
            <RootStack.Screen name="IdentityVerify" component={IdentityVerifyScreen} />
            <RootStack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            <RootStack.Screen name="Privacy" component={PrivacyScreen} />
            <RootStack.Screen name="Agreement" component={AgreementScreen} />
            <RootStack.Screen name="About" component={AboutScreen} />
            <RootStack.Screen name="Help" component={HelpScreen} />
            <RootStack.Screen name="Feedback" component={FeedbackScreen} />
            <RootStack.Screen name="CustomerService" component={CustomerServiceScreen} />
            <RootStack.Screen name="Announcement" component={AnnouncementScreen} />
            <RootStack.Screen name="Activity" component={ActivityScreen} />
            <RootStack.Screen name="Promotion" component={PromotionScreen} />
            <RootStack.Screen name="Referrer" component={ReferrerScreen} />
            <RootStack.Screen name="Invite" component={InviteScreen} />
            <RootStack.Screen name="QrCode" component={QrCodeScreen} />
            <RootStack.Screen name="Debug" component={DebugScreen} />
            <RootStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          </>
        ) : (
          <>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
          </>
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
