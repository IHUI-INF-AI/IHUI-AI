import { useEffect } from 'react'
import { View, Text } from 'react-native'
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { useNotificationWebSocket } from '../hooks/use-websocket'
import { NotificationProvider, useNotificationStore } from '../stores/notification'
import NotificationPanel from '../components/NotificationPanel'
import { LoginScreen } from '../screens/LoginScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { ChatScreen } from '../screens/ChatScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { CourseScreen } from '../screens/CourseScreen'
import { LiveScreen } from '../screens/LiveScreen'
import { OrderRefundScreen } from '../screens/OrderRefundScreen'
import { AgentScreen } from '../screens/AgentScreen'
import { RegisterScreen } from '../screens/RegisterScreen'
import { PaymentScreen } from '../screens/PaymentScreen'
import { VipScreen } from '../screens/VipScreen'
import { WalletScreen } from '../screens/WalletScreen'
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
import { AgentReviewDetailScreen } from '../screens/AgentReviewDetailScreen'
import { AgentReviewListScreen } from '../screens/AgentReviewListScreen'
import { AgentStatScreen } from '../screens/AgentStatScreen'
import { AgentSettingScreen } from '../screens/AgentSettingScreen'
import { CourseAnnexScreen } from '../screens/CourseAnnexScreen'
import { CourseResourceScreen } from '../screens/CourseResourceScreen'
import { CourseQAListScreen } from '../screens/CourseQAListScreen'
import { CourseQAAskScreen } from '../screens/CourseQAAskScreen'
import { LivePreviewScreen } from '../screens/LivePreviewScreen'
import { LivePlaybackListScreen } from '../screens/LivePlaybackListScreen'
import { OrderLogScreen } from '../screens/OrderLogScreen'
import { OrderTrackScreen } from '../screens/OrderTrackScreen'
import { RefundDetailScreen } from '../screens/RefundDetailScreen'
import { RefundHistoryScreen } from '../screens/RefundHistoryScreen'
import { PointRuleScreen } from '../screens/PointRuleScreen'
import { PointHistoryScreen } from '../screens/PointHistoryScreen'
import { VipLevelScreen } from '../screens/VipLevelScreen'
import { VipBenefitScreen } from '../screens/VipBenefitScreen'
import { VipCompareScreen } from '../screens/VipCompareScreen'
import { CertListScreen } from '../screens/CertListScreen'
import { CertApplyScreen } from '../screens/CertApplyScreen'
import { MessageSystemScreen } from '../screens/MessageSystemScreen'
import { MessageDirectScreen } from '../screens/MessageDirectScreen'
import { MessageGroupScreen } from '../screens/MessageGroupScreen'
import { AnnouncementDetailScreen } from '../screens/AnnouncementDetailScreen'
import { ActivityDetailScreen } from '../screens/ActivityDetailScreen'
import { HelpDetailScreen } from '../screens/HelpDetailScreen'
import { FeedbackHistoryScreen } from '../screens/FeedbackHistoryScreen'
import { FeedbackDetailScreen } from '../screens/FeedbackDetailScreen'
import { SettingsAccountScreen } from '../screens/SettingsAccountScreen'
import { OrderDetailScreen } from '../screens/OrderDetailScreen'
import { CourseChapterScreen } from '../screens/CourseChapterScreen'
import { CourseCommentScreen } from '../screens/CourseCommentScreen'
import { CourseCatalogScreen } from '../screens/CourseCatalogScreen'
import { LiveChatScreen } from '../screens/LiveChatScreen'
import { LiveHostScreen } from '../screens/LiveHostScreen'
import { ChangePhoneScreen } from '../screens/ChangePhoneScreen'
import IncomeScreen from '../screens/IncomeScreen'
import { AgentDetailScreen } from '../screens/AgentDetailScreen'
import { AgentChatScreen } from '../screens/AgentChatScreen'
import { AgentMarketScreen } from '../screens/AgentMarketScreen'
import { AgentCreateScreen } from '../screens/AgentCreateScreen'
import { ArticleDetailScreen } from '../screens/ArticleDetailScreen'
import { ArticleListScreen } from '../screens/ArticleListScreen'
import { PostDetailScreen } from '../screens/PostDetailScreen'
import { PostCreateScreen } from '../screens/PostCreateScreen'
import { CircleDetailScreen } from '../screens/CircleDetailScreen'
import { CircleCreateScreen } from '../screens/CircleCreateScreen'
import { CircleMemberScreen } from '../screens/CircleMemberScreen'
import { CircleChatScreen } from '../screens/CircleChatScreen'
import { AskDetailScreen } from '../screens/AskDetailScreen'
import { AskCreateScreen } from '../screens/AskCreateScreen'
import { AskListScreen } from '../screens/AskListScreen'
import { NoteDetailScreen } from '../screens/NoteDetailScreen'
import { NoteCreateScreen } from '../screens/NoteCreateScreen'
import { NoteListScreen } from '../screens/NoteListScreen'
import { StudyPlanScreen } from '../screens/StudyPlanScreen'
import { StudyProgressScreen } from '../screens/StudyProgressScreen'
import { ExamResultScreen } from '../screens/ExamResultScreen'
import { ExamHistoryScreen } from '../screens/ExamHistoryScreen'
import { ExamQuestionScreen } from '../screens/ExamQuestionScreen'
import { CertDetailScreen } from '../screens/CertDetailScreen'
import { CertVerifyScreen } from '../screens/CertVerifyScreen'
import { MessageDetailScreen } from '../screens/MessageDetailScreen'
import { MessageChatScreen } from '../screens/MessageChatScreen'
import { NotificationListScreen } from '../screens/NotificationListScreen'
import { SearchScreen } from '../screens/SearchScreen'
import { HistoryScreen } from '../screens/HistoryScreen'
import { BookmarkScreen } from '../screens/BookmarkScreen'
import { ShareScreen } from '../screens/ShareScreen'
import { useTheme } from '../context/ThemeContext'
import { WorkPanelScreen, setWorkPanelNavigator } from '../components/WorkPanel'
import { TaskDispatchPage } from '../pages/TaskDispatchPage'
import { SharedDemoScreen } from '../screens/SharedDemoScreen'
import AigcCoverScreen from '../screens/AigcCoverScreen'
import AigcPublishScreen from '../screens/AigcPublishScreen'
import { LearnScreen } from '../screens/LearnScreen'
import SquareScreen from '../screens/SquareScreen'
import { PlazaScreen } from '../screens/PlazaScreen'
import { CoursePlanetScreen } from '../screens/CoursePlanetScreen'
import { LearnDevelopScreen } from '../screens/LearnDevelopScreen'
import StudyIndexScreen from '../screens/StudyIndexScreen'
import { KnowledgePlanetScreen } from '../screens/KnowledgePlanetScreen'
import AccountCancelScreen from '../screens/AccountCancelScreen'
import { BusinessLicenseScreen } from '../screens/BusinessLicenseScreen'
import { IcpRecordScreen } from '../screens/IcpRecordScreen'
import { ModelRecordScreen } from '../screens/ModelRecordScreen'
import { UsageRulesScreen } from '../screens/UsageRulesScreen'
import { AppPermissionScreen } from '../screens/AppPermissionScreen'
import TokenValueScreen from '../screens/TokenValueScreen'
import AiGroupScreen from '../screens/AiGroupScreen'
import AiAssistantScreen from '../screens/AiAssistantScreen'
import AigcListScreen from '../screens/AigcListScreen'
import ModelPlazaScreen from '../screens/ModelPlazaScreen'
import DeveloperScreen from '../screens/DeveloperScreen'
import BusinessCardScreen from '../screens/BusinessCardScreen'
import RecruitmentScreen from '../screens/RecruitmentScreen'
import VipTraderScreen from '../screens/VipTraderScreen'
import DevEnterScreen from '../screens/DevEnterScreen'
import N8nModelScreen from '../screens/N8nModelScreen'
import ModelIncomeScreen from '../screens/ModelIncomeScreen'
import AiCareerScreen from '../screens/AiCareerScreen'
import AssistantScreen from '../screens/AssistantScreen'
import ChangePwdScreen from '../screens/ChangePwdScreen'
import TopupSuccessScreen from '../screens/TopupSuccessScreen'
import TopupFailScreen from '../screens/TopupFailScreen'
import CategoryDetailScreen from '../screens/CategoryDetailScreen'
import RankingDetailScreen from '../screens/RankingDetailScreen'
import TeamDetailScreen from '../screens/TeamDetailScreen'
import DistributionOrderListScreen from '../screens/DistributionOrderListScreen'
import EarnCommissionScreen from '../screens/EarnCommissionScreen'
import StudyPublishScreen from '../screens/StudyPublishScreen'
import AiAssistantN8nScreen from '../screens/AiAssistantN8nScreen'
import { MoreCourseScreen } from '../screens/MoreCourseScreen'
// H20 补齐:类型已声明但未注册的路由对应 Screen(此前 navigate 即崩)
import { CourseDetailScreen } from '../screens/CourseDetailScreen'
import { VideoPlayerScreen } from '../screens/VideoPlayerScreen'
import { LiveDetailScreen } from '../screens/LiveDetailScreen'
import { OrderScreen } from '../screens/OrderScreen'
import SettingsScreen from '../screens/SettingsScreen'
import { FavoritesScreen } from '../screens/FavoritesScreen'
import { FavoriteScreen } from '../screens/FavoriteScreen'
import { FollowScreen } from '../screens/FollowScreen'
import { FollowingScreen } from '../screens/FollowingScreen'
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen'
import { CertificateScreen } from '../screens/CertificateScreen'
import { MessageCenterScreen } from '../screens/MessageCenterScreen'
import { ProfileEditScreen } from '../screens/ProfileEditScreen'
import { DevEnterCoverScreen } from '../screens/DevEnterCoverScreen'
import { PlazaCoverScreen } from '../screens/PlazaCoverScreen'
import { SetNeedScreen } from '../screens/SetNeedScreen'
import { SubPackageIndexScreen } from '../screens/SubPackageIndexScreen'
import AppTopupScreen from '../screens/AppTopupScreen'

