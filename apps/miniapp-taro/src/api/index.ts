/**
 * API 接口定义 - 对接新架构后端 http://localhost:8801/api
 */
import Taro from '@tarojs/taro'
import { get, post, put, patch, del, BASE_URL } from '../utils/request'
import { getToken, type UserInfo, type LoginResult } from '../utils/auth'
import { parseSSEChunk, type SSEEvent } from '../utils/sse-parse'
export type { UserInfo }
export { get, post } from '../utils/request'

/* ============ 认证相关 ============ */

/** 发送短信验证码 */
export const sendSmsCode = (phone: string) => post('/auth/sms/send', { phone, scene: 'login' })

/** 手机号验证码登录 — 返回与 @ihui/api-client LoginResult 对齐 */
export const loginBySms = (phone: string, code: string) =>
  post<LoginResult>('/auth/login/sms', { phone, code })

/** 手机号密码登录 — 返回与 @ihui/api-client LoginResult 对齐 */
export const loginByPassword = (phone: string, password: string) =>
  post<LoginResult>('/auth/login/password', { phone, password })

/** 微信登录 — 返回与 @ihui/api-client LoginResult 对齐 */
export const loginByWechat = (code: string) => post<LoginResult>('/auth/login/wechat', { code })

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
  /** 运营位位置:home / discover / activity */
  position?: string
  /** 跳转类型:webview / page / none */
  linkType?: 'webview' | 'page' | 'none'
  /** 排序权重,数值越大越靠前 */
  sortOrder?: number
  /** 生效时间(ISO 字符串) */
  startTime?: string
  /** 失效时间(ISO 字符串) */
  endTime?: string
  /** 状态:0 草稿 / 1 已发布 / 2 已下线 */
  status?: number
}

/** 首页资源(轮播、工具栏等) */
export const getHomePage = () => get<{ banner: Banner[] }>('/content/home')

/**
 * 运营 banner 列表(独立接口,支持按位置筛选)。
 * 对接后端 GET /content/banner/list?position=home&status=1
 * 返回结构: { list: Banner[], total: number }
 */
export const getBannerList = (params?: { position?: string; status?: number }) =>
  get<{ list: Banner[]; total: number }>('/content/banner/list', params)

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
  reasoning?: string
  /** 图片 URL 列表(对标原 ai_assistant.vue imgUrlList) */
  images?: string[]
  /** 视频 URL 列表(对标原 ai_assistant.vue videoUrlList) */
  videos?: string[]
  /** token 消耗(对标原 ai_assistant.vue total_tokens) */
  tokenCount?: number
  /** 代码块内容(对标原 ai_assistant.vue content_code) */
  codeContent?: string
}

export interface ChatOptions {
  /** 模型 ID(优先使用,与 AI-service LLMCompleteRequest 对齐) */
  model?: string
  /** 向后兼容 alias,优先级低于 model */
  modelId?: string
  agentId?: string
  materialContent?: string
  /** 模型上下文窗口大小(tokens),达 88% 阈值自动压缩(跨端统一)。
   * 由调用方调 getModelContextCapacity(model) 取得,后端不传则不压缩。 */
  contextLimit?: number
}

export interface ChatResult {
  reply: string
  sessionId: string
  reasoning?: string
}

/** AI 对话（流式可由后端 SSE 处理，此处提供普通接口） */
export const chat = (messages: ChatMessage[], sessionId?: string, options?: ChatOptions) =>
  post<ChatResult>('/ai/chat', {
    messages,
    sessionId,
    model: options?.model ?? options?.modelId,
    agentId: options?.agentId,
    materialContent: options?.materialContent,
  })

