import { fetchApi } from '@/lib/api'
import type { IpReputation, BlockIpRequest, BlockIpResponse, UnblockIpResponse } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchIpReputation(ip: string): Promise<IpReputation> {
  return api<IpReputation>(`/api/security/ip-reputation/${encodeURIComponent(ip)}`)
}

export async function blockIp(req: BlockIpRequest): Promise<BlockIpResponse> {
  return api<BlockIpResponse>('/api/block-ip', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function unblockIp(ip: string): Promise<UnblockIpResponse> {
  return api<UnblockIpResponse>(`/api/block-ip/${encodeURIComponent(ip)}`, { method: 'DELETE' })
}

export function scoreClass(score: number): string {
  if (score >= 80) return 'text-red-600'
  if (score >= 50) return 'text-orange-600'
  if (score >= 20) return 'text-yellow-600'
  return 'text-green-600'
}

export function scoreLabel(score: number): string {
  if (score >= 80) return '极高风险'
  if (score >= 50) return '高风险'
  if (score >= 20) return '中风险'
  return '低风险'
}

// 预设封禁时长选项(秒 + 显示名)
export const DURATION_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 3600, label: '1 小时' },
  { value: 6 * 3600, label: '6 小时' },
  { value: 24 * 3600, label: '24 小时' },
  { value: 7 * 24 * 3600, label: '7 天' },
  { value: 30 * 24 * 3600, label: '30 天' },
]