export type RootStackParamList = {
  Login: undefined
  Main: NavigatorScreenParams<MainStackParamList>
  Home: undefined
  // 对齐 Uniapp 跳 chat 传参(conversationId/title/modelName/modelId/remark),其余 12 参数中关键项已覆盖;
  // modelName/modelId/remark 可选,ChatScreen 仅消费 conversationId,其余字段预留给后续接入。
  Chat: {
    conversationId?: string
    title?: string
    modelName?: string
    modelId?: string
    remark?: string
  }
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
  AgentReviewDetail: { id: string }
  AgentReviewList: undefined
  AgentStat: undefined
  AgentSetting: undefined
  CourseAnnex: undefined
  CourseResource: undefined
  CourseQAList: undefined
  CourseQAAsk: undefined
  LivePreview: { id: string }
  LivePlaybackList: undefined
  OrderLog: undefined
  OrderTrack: undefined
  RefundDetail: { id: string }
  RefundHistory: undefined
  PointRule: undefined
  PointHistory: undefined
  VipLevel: { id: string }
  VipBenefit: undefined
  VipCompare: undefined
  CertList: undefined
  CertApply: undefined
  MessageSystem: undefined
  MessageDirect: undefined
  MessageGroup: undefined
  AnnouncementDetail: { id: string }
  ActivityDetail: { id: string }
  HelpDetail: { id: string }
  FeedbackHistory: undefined
  FeedbackDetail: { id: string }
  SettingsAccount: undefined
  OrderDetail: { id: string }
  CourseChapter: { courseId: string }
  CourseComment: { courseId: string }
  CourseCatalog: { courseId: string }
  LiveChat: { liveId: string }
  LiveHost: undefined
  ChangePhone: { uuid: string }
  Income: undefined
  AgentDetail: { id: string }
  AgentChat: { agentId: string; name: string }
  AgentMarket: undefined
  AgentCreate: undefined
  ArticleDetail: { id: string }
  ArticleList: undefined
  PostDetail: { id: string }
  PostCreate: { circleId?: string }
  CircleDetail: { id: string }
  CircleCreate: undefined
  CircleMember: { circleId: string }
  CircleChat: { circleId: string; name: string }
  AskDetail: { id: string }
  AskCreate: undefined
  AskList: undefined
  NoteDetail: { id: string }
  NoteCreate: { courseId?: string }
  NoteList: undefined
  StudyPlan: undefined
  StudyProgress: undefined
  ExamResult: { id: string }
  ExamHistory: undefined
  ExamQuestion: { examId: string }
  CertDetail: { id: string }
  CertVerify: { certNo?: string }
  MessageDetail: { id: string }
  MessageChat: { peerId: string; name: string }
  NotificationList: undefined
  Search: undefined
  History: undefined
  Bookmark: undefined
  Share: undefined
  WorkPanel: { url: string }
  TaskDispatch: undefined
  SharedDemo: undefined
  Recharge: undefined
  AigcCover: { id: string; title: string }
  AigcPublish: undefined
  // H10-H18 新增路由(复刻 Uniapp 缺失页面)
  Learn: undefined
  Square: undefined
  Plaza: undefined
  CoursePlanet: undefined
  LearnDevelop: undefined
  StudyIndex: undefined
  KnowledgePlanet: undefined
  AccountCancel: undefined
  BusinessLicense: undefined
  IcpRecord: undefined
  ModelRecord: undefined
  UsageRules: undefined
  AppPermission: undefined
  TokenValue: undefined
  AiGroup: undefined
  AiAssistant: { agentId?: string; title?: string } | undefined
  AigcList: undefined
  ModelPlaza: undefined
  Developer: { id: string }
  BusinessCard: { userId?: string }
  Recruitment: undefined
  VipTrader: undefined
  DevEnter: undefined
  N8nModel: undefined
  ModelIncome: { agentId?: string }
  AiCareer: undefined
  Assistant: undefined
  ChangePwd: undefined
  TopupSuccess: { amount: number; orderId: string }
  TopupFail: { reason?: string }
  CategoryDetail: { categoryId: string; title: string }
  RankingDetail: { id: string }
  TeamDetail: { memberId: string }
  DistributionOrderList: undefined
  EarnCommission: undefined
  StudyPublish: undefined
  AiAssistantN8n: { agentId?: string; title?: string }
  // H19 新增路由(对齐 Uniapp pagesA 缺失页面)
  MoreCourse: undefined
  DevEnterCover: undefined
  PlazaCover: undefined
  SetNeed: undefined
  SubPackageIndex: undefined
  AppTopup: undefined
}

