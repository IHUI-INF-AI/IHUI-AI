/**
 * 用户 API Key（user_sk_info）接口
 * 创建：POST /ihui-ai-api/user-sk/create
 * 删除：/ihui-ai-api/user-sk/delete/{sk_id}
 * 列表：GET /ihui-ai-api/user-sk/list
 */
import request from '@/utils/request'

const PREFIX = '/ihui-ai-api/user-sk'

/** 与表 user_sk_info 对应 */
export interface UserSkItem {
  id: number
  user_uuid?: string
  key?: string
  status?: number
  type?: number
  max?: number
  desc?: string
  out_time?: string
  created_time?: string
  updated_time?: string
}

export interface UserSkListRes {
  list?: UserSkItem[]
  data?: UserSkItem[]
}

/** 密钥类型：0系统密钥 1普通密钥 2子级密钥 */
export const USER_SK_TYPE_OPTIONS = [
  { value: 0, label: '系统密钥' },
  { value: 1, label: '普通密钥' },
  { value: 2, label: '子级密钥' },
] as const

export interface UserSkCreatePayload {
  user_uuid?: string
  type?: number
  max?: number
  out_time?: string
  desc?: string
}

export interface UserSkCreateRes {
  id?: number
  key?: string
  [key: string]: unknown
}

/** 获取密钥列表 */
export function getUserSkList(): Promise<UserSkItem[]> {
  return request.get<UserSkListRes | UserSkItem[]>(`${PREFIX}/list`).then((res: unknown) => {
    const r = res as UserSkListRes & { list?: UserSkItem[]; data?: UserSkItem[] | { list?: UserSkItem[] } }
    if (Array.isArray(r)) return r as UserSkItem[]
    if (r?.list) return r.list
    const data = r?.data
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && 'list' in data) return (data as { list: UserSkItem[] }).list
    return []
  })
}

/** 创建 API Key */
export function createUserSk(payload: UserSkCreatePayload) {
  return request.post<UserSkCreateRes>(`${PREFIX}/create`, payload).then((res: unknown) => {
    const r = res as UserSkCreateRes & { data?: UserSkCreateRes }
    return (r?.data ?? r) as UserSkCreateRes
  })
}

/** 删除 API Key */
export function deleteUserSk(skId: number) {
  return request.delete<unknown>(`${PREFIX}/delete/${skId}`)
}
