/**
 * API 接口定义 - 对接新架构后端 http://localhost:3000/api
 */
import { get, post, put, del } from '../utils/request'
import type { UserInfo } from '../utils/auth'
export type { UserInfo }
export { get, post } from '../utils/request'

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
  id: string
  title: string
  description?: string | null
  categoryId?: string | null
  paperType?: 'normal' | 'random' | 'mock' | 'exam'
  totalScore: string
  passScore: string
  duration: number
  isPublished?: boolean
  questionCount: number
  status?: number
  categoryName?: string | null
  createdAt?: string
}
export const getExamList = (params?: {
  page?: number
  pageSize?: number
  search?: string
  categoryId?: string
  paperType?: 'normal' | 'random' | 'mock' | 'exam'
}) => get<{ list: Exam[]; total: number }>('/exam/papers', params)
export type QuestionType =
  'single_choice' | 'multi_choice' | 'judgment' | 'fill_blank' | 'subjective'
export interface ExamPaper {
  id: string
  title: string
  description?: string | null
  categoryId?: string
  paperType?: 'normal' | 'random' | 'mock' | 'exam'
  totalScore?: string
  passScore?: string
  duration?: number
  isPublished?: boolean
  isRandom?: boolean
  status?: number
}
export interface ExamQuestion {
  id: string
  paperId: string
  type: QuestionType
  title: string
  options?: string[]
  score?: string
  sortOrder?: number
}
export const getExamPaper = (id: string) => get<{ paper: ExamPaper }>(`/exam/papers/${id}`)
export const getExamQuestions = (id: string) =>
  get<{ list: ExamQuestion[] }>(`/exam/papers/${id}/questions`)
export interface ExamRecord {
  id: string
  paperId: string
  score: string
  isPassed: boolean
  status: string
  startedAt: string
  submittedAt?: string | null
}
export const getExamRecords = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: ExamRecord[]; total: number }>('/exam/records', params)
export interface ExamSubmitResult {
  score: number
  isPassed: boolean
  duration: number
  answers: Array<{ questionId: string; answer: unknown; isCorrect: boolean; score: number }>
}
export const startExamRecord = (paperId: string) =>
  post<{ record: ExamRecord }>(`/exam/papers/${paperId}/start`)
export const submitExam = (data: {
  recordId: string
  answers: Array<{ questionId: string; answer: unknown }>
}) =>
  post<{ result: ExamSubmitResult }>(`/exam/records/${data.recordId}/submit`, {
    answers: data.answers,
  })
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

/* ============ 智能体市场 ============ */
// 注：getAgentList / getAgentDetail 已在上方 AI 模块定义，此处不再重复声明
export const getAgentCategories = () => get('/agents/categories')
export const collectAgent = (id: string) => post(`/agents/${id}/collect`)
export const likeAgent = (id: string) => post(`/agents/${id}/like`)
export const recordAgentUse = (id: string) => post(`/agents/${id}/use`)
export const getAgentUseHistory = () => get('/agents/use-history')
export const getAgentCollections = () => get('/agents/collections')

/* ============ 消息中心 ============ */
export const getMessageRooms = () => get('/messages/rooms')
export const getRoomHistory = (roomId: string, page = 1) =>
  get(`/messages/rooms/${roomId}/history`, { page })
export const markRoomRead = (roomId: string) => post(`/messages/rooms/${roomId}/read`)

/* ============ AIGC ============ */
export const getAigcList = (params?: unknown) => get('/aigc/list', params)
export const publishAigc = (data: unknown) => post('/aigc/publish', data)

/* ============ 模型广场 ============ */
export const getModelPlazaList = () => get('/models/plaza')

/* ============ 排行榜 ============ */
export const getRankingList = (type?: string) => get('/ranking', { type })

/* ============ Token 智汇值 ============ */
export const getTokenBalance = () => get('/token/balance')
export const getTokenRecords = (page = 1) => get('/token/records', { page })

/* ============ 开发者 ============ */
export const getDeveloperAgents = () => get('/developer/agents')
export const getDeveloperIncome = () => get('/developer/income')
export const getDeveloperWithdrawalList = () => get('/developer/withdrawals')

/* ============ N8N 工作流 ============ */
export const getN8nWorkflows = () => get('/workflows/n8n')
export const createN8nAgent = (data: unknown) => post('/workflows/n8n/create', data)

/* ============ 名片 ============ */
export const getBusinessCard = () => get('/user/business-card')
export const updateBusinessCard = (data: unknown) => put('/user/business-card', data)

/* ============ 知识星球 ============ */
export const getKnowledgePlanetInfo = () => get('/knowledge-planet/info')
export const getKnowledgePlanetNews = (page = 1) => get('/knowledge-planet/news', { page })