/** AI 对话 SSE 流式（小程序端 enableChunked / H5 端 fetch ReadableStream 自动降级） */
export const chatStream = (
  messages: ChatMessage[],
  sessionId: string,
  options: ChatOptions,
  onChunk: (delta: string) => void,
  onReasoning?: (delta: string) => void,
  onMeta?: (meta: { sessionId?: string }) => void,
  signal?: AbortSignal,
  onCompaction?: (info: {
    tokensBefore: number
    tokensAfter: number
    removedCount: number
    usageRatio: number
  }) => void,
  /** 流结束回调(对标原 ai_assistant.vue total_tokens 显示):ai-service event:done 下发 usage */
  onDone?: (info: { totalTokens?: number; promptTokens?: number; completionTokens?: number; model?: string }) => void,
): Promise<void> => {
  let errored = false
  const resolvedModel = options.model ?? options.modelId
  const dispatch = (evt: SSEEvent) => {
    if (errored) return
    if (evt.type === 'chunk' && evt.content) onChunk(evt.content)
    else if (evt.type === 'reasoning' && evt.content) onReasoning?.(evt.content)
    else if (evt.type === 'meta' && evt.sessionId) onMeta?.({ sessionId: evt.sessionId })
    else if (evt.type === 'compaction' && evt.compaction) onCompaction?.(evt.compaction)
    else if (evt.type === 'done') {
      onDone?.({
        totalTokens: evt.usage?.totalTokens,
        promptTokens: evt.usage?.promptTokens,
        completionTokens: evt.usage?.completionTokens,
        model: evt.model,
      })
    }
    else if (evt.type === 'error' && evt.content) {
      errored = true
      const err = new Error(evt.content) as Error & {
        code?: number
        errorCode?: string
        retryAfter?: number
      }
      err.name = 'SSEError'
      if (typeof evt.code === 'number') err.code = evt.code
      if (typeof evt.errorCode === 'string') err.errorCode = evt.errorCode
      if (typeof evt.retryAfter === 'number') err.retryAfter = evt.retryAfter
      throw err
    }
  }

  // H5 端: Taro.request 不支持 enableChunked,改用原生 fetch + ReadableStream
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
    return (async () => {
      const token = getToken()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      const res = await fetch(BASE_URL + '/ai/chat/stream', {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          sessionId,
          model: resolvedModel,
          agentId: options.agentId,
          materialContent: options.materialContent,
          contextLimit: options.contextLimit ?? 0,
        }),
        signal,
      })
      if (!res.ok || !res.body) throw new Error(`请求失败(${res.status})`)
      const reader = res.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            const { events } = parseSSEChunk(buffer + '\n')
            for (const evt of events) dispatch(evt)
          }
          return
        }
        buffer += decoder.decode(value, { stream: true })
        const { events, remainder } = parseSSEChunk(buffer)
        buffer = remainder
        for (const evt of events) {
          dispatch(evt)
          if (errored) return
        }
      }
    })()
  }

  // 小程序端: Taro.request + enableChunked 逐 chunk 接收
  return new Promise<void>((resolve, reject) => {
    const token = getToken()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    const task = Taro.request({
      url: BASE_URL + '/ai/chat/stream',
      method: 'POST',
      data: {
        messages,
        sessionId,
        model: resolvedModel,
        agentId: options.agentId,
        materialContent: options.materialContent,
        contextLimit: options.contextLimit ?? 0,
      },
      enableChunked: true,
      responseType: 'text',
      header: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      success: (res) => {
        if (errored) return
        if (buffer.trim()) {
          const { events } = parseSSEChunk(buffer + '\n')
          for (const evt of events) {
            try {
              dispatch(evt)
            } catch (e) {
              reject(e)
              return
            }
          }
        }
        if (res.statusCode >= 400) {
          const err = new Error(`请求失败(${res.statusCode})`) as Error & { code: number }
          err.name = 'SSEError'
          err.code = res.statusCode
          reject(err)
        } else resolve()
      },
      fail: (err) => reject(new Error(err.errMsg || '请求失败')),
    })

    task.onChunkReceived(({ data }) => {
      if (errored) return
      buffer += decoder.decode(data, { stream: true })
      const { events, remainder } = parseSSEChunk(buffer)
      buffer = remainder
      for (const evt of events) {
        try {
          dispatch(evt)
          if (errored) return
        } catch (e) {
          reject(e)
          return
        }
      }
    })

    if (signal) signal.addEventListener('abort', () => task.abort(), { once: true })
  })
}

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

