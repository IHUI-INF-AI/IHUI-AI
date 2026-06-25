/**
 * v2 业务封装层 (P13) - 已简化为纯 v1 调用
 *
 * 2026-06-21: v2 后端空壳路由已清理, 本文件改为直接调用 v1 API.
 * 保留导出名称 (v2Agents/v2Courses/v2Orders/v2User) 以避免业务页面改动.
 */

import * as v1Agents from '@/api/agent/agent/agents'
import * as v1Courses from '@/api/course/course/courses'
import * as v1Orders from '@/api/payment/orders'
import * as v1User from '@/api/user/user'

// ========== Agents 业务封装 ==========
export const v2Agents = {
  // 智能体列表
  async list(params: { page?: number; size?: number; keyword?: string; category?: string } = {}) {
    return v1Agents.getAgentsList({
      page: params.page ?? 1,
      pageSize: params.size ?? 20,
      keyword: params.keyword,
      category: params.category,
    })
  },

  // 智能体详情
  async info(agent_id: string) {
    return v1Agents.getAgentDetail(agent_id)
  },
}

// ========== Courses 业务封装 ==========
export const v2Courses = {
  // 课程列表
  async list(params: { page?: number; size?: number; keyword?: string } = {}) {
    return v1Courses.getCoursesList({
      page: params.page ?? 1,
      pageSize: params.size ?? 20,
      keyword: params.keyword,
    })
  },

  // 课程详情
  async detail(course_id: string) {
    return v1Courses.getCourseDetail(course_id)
  },

  // 课程报名
  async enroll(course_id: string) {
    return v1Courses.enrollCourse(course_id)
  },
}

// ========== Orders 业务封装 ==========
export const v2Orders = {
  // 订单列表
  async list(params: { page?: number; pageSize?: number; status?: string } = {}) {
    return v1Orders.getOrders(params)
  },

  // 订单详情
  async detail(order_id: string) {
    return v1Orders.getOrderDetail(order_id)
  },

  // 取消订单
  async cancel(order_id: string) {
    return v1Orders.cancelOrder(order_id)
  },

  // 确认收货
  async confirm(order_id: string) {
    return v1Orders.confirmOrder(order_id)
  },

  // 创建订单
  async create(body: { productId: string; amount: number; paymentMethod?: string; remark?: string }) {
    return v1Orders.createOrder(body)
  },
}

// ========== User 业务封装 ==========
export const v2User = {
  // 获取当前用户 profile
  async profile() {
    return v1User.getUserInfo()
  },

  // 更新用户 profile
  async updateProfile(body: Record<string, unknown>) {
    return v1User.updateUserInfo(body)
  },

  // 上传头像
  async updateAvatar(file: File) {
    return v1User.uploadAvatar(file)
  },
}

// ========== 通用探测: v2 可用性 (已废弃, 始终返回 false) ==========
export async function probeV2Available(_path = '/agents/list'): Promise<boolean> {
  return false
}
