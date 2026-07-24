import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData } from '../utils'

export interface AdminUser {
  id: string
  username: string
  nickname: string
  avatar: string | null
  email: string | null
  phone: string | null
  status: string
  role: string
  vipLevel: number
  balance: number
  createdAt: string
  lastLoginAt: string | null
}

export interface AdminRole {
  id: string
  name: string
  code: string
  description: string | null
  permissions: string[]
  userCount: number
  createdAt: string
}

export interface AdminOrder {
  id: string
  orderNo: string
  userId: string
  userNickname: string
  type: string
  targetTitle: string
  amount: number
  payAmount: number
  status: string
  payMethod: string | null
  createdAt: string
  paidAt: string | null
}

export interface AdminProduct {
  id: string
  name: string
  type: string
  price: number
  originalPrice: number | null
  stock: number
  sales: number
  status: string
  cover: string | null
  description: string
  createdAt: string
}

export interface AdminStatistics {
  userCount: number
  newUserToday: number
  orderCount: number
  revenueToday: number
  revenueTotal: number
  activeUserToday: number
  courseCount: number
  liveCount: number
}

export interface AdminLog {
  id: string
  userId: string
  userNickname: string
  action: string
  resource: string
  resourceId: string | null
  ip: string | null
  userAgent: string | null
  detail: string | null
  createdAt: string
}

export interface AdminConfig {
  [key: string]: string | number | boolean | null
}

export type AdminUserQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  role?: string
}

export type AdminOrderQuery = {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  keyword?: string
}

export type AdminProductQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  type?: string
  status?: string
}

export async function adminGetUsers(
  query: AdminUserQuery = {},
): Promise<ApiResult<PageData<AdminUser>>> {
  return fetchApi<PageData<AdminUser>>(`/admin/usercenter/users${buildQs(query)}`)
}

export async function adminUpdateUser(
  id: string,
  input: Partial<Pick<AdminUser, 'nickname' | 'status' | 'role' | 'vipLevel' | 'balance'>>,
): Promise<ApiResult<AdminUser>> {
  return fetchApi<AdminUser>(`/admin/usercenter/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function adminDeleteUser(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/admin/usercenter/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function adminGetRoles(): Promise<ApiResult<AdminRole[]>> {
  return fetchApi<AdminRole[]>('/admin/roles')
}

export async function adminCreateRole(input: {
  name: string
  code: string
  description?: string
  permissions: string[]
}): Promise<ApiResult<AdminRole>> {
  return fetchApi<AdminRole>('/admin/roles', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adminGetOrders(
  query: AdminOrderQuery = {},
): Promise<ApiResult<PageData<AdminOrder>>> {
  return fetchApi<PageData<AdminOrder>>(`/admin/orders${buildQs(query)}`)
}

export async function adminGetProducts(
  query: AdminProductQuery = {},
): Promise<ApiResult<PageData<AdminProduct>>> {
  return fetchApi<PageData<AdminProduct>>(`/admin/products${buildQs(query)}`)
}

export async function adminCreateProduct(input: {
  name: string
  type: string
  price: number
  originalPrice?: number
  stock?: number
  cover?: string
  description?: string
}): Promise<ApiResult<AdminProduct>> {
  return fetchApi<AdminProduct>('/admin/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adminGetStatistics(
  query: { startDate?: string; endDate?: string } = {},
): Promise<ApiResult<AdminStatistics>> {
  return fetchApi<AdminStatistics>(`/admin/statistics${buildQs(query)}`)
}

export async function adminGetLogs(
  query: {
    page?: number
    pageSize?: number
    userId?: string
    action?: string
    startDate?: string
    endDate?: string
  } = {},
): Promise<ApiResult<PageData<AdminLog>>> {
  return fetchApi<PageData<AdminLog>>(`/admin/logs${buildQs(query)}`)
}

export async function adminGetConfig(): Promise<ApiResult<AdminConfig>> {
  return fetchApi<AdminConfig>('/admin/configs')
}

export async function adminUpdateConfig(input: AdminConfig): Promise<ApiResult<AdminConfig>> {
  return fetchApi<AdminConfig>('/admin/configs', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