/* ============ 课程星球 ============ */
export const getCoursePlanet = () => get('/course-planet')

/* ============ 多登录方式 ============ */
export const loginByAlipay = (code: string) => post('/auth/alipay/login', { code })
export const loginByGoogle = (code: string) => post('/auth/google/login', { code })
export const register = (data: unknown) => post('/auth/register', data)
export const changePassword = (data: unknown) => put('/auth/password', data)
export const accountCancel = () => del('/auth/account')

/* ============ 学习扩展 ============ */
export const getStudyGroups = () => get('/study/groups')
export const getStudyGroupDetail = (id: string) => get(`/study/groups/${id}`)
export const getVideoDetail = (id: string) => get(`/study/videos/${id}`)
export const getStudyRanking = () => get('/study/ranking')

/* ============ 分销扩展 ============ */
export const getSubordinates = () => get('/distribution/subordinates')
export const getInviteeOrders = () => get('/distribution/invitee-orders')

/* ============ 设置扩展 ============ */
export const getSettings = () => get('/settings')
export const getPrivacyPolicy = () => get('/settings/privacy')
export const getUserAgreement = () => get('/settings/agreement')

/* ============ 智能体对话上下文 ============ */
type ApiParams = Record<string, unknown>

/** 获取智能体 token */
export const getAgentTokens = (params: ApiParams) => get('/agent/tokens', params)
/** 保存对话上下文 */
export const postContext = (data: unknown) => post('/agent/context', data)
/** 获取用户对话上下文 */
export const getUserContext = (params: ApiParams) => get('/agent/context', params)
/** 保存聊天记录 */
export const saveChatHistory = (data: unknown) => post('/chat/history', data)
/** 删除聊天记录 */
export const removeChatHistory = (id: string) => del(`/chat/history/${id}`)
/** 查询智能体上下文 */
export const queryAgentContext = (params: ApiParams) => get('/agent/context/query', params)
/** 创建模型对话 */
export const createModelChat = (data: unknown) => post('/model/chat', data)
/** 删除模型对话 */
export const removeModelChat = (id: string) => del(`/model/chat/${id}`)

/* ============ AIGC 多媒体生成 ============ */
/** 通义万相 - 图片生成 */
export const generateImageDashscope = (data: unknown) => post('/dashscope/image/generate', data)
/** 通义万相 - 图片编辑 */
export const editImageDashscope = (data: unknown) => post('/dashscope/image/edit', data)
/** 通义万相 - 视频生成 */
export const generateVideoDashscope = (data: unknown) => post('/dashscope/video/generate', data)
/** 腾讯混元3D - 提交生成 */
export const generate3dTencent = (data: unknown) => post('/tencent/hunyuan3d/submit', data)
/** 腾讯混元3D - 查询结果 */
export const query3dTencent = (taskId: string) => get(`/tencent/hunyuan3d/query?taskId=${taskId}`)
/** 豆包 - 图片生成 */
export const generateImageDoubao = (data: unknown) => post('/doubao/image', data)
/** 豆包 - 图片编辑 */
export const editImageDoubao = (data: unknown) => post('/doubao/image/edit', data)
/** 豆包 - 视频生成 */
export const generateVideoDoubao = (data: unknown) => post('/doubao/video', data)
/** 即梦 - 图片生成 */
export const generateImageJimeng = (data: unknown) => post('/volcengine/jimeng/image', data)
/** 火山引擎 - 图片生成 */
export const generateImageVolcengine = (data: unknown) => post('/volcengine/visual/generate', data)
/** 可灵 - 视频生成 */
export const generateVideoKling = (data: unknown) => post('/kling/video/generate', data)
/** 可灵 - 图片生成 */
export const generateImageKling = (data: unknown) => post('/kling/image/generate', data)

/* ============ 课程 / 视频内容管理 ============ */
/** 课程分组详情 */
export const getGroupDetail = (id: string) => get(`/learn/group/${id}`)
/** 新增课程分组 */
export const addGroup = (data: unknown) => post('/learn/group', data)
/** 更新课程 */
export const coursePut = (id: string, data: unknown) => put(`/learn/course/${id}`, data)
/** 删除课程 */
export const courseDelete = (id: string) => del(`/learn/course/${id}`)
/** 新增视频 */
export const addVideo = (data: unknown) => post('/learn/video', data)
/** 更新视频 */
export const videoPut = (id: string, data: unknown) => put(`/learn/video/${id}`, data)
/** 删除视频 */
export const videoDelete = (id: string) => del(`/learn/video/${id}`)
/** 发布课程 */
export const issueCourse = (id: string) => post(`/learn/course/${id}/issue`)
/** 下架课程 */
export const delistCourse = (id: string) => post(`/learn/course/${id}/delist`)
/** 视频评论列表 */
export const getVideoCommentList = (params: ApiParams) => get('/learn/video/comments', params)
/** 新增视频评论 */
export const addVideoComment = (data: unknown) => post('/learn/video/comment', data)
/** 视频日志操作 */
export const videoLogOperate = (data: unknown) => post('/learn/video/log', data)

