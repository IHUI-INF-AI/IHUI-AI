/**
 * API 密钥管理页本地 UI 状态类型。
 *
 * 契约类型(re-export 自 @ihui/types,不重复定义):
 * - ApiKeyInfo:密钥脱敏信息(不含 secret)
 * - ApiKeyPermission:权限点联合类型
 * - CreateApiKeyRequest:创建请求体
 * - ApiKeyQuotaInfo:配额信息
 */
export type {
  ApiKeyInfo,
  ApiKeyPermission,
  CreateApiKeyRequest,
  ApiKeyQuotaInfo,
} from '@ihui/types'

import type { ApiKeyInfo, ApiKeyQuotaInfo, ApiKeyPermission } from '@ihui/types'

/** 列表项附带用量信息(展开时按需加载)。 */
export interface ApiKeyWithUsage extends ApiKeyInfo {
  usage?: ApiKeyQuotaInfo
}

/** 弹窗状态机:idle / create 创建 / secret-display 展示一次性 secret / rotate 轮换确认。 */
export type DialogState = 'idle' | 'create' | 'secret-display' | 'rotate'

/** 创建表单本地状态。 */
export interface CreateFormState {
  name: string
  permissions: ApiKeyPermission[]
  rateLimit: number
}

export const EMPTY_FORM: CreateFormState = {
  name: '',
  permissions: [],
  rateLimit: 60,
}

/** 确认弹窗状态(删除/轮换前的二次确认)。 */
export interface ConfirmState {
  open: boolean
  title: string
  desc: string
  pending: boolean
  destructive: boolean
  onConfirm: () => void
}

export const IDLE_CONFIRM: ConfirmState = {
  open: false,
  title: '',
  desc: '',
  pending: false,
  destructive: false,
  onConfirm: () => {},
}
