/**
 * API 接口定义 - 对接新架构后端 http://localhost:3000/api
 */
import { get, post, put } from '../utils/request'
import type { UserInfo } from '../utils/auth'
export type { UserInfo }

/* ============ 认证相关 ============ */

/** 发送短信验证码 */
export const sendSmsCode = (phone: string) => post('/auth/sms/send', { phone, scene: 'login' })

/** 手机号验证码登录 */
export const loginBySms = (phone: string, code: string) =>
  post<{ token: string; user: UserInfo }>('/auth/login/sms', { phone, code })

/** 手机号密码登录 */
export const loginByPassword = (phone: string, password: string) =>
  post<{ token: string; user: UserInfo }>('/auth/login/password', { phone, password })

/** 微信登录 */
export const loginByWechat = (code: string) =>
  post<{ token: string; user: UserInfo }>('/auth/login/wechat', { code })

/** 退出登录 */
export const logout = () => post('/auth/logout')

/** 获取当前用户信息 */
export const getProfile = () => get<UserInfo>('/user/profile')

/* ============ 首页 ============ */

export interface Banner {
  id: string | number
  title: string
  coverUrl: string
  link?: string
}

/** 首页资源（轮播、工具栏等） */
export const getHomePage = () => get<{ banner: Banner[] }>('/content/home')

/* ============ 课程 ============ */

export interface Course {
  id: string | number
  title: string
  subtitle?: string
  coverUrl: string
  teacher?: string
  duration?: string
  level?: string
  price?: number
  description?: string
  outline?: Array<{ title: string; duration: string; description: string }>
}

/** 课程列表 */
export const getCourseList = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  get<{ list: Course[]; total: number }>('/content/course/list', params)

/** 课程详情 */
export const getCourseDetail = (id: string | number) => get<Course>(`/content/course/${id}`)

/* ============ 直播 ============ */

export interface Live {
  id: string | number
  title: string
  coverUrl: string
  status: 'upcoming' | 'living' | 'ended'
  startTime?: string
  anchor?: string
  playUrl?: string
  watchCount?: number
}

/** 直播列表 */
export const getLiveList = (params?: { page?: number; pageSize?: number; status?: string }) =>
  get<{ list: Live[]; total: number }>('/live/list', params)

/** 直播详情 */
export const getLiveDetail = (id: string | number) => get<Live>(`/live/${id}`)

/* ============ 订单 ============ */

export interface Order {
  id: string | number
  orderNo: string
  type: string
  title: string
  amount: number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  createTime: string
}

/** 我的订单列表 */
export const getOrderList = (params?: { page?: number; pageSize?: number; status?: string }) =>
  get<{ list: Order[]; total: number }>('/order/list', params)

/* ============ AI 对话 ============ */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

/** AI 对话（流式可由后端 SSE 处理，此处提供普通接口） */
export const chat = (messages: ChatMessage[], sessionId?: string) =>
  post<{ reply: string; sessionId: string }>('/ai/chat', { messages, sessionId })

/* ============ 用户设置 ============ */

/** 更新用户资料 */
export const updateProfile = (data: Partial<UserInfo>) => put<UserInfo>('/user/profile', data)

/* ============ VIP / 会员 ============ */

export interface VipInfo {
  level: number
  name: string
  expireTime?: string
  privileges?: string[]
  price?: number
  originalPrice?: number
}

export const getVipInfo = () => get<VipInfo>('/vip/info')
export const getVipPrivilege = () =>
  get<{ list: Array<{ id: string; title: string; desc: string }> }>('/vip/privilege')
export const upgradeVip = (level: number) => post<{ orderNo: string }>('/vip/upgrade', { level })

export interface MemberInfo {
  level: string
  integral: number
  growth: number
  coupons: number
}
export const getMemberInfo = () => get<MemberInfo>('/member/info')
export const getMemberBenefits = () =>
  get<{ list: Array<{ id: string; title: string; desc: string; icon?: string }> }>(
    '/member/benefits',
  )