// MainStackParamList / MainTabKey / mainScreenForTab 已提取到 tab-utils.ts,
// 避免 RootNavigator ↔ screen 的 require cycle。此处 re-export 保持向后兼容。
import type { MainStackParamList } from './tab-utils'
export { mainScreenForTab, type MainTabKey } from './tab-utils'

const RootStack = createNativeStackNavigator<RootStackParamList>()
const MainStack = createNativeStackNavigator<MainStackParamList>()

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="HomeMain" component={HomeScreen} />
      <MainStack.Screen name="CourseMain" component={CourseScreen} />
      <MainStack.Screen name="AiMain" component={AgentScreen} />
      <MainStack.Screen name="LiveMain" component={LiveScreen} />
      <MainStack.Screen name="ProfileMain" component={ProfileScreen} />
    </MainStack.Navigator>
  )
}

function WorkPanelNavBridge() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  useEffect(() => {
    setWorkPanelNavigator((url: string) => navigation.navigate('WorkPanel', { url }))
    return () => setWorkPanelNavigator(null)
  }, [navigation])
  return null
}

function RootNavigatorInner() {
  const { token, ready } = useAuth()
  const { resolvedTheme } = useTheme()
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
      <View
        className={`flex-1 items-center justify-center ${resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}
      >
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <RootStack.Screen name="Main" component={MainNavigator} />
            <RootStack.Screen name="Home" component={HomeScreen} />
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
            <RootStack.Screen name="AgentReviewDetail" component={AgentReviewDetailScreen} />
            <RootStack.Screen name="AgentReviewList" component={AgentReviewListScreen} />
            <RootStack.Screen name="AgentStat" component={AgentStatScreen} />
            <RootStack.Screen name="AgentSetting" component={AgentSettingScreen} />
            <RootStack.Screen name="CourseAnnex" component={CourseAnnexScreen} />
            <RootStack.Screen name="CourseResource" component={CourseResourceScreen} />
            <RootStack.Screen name="CourseQAList" component={CourseQAListScreen} />
            <RootStack.Screen name="CourseQAAsk" component={CourseQAAskScreen} />
            <RootStack.Screen name="LivePreview" component={LivePreviewScreen} />
            <RootStack.Screen name="LivePlaybackList" component={LivePlaybackListScreen} />
            <RootStack.Screen name="OrderLog" component={OrderLogScreen} />
            <RootStack.Screen name="OrderTrack" component={OrderTrackScreen} />
            <RootStack.Screen name="RefundDetail" component={RefundDetailScreen} />
            <RootStack.Screen name="RefundHistory" component={RefundHistoryScreen} />
            <RootStack.Screen name="PointRule" component={PointRuleScreen} />
            <RootStack.Screen name="PointHistory" component={PointHistoryScreen} />
            <RootStack.Screen name="VipLevel" component={VipLevelScreen} />
            <RootStack.Screen name="VipBenefit" component={VipBenefitScreen} />
            <RootStack.Screen name="VipCompare" component={VipCompareScreen} />
            <RootStack.Screen name="CertList" component={CertListScreen} />
            <RootStack.Screen name="CertApply" component={CertApplyScreen} />
            <RootStack.Screen name="MessageSystem" component={MessageSystemScreen} />
            <RootStack.Screen name="MessageDirect" component={MessageDirectScreen} />
            <RootStack.Screen name="MessageGroup" component={MessageGroupScreen} />
            <RootStack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} />
            <RootStack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
            <RootStack.Screen name="HelpDetail" component={HelpDetailScreen} />
            <RootStack.Screen name="FeedbackHistory" component={FeedbackHistoryScreen} />
            <RootStack.Screen name="FeedbackDetail" component={FeedbackDetailScreen} />
            <RootStack.Screen name="SettingsAccount" component={SettingsAccountScreen} />
            <RootStack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <RootStack.Screen name="CourseChapter" component={CourseChapterScreen} />
            <RootStack.Screen name="CourseComment" component={CourseCommentScreen} />
            <RootStack.Screen name="CourseCatalog" component={CourseCatalogScreen} />
            <RootStack.Screen name="LiveChat" component={LiveChatScreen} />
            <RootStack.Screen
              name="LiveHost"
              component={LiveHostScreen}
              options={{ title: '主播端' }}
            />
            <RootStack.Screen
              name="ChangePhone"
              component={ChangePhoneScreen}
              options={{ title: '修改手机号' }}
            />
            <RootStack.Screen
              name="Income"
              component={IncomeScreen}
              options={{ title: '我的收益' }}
            />
            <RootStack.Screen name="AgentDetail" component={AgentDetailScreen} />
            <RootStack.Screen name="AgentChat" component={AgentChatScreen} />
            <RootStack.Screen name="AgentMarket" component={AgentMarketScreen} />
            <RootStack.Screen name="AgentCreate" component={AgentCreateScreen} />
            <RootStack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
            <RootStack.Screen name="ArticleList" component={ArticleListScreen} />
            <RootStack.Screen name="PostDetail" component={PostDetailScreen} />
            <RootStack.Screen name="PostCreate" component={PostCreateScreen} />
            <RootStack.Screen name="CircleDetail" component={CircleDetailScreen} />
            <RootStack.Screen name="CircleCreate" component={CircleCreateScreen} />
            <RootStack.Screen name="CircleMember" component={CircleMemberScreen} />
            <RootStack.Screen name="CircleChat" component={CircleChatScreen} />
            <RootStack.Screen name="AskDetail" component={AskDetailScreen} />
            <RootStack.Screen name="AskCreate" component={AskCreateScreen} />
            <RootStack.Screen name="AskList" component={AskListScreen} />
            <RootStack.Screen name="NoteDetail" component={NoteDetailScreen} />
            <RootStack.Screen name="NoteCreate" component={NoteCreateScreen} />
            <RootStack.Screen name="NoteList" component={NoteListScreen} />
            <RootStack.Screen name="StudyPlan" component={StudyPlanScreen} />
            <RootStack.Screen name="StudyProgress" component={StudyProgressScreen} />
            <RootStack.Screen name="ExamResult" component={ExamResultScreen} />
            <RootStack.Screen name="ExamHistory" component={ExamHistoryScreen} />
            <RootStack.Screen name="ExamQuestion" component={ExamQuestionScreen} />
            <RootStack.Screen name="CertDetail" component={CertDetailScreen} />
            <RootStack.Screen name="CertVerify" component={CertVerifyScreen} />
            <RootStack.Screen name="MessageDetail" component={MessageDetailScreen} />
            <RootStack.Screen name="MessageChat" component={MessageChatScreen} />
            <RootStack.Screen name="NotificationList" component={NotificationListScreen} />
            <RootStack.Screen name="Search" component={SearchScreen} />
            <RootStack.Screen name="History" component={HistoryScreen} />
            <RootStack.Screen name="Bookmark" component={BookmarkScreen} />
            <RootStack.Screen name="Share" component={ShareScreen} />
            <RootStack.Screen name="WorkPanel" component={WorkPanelScreen} />
            <RootStack.Screen name="TaskDispatch" component={TaskDispatchPage} />
            <RootStack.Screen name="SharedDemo" component={SharedDemoScreen} />
            {/* Recharge 暂复用钱包页(充值页独立实现前,保证导航可达不崩) */}
            <RootStack.Screen name="Recharge" component={WalletScreen} />
            <RootStack.Screen name="AigcCover" component={AigcCoverScreen} />
            <RootStack.Screen name="AigcPublish" component={AigcPublishScreen} />
            {/* H10-H18 新增 Screen(复刻 Uniapp 缺失页面) */}
            <RootStack.Screen name="Learn" component={LearnScreen} />
            <RootStack.Screen name="Square" component={SquareScreen} />
            <RootStack.Screen name="Plaza" component={PlazaScreen} />
            <RootStack.Screen name="CoursePlanet" component={CoursePlanetScreen} />
            <RootStack.Screen name="LearnDevelop" component={LearnDevelopScreen} />
            <RootStack.Screen name="StudyIndex" component={StudyIndexScreen} />
            <RootStack.Screen name="KnowledgePlanet" component={KnowledgePlanetScreen} />
            <RootStack.Screen name="AccountCancel" component={AccountCancelScreen} />
            <RootStack.Screen name="BusinessLicense" component={BusinessLicenseScreen} />
            <RootStack.Screen name="IcpRecord" component={IcpRecordScreen} />
            <RootStack.Screen name="ModelRecord" component={ModelRecordScreen} />
            <RootStack.Screen name="UsageRules" component={UsageRulesScreen} />
            <RootStack.Screen name="AppPermission" component={AppPermissionScreen} />
            <RootStack.Screen name="TokenValue" component={TokenValueScreen} />
            <RootStack.Screen name="AiGroup" component={AiGroupScreen} />
            <RootStack.Screen name="AiAssistant" component={AiAssistantScreen} />
            <RootStack.Screen name="AigcList" component={AigcListScreen} />
            <RootStack.Screen name="ModelPlaza" component={ModelPlazaScreen} />
            <RootStack.Screen name="Developer" component={DeveloperScreen} />
            <RootStack.Screen name="BusinessCard" component={BusinessCardScreen} />
            <RootStack.Screen name="Recruitment" component={RecruitmentScreen} />
            <RootStack.Screen name="VipTrader" component={VipTraderScreen} />
            <RootStack.Screen name="DevEnter" component={DevEnterScreen} />
            <RootStack.Screen name="N8nModel" component={N8nModelScreen} />
            <RootStack.Screen name="ModelIncome" component={ModelIncomeScreen} />
            <RootStack.Screen name="AiCareer" component={AiCareerScreen} />
            <RootStack.Screen name="Assistant" component={AssistantScreen} />
            <RootStack.Screen name="ChangePwd" component={ChangePwdScreen} />
            <RootStack.Screen name="TopupSuccess" component={TopupSuccessScreen} />
            <RootStack.Screen name="TopupFail" component={TopupFailScreen} />
            <RootStack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
            <RootStack.Screen name="RankingDetail" component={RankingDetailScreen} />
            <RootStack.Screen name="TeamDetail" component={TeamDetailScreen} />
            <RootStack.Screen
              name="DistributionOrderList"
              component={DistributionOrderListScreen}
            />
            <RootStack.Screen name="EarnCommission" component={EarnCommissionScreen} />
            <RootStack.Screen name="StudyPublish" component={StudyPublishScreen} />
            <RootStack.Screen name="AiAssistantN8n" component={AiAssistantN8nScreen} />
            {/* H19 新增 Screen(对齐 Uniapp pagesA 缺失页面) */}
            <RootStack.Screen name="MoreCourse" component={MoreCourseScreen} />
            <RootStack.Screen name="DevEnterCover" component={DevEnterCoverScreen} />
            <RootStack.Screen name="PlazaCover" component={PlazaCoverScreen} />
            <RootStack.Screen name="SetNeed" component={SetNeedScreen} />
            <RootStack.Screen name="SubPackageIndex" component={SubPackageIndexScreen} />
            <RootStack.Screen name="AppTopup" component={AppTopupScreen} />
            {/* H20 补齐:类型已声明但未注册的路由(此前 navigate 即崩) */}
            <RootStack.Screen name="CourseDetail" component={CourseDetailScreen} />
            <RootStack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
            <RootStack.Screen name="LiveDetail" component={LiveDetailScreen} />
            <RootStack.Screen name="Order" component={OrderScreen} />
            <RootStack.Screen name="Wallet" component={WalletScreen} />
            <RootStack.Screen name="Settings" component={SettingsScreen} />
            <RootStack.Screen name="Favorites" component={FavoritesScreen} />
            <RootStack.Screen name="Favorite" component={FavoriteScreen} />
            <RootStack.Screen name="Follow" component={FollowScreen} />
            <RootStack.Screen name="Following" component={FollowingScreen} />
            <RootStack.Screen name="Subscriptions" component={SubscriptionsScreen} />
            <RootStack.Screen name="Certificate" component={CertificateScreen} />
            <RootStack.Screen name="MessageCenter" component={MessageCenterScreen} />
            <RootStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
            <RootStack.Screen name="Agent" component={AgentScreen} />
          </>
        ) : (
          <>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </RootStack.Navigator>
      <NotificationPanel />
      <WorkPanelNavBridge />
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