export interface VipLevel {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  benefits?: Record<string, unknown> | null
  status: number
  sortOrder: number
}

export const getVipInfo = () => get<VipInfo>('/vip/info')
export const getVipLevels = () => get<{ items: VipLevel[] }>('/vip/levels')
export const getVipPrivilege = () =>
  get<{ list: Array<{ id: string; title: string; desc: string }> }>('/vip/privilege')
export interface VipPayInfo {
  mock: boolean
  method: 'jsapi' | 'native' | 'h5'
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
  codeUrl?: string
  h5Url?: string
  error?: string
}
export interface VipOrderResult {
  orderId: string
  orderNo: string
  amount: number
  vipLevelId: string
  quantity: number
  payInfo: VipPayInfo
}
export const upgradeVip = (vipLevelId: string) =>
  post<VipOrderResult>('/vip/order', { vipLevelId, quantity: 1 })
export const getVipOrderPayInfo = (orderNo: string) =>
  get<{ status: string; payInfo?: VipPayInfo }>(`/vip/order/${orderNo}/payinfo`)

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

export const getPayResult = async (orderNo: string) => {
  const res = await get<{ order: { status: string; amount: number } }>(`/payment/orders/${orderNo}`)
  const raw = res.order.status
  const status: 'pending' | 'paid' | 'failed' =
    raw === 'paid' ? 'paid' : raw === 'pending' ? 'pending' : 'failed'
  return { status, amount: res.order.amount }
}
export const getOrderDetail = (id: string | number) => get<Order>(`/order/${id}`)
export const refund = (data: { orderNo: string; reason: string }) => post('/order/refund', data)
export const getRefundList = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: Order[]; total: number }>('/order/refund/list', params)

/** 创建充值订单（对接 payments/wechat|alipay/create） */
export interface RechargeCreateResult {
  outTradeNo: string
  mock?: boolean
  payParams?: Record<string, unknown>
}
export const createRecharge = (amount: number, payMethod: 'wechat' | 'alipay' = 'wechat') =>
  post<RechargeCreateResult>(`/payments/${payMethod}/create?amount=${amount}`, {})

/** 钱包余额（对接 /wallet/balance） */
export interface WalletBalance {
  balance: number
  frozenBalance: number
  totalRecharge: number
  totalWithdraw: number
}
export const getWalletBalance = () => get<WalletBalance>('/wallet/balance')

/* ============ 分销 ============ */

export interface DistributionInfo {
  level: number
  totalCommission: number
  available: number
  withdrawn: number
  teamCount: number
}
export const getDistributionInfo = () =>
  get<{
    totalCommission: number
    pendingCommission: number
    withdrawnCommission: number
    inviteCode: string | null
  }>('/distribution/overview').then((res) => ({
    level: 0,
    totalCommission: res.totalCommission,
    available: res.pendingCommission,
    withdrawn: res.withdrawnCommission,
    teamCount: 0,
    inviteCode: res.inviteCode,
  })) as Promise<DistributionInfo & { inviteCode: string | null }>
export const getDistributionTeam = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{
      id: string
      username: string
      nickname: string | null
      avatar: string | null
      createdAt: string
    }>
    total: number
  }>('/distribution/invited-users', params)
export const getWithdrawalRecords = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{
      id: string
      amount: number
      originalAmount: number
      fee: number
      status: number
      method: string
      rejectReason: string | null
      processedAt: string | null
      createdAt: string
    }>
    total: number
  }>('/distribution/withdrawals', params)
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
  get<{ list: Circle[]; total: number }>('/circles', params)
export const getCircleDetail = (id: string | number) => get<Circle>(`/circles/${id}`)
export const createCircle = (data: { title: string; content: string; images?: string[] }) =>
  post('/circles', data)

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
  get<{ list: Ask[]; total: number }>('/asks', params)
export const getAskDetail = (id: string | number) => get<Ask>(`/asks/${id}`)
export const createAsk = (data: { title: string; content: string }) => post('/asks', data)