/* ============ 分销高级功能 ============ */
/** 获取微信二维码 */
export const getWxCode = (params: ApiParams) => get('/distribution/wx-code', params)
/** 分销流量列表 */
export const getFlowList = (params: ApiParams) => get('/distribution/flow', params)
/** 分销流量订单列表 */
export const getFlowOrderList = (params: ApiParams) => get('/distribution/flow/orders', params)
/** 提现状态查询 */
export const getWithdrawalStatus = (id: string) => get(`/distribution/withdrawal/${id}/status`)

/* ============ 分享功能 ============ */
/** 智能体创建分享 */
export const agentCreationShare = (data: unknown) => post('/agent/creation/share', data)
/** 第三方分享 */
export const agentCreationShareThird = (data: unknown) => post('/agent/creation/share/third', data)
/** 首次分享状态查询 */
export const checkFirstShareStatus = () => get('/agent/creation/share/first-status')
/** 首次分享 */
export const firstShare = (data: unknown) => post('/agent/creation/share/first', data)
/** 根据分享码获取内容 */
export const getShareContentByCode = (code: string) => get(`/agent/creation/share/third/${code}`)

/* ============ 其他扩展 API ============ */
/** 绑定用户 */
export const bindUser = (data: unknown) => post('/auth/bind-user', data)
/** 绑定用户（新版） */
export const bindUserNew = (data: unknown) => post('/auth/bind-user-new', data)
/** 获取手机号（微信授权） */
export const getPhoneNumber = (data: unknown) => post('/auth/phone-number', data)
/** 查询是否已设置密码 */
export const pwdExist = (phone: string) => get(`/auth/pwd-exist?phone=${phone}`)
/** 修改手机号 */
export const editPhone = (data: unknown) => put('/auth/phone', data)
/** 关闭订单 */
export const closeOrder = (orderId: string) => post(`/order/${orderId}/close`)
/** 批量关闭订单 */
export const closeOrders = (orderIds: string[]) => post('/order/batch-close', { orderIds })
/** 支付宝新支付 */
export const zfbNewPay = (data: unknown) => post('/pay/zfb-new', data)
/** Token 智汇值总数 */
export const getTokenCount = () => get('/token/count')
/** Token 智汇值返还 */
export const getTokenReturn = () => get('/token/return')
/** N8N 智能体处理 */
export const processN8nAgent = (data: unknown) => post('/n8n/agent/process', data)
/** Base64 上传文件 */
export const uploadByBase64 = (data: unknown) => post('/files/upload/base64', data)
/** 添加水印 */
export const addWatermark = (data: unknown) => post('/files/watermark', data)
/** 资讯分类 */
export const getInformationCategory = () => get('/news/categories')
/** 每日资讯 */
export const getDailyNews = (params: ApiParams) => get('/news/daily', params)
/** 商品选择列表 */
export const selectGoods = (params: ApiParams) => get('/goods/select', params)
/** 支付活动 */
export const getActivity = () => get('/pay/activity')
/** 商品详情 */
export const getProduct = (id: string) => get(`/goods/${id}`)

/* ============ 智能体收费配置 ============ */
/** 根据智能体 ID 获取收费配置 */
export const getChargeInfoById = (agentId: string | number) => get(`/agents/charge/${agentId}`)
/** 创建付费记录 */
export const createPayHistory = (data: unknown) => post('/agents/charge/pay-history', data)
/** 创建智能体收费配置 */
export const createZntCharge = (data: unknown) => post('/agents/charge', data)
/** 修改智能体收费配置 */
export const putZntCharge = (data: unknown) => put('/agents/charge', data)
/** 删除智能体收费配置 */
export const deleteZntCharge = (id: string | number) => del(`/agents/charge/${id}`)
/** 获取智能体审核记录列表 */
export const getZntList = (params: ApiParams) => get('/agents/charge/list', params)

/* ============ 开发者收入明细 ============ */
/** 收入详情 */
export const getBuyInfo = (params: ApiParams) => get('/developer/income/detail', params)
/** 收入列表 */
export const getBuyList = (params: ApiParams) => get('/developer/income/list', params)
/** 明细列表 */
export const getMxList = (params: ApiParams) => get('/developer/income/mx', params)

/* ============ 广场发布管理 ============ */
/** 发布广场列表 */
export const getPlazaList = (params: ApiParams) => get('/plaza/list', params)
/** 发布广场模型 */
export const addPlazaModel = (data: unknown) => post('/plaza/add', data)
/** 发布广场详情 */
export const getPlazaInfoById = (id: string | number) => get(`/plaza/${id}`)