export const getIntegral = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: Array<{ id: string; type: string; amount: number; time: string }>; total: number }>(
    '/member/integral',
    params,
  )
export const getCouponList = (params?: { status?: string }) =>
  get<{
    list: Array<{
      id: string
      title: string
      amount: number
      threshold: number
      expireTime: string
      status: string
    }>
  }>('/member/coupon', params)

/* ============ 支付 / 订单 ============ */

export interface PayParams {
  orderNo: string
  payType: 'wechat' | 'balance' | 'alipay'
}
export const pay = (data: PayParams) => post<{ success: boolean; payUrl?: string }>('/pay', data)
export const getPayResult = (orderNo: string) =>
  get<{ status: 'pending' | 'paid' | 'failed'; amount: number }>('/pay/result', { orderNo })
export const getOrderDetail = (id: string | number) => get<Order>(`/order/${id}`)
export const refund = (data: { orderNo: string; reason: string }) => post('/order/refund', data)
export const getRefundList = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: Order[]; total: number }>('/order/refund/list', params)

/* ============ 分销 ============ */

export interface DistributionInfo {
  level: number
  totalCommission: number
  available: number
  withdrawn: number
  teamCount: number
}
export const getDistributionInfo = () => get<DistributionInfo>('/distribution/info')
export const getDistributionTeam = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{ id: string; nickname: string; avatar?: string; joinTime: string; level: number }>
    total: number
  }>('/distribution/team', params)
export const getCommissionRecords = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{ id: string; amount: number; type: string; time: string; nickname?: string }>
    total: number
  }>('/distribution/commission', params)
export const withdraw = (data: { amount: number; type: string }) =>
  post('/distribution/withdraw', data)
export const getDistributionRank = () =>
  get<{ list: Array<{ id: string; nickname: string; avatar?: string; commission: number }> }>(
    '/distribution/rank',
  )

/* ============ 用户中心扩展 ============ */

export const updateUserAvatar = (avatar: string) => put('/user/avatar', { avatar })
export const updateUserNickname = (nickname: string) => put('/user/nickname', { nickname })
export const bindPhone = (phone: string, code: string) => post('/user/phone/bind', { phone, code })
export const updatePassword = (oldPwd: string, newPwd: string) =>
  post('/user/password', { oldPwd, newPwd })
export const bindEmail = (email: string, code: string) => post('/user/email/bind', { email, code })
export const realNameAuth = (data: { realName: string; idCard: string }) =>
  post('/user/realname', data)
export const submitFeedback = (data: { content: string; contact?: string; images?: string[] }) =>
  post('/user/feedback', data)

/* ============ 内容 / 社区 ============ */

export interface News {
  id: string | number
  title: string
  coverUrl?: string
  summary?: string
  content?: string
  createTime: string
  views?: number
}
export const getNewsList = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  get<{ list: News[]; total: number }>('/content/news/list', params)
export const getNewsDetail = (id: string | number) => get<News>(`/content/news/${id}`)

export interface Circle {
  id: string | number
  title: string
  content: string
  images?: string[]
  author?: string
  avatar?: string
  createTime: string
  likes?: number
  comments?: number
}
export const getCircleList = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: Circle[]; total: number }>('/community/circle/list', params)
export const getCircleDetail = (id: string | number) => get<Circle>(`/community/circle/${id}`)
export const createCircle = (data: { title: string; content: string; images?: string[] }) =>
  post('/community/circle', data)

export interface Ask {
  id: string | number
  title: string
  content: string
  author?: string
  avatar?: string
  createTime: string
  answers?: number
  adopted?: boolean
}
export const getAskList = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  get<{ list: Ask[]; total: number }>('/community/ask/list', params)
export const getAskDetail = (id: string | number) => get<Ask>(`/community/ask/${id}`)
export const createAsk = (data: { title: string; content: string }) => post('/community/ask', data)

export const getTopicList = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{ id: string; name: string; count: number; coverUrl?: string }>
    total: number
  }>('/community/topic/list', params)
export const getTopicDetail = (id: string | number) =>
  get<{ id: string; name: string; posts: Circle[] }>(`/community/topic/${id}`)

