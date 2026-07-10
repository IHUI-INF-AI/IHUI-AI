/**
 * API 接口定义 - 对接新架构后端 http://localhost:3000/api
 */
import { get, post, put } from '../utils/request'
import type { UserInfo } from '../utils/auth'

/* ============ 认证相关 ============ */

/** 发送短信验证码 */
export const sendSmsCode = (phone: string) =>
  post('/auth/sms/send', { phone, scene: 'login' })

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
export const getHomePage = () =>
  get<{ banner: Banner[] }>('/content/home')

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
export const getCourseDetail = (id: string | number) =>
  get<Course>(`/content/course/${id}`)

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
export const getLiveDetail = (id: string | number) =>
  get<Live>(`/live/${id}`)

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
export const updateProfile = (data: Partial<UserInfo>) =>
  put<UserInfo>('/user/profile', data)
