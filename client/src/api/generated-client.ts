 
/**
 * 自动生成的 API 客户端
 * 来源: 系统模块接口文档 vundefined
 * 生成时间: 2026-01-22T13:05:32.169Z
 *
 * 此文件由脚本自动生成，请勿手动修改
 * 如需更新，请运行: npm run generate:api-client
 * 
 * ⚠️ 使用场景说明：
 * - 此 Client 由脚本自动生成，用于 api/index.ts
 * - 提供类型安全的 API 调用方法
 * - 如需使用其他 API Client，请参考：
 *   - api/client.ts: 用于 composables/useAuth.ts
 *   - api/core/client.ts: 用于 core stores，支持多个 baseURL
 *   - utils/request.ts: axios service，被大量文件使用
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data?: T
}

/**
 * API 错误响应
 */
export interface ApiErrorResponse {
  code: number
  msg: string
  data?: any
}

/**
 * API 客户端配置
 */
export interface APIClientConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
}

/**
 * API 客户端类
 */
export class APIClient {
  private client: AxiosInstance

  constructor(config: APIClientConfig = {}) {
    this.client = axios.create({
      baseURL: config.baseURL || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/ai-program',
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    })

    // 请求拦截器
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // 添加认证令牌
        const token = this.getToken()
        if (token) {
          config.headers = config.headers || {}
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        const data = response.data
        if (data.code === 200 || data.code === 0) {
          return response
        } else {
          return Promise.reject({
            code: data.code,
            msg: data.msg,
            data: data.data,
          } as ApiErrorResponse)
        }
      },
      (error) => {
        if (error.response) {
          return Promise.reject({
            code: error.response.status,
            msg: error.response.data?.msg || error.message,
            data: error.response.data,
          } as ApiErrorResponse)
        }
        return Promise.reject(error)
      }
    )
  }

  private getToken(): string | null {
    // 从 StorageManager 获取 token
    if (typeof window !== 'undefined') {
      const accessToken = String(StorageManager.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '')
      const token = String(StorageManager.getItem(STORAGE_KEYS.TOKEN) || '')
      return accessToken || token || null
    }
    return null
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      StorageManager.setItem(STORAGE_KEYS.ACCESS_TOKEN, token)
    }
  }

  clearToken(): void {
    if (typeof window !== 'undefined') {
      StorageManager.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
      StorageManager.removeItem(STORAGE_KEYS.TOKEN)
    }
  }

  // ========================================
  // zhs-user-controller
  // ========================================
  
  /**
   * PUT /zhs_user
   * @path PUT /zhs_user
   */
  async edit(data?: any): Promise<ApiResponse> {
    return this.client.put(`/zhs_user`, data)
  }

  /**
   * POST /zhs_user
   * @path POST /zhs_user
   */
  async add(data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhs_user`, data)
  }

  /**
   * POST /zhs_user/export
   * @path POST /zhs_user/export
   */
  async export(params?: {zhsUser: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhs_user/export`, data)
  }

  /**
   * GET /zhs_user/{id}
   * @path GET /zhs_user/{id}
   */
  async getInfo(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhs_user/${id}`)
  }

  /**
   * GET /zhs_user/list
   * @path GET /zhs_user/list
   */
  async list(params?: {zhsUser: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhs_user/list`, { params })
  }

  /**
   * DELETE /zhs_user/{ids}
   * @path DELETE /zhs_user/{ids}
   */
  async remove(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/zhs_user/${ids}`)
  }

  // ========================================
  // zhs-product-controller
  // ========================================
  
  /**
   * PUT /zhs_product
   * @path PUT /zhs_product
   */
  async edit1(data?: any): Promise<ApiResponse> {
    return this.client.put(`/zhs_product`, data)
  }

  /**
   * POST /zhs_product
   * @path POST /zhs_product
   */
  async add1(data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhs_product`, data)
  }

  /**
   * POST /zhs_product/export
   * @path POST /zhs_product/export
   */
  async export1(params?: {zhsProduct: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhs_product/export`, data)
  }

  /**
   * GET /zhs_product/{id}
   * @path GET /zhs_product/{id}
   */
  async getInfo1(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhs_product/${id}`)
  }

  /**
   * GET /zhs_product/list
   * @path GET /zhs_product/list
   */
  async list1(params?: {zhsProduct: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhs_product/list`, { params })
  }

  /**
   * DELETE /zhs_product/{ids}
   * @path DELETE /zhs_product/{ids}
   */
  async remove1(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/zhs_product/${ids}`)
  }

  // ========================================
  // zhs-activity-controller
  // ========================================
  
  /**
   * PUT /zhs_activity
   * @path PUT /zhs_activity
   */
  async edit2(data?: any): Promise<ApiResponse> {
    return this.client.put(`/zhs_activity`, data)
  }

  /**
   * POST /zhs_activity
   * @path POST /zhs_activity
   */
  async add2(data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhs_activity`, data)
  }

  /**
   * POST /zhs_activity/export
   * @path POST /zhs_activity/export
   */
  async export2(params?: {zhsActivity: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhs_activity/export`, data)
  }

  /**
   * POST /zhs_activity/activityStatus
   * @path POST /zhs_activity/activityStatus
   */
  async activityStatus(data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhs_activity/activityStatus`, data)
  }

  /**
   * GET /zhs_activity/{id}
   * @path GET /zhs_activity/{id}
   */
  async getInfo2(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhs_activity/${id}`)
  }

  /**
   * GET /zhs_activity/list
   * @path GET /zhs_activity/list
   */
  async list2(params?: {zhsActivity: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhs_activity/list`, { params })
  }

  /**
   * DELETE /zhs_activity/{ids}
   * @path DELETE /zhs_activity/{ids}
   */
  async remove2(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/zhs_activity/${ids}`)
  }

  // ========================================
  // 平台身份管理
  // ========================================

  /**
   * 修改
   * @path PUT /zhsIdentity
   */
  async edit3(data?: any): Promise<ApiResponse> {
    return this.client.put(`/zhsIdentity`, data)
  }

  /**
   * 新增
   * @path POST /zhsIdentity
   */
  async add3(data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhsIdentity`, data)
  }

  /**
   * 导出
   * @path POST /zhsIdentity/export
   */
  async export3(params?: {zhsIdentity: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhsIdentity/export`, data)
  }

  /**
   * 详情
   * @path GET /zhsIdentity/{id}
   */
  async getInfo3(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhsIdentity/${id}`)
  }

  /**
   * 列表
   * @path GET /zhsIdentity/list
   */
  async list3(params?: {zhsIdentity: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhsIdentity/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /zhsIdentity/{ids}
   */
  async remove3(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/zhsIdentity/${ids}`)
  }

  // ========================================
  // zhs-agent-controller
  // ========================================
  
  /**
   * PUT /zhsAgent
   * @path PUT /zhsAgent
   */
  async edit4(data?: any): Promise<ApiResponse> {
    return this.client.put(`/zhsAgent`, data)
  }

  /**
   * POST /zhsAgent
   * @path POST /zhsAgent
   */
  async add4(data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhsAgent`, data)
  }

  /**
   * POST /zhsAgent/export
   * @path POST /zhsAgent/export
   */
  async export4(params?: {zhsAgent: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/zhsAgent/export`, data)
  }

  /**
   * GET /zhsAgent/{id}
   * @path GET /zhsAgent/{id}
   */
  async getInfo4(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhsAgent/${id}`)
  }

  /**
   * DELETE /zhsAgent/{id}
   * @path DELETE /zhsAgent/{id}
   */
  async remove4(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/zhsAgent/${id}`)
  }

  /**
   * GET /zhsAgent/list
   * @path GET /zhsAgent/list
   */
  async list4(params?: {zhsAgent: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/zhsAgent/list`, { params })
  }

  /**
   * DELETE /zhsAgent/{ids}
   * @path DELETE /zhsAgent/{ids}
   */
  async remove5(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/zhsAgent/${ids}`)
  }

  // ========================================
  // zhs-withdrawal-flow-controller
  // ========================================
  
  /**
   * PUT /withdrawal_flow
   * @path PUT /withdrawal_flow
   */
  async edit5(data?: any): Promise<ApiResponse> {
    return this.client.put(`/withdrawal_flow`, data)
  }

  /**
   * POST /withdrawal_flow
   * @path POST /withdrawal_flow
   */
  async add5(data?: any): Promise<ApiResponse> {
    return this.client.post(`/withdrawal_flow`, data)
  }

  /**
   * PUT /withdrawal_flow/{id}/approve
   * @path PUT /withdrawal_flow/{id}/approve
   */
  async approve(id: string | number, params?: {status: any}, data?: any): Promise<ApiResponse> {
    return this.client.put(`/withdrawal_flow/${id}/approve`, data)
  }

  /**
   * POST /withdrawal_flow/export
   * @path POST /withdrawal_flow/export
   */
  async export5(params?: {zhsWithdrawalFlow: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/withdrawal_flow/export`, data)
  }

  /**
   * GET /withdrawal_flow/{id}
   * @path GET /withdrawal_flow/{id}
   */
  async getInfo5(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/withdrawal_flow/${id}`)
  }

  /**
   * GET /withdrawal_flow/list
   * @path GET /withdrawal_flow/list
   */
  async list5(params?: {zhsWithdrawalFlow: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/withdrawal_flow/list`, { params })
  }

  /**
   * DELETE /withdrawal_flow/{ids}
   * @path DELETE /withdrawal_flow/{ids}
   */
  async remove6(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/withdrawal_flow/${ids}`)
  }

  // ========================================
  // zhs-vip-level-controller
  // ========================================
  
  /**
   * PUT /vip_level
   * @path PUT /vip_level
   */
  async edit6(data?: any): Promise<ApiResponse> {
    return this.client.put(`/vip_level`, data)
  }

  /**
   * POST /vip_level
   * @path POST /vip_level
   */
  async add6(data?: any): Promise<ApiResponse> {
    return this.client.post(`/vip_level`, data)
  }

  /**
   * POST /vip_level/export
   * @path POST /vip_level/export
   */
  async export6(params?: {zhsVipLevel: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/vip_level/export`, data)
  }

  /**
   * GET /vip_level/{id}
   * @path GET /vip_level/{id}
   */
  async getInfo6(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/vip_level/${id}`)
  }

  /**
   * GET /vip_level/list
   * @path GET /vip_level/list
   */
  async list6(params?: {zhsVipLevel: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/vip_level/list`, { params })
  }

  /**
   * DELETE /vip_level/{ids}
   * @path DELETE /vip_level/{ids}
   */
  async remove7(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/vip_level/${ids}`)
  }

  // ========================================
  // 用户中心Controller
  // ========================================
  
  /**
   * PUT /users
   * @path PUT /users
   */
  async edit7(data?: any): Promise<ApiResponse> {
    return this.client.put(`/users`, data)
  }

  /**
   * POST /users
   * @path POST /users
   */
  async add7(data?: any): Promise<ApiResponse> {
    return this.client.post(`/users`, data)
  }

  /**
   * POST /users/set/user/identity
   * @path POST /users/set/user/identity
   */
  async setUserIdentity(data?: any): Promise<ApiResponse> {
    return this.client.post(`/users/set/user/identity`, data)
  }

  /**
   * POST /users/export
   * @path POST /users/export
   */
  async export7(params?: {users: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/users/export`, data)
  }

  /**
   * GET /users/{uuid}
   * @path GET /users/{uuid}
   */
  async getInfo7(uuid: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/users/${uuid}`)
  }

  /**
   * GET /users/vipInfo/{uuid}
   * @path GET /users/vipInfo/{uuid}
   */
  async getVIPInfo(uuid: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/users/vipInfo/${uuid}`)
  }

  /**
   * GET /users/platform/list
   * @path GET /users/platform/list
   */
  async getCourseUser(params?: {name: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/users/platform/list`, { params })
  }

  /**
   * GET /users/list
   * @path GET /users/list
   */
  async list7(params?: {users: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/users/list`, { params })
  }

  /**
   * GET /users/course/platform
   * @path GET /users/course/platform
   */
  async getLoginCoursePlatform(_data?: any): Promise<ApiResponse> {
    return this.client.get(`/users/course/platform`)
  }

  /**
   * DELETE /users/{uuids}
   * @path DELETE /users/{uuids}
   */
  async remove8(uuids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/users/${uuids}`)
  }

  // ========================================
  // zhs-user-vip-controller
  // ========================================
  
  /**
   * PUT /user_vip
   * @path PUT /user_vip
   */
  async edit8(data?: any): Promise<ApiResponse> {
    return this.client.put(`/user_vip`, data)
  }

  /**
   * POST /user_vip
   * @path POST /user_vip
   */
  async add8(data?: any): Promise<ApiResponse> {
    return this.client.post(`/user_vip`, data)
  }

  /**
   * POST /user_vip/export
   * @path POST /user_vip/export
   */
  async export8(params?: {zhsUserVip: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/user_vip/export`, data)
  }

  /**
   * GET /user_vip/{id}
   * @path GET /user_vip/{id}
   */
  async getInfo8(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/user_vip/${id}`)
  }

  /**
   * GET /user_vip/list
   * @path GET /user_vip/list
   */
  async list8(params?: {zhsUserVip: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/user_vip/list`, { params })
  }

  /**
   * DELETE /user_vip/{ids}
   * @path DELETE /user_vip/{ids}
   */
  async remove9(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/user_vip/${ids}`)
  }

  // ========================================
  // 用户操作课程视频管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /userVideoLog
   */
  async edit9(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userVideoLog`, data)
  }

  /**
   * 新增
   * @path POST /userVideoLog
   */
  async add9(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userVideoLog`, data)
  }

  /**
   * 导出
   * @path POST /userVideoLog/export
   */
  async export9(params?: {zhsUserVideoLog: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userVideoLog/export`, data)
  }

  /**
   * 详情
   * @path GET /userVideoLog/{id}
   */
  async getInfo9(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userVideoLog/${id}`)
  }

  /**
   * 列表
   * @path GET /userVideoLog/list
   */
  async list9(params?: {zhsUserVideoLog: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userVideoLog/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /userVideoLog/{ids}
   */
  async remove10(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userVideoLog/${ids}`)
  }

  // ========================================
  // 用户评论管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /userVideoComment
   */
  async edit10(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userVideoComment`, data)
  }

  /**
   * 新增
   * @path POST /userVideoComment
   */
  async add10(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userVideoComment`, data)
  }

  /**
   * 导出
   * @path POST /userVideoComment/export
   */
  async export10(params?: {zhsUserVideoComment: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userVideoComment/export`, data)
  }

  /**
   * 详情
   * @path GET /userVideoComment/{id}
   */
  async getInfo10(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userVideoComment/${id}`)
  }

  /**
   * 列表
   * @path GET /userVideoComment/list
   */
  async list10(params?: {zhsUserVideoComment: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userVideoComment/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /userVideoComment/{ids}
   */
  async remove11(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userVideoComment/${ids}`)
  }

  // ========================================
  // 普通用户与系统用户对应管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /userSysLink
   */
  async edit11(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userSysLink`, data)
  }

  /**
   * 新增
   * @path POST /userSysLink
   */
  async add11(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userSysLink`, data)
  }

  /**
   * 导出
   * @path POST /userSysLink/export
   */
  async export11(params?: {zhsUserSysLink: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userSysLink/export`, data)
  }

  /**
   * 详情
   * @path GET /userSysLink/{id}
   */
  async getInfo11(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userSysLink/${id}`)
  }

  /**
   * 列表
   * @path GET /userSysLink/list
   */
  async list11(params?: {zhsUserSysLink: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userSysLink/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /userSysLink/{ids}
   */
  async remove12(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userSysLink/${ids}`)
  }

  // ========================================
  // 用户与平台关系管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /userPlatform
   */
  async edit12(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userPlatform`, data)
  }

  /**
   * 新增
   * @path POST /userPlatform
   */
  async add12(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userPlatform`, data)
  }

  /**
   * 导出
   * @path POST /userPlatform/export
   */
  async export12(params?: {zhsUserPlatform: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userPlatform/export`, data)
  }

  /**
   * 详情
   * @path GET /userPlatform/{id}
   */
  async getInfo12(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userPlatform/${id}`)
  }

  /**
   * 列表
   * @path GET /userPlatform/list
   */
  async list12(params?: {zhsUserPlatform: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userPlatform/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /userPlatform/{ids}
   */
  async remove13(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userPlatform/${ids}`)
  }

  // ========================================
  // 用户反馈管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /userFeedback
   */
  async edit13(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userFeedback`, data)
  }

  /**
   * 新增
   * @path POST /userFeedback
   */
  async add13(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userFeedback`, data)
  }

  /**
   * 导出
   * @path POST /userFeedback/export
   */
  async export13(params?: {aiUserFeedback: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userFeedback/export`, data)
  }

  /**
   * 详情
   * @path GET /userFeedback/{id}
   */
  async getInfo13(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userFeedback/${id}`)
  }

  /**
   * 列表
   * @path GET /userFeedback/list
   */
  async list13(params?: {aiUserFeedback: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userFeedback/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /userFeedback/{ids}
   */
  async remove14(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userFeedback/${ids}`)
  }

  // ========================================
  // 用户评论点赞记录管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /userCommentLog
   */
  async edit14(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userCommentLog`, data)
  }

  /**
   * 新增
   * @path POST /userCommentLog
   */
  async add14(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userCommentLog`, data)
  }

  /**
   * 导出
   * @path POST /userCommentLog/export
   */
  async export14(params?: {zhsUserCommentLog: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userCommentLog/export`, data)
  }

  /**
   * 详情
   * @path GET /userCommentLog/{id}
   */
  async getInfo14(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userCommentLog/${id}`)
  }

  /**
   * 列表
   * @path GET /userCommentLog/list
   */
  async list14(params?: {zhsUserCommentLog: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userCommentLog/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /userCommentLog/{ids}
   */
  async remove15(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userCommentLog/${ids}`)
  }

  // ========================================
  // 用户形象管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /userAgentImage
   */
  async edit15(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userAgentImage`, data)
  }

  /**
   * 新增
   * @path POST /userAgentImage
   */
  async add15(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userAgentImage`, data)
  }

  /**
   * 导出
   * @path POST /userAgentImage/export
   */
  async export15(params?: {zhsUserAgentImage: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userAgentImage/export`, data)
  }

  /**
   * 详情
   * @path GET /userAgentImage/{id}
   */
  async getInfo15(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userAgentImage/${id}`)
  }

  /**
   * 列表
   * @path GET /userAgentImage/list
   */
  async list15(params?: {zhsUserAgentImage: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userAgentImage/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /userAgentImage/{ids}
   */
  async remove16(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userAgentImage/${ids}`)
  }

  // ========================================
  // zhs-user-agent-context-controller
  // ========================================
  
  /**
   * PUT /userAgentContext
   * @path PUT /userAgentContext
   */
  async edit16(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userAgentContext`, data)
  }

  /**
   * POST /userAgentContext
   * @path POST /userAgentContext
   */
  async add16(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userAgentContext`, data)
  }

  /**
   * POST /userAgentContext/export
   * @path POST /userAgentContext/export
   */
  async export16(params?: {zhsUserAgentContext: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userAgentContext/export`, data)
  }

  /**
   * GET /userAgentContext/{id}
   * @path GET /userAgentContext/{id}
   */
  async getInfo16(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userAgentContext/${id}`)
  }

  /**
   * GET /userAgentContext/list
   * @path GET /userAgentContext/list
   */
  async list16(params?: {zhsUserAgentContext: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userAgentContext/list`, { params })
  }

  /**
   * DELETE /userAgentContext/{ids}
   * @path DELETE /userAgentContext/{ids}
   */
  async remove17(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userAgentContext/${ids}`)
  }

  // ========================================
  // 用户音色管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /userAgentAudio
   */
  async edit17(data?: any): Promise<ApiResponse> {
    return this.client.put(`/userAgentAudio`, data)
  }

  /**
   * 新增
   * @path POST /userAgentAudio
   */
  async add17(data?: any): Promise<ApiResponse> {
    return this.client.post(`/userAgentAudio`, data)
  }

  /**
   * 导出
   * @path POST /userAgentAudio/export
   */
  async export17(params?: {zhsUserAgentAudio: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/userAgentAudio/export`, data)
  }

  /**
   * 详情
   * @path GET /userAgentAudio/{id}
   */
  async getInfo17(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userAgentAudio/${id}`)
  }

  /**
   * 列表
   * @path GET /userAgentAudio/list
   */
  async list17(params?: {zhsUserAgentAudio: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/userAgentAudio/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /userAgentAudio/{ids}
   */
  async remove18(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/userAgentAudio/${ids}`)
  }

  // ========================================
  // zhs-operate-token-flow-controller
  // ========================================
  
  /**
   * PUT /token_flow
   * @path PUT /token_flow
   */
  async edit18(data?: any): Promise<ApiResponse> {
    return this.client.put(`/token_flow`, data)
  }

  /**
   * POST /token_flow
   * @path POST /token_flow
   */
  async add18(data?: any): Promise<ApiResponse> {
    return this.client.post(`/token_flow`, data)
  }

  /**
   * POST /token_flow/export
   * @path POST /token_flow/export
   */
  async export18(params?: {zhsOperateTokenFlow: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/token_flow/export`, data)
  }

  /**
   * GET /token_flow/{id}
   * @path GET /token_flow/{id}
   */
  async getInfo18(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/token_flow/${id}`)
  }

  /**
   * GET /token_flow/list
   * @path GET /token_flow/list
   */
  async list18(params?: {zhsOperateTokenFlow: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/token_flow/list`, { params })
  }

  /**
   * DELETE /token_flow/{ids}
   * @path DELETE /token_flow/{ids}
   */
  async remove19(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/token_flow/${ids}`)
  }

  // ========================================
  // 订单记录管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /taskDeveloper
   */
  async edit19(data?: any): Promise<ApiResponse> {
    return this.client.put(`/taskDeveloper`, data)
  }

  /**
   * 新增
   * @path POST /taskDeveloper
   */
  async add19(data?: any): Promise<ApiResponse> {
    return this.client.post(`/taskDeveloper`, data)
  }

  /**
   * 导出
   * @path POST /taskDeveloper/export
   */
  async export19(params?: {agentTaskDeveloper: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/taskDeveloper/export`, data)
  }

  /**
   * 详情
   * @path GET /taskDeveloper/{id}
   */
  async getInfo19(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/taskDeveloper/${id}`)
  }

  /**
   * 列表
   * @path GET /taskDeveloper/list
   */
  async list19(params?: {agentTaskDeveloper: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/taskDeveloper/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /taskDeveloper/{ids}
   */
  async remove20(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/taskDeveloper/${ids}`)
  }

  // ========================================
  // zhs-product-identity-controller
  // ========================================
  
  /**
   * PUT /product_identity
   * @path PUT /product_identity
   */
  async edit20(data?: any): Promise<ApiResponse> {
    return this.client.put(`/product_identity`, data)
  }

  /**
   * POST /product_identity
   * @path POST /product_identity
   */
  async add20(data?: any): Promise<ApiResponse> {
    return this.client.post(`/product_identity`, data)
  }

  /**
   * POST /product_identity/export
   * @path POST /product_identity/export
   */
  async export20(params?: {zhsProductIdentity: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/product_identity/export`, data)
  }

  /**
   * GET /product_identity/{id}
   * @path GET /product_identity/{id}
   */
  async getInfo21(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/product_identity/${id}`)
  }

  /**
   * GET /product_identity/list
   * @path GET /product_identity/list
   */
  async list20(params?: {zhsProductIdentity: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/product_identity/list`, { params })
  }

  /**
   * DELETE /product_identity/{ids}
   * @path DELETE /product_identity/{ids}
   */
  async remove21(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/product_identity/${ids}`)
  }

  // ========================================
  // 算力购买规则管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /powerPurchaseRule
   */
  async edit21(data?: any): Promise<ApiResponse> {
    return this.client.put(`/powerPurchaseRule`, data)
  }

  /**
   * 新增
   * @path POST /powerPurchaseRule
   */
  async add21(data?: any): Promise<ApiResponse> {
    return this.client.post(`/powerPurchaseRule`, data)
  }

  /**
   * 导出
   * @path POST /powerPurchaseRule/export
   */
  async export21(params?: {powerPurchaseRule: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/powerPurchaseRule/export`, data)
  }

  /**
   * 详情
   * @path GET /powerPurchaseRule/{id}
   */
  async getInfo22(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/powerPurchaseRule/${id}`)
  }

  /**
   * 列表
   * @path GET /powerPurchaseRule/list
   */
  async list21(params?: {powerPurchaseRule: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/powerPurchaseRule/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /powerPurchaseRule/{ids}
   */
  async remove22(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/powerPurchaseRule/${ids}`)
  }

  // ========================================
  // 平台机构管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /organization
   */
  async edit22(data?: any): Promise<ApiResponse> {
    return this.client.put(`/organization`, data)
  }

  /**
   * 新增
   * @path POST /organization
   */
  async add22(data?: any): Promise<ApiResponse> {
    return this.client.post(`/organization`, data)
  }

  /**
   * 导出
   * @path POST /organization/export
   */
  async export22(params?: {zhsOrganization: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/organization/export`, data)
  }

  /**
   * 详情
   * @path GET /organization/{id}
   */
  async getInfo23(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/organization/${id}`)
  }

  /**
   * 列表
   * @path GET /organization/list
   */
  async list22(params?: {zhsOrganization: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/organization/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /organization/{ids}
   */
  async remove23(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/organization/${ids}`)
  }

  // ========================================
  // zhs-order-controller
  // ========================================
  
  /**
   * PUT /order
   * @path PUT /order
   */
  async edit23(data?: any): Promise<ApiResponse> {
    return this.client.put(`/order`, data)
  }

  /**
   * POST /order
   * @path POST /order
   */
  async add23(data?: any): Promise<ApiResponse> {
    return this.client.post(`/order`, data)
  }

  /**
   * PUT /order/{id}/status
   * @path PUT /order/{id}/status
   */
  async orderStatus(id: string | number, params?: {status: any}, data?: any): Promise<ApiResponse> {
    return this.client.put(`/order/${id}/status`, data)
  }

  /**
   * PUT /order/{id}/refund
   * @path PUT /order/{id}/refund
   */
  async orderRefund(id: string | number, data?: any): Promise<ApiResponse> {
    return this.client.put(`/order/${id}/refund`, data)
  }

  /**
   * POST /order/export
   * @path POST /order/export
   */
  async export23(params?: {zhsOrder: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/order/export`, data)
  }

  /**
   * GET /order/{id}
   * @path GET /order/{id}
   */
  async getInfo24(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/order/${id}`)
  }

  /**
   * GET /order/list
   * @path GET /order/list
   */
  async list23(params?: {zhsOrder: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/order/list`, { params })
  }

  /**
   * GET /order/completeOrder/{day}
   * @path GET /order/completeOrder/{day}
   */
  async completeOrder(day: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/order/completeOrder/${day}`)
  }

  /**
   * DELETE /order/{ids}
   * @path DELETE /order/{ids}
   */
  async remove24(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/order/${ids}`)
  }

  // ========================================
  // 用户登录日志Controller
  // ========================================
  
  /**
   * PUT /login_logs
   * @path PUT /login_logs
   */
  async edit24(data?: any): Promise<ApiResponse> {
    return this.client.put(`/login_logs`, data)
  }

  /**
   * POST /login_logs
   * @path POST /login_logs
   */
  async add24(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login_logs`, data)
  }

  /**
   * POST /login_logs/export
   * @path POST /login_logs/export
   */
  async export24(params?: {userLoginLogs: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/login_logs/export`, data)
  }

  /**
   * GET /login_logs/{id}
   * @path GET /login_logs/{id}
   */
  async getInfo25(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/login_logs/${id}`)
  }

  /**
   * GET /login_logs/list
   * @path GET /login_logs/list
   */
  async list24(params?: {userLoginLogs: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/login_logs/list`, { params })
  }

  /**
   * DELETE /login_logs/{ids}
   * @path DELETE /login_logs/{ids}
   */
  async remove25(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/login_logs/${ids}`)
  }

  // ========================================
  // zhs-information-controller
  // ========================================
  
  /**
   * PUT /information
   * @path PUT /information
   */
  async edit25(data?: any): Promise<ApiResponse> {
    return this.client.put(`/information`, data)
  }

  /**
   * POST /information
   * @path POST /information
   */
  async add25(data?: any): Promise<ApiResponse> {
    return this.client.post(`/information`, data)
  }

  /**
   * POST /information/export
   * @path POST /information/export
   */
  async export25(params?: {zhsInformation: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/information/export`, data)
  }

  /**
   * GET /information/{id}
   * @path GET /information/{id}
   */
  async getInfo26(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/information/${id}`)
  }

  /**
   * GET /information/list
   * @path GET /information/list
   */
  async list25(params?: {zhsInformation: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/information/list`, { params })
  }

  /**
   * DELETE /information/{ids}
   * @path DELETE /information/{ids}
   */
  async remove26(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/information/${ids}`)
  }

  // ========================================
  // zhs-identity-proportion-controller
  // ========================================
  
  /**
   * PUT /identity_proportion
   * @path PUT /identity_proportion
   */
  async edit26(data?: any): Promise<ApiResponse> {
    return this.client.put(`/identity_proportion`, data)
  }

  /**
   * POST /identity_proportion
   * @path POST /identity_proportion
   */
  async add26(data?: any): Promise<ApiResponse> {
    return this.client.post(`/identity_proportion`, data)
  }

  /**
   * POST /identity_proportion/export
   * @path POST /identity_proportion/export
   */
  async export26(params?: {zhsIdentityProportion: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/identity_proportion/export`, data)
  }

  /**
   * GET /identity_proportion/{id}
   * @path GET /identity_proportion/{id}
   */
  async getInfo27(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/identity_proportion/${id}`)
  }

  /**
   * GET /identity_proportion/list
   * @path GET /identity_proportion/list
   */
  async list26(params?: {zhsIdentityProportion: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/identity_proportion/list`, { params })
  }

  /**
   * DELETE /identity_proportion/{ids}
   * @path DELETE /identity_proportion/{ids}
   */
  async remove27(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/identity_proportion/${ids}`)
  }

  // ========================================
  // zhs-commission-flow-controller
  // ========================================
  
  /**
   * PUT /flow
   * @path PUT /flow
   */
  async edit27(data?: any): Promise<ApiResponse> {
    return this.client.put(`/flow`, data)
  }

  /**
   * POST /flow
   * @path POST /flow
   */
  async add27(data?: any): Promise<ApiResponse> {
    return this.client.post(`/flow`, data)
  }

  /**
   * PUT /flow/{id}/settle
   * @path PUT /flow/{id}/settle
   */
  async settle(id: string | number, data?: any): Promise<ApiResponse> {
    return this.client.put(`/flow/${id}/settle`, data)
  }

  /**
   * POST /flow/export
   * @path POST /flow/export
   */
  async export27(params?: {zhsCommissionFlow: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/flow/export`, data)
  }

  /**
   * GET /flow/{id}
   * @path GET /flow/{id}
   */
  async getInfo29(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/flow/${id}`)
  }

  /**
   * GET /flow/list
   * @path GET /flow/list
   */
  async list27(params?: {zhsCommissionFlow: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/flow/list`, { params })
  }

  /**
   * DELETE /flow/{ids}
   * @path DELETE /flow/{ids}
   */
  async remove28(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/flow/${ids}`)
  }

  // ========================================
  // 开发者智能体审核管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /examine
   */
  async edit28(data?: any): Promise<ApiResponse> {
    return this.client.put(`/examine`, data)
  }

  /**
   * 新增
   * @path POST /examine
   */
  async add28(data?: any): Promise<ApiResponse> {
    return this.client.post(`/examine`, data)
  }

  /**
   * 审批智能体-驳回
   * @path PUT /examine/reject
   */
  async reject(data?: any): Promise<ApiResponse> {
    return this.client.put(`/examine/reject`, data)
  }

  /**
   * 审批智能体-通过
   * @path PUT /examine/pass
   */
  async pass(data?: any): Promise<ApiResponse> {
    return this.client.put(`/examine/pass`, data)
  }

  /**
   * 导出
   * @path POST /examine/export
   */
  async export28(params?: {zhsAgentExamine: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/examine/export`, data)
  }

  /**
   * 详情
   * @path GET /examine/{id}
   */
  async getInfo30(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/examine/${id}`)
  }

  /**
   * 列表
   * @path GET /examine/list
   */
  async list28(params?: {zhsAgentExamine: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/examine/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /examine/{ids}
   */
  async remove29(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/examine/${ids}`)
  }

  // ========================================
  // 平台发布管理管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /educationPlatform
   */
  async edit29(data?: any): Promise<ApiResponse> {
    return this.client.put(`/educationPlatform`, data)
  }

  /**
   * 新增
   * @path POST /educationPlatform
   */
  async add29(data?: any): Promise<ApiResponse> {
    return this.client.post(`/educationPlatform`, data)
  }

  /**
   * 导出
   * @path POST /educationPlatform/export
   */
  async export29(params?: {zhsEducationPlatform: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/educationPlatform/export`, data)
  }

  /**
   * 详情
   * @path GET /educationPlatform/{id}
   */
  async getInfo31(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/educationPlatform/${id}`)
  }

  /**
   * 列表
   * @path GET /educationPlatform/list
   */
  async list29(params?: {zhsEducationPlatform: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/educationPlatform/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /educationPlatform/{ids}
   */
  async remove30(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/educationPlatform/${ids}`)
  }

  // ========================================
  // zhs-dictionary-controller
  // ========================================
  
  /**
   * PUT /dictionary
   * @path PUT /dictionary
   */
  async edit30(data?: any): Promise<ApiResponse> {
    return this.client.put(`/dictionary`, data)
  }

  /**
   * POST /dictionary
   * @path POST /dictionary
   */
  async add30(data?: any): Promise<ApiResponse> {
    return this.client.post(`/dictionary`, data)
  }

  /**
   * POST /dictionary/export
   * @path POST /dictionary/export
   */
  async export30(params?: {zhsDictionary: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/dictionary/export`, data)
  }

  /**
   * GET /dictionary/{id}
   * @path GET /dictionary/{id}
   */
  async getInfo32(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/dictionary/${id}`)
  }

  /**
   * GET /dictionary/list
   * @path GET /dictionary/list
   */
  async list30(params?: {zhsDictionary: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/dictionary/list`, { params })
  }

  /**
   * GET /dictionary/getInformationType
   * @path GET /dictionary/getInformationType
   */
  async getInformationType(_data?: any): Promise<ApiResponse> {
    return this.client.get(`/dictionary/getInformationType`)
  }

  /**
   * DELETE /dictionary/{ids}
   * @path DELETE /dictionary/{ids}
   */
  async remove31(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/dictionary/${ids}`)
  }

  // ========================================
  // 开发者账号（coze账号）管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /developer
   */
  async edit31(data?: any): Promise<ApiResponse> {
    return this.client.put(`/developer`, data)
  }

  /**
   * 新增
   * @path POST /developer
   */
  async add31(data?: any): Promise<ApiResponse> {
    return this.client.post(`/developer`, data)
  }

  /**
   * 导出
   * @path POST /developer/export
   */
  async export33(params?: {zhsDeveloper: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/developer/export`, data)
  }

  /**
   * 详情
   * @path GET /developer/{id}
   */
  async getInfo35(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/developer/${id}`)
  }

  /**
   * 列表
   * @path GET /developer/list
   */
  async list33(params?: {zhsDeveloper: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/developer/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /developer/{ids}
   */
  async remove34(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/developer/${ids}`)
  }

  // ========================================
  // 用户开发者关系管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /developerLink
   */
  async edit32(data?: any): Promise<ApiResponse> {
    return this.client.put(`/developerLink`, data)
  }

  /**
   * 新增
   * @path POST /developerLink
   */
  async add32(data?: any): Promise<ApiResponse> {
    return this.client.post(`/developerLink`, data)
  }

  /**
   * 分配开发者账号
   * @path PUT /developerLink/assignAccount
   */
  async assignAccount(data?: any): Promise<ApiResponse> {
    return this.client.put(`/developerLink/assignAccount`, data)
  }

  /**
   * 导出
   * @path POST /developerLink/export
   */
  async export31(params?: {zhsDeveloperLink: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/developerLink/export`, data)
  }

  /**
   * 详情
   * @path GET /developerLink/{id}
   */
  async getInfo33(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/developerLink/${id}`)
  }

  /**
   * 列表
   * @path GET /developerLink/list
   */
  async list31(params?: {zhsDeveloperLink: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/developerLink/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /developerLink/{ids}
   */
  async remove32(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/developerLink/${ids}`)
  }

  // ========================================
  // 开发者订单日志管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /developerFundLogs
   */
  async edit33(data?: any): Promise<ApiResponse> {
    return this.client.put(`/developerFundLogs`, data)
  }

  /**
   * 新增
   * @path POST /developerFundLogs
   */
  async add33(data?: any): Promise<ApiResponse> {
    return this.client.post(`/developerFundLogs`, data)
  }

  /**
   * 导出
   * @path POST /developerFundLogs/export
   */
  async export32(params?: {zhsDeveloperFundLogs: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/developerFundLogs/export`, data)
  }

  /**
   * 详情
   * @path GET /developerFundLogs/{id}
   */
  async getInfo34(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/developerFundLogs/${id}`)
  }

  /**
   * 列表
   * @path GET /developerFundLogs/list
   */
  async list32(params?: {zhsDeveloperFundLogs: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/developerFundLogs/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /developerFundLogs/{ids}
   */
  async remove33(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/developerFundLogs/${ids}`)
  }

  // ========================================
  // zhs-popular-courses-controller
  // ========================================
  
  /**
   * PUT /courses
   * @path PUT /courses
   */
  async edit34(data?: any): Promise<ApiResponse> {
    return this.client.put(`/courses`, data)
  }

  /**
   * POST /courses
   * @path POST /courses
   */
  async add34(data?: any): Promise<ApiResponse> {
    return this.client.post(`/courses`, data)
  }

  /**
   * POST /courses/export
   * @path POST /courses/export
   */
  async export34(params?: {zhsPopularCourses: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/courses/export`, data)
  }

  /**
   * GET /courses/{id}
   * @path GET /courses/{id}
   */
  async getInfo36(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courses/${id}`)
  }

  /**
   * GET /courses/list
   * @path GET /courses/list
   */
  async list34(params?: {zhsPopularCourses: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courses/list`, { params })
  }

  /**
   * DELETE /courses/{ids}
   * @path DELETE /courses/{ids}
   */
  async remove35(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/courses/${ids}`)
  }

  // ========================================
  // 课程管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /course
   */
  async edit35(data?: any): Promise<ApiResponse> {
    return this.client.put(`/course`, data)
  }

  /**
   * 新增
   * @path POST /course
   */
  async add35(data?: any): Promise<ApiResponse> {
    return this.client.post(`/course`, data)
  }

  /**
   * 导出
   * @path POST /course/export
   */
  async export42(params?: {zhsCourse: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/course/export`, data)
  }

  /**
   * 详情
   * @path GET /course/{id}
   */
  async getInfo44(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/course/${id}`)
  }

  /**
   * 列表
   * @path GET /course/list
   */
  async list42(params?: {zhsCourse: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/course/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /course/{ids}
   */
  async remove43(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/course/${ids}`)
  }

  // ========================================
  // 课程视频管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /courseVideo
   */
  async edit36(data?: any): Promise<ApiResponse> {
    return this.client.put(`/courseVideo`, data)
  }

  /**
   * 新增
   * @path POST /courseVideo
   */
  async add36(data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseVideo`, data)
  }

  /**
   * 导出
   * @path POST /courseVideo/export
   */
  async export36(params?: {zhsCourseVideo: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseVideo/export`, data)
  }

  /**
   * 详情
   * @path GET /courseVideo/{id}
   */
  async getInfo38(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courseVideo/${id}`)
  }

  /**
   * 列表
   * @path GET /courseVideo/list
   */
  async list36(params?: {zhsCourseVideo: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courseVideo/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /courseVideo/{ids}
   */
  async remove37(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/courseVideo/${ids}`)
  }

  // ========================================
  // 课程视频维护临时管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /courseVideoTemp
   */
  async edit37(data?: any): Promise<ApiResponse> {
    return this.client.put(`/courseVideoTemp`, data)
  }

  /**
   * 新增
   * @path POST /courseVideoTemp
   */
  async add37(data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseVideoTemp`, data)
  }

  /**
   * 导出
   * @path POST /courseVideoTemp/export
   */
  async export35(params?: {zhsCourseVideoTemp: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseVideoTemp/export`, data)
  }

  /**
   * 详情
   * @path GET /courseVideoTemp/{id}
   */
  async getInfo37(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courseVideoTemp/${id}`)
  }

  /**
   * 列表
   * @path GET /courseVideoTemp/list
   */
  async list35(params?: {zhsCourseVideoTemp: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courseVideoTemp/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /courseVideoTemp/{ids}
   */
  async remove36(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/courseVideoTemp/${ids}`)
  }

  // ========================================
  // 课程维护临时管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /courseTemp
   */
  async edit38(data?: any): Promise<ApiResponse> {
    return this.client.put(`/courseTemp`, data)
  }

  /**
   * 新增
   * @path POST /courseTemp
   */
  async add38(data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseTemp`, data)
  }

  /**
   * 导出
   * @path POST /courseTemp/export
   */
  async export37(params?: {zhsCourseTemp: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseTemp/export`, data)
  }

  /**
   * 详情
   * @path GET /courseTemp/{id}
   */
  async getInfo39(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courseTemp/${id}`)
  }

  /**
   * 列表
   * @path GET /courseTemp/list
   */
  async list37(params?: {zhsCourseTemp: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courseTemp/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /courseTemp/{ids}
   */
  async remove38(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/courseTemp/${ids}`)
  }

  // ========================================
  // 视频发布平台记录管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /coursePlatformLog
   */
  async edit39(data?: any): Promise<ApiResponse> {
    return this.client.put(`/coursePlatformLog`, data)
  }

  /**
   * 新增
   * @path POST /coursePlatformLog
   */
  async add39(data?: any): Promise<ApiResponse> {
    return this.client.post(`/coursePlatformLog`, data)
  }

  /**
   * 导出
   * @path POST /coursePlatformLog/export
   */
  async export38(params?: {zhsCoursePlatformLog: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/coursePlatformLog/export`, data)
  }

  /**
   * 详情
   * @path GET /coursePlatformLog/{id}
   */
  async getInfo40(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/coursePlatformLog/${id}`)
  }

  /**
   * 列表
   * @path GET /coursePlatformLog/list
   */
  async list38(params?: {zhsCoursePlatformLog: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/coursePlatformLog/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /coursePlatformLog/{ids}
   */
  async remove39(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/coursePlatformLog/${ids}`)
  }

  // ========================================
  // 课程价格管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /coursePay
   */
  async edit40(data?: any): Promise<ApiResponse> {
    return this.client.put(`/coursePay`, data)
  }

  /**
   * 新增
   * @path POST /coursePay
   */
  async add40(data?: any): Promise<ApiResponse> {
    return this.client.post(`/coursePay`, data)
  }

  /**
   * 导出
   * @path POST /coursePay/export
   */
  async export40(params?: {zhsCoursePay: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/coursePay/export`, data)
  }

  /**
   * 详情
   * @path GET /coursePay/{uuid}
   */
  async getInfo42(uuid: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/coursePay/${uuid}`)
  }

  /**
   * 列表
   * @path GET /coursePay/list
   */
  async list40(params?: {zhsCoursePay: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/coursePay/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /coursePay/{uuids}
   */
  async remove41(uuids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/coursePay/${uuids}`)
  }

  // ========================================
  // 用户购买课程记录管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /coursePayLog
   */
  async edit41(data?: any): Promise<ApiResponse> {
    return this.client.put(`/coursePayLog`, data)
  }

  /**
   * 新增
   * @path POST /coursePayLog
   */
  async add41(data?: any): Promise<ApiResponse> {
    return this.client.post(`/coursePayLog`, data)
  }

  /**
   * 导出
   * @path POST /coursePayLog/export
   */
  async export39(params?: {zhsCoursePayLog: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/coursePayLog/export`, data)
  }

  /**
   * 详情
   * @path GET /coursePayLog/{id}
   */
  async getInfo41(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/coursePayLog/${id}`)
  }

  /**
   * 列表
   * @path GET /coursePayLog/list
   */
  async list39(params?: {zhsCoursePayLog: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/coursePayLog/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /coursePayLog/{ids}
   */
  async remove40(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/coursePayLog/${ids}`)
  }

  // ========================================
  // 课程审批管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /courseAudit
   */
  async edit42(data?: any): Promise<ApiResponse> {
    return this.client.put(`/courseAudit`, data)
  }

  /**
   * 新增
   * @path POST /courseAudit
   */
  async add42(data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseAudit`, data)
  }

  /**
   * 导出
   * @path POST /courseAudit/export
   */
  async export41(params?: {zhsCourseAudit: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseAudit/export`, data)
  }

  /**
   * 审批状态
   * @path POST /courseAudit/audit
   */
  async auditStatus(data?: any): Promise<ApiResponse> {
    return this.client.post(`/courseAudit/audit`, data)
  }

  /**
   * 详情
   * @path GET /courseAudit/{id}
   */
  async getInfo43(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courseAudit/${id}`)
  }

  /**
   * 列表
   * @path GET /courseAudit/list
   */
  async list41(params?: {zhsCourseAudit: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/courseAudit/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /courseAudit/{ids}
   */
  async remove42(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/courseAudit/${ids}`)
  }

  // ========================================
  // 智能体类型关联管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /category_link
   */
  async edit43(data?: any): Promise<ApiResponse> {
    return this.client.put(`/category_link`, data)
  }

  /**
   * 新增
   * @path POST /category_link
   */
  async add43(data?: any): Promise<ApiResponse> {
    return this.client.post(`/category_link`, data)
  }

  /**
   * 导出
   * @path POST /category_link/export
   */
  async export43(params?: {agentCategoryLink: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/category_link/export`, data)
  }

  /**
   * 详情
   * @path GET /category_link/{id}
   */
  async getInfo45(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/category_link/${id}`)
  }

  /**
   * 列表
   * @path GET /category_link/list
   */
  async list43(params?: {agentCategoryLink: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/category_link/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /category_link/{ids}
   */
  async remove44(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/category_link/${ids}`)
  }

  // ========================================
  // 智能体类型管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /category
   */
  async edit44(data?: any): Promise<ApiResponse> {
    return this.client.put(`/category`, data)
  }

  /**
   * 新增
   * @path POST /category
   */
  async add44(data?: any): Promise<ApiResponse> {
    return this.client.post(`/category`, data)
  }

  /**
   * 导出
   * @path POST /category/export
   */
  async export45(params?: {agentCategory: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/category/export`, data)
  }

  /**
   * 详情
   * @path GET /category/{id}
   */
  async getInfo47(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/category/${id}`)
  }

  /**
   * 列表
   * @path GET /category/list
   */
  async list45(params?: {agentCategory: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/category/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /category/{ids}
   */
  async remove46(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/category/${ids}`)
  }

  // ========================================
  // 赛道字典管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /categoryDictionary
   */
  async edit45(data?: any): Promise<ApiResponse> {
    return this.client.put(`/categoryDictionary`, data)
  }

  /**
   * 新增
   * @path POST /categoryDictionary
   */
  async add45(data?: any): Promise<ApiResponse> {
    return this.client.post(`/categoryDictionary`, data)
  }

  /**
   * 导出
   * @path POST /categoryDictionary/export
   */
  async export44(params?: {zhsCategoryDictionary: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/categoryDictionary/export`, data)
  }

  /**
   * 详情
   * @path GET /categoryDictionary/{id}
   */
  async getInfo46(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/categoryDictionary/${id}`)
  }

  /**
   * 列表
   * @path GET /categoryDictionary/list
   */
  async list44(params?: {zhsCategoryDictionary: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/categoryDictionary/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /categoryDictionary/{ids}
   */
  async remove45(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/categoryDictionary/${ids}`)
  }

  // ========================================
  // zhs-banner-carousel-controller
  // ========================================
  
  /**
   * PUT /carousel
   * @path PUT /carousel
   */
  async edit46(data?: any): Promise<ApiResponse> {
    return this.client.put(`/carousel`, data)
  }

  /**
   * POST /carousel
   * @path POST /carousel
   */
  async add46(data?: any): Promise<ApiResponse> {
    return this.client.post(`/carousel`, data)
  }

  /**
   * POST /carousel/export
   * @path POST /carousel/export
   */
  async export46(params?: {zhsBannerCarousel: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/carousel/export`, data)
  }

  /**
   * GET /carousel/{id}
   * @path GET /carousel/{id}
   */
  async getInfo48(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/carousel/${id}`)
  }

  /**
   * GET /carousel/list
   * @path GET /carousel/list
   */
  async list46(params?: {zhsBannerCarousel: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/carousel/list`, { params })
  }

  /**
   * DELETE /carousel/{ids}
   * @path DELETE /carousel/{ids}
   */
  async remove47(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/carousel/${ids}`)
  }

  // ========================================
  // vip等级Controller)
  // ========================================
  
  /**
   * PUT /auth_vip_level
   * @path PUT /auth_vip_level
   */
  async edit47(data?: any): Promise<ApiResponse> {
    return this.client.put(`/auth_vip_level`, data)
  }

  /**
   * POST /auth_vip_level
   * @path POST /auth_vip_level
   */
  async add47(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_vip_level`, data)
  }

  /**
   * POST /auth_vip_level/export
   * @path POST /auth_vip_level/export
   */
  async export47(params?: {zhsVipLevel: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_vip_level/export`, data)
  }

  /**
   * GET /auth_vip_level/{id}
   * @path GET /auth_vip_level/{id}
   */
  async getInfo49(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_vip_level/${id}`)
  }

  /**
   * GET /auth_vip_level/list
   * @path GET /auth_vip_level/list
   */
  async list47(params?: {zhsVipLevel: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_vip_level/list`, { params })
  }

  /**
   * DELETE /auth_vip_level/{ids}
   * @path DELETE /auth_vip_level/{ids}
   */
  async remove48(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/auth_vip_level/${ids}`)
  }

  // ========================================
  // 验证码记录Controller)
  // ========================================
  
  /**
   * PUT /auth_veri_codes
   * @path PUT /auth_veri_codes
   */
  async edit48(data?: any): Promise<ApiResponse> {
    return this.client.put(`/auth_veri_codes`, data)
  }

  /**
   * POST /auth_veri_codes
   * @path POST /auth_veri_codes
   */
  async add48(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_veri_codes`, data)
  }

  /**
   * POST /auth_veri_codes/export
   * @path POST /auth_veri_codes/export
   */
  async export48(params?: {verificationCodes: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_veri_codes/export`, data)
  }

  /**
   * GET /auth_veri_codes/{id}
   * @path GET /auth_veri_codes/{id}
   */
  async getInfo50(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_veri_codes/${id}`)
  }

  /**
   * GET /auth_veri_codes/list
   * @path GET /auth_veri_codes/list
   */
  async list48(params?: {verificationCodes: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_veri_codes/list`, { params })
  }

  /**
   * DELETE /auth_veri_codes/{ids}
   * @path DELETE /auth_veri_codes/{ids}
   */
  async remove49(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/auth_veri_codes/${ids}`)
  }

  // ========================================
  // 用户VIP进度Controller)
  // ========================================
  
  /**
   * PUT /auth_user_vip
   * @path PUT /auth_user_vip
   */
  async edit49(data?: any): Promise<ApiResponse> {
    return this.client.put(`/auth_user_vip`, data)
  }

  /**
   * POST /auth_user_vip
   * @path POST /auth_user_vip
   */
  async add49(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_user_vip`, data)
  }

  /**
   * POST /auth_user_vip/export
   * @path POST /auth_user_vip/export
   */
  async export49(params?: {zhsUserVip: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_user_vip/export`, data)
  }

  /**
   * GET /auth_user_vip/{id}
   * @path GET /auth_user_vip/{id}
   */
  async getInfo51(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_user_vip/${id}`)
  }

  /**
   * GET /auth_user_vip/list
   * @path GET /auth_user_vip/list
   */
  async list49(params?: {zhsUserVip: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_user_vip/list`, { params })
  }

  /**
   * DELETE /auth_user_vip/{ids}
   * @path DELETE /auth_user_vip/{ids}
   */
  async remove50(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/auth_user_vip/${ids}`)
  }

  // ========================================
  // 用户令牌Controller)
  // ========================================
  
  /**
   * PUT /auth_tokens
   * @path PUT /auth_tokens
   */
  async edit50(data?: any): Promise<ApiResponse> {
    return this.client.put(`/auth_tokens`, data)
  }

  /**
   * POST /auth_tokens
   * @path POST /auth_tokens
   */
  async add50(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_tokens`, data)
  }

  /**
   * POST /auth_tokens/export
   * @path POST /auth_tokens/export
   */
  async export50(params?: {userTokens: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_tokens/export`, data)
  }

  /**
   * GET /auth_tokens/{id}
   * @path GET /auth_tokens/{id}
   */
  async getInfo52(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_tokens/${id}`)
  }

  /**
   * GET /auth_tokens/list
   * @path GET /auth_tokens/list
   */
  async list50(params?: {userTokens: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_tokens/list`, { params })
  }

  /**
   * DELETE /auth_tokens/{ids}
   * @path DELETE /auth_tokens/{ids}
   */
  async remove51(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/auth_tokens/${ids}`)
  }

  // ========================================
  // 短信验证模板对应关系Controller
  // ========================================
  
  /**
   * PUT /auth_sms_temp
   * @path PUT /auth_sms_temp
   */
  async edit51(data?: any): Promise<ApiResponse> {
    return this.client.put(`/auth_sms_temp`, data)
  }

  /**
   * POST /auth_sms_temp
   * @path POST /auth_sms_temp
   */
  async add51(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_sms_temp`, data)
  }

  /**
   * POST /auth_sms_temp/export
   * @path POST /auth_sms_temp/export
   */
  async export51(params?: {smsTemp: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_sms_temp/export`, data)
  }

  /**
   * GET /auth_sms_temp/{id}
   * @path GET /auth_sms_temp/{id}
   */
  async getInfo53(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_sms_temp/${id}`)
  }

  /**
   * GET /auth_sms_temp/list
   * @path GET /auth_sms_temp/list
   */
  async list51(params?: {smsTemp: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_sms_temp/list`, { params })
  }

  /**
   * DELETE /auth_sms_temp/{ids}
   * @path DELETE /auth_sms_temp/{ids}
   */
  async remove52(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/auth_sms_temp/${ids}`)
  }

  // ========================================
  // 用户认证身份信息Controller
  // ========================================
  
  /**
   * PUT /auth_info
   * @path PUT /auth_info
   */
  async edit52(data?: any): Promise<ApiResponse> {
    return this.client.put(`/auth_info`, data)
  }

  /**
   * POST /auth_info
   * @path POST /auth_info
   */
  async add52(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_info`, data)
  }

  /**
   * POST /auth_info/export
   * @path POST /auth_info/export
   */
  async export52(params?: {userAuthInfo: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_info/export`, data)
  }

  /**
   * GET /auth_info/{id}
   * @path GET /auth_info/{id}
   */
  async getInfo54(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_info/${id}`)
  }

  /**
   * GET /auth_info/list
   * @path GET /auth_info/list
   */
  async list52(params?: {userAuthInfo: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_info/list`, { params })
  }

  /**
   * DELETE /auth_info/{ids}
   * @path DELETE /auth_info/{ids}
   */
  async remove53(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/auth_info/${ids}`)
  }

  // ========================================
  // 用户资金账户Controller
  // ========================================
  
  /**
   * PUT /auth_find_info
   * @path PUT /auth_find_info
   */
  async edit53(data?: any): Promise<ApiResponse> {
    return this.client.put(`/auth_find_info`, data)
  }

  /**
   * POST /auth_find_info
   * @path POST /auth_find_info
   */
  async add53(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_find_info`, data)
  }

  /**
   * POST /auth_find_info/export
   * @path POST /auth_find_info/export
   */
  async export53(params?: {userFundInfo: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_find_info/export`, data)
  }

  /**
   * GET /auth_find_info/{id}
   * @path GET /auth_find_info/{id}
   */
  async getInfo55(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_find_info/${id}`)
  }

  /**
   * GET /auth_find_info/list
   * @path GET /auth_find_info/list
   */
  async list53(params?: {userFundInfo: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_find_info/list`, { params })
  }

  /**
   * DELETE /auth_find_info/{ids}
   * @path DELETE /auth_find_info/{ids}
   */
  async remove54(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/auth_find_info/${ids}`)
  }

  // ========================================
  // 第三方账号关联Controller)
  // ========================================
  
  /**
   * PUT /auth_accounts
   * @path PUT /auth_accounts
   */
  async edit54(data?: any): Promise<ApiResponse> {
    return this.client.put(`/auth_accounts`, data)
  }

  /**
   * POST /auth_accounts
   * @path POST /auth_accounts
   */
  async add54(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_accounts`, data)
  }

  /**
   * POST /auth_accounts/export
   * @path POST /auth_accounts/export
   */
  async export54(params?: {userThirdPartyAccounts: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_accounts/export`, data)
  }

  /**
   * POST /auth_accounts/bind
   * @path POST /auth_accounts/bind
   */
  async bind(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth_accounts/bind`, data)
  }

  /**
   * GET /auth_accounts/{id}
   * @path GET /auth_accounts/{id}
   */
  async getInfo56(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_accounts/${id}`)
  }

  /**
   * GET /auth_accounts/list
   * @path GET /auth_accounts/list
   */
  async list54(params?: {userThirdPartyAccounts: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/auth_accounts/list`, { params })
  }

  /**
   * DELETE /auth_accounts/{ids}
   * @path DELETE /auth_accounts/{ids}
   */
  async remove55(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/auth_accounts/${ids}`)
  }

  // ========================================
  // App版本管理管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /appVersion
   */
  async edit55(data?: any): Promise<ApiResponse> {
    return this.client.put(`/appVersion`, data)
  }

  /**
   * 新增
   * @path POST /appVersion
   */
  async add55(data?: any): Promise<ApiResponse> {
    return this.client.post(`/appVersion`, data)
  }

  /**
   * 导出
   * @path POST /appVersion/export
   */
  async export55(params?: {appVersion: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/appVersion/export`, data)
  }

  /**
   * 详情
   * @path GET /appVersion/{id}
   */
  async getInfo57(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/appVersion/${id}`)
  }

  /**
   * 列表
   * @path GET /appVersion/list
   */
  async list55(params?: {appVersion: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/appVersion/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /appVersion/{ids}
   */
  async remove56(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/appVersion/${ids}`)
  }

  // ========================================
  // 智能体列表管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agents
   */
  async edit56(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agents`, data)
  }

  /**
   * 新增
   * @path POST /agents
   */
  async add56(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agents`, data)
  }

  /**
   * 修改智能体标签
   * @path PUT /agents/label/edit
   */
  async editLabel(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agents/label/edit`, data)
  }

  /**
   * 导出
   * @path POST /agents/export
   */
  async export56(params?: {agents: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agents/export`, data)
  }

  /**
   * 修改状态
   * @path POST /agents/edit/status
   */
  async editStatus(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agents/edit/status`, data)
  }

  /**
   * 详情
   * @path GET /agents/{agentId}
   */
  async getInfo58(agentId: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agents/${agentId}`)
  }

  /**
   * 列表
   * @path GET /agents/list
   */
  async list56(params?: {agents: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agents/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agents/{agentIds}
   */
  async remove57(agentIds: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agents/${agentIds}`)
  }

  // ========================================
  // 提现明细管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agentWithdrawalDetail
   */
  async edit57(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentWithdrawalDetail`, data)
  }

  /**
   * 新增
   * @path POST /agentWithdrawalDetail
   */
  async add57(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentWithdrawalDetail`, data)
  }

  /**
   * PUT /agentWithdrawalDetail/handle
   * @path PUT /agentWithdrawalDetail/handle
   */
  async handleReview(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentWithdrawalDetail/handle`, data)
  }

  /**
   * 导出
   * @path POST /agentWithdrawalDetail/export
   */
  async export57(params?: {zhsAgentWithdrawalDetail: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentWithdrawalDetail/export`, data)
  }

  /**
   * 详情
   * @path GET /agentWithdrawalDetail/{id}
   */
  async getInfo59(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentWithdrawalDetail/${id}`)
  }

  /**
   * GET /agentWithdrawalDetail/withdraw
   * @path GET /agentWithdrawalDetail/withdraw
   */
  async withdraw(params?: {openId: any,amount: any,outBillNo: any,userName: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentWithdrawalDetail/withdraw`, { params })
  }

  /**
   * 购买智能体期号列表
   * @path GET /agentWithdrawalDetail/settlement
   */
  async settlementList(params?: {agentSettlement: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentWithdrawalDetail/settlement`, { params })
  }

  /**
   * 列表
   * @path GET /agentWithdrawalDetail/list
   */
  async list57(params?: {zhsAgentWithdrawalDetail: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentWithdrawalDetail/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agentWithdrawalDetail/{ids}
   */
  async remove58(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agentWithdrawalDetail/${ids}`)
  }

  // ========================================
  // 智能体使用记录管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agentUseDetail
   */
  async edit58(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentUseDetail`, data)
  }

  /**
   * 新增
   * @path POST /agentUseDetail
   */
  async add58(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentUseDetail`, data)
  }

  /**
   * 导出
   * @path POST /agentUseDetail/export
   */
  async export58(params?: {zhsAgentUsedetail: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentUseDetail/export`, data)
  }

  /**
   * 详情
   * @path GET /agentUseDetail/{id}
   */
  async getInfo60(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentUseDetail/${id}`)
  }

  /**
   * 列表
   * @path GET /agentUseDetail/list
   */
  async list58(params?: {zhsAgentUsedetail: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentUseDetail/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agentUseDetail/{ids}
   */
  async remove59(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agentUseDetail/${ids}`)
  }

  // ========================================
  // 智能体需求任务管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agentTask
   */
  async edit59(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentTask`, data)
  }

  /**
   * 新增
   * @path POST /agentTask
   */
  async add59(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentTask`, data)
  }

  /**
   * 添加接单人
   * @path POST /agentTask/set/developer
   */
  async setDeveloper(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentTask/set/developer`, data)
  }

  /**
   * 导出
   * @path POST /agentTask/export
   */
  async export59(params?: {agentNeedTask: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentTask/export`, data)
  }

  /**
   * 流转接单人
   * @path POST /agentTask/circulate/developer
   */
  async circulateDeveloper(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentTask/circulate/developer`, data)
  }

  /**
   * 详情
   * @path GET /agentTask/{id}
   */
  async getInfo61(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentTask/${id}`)
  }

  /**
   * 列表
   * @path GET /agentTask/list
   */
  async list59(params?: {agentNeedTask: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentTask/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agentTask/{ids}
   */
  async remove60(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agentTask/${ids}`)
  }

  // ========================================
  // 开发者结算单管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agentSettlement
   */
  async edit60(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentSettlement`, data)
  }

  /**
   * 新增
   * @path POST /agentSettlement
   */
  async add60(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentSettlement`, data)
  }

  /**
   * 导出
   * @path POST /agentSettlement/export
   */
  async export60(params?: {zhsAgentSettlement: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentSettlement/export`, data)
  }

  /**
   * 详情
   * @path GET /agentSettlement/{id}
   */
  async getInfo62(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentSettlement/${id}`)
  }

  /**
   * 列表
   * @path GET /agentSettlement/list
   */
  async list60(params?: {zhsAgentSettlement: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentSettlement/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agentSettlement/{ids}
   */
  async remove61(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agentSettlement/${ids}`)
  }

  // ========================================
  // 智能体自定义筛选规则管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agentRule
   */
  async edit61(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentRule`, data)
  }

  /**
   * 新增
   * @path POST /agentRule
   */
  async add61(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentRule`, data)
  }

  /**
   * 导出
   * @path POST /agentRule/export
   */
  async export62(params?: {agentRule: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentRule/export`, data)
  }

  /**
   * 详情
   * @path GET /agentRule/{id}
   */
  async getInfo64(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentRule/${id}`)
  }

  /**
   * 列表
   * @path GET /agentRule/list
   */
  async list62(params?: {agentRule: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentRule/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agentRule/{ids}
   */
  async remove63(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agentRule/${ids}`)
  }

  // ========================================
  // 智能体自定义检索规则字段管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agentRuleParam
   */
  async edit62(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentRuleParam`, data)
  }

  /**
   * 新增
   * @path POST /agentRuleParam
   */
  async add62(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentRuleParam`, data)
  }

  /**
   * 导出
   * @path POST /agentRuleParam/export
   */
  async export61(params?: {agentRuleParam: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentRuleParam/export`, data)
  }

  /**
   * 详情
   * @path GET /agentRuleParam/{id}
   */
  async getInfo63(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentRuleParam/${id}`)
  }

  /**
   * 列表
   * @path GET /agentRuleParam/list
   */
  async list61(params?: {agentRuleParam: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentRuleParam/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agentRuleParam/{ids}
   */
  async remove62(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agentRuleParam/${ids}`)
  }

  // ========================================
  // 开发者智能体收费配置管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agentCategory
   */
  async edit63(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentCategory`, data)
  }

  /**
   * 新增
   * @path POST /agentCategory
   */
  async add63(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentCategory`, data)
  }

  /**
   * 导出
   * @path POST /agentCategory/export
   */
  async export63(params?: {zhsAgentCategory: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentCategory/export`, data)
  }

  /**
   * 详情
   * @path GET /agentCategory/{id}
   */
  async getInfo65(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentCategory/${id}`)
  }

  /**
   * 列表
   * @path GET /agentCategory/list
   */
  async list63(params?: {zhsAgentCategory: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentCategory/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agentCategory/{ids}
   */
  async remove64(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agentCategory/${ids}`)
  }

  // ========================================
  // 用户支付购买智能体记录管理
  // ========================================
  
  /**
   * 修改
   * @path PUT /agentBuy
   */
  async edit64(data?: any): Promise<ApiResponse> {
    return this.client.put(`/agentBuy`, data)
  }

  /**
   * 新增
   * @path POST /agentBuy
   */
  async add64(data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentBuy`, data)
  }

  /**
   * 导出
   * @path POST /agentBuy/export
   */
  async export64(params?: {zhsAgentBuy: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/agentBuy/export`, data)
  }

  /**
   * 详情
   * @path GET /agentBuy/{id}
   */
  async getInfo66(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentBuy/${id}`)
  }

  /**
   * 列表
   * @path GET /agentBuy/list
   */
  async list64(params?: {zhsAgentBuy: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/agentBuy/list`, { params })
  }

  /**
   * 删除
   * @path DELETE /agentBuy/{ids}
   */
  async remove65(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/agentBuy/${ids}`)
  }

  // ========================================
  // zhs-advertise-controller
  // ========================================
  
  /**
   * PUT /advertise
   * @path PUT /advertise
   */
  async edit65(data?: any): Promise<ApiResponse> {
    return this.client.put(`/advertise`, data)
  }

  /**
   * POST /advertise
   * @path POST /advertise
   */
  async add65(data?: any): Promise<ApiResponse> {
    return this.client.post(`/advertise`, data)
  }

  /**
   * POST /advertise/export
   * @path POST /advertise/export
   */
  async export65(params?: {zhsAdvertise: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/advertise/export`, data)
  }

  /**
   * GET /advertise/{id}
   * @path GET /advertise/{id}
   */
  async getInfo67(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/advertise/${id}`)
  }

  /**
   * GET /advertise/list
   * @path GET /advertise/list
   */
  async list65(params?: {zhsAdvertise: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/advertise/list`, { params })
  }

  /**
   * DELETE /advertise/{ids}
   * @path DELETE /advertise/{ids}
   */
  async remove66(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/advertise/${ids}`)
  }

  // ========================================
  // zhs-withdrawal-detail-controller
  // ========================================
  
  /**
   * PUT /Withdrawaldetail
   * @path PUT /Withdrawaldetail
   */
  async handleReview1(data?: any): Promise<ApiResponse> {
    return this.client.put(`/Withdrawaldetail`, data)
  }

  /**
   * POST /Withdrawaldetail
   * @path POST /Withdrawaldetail
   */
  async add66(data?: any): Promise<ApiResponse> {
    return this.client.post(`/Withdrawaldetail`, data)
  }

  /**
   * POST /Withdrawaldetail/export
   * @path POST /Withdrawaldetail/export
   */
  async export66(params?: {zhsWithdrawalDetail: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/Withdrawaldetail/export`, data)
  }

  /**
   * GET /Withdrawaldetail/{Id}
   * @path GET /Withdrawaldetail/{Id}
   */
  async getInfo68(Id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/Withdrawaldetail/${Id}`)
  }

  /**
   * GET /Withdrawaldetail/withdraw
   * @path GET /Withdrawaldetail/withdraw
   */
  async withdraw1(params?: {openId: any,amount: any,outBillNo: any,userName: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/Withdrawaldetail/withdraw`, { params })
  }

  /**
   * GET /Withdrawaldetail/list
   * @path GET /Withdrawaldetail/list
   */
  async list66(params?: {zhsWithdrawalDetail: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/Withdrawaldetail/list`, { params })
  }

  // ========================================
  // user-margin-controller
  // ========================================
  
  /**
   * PUT /AuthuserMargin
   * @path PUT /AuthuserMargin
   */
  async edit66(data?: any): Promise<ApiResponse> {
    return this.client.put(`/AuthuserMargin`, data)
  }

  /**
   * POST /AuthuserMargin
   * @path POST /AuthuserMargin
   */
  async add67(data?: any): Promise<ApiResponse> {
    return this.client.post(`/AuthuserMargin`, data)
  }

  /**
   * POST /AuthuserMargin/export
   * @path POST /AuthuserMargin/export
   */
  async export67(params?: {userMargin: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/AuthuserMargin/export`, data)
  }

  /**
   * GET /AuthuserMargin/{id}
   * @path GET /AuthuserMargin/{id}
   */
  async getInfo69(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/AuthuserMargin/${id}`)
  }

  /**
   * GET /AuthuserMargin/list
   * @path GET /AuthuserMargin/list
   */
  async list67(params?: {userMargin: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/AuthuserMargin/list`, { params })
  }

  /**
   * DELETE /AuthuserMargin/{ids}
   * @path DELETE /AuthuserMargin/{ids}
   */
  async remove67(ids: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.delete(`/AuthuserMargin/${ids}`)
  }

  // ========================================
  // 第三方设备请求方法
  // ========================================
  
  /**
   * POST /remote/uploadBusinessCard
   * @path POST /remote/uploadBusinessCard
   */
  async uploadBusinessCard(data?: any): Promise<ApiResponse> {
    return this.client.post(`/remote/uploadBusinessCard`, data)
  }

  /**
   * POST /remote/myTeam/{uuid}
   * @path POST /remote/myTeam/{uuid}
   */
  async getMyTeam(uuid: string | number, data?: any): Promise<ApiResponse> {
    return this.client.post(`/remote/myTeam/${uuid}`, data)
  }

  /**
   * POST /remote/get/tencent/sentence
   * @path POST /remote/get/tencent/sentence
   */
  async get(data?: any): Promise<ApiResponse> {
    return this.client.post(`/remote/get/tencent/sentence`, data)
  }

  /**
   * GET /remote/role
   * @path GET /remote/role
   */
  async getRole(_data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/role`)
  }

  /**
   * GET /remote/info/{uuid}
   * @path GET /remote/info/{uuid}
   */
  async getInfo20(uuid: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/info/${uuid}`)
  }

  /**
   * GET /remote/get/true
   * @path GET /remote/get/true
   */
  async getTrue(_data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/get/true`)
  }

  /**
   * GET /remote/agent/category
   * @path GET /remote/agent/category
   */
  async agentCategory(params?: {type:any | undefined}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/agent/category`, { params })
  }

  /**
   * GET /remote/agent/category2
   * @path GET /remote/agent/category2
   */
  async agentCategory2(params?: {type:any | undefined}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/agent/category2`, { params })
  }

  /**
   * GET /remote/agent/by/type
   * @path GET /remote/agent/by/type
   */
  async agentLists(params?: {search:any | undefined,code:any | undefined}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/agent/by/type`, { params })
  }

  /**
   * GET /remote/agent/by/pay
   * @path GET /remote/agent/by/pay
   */
  async agentListsByPay(params?: {uuid: any,search:any | undefined,type:any | undefined,date:any | undefined}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/agent/by/pay`, { params })
  }

  /**
   * GET /remote/agent/by/collect/{uuid}
   * @path GET /remote/agent/by/collect/{uuid}
   */
  async agentListsByCollect(uuid: string | number, params?: {search:any | undefined}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/agent/by/collect/${uuid}`, { params })
  }

  // ========================================
  // 第三方设备请求方法-智能体任务相关
  // ========================================
  
  /**
   * POST /remote/agent/task/send/message/approve
   * @path POST /remote/agent/task/send/message/approve
   */
  async approve1(data?: any): Promise<ApiResponse> {
    return this.client.post(`/remote/agent/task/send/message/approve`, data)
  }

  /**
   * POST /remote/agent/task/need/task/add
   * @path POST /remote/agent/task/need/task/add
   */
  async addNeedTask(data?: any): Promise<ApiResponse> {
    return this.client.post(`/remote/agent/task/need/task/add`, data)
  }

  /**
   * GET /remote/agent/task/need/task
   * @path GET /remote/agent/task/need/task
   */
  async needTaskList(params?: {task: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/agent/task/need/task`, { params })
  }

  /**
   * GET /remote/agent/task/need/task/{id}
   * @path GET /remote/agent/task/need/task/{id}
   */
  async needTask(id: string | number, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/remote/agent/task/need/task/${id}`)
  }

  // ========================================
  // 第三方：微信登录相关
  // ========================================
  
  /**
   * POST /login/wechat/getPhoneNumber
   * @path POST /login/wechat/getPhoneNumber
   */
  async getPhoneNumber(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/wechat/getPhoneNumber`, data)
  }

  /**
   * POST /login/wechat/getOpenId
   * @path POST /login/wechat/getOpenId
   */
  async getOpenId(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/wechat/getOpenId`, data)
  }

  /**
   * GET /login/wechat/pc/wxCode
   * @path GET /login/wechat/pc/wxCode
   */
  async pcWxCode(params?: {code: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/login/wechat/pc/wxCode`, { params })
  }

  // ========================================
  // 账号登录
  // ========================================
  
  /**
   * POST /login/pwd/verify
   * @path POST /login/pwd/verify
   */
  async verify(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/verify`, data)
  }

  /**
   * POST /login/pwd/third/wx/login
   * @path POST /login/pwd/third/wx/login
   */
  async thirdWxLogin(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/third/wx/login`, data)
  }

  /**
   * POST /login/pwd/smsVerify
   * @path POST /login/pwd/smsVerify
   */
  async smsVerify(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/smsVerify`, data)
  }

  /**
   * POST /login/pwd/send/batch/sms
   * @path POST /login/pwd/send/batch/sms
   */
  async sendBatchSms(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/send/batch/sms`, data)
  }

  /**
   * POST /login/pwd/replace/phone
   * @path POST /login/pwd/replace/phone
   */
  async replacePhone(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/replace/phone`, data)
  }

  /**
   * POST /login/pwd/registerLogin
   * @path POST /login/pwd/registerLogin
   */
  async registerLogin(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/registerLogin`, data)
  }

  /**
   * POST /login/pwd/refreshToken
   * @path POST /login/pwd/refreshToken
   */
  async refreshToken(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/refreshToken`, data)
  }

  /**
   * POST /login/pwd/login
   * @path POST /login/pwd/login
   */
  async login(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/login`, data)
  }

  /**
   * POST /login/pwd/editPasswd
   * @path POST /login/pwd/editPasswd
   */
  async editPasswd(data?: any): Promise<ApiResponse> {
    return this.client.post(`/login/pwd/editPasswd`, data)
  }

  // ========================================
  // 资金相关
  // ========================================
  
  /**
   * POST /fund/useToken
   * @path POST /fund/useToken
   */
  async useToken(data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/useToken`, data)
  }

  /**
   * POST /fund/notify
   * @path POST /fund/notify
   */
  async notify(data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/notify`, data)
  }

  /**
   * POST /fund/file/to/stream
   * @path POST /fund/file/to/stream
   */
  async fileToStream(data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/file/to/stream`, data)
  }

  /**
   * POST /fund/file/to/stream2
   * @path POST /fund/file/to/stream2
   */
  async fileToStream2(params?: {file: any}, data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/file/to/stream2`, data)
  }

  /**
   * POST /fund/app/notify
   * @path POST /fund/app/notify
   */
  async appNotify(data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/app/notify`, data)
  }

  /**
   * POST /fund/agent/transfer/notify
   * @path POST /fund/agent/transfer/notify
   */
  async transferAccountsNotify(data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/agent/transfer/notify`, data)
  }

  /**
   * GET /fund/getStatistics
   * @path GET /fund/getStatistics
   */
  async getStatistics(params?: {param: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/fund/getStatistics`, { params })
  }

  /**
   * GET /fund/getProduct
   * @path GET /fund/getProduct
   */
  async getProduct(_data?: any): Promise<ApiResponse> {
    return this.client.get(`/fund/getProduct`)
  }

  /**
   * GET /fund/getInfo
   * @path GET /fund/getInfo
   */
  async getInfo28(params?: {token: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/fund/getInfo`, { params })
  }

  // ========================================
  // ali支付)
  // ========================================
  
  /**
   * 发起支付宝支付
   * @path POST /fund/ali/pay/create
   */
  async createPay(data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/ali/pay/create`, data)
  }

  /**
   * 发起支付宝支付
   * @path POST /fund/ali/pay/create2
   */
  async createPay2(data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/ali/pay/create2`, data)
  }

  /**
   * POST /fund/ali/pay/alipay/notify
   * @path POST /fund/ali/pay/alipay/notify
   */
  async alipayNotify(data?: any): Promise<ApiResponse> {
    return this.client.post(`/fund/ali/pay/alipay/notify`, data)
  }

  /**
   * GET /fund/ali/pay/success
   * @path GET /fund/ali/pay/success
   */
  async paySuccess(params?: {orderNo: any}, _data?: any): Promise<ApiResponse> {
    return this.client.get(`/fund/ali/pay/success`, { params })
  }

  /**
   * GET /fund/ali/pay/fail
   * @path GET /fund/ali/pay/fail
   */
  async payFail(_data?: any): Promise<ApiResponse> {
    return this.client.get(`/fund/ali/pay/fail`)
  }

  /**
   * GET /fund/ali/pay/alipay/return
   * @path GET /fund/ali/pay/alipay/return
   */
  async alipayReturn(_data?: any): Promise<ApiResponse> {
    return this.client.get(`/fund/ali/pay/alipay/return`)
  }

  // ========================================
  // 真实身份认证)
  // ========================================
  
  /**
   * POST /auth/user
   * @path POST /auth/user
   */
  async authUser(data?: any): Promise<ApiResponse> {
    return this.client.post(`/auth/user`, data)
  }

}

// 导出默认实例
export const apiClient = new APIClient({
  baseURL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/ai-program',
})

// 导出类以便创建自定义实例
export default APIClient
