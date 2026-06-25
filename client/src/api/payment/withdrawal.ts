/**
 * 提现相关 API
 * 迁移自 Ai-WXMiniVue/src/service/tixian.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'

/**
 * 提现记录类型
 */
export interface WithdrawalRecord {
  id: string
  amount: number
  status: string
  createTime?: string
  updateTime?: string
  nickname?: string
  openId?: string
  reason?: string
  [key: string]: any
}

/**
 * 提现审批
 * 支持完整提现方式信息（微信/支付宝/银行卡）
 */
export function zhsWithdrawal(params: {
  token: string
  amount: number
  nickname?: string
  openId?: string
  method?: string
  wechatAccount?: string
  alipayAccount?: string
  realName?: string
  bankName?: string
  bankAccount?: string
  remark?: string
} | string, amount?: number, nickname?: string, openId?: string) {
  // 支持两种调用方式：对象参数或独立参数
  const requestData = typeof params === 'string'
    ? { token: params, amount: amount!, nickname: nickname, openId: openId }
    : params

  return request({
    url: '/zhsWithdrawal/withdrawal',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: requestData,
  })
}

/**
 * 获取提现审批状态
 */
export function getWithdrawal(nickname: string, token: string, openId: string) {
  return request({
    url: '/zhsWithdrawal/getWithdrawal',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: { nickname, token, openId },
  })
}

/**
 * 获取提现列表（管理员专用）
 */
export function getWithdrawals(params?: { page?: number; pageSize?: number; status?: string }) {
  return request({
    url: '/zhs-withdrawal-flow/list',
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
    data: params || {},
  })
}

/**
 * 获取提现详情（管理员专用）
 */
export function getWithdrawalDetail(id: string) {
  return request({
    url: `/zhs-withdrawal-flow/${id}`,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  })
}

/**
 * 审批提现（管理员专用）
 */
export function approveWithdrawal(id: string, params?: Record<string, unknown>) {
  return request({
    url: `/zhs-withdrawal-flow/${id}/approve`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: params || {},
  })
}

/**
 * 拒绝提现（管理员专用）
 */
export function rejectWithdrawal(id: string, reason?: string) {
  return request({
    url: `/zhs-withdrawal-flow/${id}/reject`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data: { reason: reason || '审核未通过' },
  })
}

/**
 * 获取当前用户自己的提现记录（用户专用，禁止调用管理员接口）
 */
export function getWithdrawalRecords(params?: { page?: number; pageSize?: number }) {
  return request({
    url: '/zhsWithdrawal/my-records',
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
    data: params || {},
  })
}