/* ============ 教育扩展 ============ */

export interface StudyRecord {
  id: string
  courseId: string
  courseTitle: string
  progress: number
  duration: number
  time: string
}
export const getStudyInfo = () =>
  get<{ todayMinutes: number; totalMinutes: number; continuousDays: number; courses: number }>(
    '/study/info',
  )
export const getStudyRecords = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: StudyRecord[]; total: number }>('/study/records', params)
export const getStudyPlan = () =>
  get<{ list: Array<{ id: string; title: string; target: number; progress: number }> }>(
    '/study/plan',
  )
export const getStudyRank = () =>
  get<{ list: Array<{ id: string; nickname: string; avatar?: string; minutes: number }> }>(
    '/study/rank',
  )

export interface Exam {
  id: string | number
  title: string
  duration: number
  questions: number
  passScore: number
  startTime?: string
  endTime?: string
  status?: string
}
export const getExamList = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: Exam[]; total: number }>('/exam/list', params)
export const getExamDetail = (id: string | number) =>
  get<Exam & { questions: Array<{ id: string; title: string; options: string[] }> }>(`/exam/${id}`)
export const submitExam = (data: { examId: string; answers: Record<string, number> }) =>
  post<{ score: number; pass: boolean }>('/exam/submit', data)
export const getExamResult = (id: string | number) =>
  get<{ score: number; pass: boolean; rank?: number; total?: number }>(`/exam/${id}/result`)

/* ============ AI 模块 ============ */

export const getChatHistory = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{ id: string; title: string; time: string; messages: ChatMessage[] }>
    total: number
  }>('/ai/history', params)
export const generateImage = (data: { prompt: string; size?: string }) =>
  post<{ url: string }>('/ai/image', data)
export const voiceChat = (data: { audio: string }) =>
  post<{ reply: string; audio?: string }>('/ai/voice', data)
export const getAgentList = () =>
  get<{ list: Array<{ id: string; name: string; desc: string; avatar?: string; uses: number }> }>(
    '/ai/agent/list',
  )
export const getAgentDetail = (id: string | number) =>
  get<{
    id: string
    name: string
    desc: string
    avatar?: string
    prompt: string
    config?: Record<string, unknown>
  }>(`/ai/agent/${id}`)

/* ============ 直播扩展 ============ */

export const getLiveHistory = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: Live[]; total: number }>('/live/history', params)
export const getLiveCalendar = (params?: { month?: string }) =>
  get<{ list: Array<{ date: string; lives: Live[] }> }>('/live/calendar', params)
export const subscribeLive = (id: string | number) => post(`/live/${id}/subscribe`)

export interface Teacher {
  id: string | number
  name: string
  avatar?: string
  title?: string
  intro?: string
  courses?: number
  students?: number
}
export const getTeacherList = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  get<{ list: Teacher[]; total: number }>('/teacher/list', params)
export const getTeacherDetail = (id: string | number) => get<Teacher>(`/teacher/${id}`)

/* ============ 设置 / 其他 ============ */

export const getAbout = () =>
  get<{ name: string; version: string; intro: string; logo?: string }>('/about')
export const getHelp = () =>
  get<{ list: Array<{ id: string; title: string; content: string }> }>('/help')
export const getProtocol = () => get<{ content: string }>('/protocol')
export const getPrivacy = () => get<{ content: string }>('/privacy')
export const getContact = () =>
  get<{ phone: string; email: string; address: string; qq?: string }>('/contact')
export const getNotificationSettings = () =>
  get<{ list: Array<{ key: string; title: string; enabled: boolean }> }>('/settings/notification')
export const updateNotificationSettings = (data: Record<string, boolean>) =>
  put('/settings/notification', data)
export const clearCache = () => post('/settings/cache/clear')
export const clearCacheSize = () => get<{ size: string }>('/settings/cache/size')
export const setLanguage = (lang: string) => post('/settings/language', { lang })
export const setTheme = (theme: string) => post('/settings/theme', { theme })
