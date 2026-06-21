/**
 * VIP 相关 API
 * 迁移自 Ai-WXMiniVue/src/service/vip.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request'
import {
  getUserVipInfo as getSharedUserVipInfo,
  getVipPrice as getSharedVipPrice,
  purchaseVip as purchaseSharedVip,
} from '@aizhs/shared-services'
import type { SharedRequestAdapter, SharedRequestConfig } from '@aizhs/shared-services'
import type { ApiResponse } from '@/types'

interface VipPurchaseResult {
  code: number
  success: boolean
  message: string
  orderId?: string
  paymentUrl?: string
  qrCode?: string
  [key: string]: any
}

type ApiResponseWithData<T> = Omit<ApiResponse<T>, 'data'> & { data: T }

const sharedRequestAdapter: SharedRequestAdapter = {
  request<TResponse = unknown, TData = unknown>(config: SharedRequestConfig<TData>): Promise<TResponse> {
    return request({
      url: config.url,
      method: config.method || 'GET',
      data: config.data,
      params: config.params,
      headers: config.headers,
      timeout: config.timeout,
      base: config.base,
    } as unknown as Parameters<typeof request>[0]) as Promise<TResponse>
  },
}

/**
 * 获取开通vip价格
 */
export function getvipPrice(token: string) {
  return getSharedVipPrice(sharedRequestAdapter, token)
}

/**
 * 购买VIP
 */
export function purchaseVip(params: { packageId: string; token?: string; paymentMethod?: string }) {
  return purchaseSharedVip(sharedRequestAdapter, params).then((response) => {
    const data = response.data && typeof response.data === 'object'
      ? response.data as Record<string, unknown>
      : {}
    const code = Number(response.code || 200)
    return {
      ...response,
      code,
      data: {
        ...data,
        code,
        success: response.success ?? code === 200,
        message: response.message || response.msg || 'success',
      },
    } as ApiResponseWithData<VipPurchaseResult>
  })
}

/**
 * 获取VIP套餐列表
 * 后端暂无此接口，直接返回前端默认数据
 */
export function getVipPackages() {
  const defaultPackages = [
    {
      id: 1,
      name: '会员',
      description: '适合个人用户和专业用户',
      price: 49,
      monthlyPrice: 49,
      yearlyPrice: 588,
      yearlyDiscount: true,
      recommended: true,
      features: [
        {
          name: '会员功能',
          items: ['无限次AI对话', '图片生成', '语音输入', '文件上传', '30天历史记录', '专属客服', '优先响应', '高级模型访问'],
        },
        {
          name: '工具权限',
          items: ['100+AI工具', '专业模板库', '大文件上传支持', '优先体验新功能'],
        },
      ],
    },
    {
      id: 2,
      name: '操盘手',
      description: '适合高级用户和团队',
      price: 324,
      monthlyPrice: 324,
      yearlyPrice: 3888,
      yearlyDiscount: true,
      recommended: false,
      features: [
        {
          name: '操盘手功能',
          items: ['无限次AI对话', '图片生成', '视频生成', '语音输入', '文件上传', '永久历史记录', '专属客服', '优先响应', '高级模型访问', 'API访问', '自定义模型', '团队协作', '数据导出', '专属顾问'],
        },
        {
          name: '工具权限',
          items: ['全部AI工具', '企业模板库', '无限文件上传', '私有化部署', 'API接口访问', '团队管理功能', '数据安全审计'],
        },
      ],
    },
  ]
  return Promise.resolve({ success: true, data: defaultPackages })
}

/**
 * 获取VIP列表（管理员）
 */
export function getVipList(params?: { page?: number; pageSize?: number }) {
  return request({
    url: '/zhs-user-vip/list',
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
    data: params || {},
  })
}

/**
 * 获取VIP详情（管理员）
 */
export function getVipDetail(id: string) {
  return request({
    url: `/zhs-user-vip/${id}`,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  })
}

/**
 * 取消VIP（管理员）
 */
export function cancelVip(id: string) {
  return request({
    url: `/zhs-user-vip/${id}/cancel`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  })
}

/**
 * 获取VIP价格（别名，兼容旧代码）
 */
export function getVipPrice(token: string) {
  return getvipPrice(token)
}

/**
 * 获取交易员价格（兼容 VipTrader.vue）
 */
export function getTraderPrice() {
  return getSharedVipPrice(sharedRequestAdapter)
}

/**
 * 获取用户VIP信息
 */
export function getUserVipInfo(token?: string) {
  return getSharedUserVipInfo(sharedRequestAdapter, token)
}