/* ============ 视频分片上传 ============ */
/** 分片上传 */
export const uploadChunkedFile = (data: unknown) => post('/upload/chunked', data)
/** 分片上传（PC） */
export const uploadChunkedFilePC = (data: unknown) => post('/upload/chunked-pc', data)
/** 获取分片视频完整地址 */
export const uploadChunkedFileJoint = (data: unknown) => post('/upload/chunked-joint', data)

/* ============ 操盘手数据统计 ============ */
/** 获取操盘手个人信息卡数据 */
export const getOperatorDataCardData = (params: ApiParams) => get('/operator/data-card', params)
/** 获取用户邀请人订单统计 */
export const getUserInviteeOrderStats = (params: ApiParams) =>
  get('/operator/invitee-order-stats', params)
/** 获取用户佣金明细 */
export const getUserCommissionDetail = (params: ApiParams) =>
  get('/operator/commission-detail', params)

/* ============ AI 模型扩展 ============ */
/** 获取我的创作内容 */
export const getMyCreation = (params: ApiParams) => get('/ai/my-creation', params)
/** 获取 AI 团队智能体类型 */
export const getAgentType = () => get('/agents/types')
/** 获取分类字典 */
export const categoryDictionary = () => get('/category/dictionary')
/** 智能体移除（购买） */
export const aiRemoveAgent = (data: unknown) => post('/agents/remove', data)
/** 获取模型列表（统一接口） */
export const getCozeApiList = (params?: ApiParams) => get('/coze/api-list', params)
/** 搜索模型工作流运行 */
export const searchModelWorkflowRun = (params: ApiParams) =>
  get('/model/workflow-run/search', params)

/** 按 URL 代理 POST 请求 */
export const postByUrl = (url: string, data: unknown) => post('/proxy/post-by-url', { url, data })

/* ============ 音频 / Sora ============ */
/** 阿里生成音色 */
export const aliGenerateTimbre = (data: unknown) => post('/audio/generate-timbre', data)
/** Sora 请求结束 */
export const soraRequestEnd = (data: unknown) => post('/sora/request-end', data)
/** 音频会话开始（会话级管理） */
export const audioStart = (data: unknown) => post('/audio/start', data)

/* ============ 智能体列表变体 ============ */
/** 获取智能体列表（base1） */
export const getAgentListBase1 = (params: ApiParams) => get('/agents/base1-list', params)
/** 获取智能体列表（全部） */
export const getAgentListAll = (params: ApiParams) => get('/agents/all-list', params)
/** 获取智能体信息 */
export const getAgentInfo = (params: ApiParams) => get('/agents/info', params)

/* ============ 智汇值消耗记录 ============ */
/** 获取智汇值消耗记录 */
export const getZHZ = (params: ApiParams) => get('/agents/zhz', params)
/** 获取智汇值消耗详情 */
export const getZHZDMX = (params: ApiParams) => get('/agents/zhz-detail', params)

/* ============ 登录变体 ============ */
/** 微信 openid 获取 */
export const openId = (code: string) => get('/auth/openid', { code })
/** 充值 */
export const recharge = (params: ApiParams) => get('/member/recharge', params)
/** 发送短信验证码（新版） */
export const sendTextMsg_new = (phone: string) => post('/sms/send-new', { phone })
/** 发送短信验证码（修改版） */
export const sendTextMsg_edit = (phone: string) => post('/sms/send-edit', { phone })

/* ============ 学习 / 视频管理扩展 ============ */
/** 根据子赛道 id 获取主赛道 */
export const parentquery = (params: ApiParams) => get('/study/parent-query', params)
/** 视频日志查询 */
export const userVideoLog = (params: ApiParams) => get('/study/video-log', params)
/** 获取智能体列表（学习用） */
export const getAgentsAlllist = (params: ApiParams) => get('/agents/all-list-study', params)
/** 视频列表 */
export const getVideoList = (params: ApiParams) => get('/study/video-list', params)
/** 视频预加载 */
export const videoPreload = (params: ApiParams) => get('/study/video-preload', params)
/** 用户反馈列表 */
export const userFeedbackList = (params: ApiParams) => get('/user/feedback-list', params)

/* ============ 名片变体 ============ */
/** 上传名片（变体 a） */
export const uploadBusinessCarda = (data: unknown) => post('/business-card/upload-a', data)
/** Base64 上传（变体 a） */
export const uploadBybase64a = (data: unknown) => post('/upload/base64-a', data)

/* ============ 其他 ============ */
/** 排行榜分组列表 */
export const getGroupList = (params: ApiParams) => get('/rankings/group-list', params)
/** 更新标记 */
export const updateMark = (data: unknown) => put('/user/update-mark', data)