/* Ask 模块扩展（M-64 + D7/D8 端点） */
export const getAskCategories = () =>
  get<{ list: Array<{ id: string; name: string }> }>('/asks/categories')
export const likeAsk = (id: string | number) =>
  post<{ id: string; liked: boolean }>(`/asks/${id}/like`)
export const favoriteAsk = (id: string | number) =>
  post<{ id: string; favorited: boolean }>(`/asks/${id}/favorite`)
export const getAskComments = (id: string | number) =>
  get<{
    list: Array<{ id: string; content: string; userId: string; createdAt: string }>
    total: number
  }>(`/asks/${id}/comments`)
export const createAskComment = (id: string | number, data: { content: string; pid?: string }) =>
  post(`/asks/${id}/comments`, data)
export const updateAskAnswer = (id: string, data: { content: string }) =>
  patch(`/asks/answers/${id}`, data)
export const deleteAskAnswer = (id: string) => del(`/asks/answers/${id}`)
export const getAskMemberQuestionCount = (userId: string) =>
  get<{ count: number }>('/ask/member/question-count', { userId })
export const getAskMemberAnswerCount = (userId: string) =>
  get<{ count: number }>('/ask/member/answer-count', { userId })
export const getAskMemberQuestions = (params: {
  userId: string
  page?: number
  pageSize?: number
}) => get<{ list: Ask[]; page: number; pageSize: number }>('/ask/member/questions', params)
export const getAskMemberAnswers = (params: { userId: string; page?: number; pageSize?: number }) =>
  get<{
    list: Array<{ id: string; content: string; askId: string; createdAt: string }>
    page: number
    pageSize: number
  }>('/ask/member/answers', params)

export const getTopicList = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{ id: string; name: string; count: number; coverUrl?: string }>
    total: number
  }>('/circles/topic/list', params)
export const getTopicDetail = (id: string | number) =>
  get<{ id: string; name: string; posts: Circle[] }>(`/circles/topic/${id}`)

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

/* Exam 模块扩展（D1/D2 端点） */
export const getExamSignups = (params?: {
  examId?: string
  userId?: string
  page?: number
  pageSize?: number
}) =>
  get<{
    list: Array<{ id: string; paperId: string; userId: string }>
    total: number
    page: number
    pageSize: number
  }>('/exam/signups', params)
export const createExamSignup = (data: { examId: string; userId: string }) =>
  post<{ id: string; paperId: string; userId: string }>('/exam/signups', data)
export const getExamSignup = (id: string) =>
  get<{ id: string; paperId: string; userId: string }>(`/exam/signups/${id}`)
export const cancelExamSignup = (id: string) => del<{ deleted: boolean }>(`/exam/signups/${id}`)
export const checkExamSignup = (params: { examId: string; userId: string }) =>
  get<{ signed: boolean; signup: { id: string } | null }>('/exam/signups/check', params)
export const getExamRecommend = () => get<{ list: Exam[] }>('/exam/recommend')
export const getExamHot = () => get<{ list: Exam[] }>('/exam/hot')
export const getExamFavorites = (userId: string) =>
  get<{ list: Exam[] }>('/exam/favorites', { userId })
export const deleteExamWrongQuestion = (id: string) =>
  del<{ deleted: boolean }>(`/exam/wrong-questions/${id}`)

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
/** 后端 agents 表原始字段(用于内部映射,不对外暴露) */
interface AgentRawRow {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  usageCount: number
  isVipExclusive: boolean | null
  agentPrompt: string | null
  /** 智能体开场白(对标原 ai_assistant.vue prologue,引导说明内容) */
  prologue?: string | null
}

/**
 * 获取智能体列表(对接后端 GET /api/agents/list)。
 * 后端返回 { list: Agent[], total, page, pageSize },此处映射为前端 AgentInfo 兼容结构。
 */
export const getAgentList = () =>
  get<{ list: AgentRawRow[]; total: number; page: number; pageSize: number }>('/agents/list').then(
    (res) => ({
      list: (res.list || []).map((a) => ({
        id: String(a.agentId),
        name: a.name,
        desc: a.description ?? '',
        avatar: a.avatar ?? undefined,
        uses: a.usageCount,
        isVipExclusive: a.isVipExclusive ?? false,
      })),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
    }),
  )

/**
 * 获取智能体详情(对接后端 GET /api/agents/:agentId)。
 * 后端返回 agent 完整行(含 agentId/description/agentPrompt/isVipExclusive 等驼峰字段),
 * 此处映射为前端 AgentDetail 兼容结构(id/desc/prompt)。
 */
export const getAgentDetail = (id: string | number) =>
  get<AgentRawRow>(`/agents/${id}`).then((a) => ({
    id: String(a.agentId),
    name: a.name,
    desc: a.description ?? '',
    avatar: a.avatar ?? undefined,
    prompt: a.agentPrompt ?? '',
    prologue: a.prologue ?? '',
    config: undefined,
    isVipExclusive: a.isVipExclusive ?? false,
  }))

/** Agent 权限类型 — 与后端 AgentPermission.type 对齐 */
export type AgentPermissionType = 'free' | 'vip' | 'purchased' | 'vip_only'

/** Agent 权限结果 — 与 @ihui/api-client AgentPermission 对齐 */
export interface AgentPermission {
  hasPermission: boolean
  type: AgentPermissionType
  reason?: string
}

/** 获取指定 Agent 的访问权限(对接后端 GET /api/agent-ext/:id/permission) */
export const getAgentPermission = (id: string | number) =>
  get<AgentPermission>(`/agent-ext/${id}/permission`)

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
export interface AggregateMessages {
  announcements: Array<{
    id: string
    title: string
    content: string | null
    isPublished: boolean
    status: number
    createdAt: string
  }>
  privateMessages: Array<{
    id: number
    senderId: string
    receiverId: string
    content: string
    isRead: boolean
    readTime: string | null
    createdAt: string
  }>
  systemNotices: Array<{
    id: string
    title: string
    content: string | null
    type: string | null
    createdAt: string
  }>
  unreadCount: {
    total: number
    announcements: number
    private: number
    system: number
  }
}
export const getMessageRooms = () => get<AggregateMessages>('/messages/aggregate')
export const getSystemNotices = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{
      id: string
      title: string
      content: string | null
      type: string | null
      createdAt: string
    }>
    page: number
    pageSize: number
  }>('/messages/system-notice/list', params)
export const getPrivateMessages = (params?: { page?: number; pageSize?: number }) =>
  get<{
    list: Array<{
      id: number
      senderId: string
      receiverId: string
      content: string
      isRead: boolean
      readTime: string | null
      createdAt: string
    }>
    page: number
    pageSize: number
  }>('/messages/private/list', params)
export const getRoomHistory = (roomId: string, page = 1) =>
  get(`/messages/rooms/${roomId}/history`, { page })
export const markRoomRead = (roomId: string) => post(`/messages/rooms/${roomId}/read`)

/* ============ 通知偏好 ============ */
export interface NotificationPreferences {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  inAppEnabled: boolean
  types: string[]
}
export const getNotificationPreferences = () =>
  get<NotificationPreferences>('/notifications/preferences')
export const updateNotificationPreferences = (data: Partial<NotificationPreferences>) =>
  put('/notifications/preferences', data)

/* ============ AIGC ============ */
export const getAigcList = (params?: { page?: number; pageSize?: number }) =>
  get<{ list: unknown[]; total: number; page: number; pageSize: number }>(
    '/content/aigc/list',
    params,
  )
export const publishAigc = (data: unknown) => post('/aigc/publish', data)

/* ============ 模型广场 ============ */
export const getModelPlazaList = () => get('/models/plaza')

/** LLM 模型信息(与 Web 端 @ihui/api-client LlmModel 对齐) */
export interface LlmModel {
  id: string
  name: string
  provider: string
  context_length: number
  input_price: number
}

/** fetchModels 返回结构(与 Web 端 @ihui/api-client FetchModelsResult 对齐) */
export interface FetchModelsResult {
  models: LlmModel[]
  default: string
  stub_mode: boolean
}

/**
 * 获取可用模型列表 — GET /llm/models (代理到 AI-service)
 * 与 Web 端 @ihui/api-client fetchModels 对齐
 */
export const fetchModels = () => get<FetchModelsResult>('/llm/models')

/* ============ 排行榜 ============ */
export const getRankingList = (type?: string) => get('/ranking', { type })

/* ============ Token 智汇值 ============ */
export const getTokenBalance = () => get('/token/balance')
export const getTokenRecords = (page = 1) => get('/token/records', { page })

/* ============ 开发者 ============ */
export const getDeveloperAgents = () => get('/developer/agents')
export const getDeveloperIncome = () => get('/developer/income')
export const getDeveloperWithdrawalList = () => get('/developer/withdrawals')

export interface DeveloperPricing {
  id: string
  name: string
  price: string
  period: string | null
  features: string[]
  status: number
  sort: number
  createdAt: string
}
export interface DeveloperSubscription {
  id: string
  userId: string
  pricingId: string | null
  period: string | null
  startTime: string
  endTime: string
  status: number
  autoRenew: number
  orderId: string | null
}
export const getDeveloperPricingList = () => get<{ list: DeveloperPricing[] }>('/developer/price')
export const subscribeDeveloper = (data: {
  pricingId: string
  period?: 'monthly' | 'yearly'
  paymentMethod?: string
}) =>
  post<{ orderId: string; orderNo: string; amount: number; pricingId: string; period: string }>(
    '/developer/subscribe',
    data,
  )
export const getMyDeveloperSubscription = () =>
  get<{ subscription: DeveloperSubscription | null }>('/developer/subscription')

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
/** 获取用户对话上下文某个字段 */
export const getUserContextField = (field: string) =>
  get<{ field: string; value: unknown }>(`/agent/context/${encodeURIComponent(field)}`)
/** 删除用户对话上下文某个字段 */
export const removeContextField = (field: string) =>
  del<{ success: boolean; deleted: number }>(`/agent/context/${encodeURIComponent(field)}`)
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

/* ============ 语音转文字 ============ */
/** 语音转文字（调用 DashScope Paraformer / qwen3-asr） */
export const fetchAudioText = (audioUrl: string) =>
  post<{ text: string }>('/ai/audio/recognize', { audio_url: audioUrl })

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

/* ============ 连续包月/自动续费 ============= */
export interface WechatPayContract {
  id: string
  contractId: string
  planId?: string
  productId?: string
  status: 'pending' | 'active' | 'cancelled' | 'expired'
  wechatPlanId?: string
  nextChargeTime?: string
  lastChargeTime?: string
  lastChargeStatus?: 'success' | 'failed' | 'pending'
  signedAt?: string
  cancelledAt?: string
  trialEndAt?: string
  createdAt: string
  updatedAt: string
}

export interface SignContractResult {
  signUrl: string
  contractId: string
}

export interface SubscriptionStatus {
  isVip: boolean
  vipLevel?: number
  endTime?: string
  autoRenew: boolean
  planName?: string
  contract?: WechatPayContract
}

export const signRecurringContract = (params: {
  planId: string
  productId?: string
  openid?: string
}) => post<SignContractResult>('/payments/recurring/sign', params)

export const listRecurringContracts = () =>
  get<{ list: WechatPayContract[] }>('/payments/recurring/contracts')

export const getRecurringContract = (id: string) =>
  get<{ contract: WechatPayContract }>(`/payments/recurring/contracts/${encodeURIComponent(id)}`)

export const cancelRecurringContract = (id: string, reason?: string) =>
  post<{ cancelled: boolean }>(
    `/payments/recurring/contracts/${encodeURIComponent(id)}/cancel`,
    reason ? { reason } : {},
  )

export const getSubscriptionStatus = () => get<SubscriptionStatus>('/payments/subscription/status')
