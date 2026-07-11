/**
 * AI 能力服务（合并版）
 *
 * 合并自旧架构 services/ai-capability-*.ts 的 6 个文件：
 * - discovery / analytics / marketplace / documentation / templates / testing
 *
 * 新架构基于 fetchApi 与纯 TypeScript，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

/* ------------------------------------------------------------------ */
/* 能力发现（discovery）                                               */
/* ------------------------------------------------------------------ */

export interface AICapability {
  id: string
  name: string
  category: string
  provider: string
  description: string
  endpoint: string
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  tags: string[]
  deprecated: boolean
  version: string
  createdAt: string
  updatedAt: string
}

export interface CapabilityQuery {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  provider?: string
  tag?: string
  [key: string]: string | number | undefined | null
}

export async function discoverCapabilities(
  query: CapabilityQuery = {},
): Promise<ApiResult<PageData<AICapability>>> {
  return fetchApi<PageData<AICapability>>(`/ai/capabilities${buildQs(query)}`)
}

export async function getCapabilityById(id: string): Promise<ApiResult<AICapability>> {
  return fetchApi<AICapability>(`/ai/capabilities/${encodeURIComponent(id)}`)
}

export async function refreshCapabilityIndex(): Promise<
  ApiResult<{ refreshed: number; lastSyncAt: string }>
> {
  return fetchApi<{ refreshed: number; lastSyncAt: string }>('/ai/capabilities/refresh', {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* 能力分析（analytics）                                               */
/* ------------------------------------------------------------------ */

export interface CapabilityUsageMetric {
  capabilityId: string
  callCount: number
  successRate: number
  avgLatencyMs: number
  errorCount: number
  uniqueUsers: number
  lastCalledAt: string
}

export interface CapabilityStats {
  totalCapabilities: number
  activeCapabilities: number
  topUsed: CapabilityUsageMetric[]
  trendingCategories: Array<{ category: string; growth: number }>
  period: { start: string; end: string }
}

export async function getCapabilityStats(
  query: { startDate?: string; endDate?: string } = {},
): Promise<ApiResult<CapabilityStats>> {
  return fetchApi<CapabilityStats>(`/ai/capabilities/stats${buildQs(query)}`)
}

export async function getCapabilityUsage(
  capabilityId: string,
  query: { startDate?: string; endDate?: string } = {},
): Promise<ApiResult<CapabilityUsageMetric>> {
  return fetchApi<CapabilityUsageMetric>(
    `/ai/capabilities/${encodeURIComponent(capabilityId)}/usage${buildQs(query)}`,
  )
}

/* ------------------------------------------------------------------ */
/* 能力市场（marketplace）                                             */
/* ------------------------------------------------------------------ */

export interface MarketplaceListing {
  id: string
  capabilityId: string
  title: string
  author: { id: string; nickname: string; avatar: string | null }
  category: string
  tags: string[]
  pricing: 'free' | 'freemium' | 'paid'
  price: number
  rating: number
  reviewCount: number
  installCount: number
  featured: boolean
  publishedAt: string
}

export interface MarketplaceQuery {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  pricing?: MarketplaceListing['pricing']
  sort?: 'popular' | 'newest' | 'rating' | 'price_asc' | 'price_desc'
}

export async function getMarketplaceListings(
  query: MarketplaceQuery = {},
): Promise<ApiResult<PageData<MarketplaceListing>>> {
  return fetchApi<PageData<MarketplaceListing>>(`/ai/marketplace${buildQs(query)}`)
}

export async function installFromMarketplace(
  listingId: string,
): Promise<ApiResult<{ installed: boolean; capabilityId: string }>> {
  return fetchApi<{ installed: boolean; capabilityId: string }>(
    `/ai/marketplace/${encodeURIComponent(listingId)}/install`,
    { method: 'POST' },
  )
}

export async function publishToMarketplace(input: {
  capabilityId: string
  title: string
  category: string
  tags: string[]
  pricing: MarketplaceListing['pricing']
  price?: number
}): Promise<ApiResult<MarketplaceListing>> {
  return fetchApi<MarketplaceListing>('/ai/marketplace', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/* ------------------------------------------------------------------ */
/* 能力文档（documentation）                                           */
/* ------------------------------------------------------------------ */

export interface CapabilityDoc {
  id: string
  capabilityId: string
  title: string
  language: string
  sections: Array<{ heading: string; content: string; examples?: string[] }>
  version: string
  updatedAt: string
}

export async function getCapabilityDocs(
  capabilityId: string,
  query: { language?: string; version?: string } = {},
): Promise<ApiResult<CapabilityDoc>> {
  return fetchApi<CapabilityDoc>(
    `/ai/capabilities/${encodeURIComponent(capabilityId)}/docs${buildQs(query)}`,
  )
}

export async function updateCapabilityDocs(
  capabilityId: string,
  input: Partial<Pick<CapabilityDoc, 'title' | 'sections' | 'language'>>,
): Promise<ApiResult<CapabilityDoc>> {
  return fetchApi<CapabilityDoc>(`/ai/capabilities/${encodeURIComponent(capabilityId)}/docs`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/* ------------------------------------------------------------------ */
/* 能力模板（templates）                                               */
/* ------------------------------------------------------------------ */

export interface CapabilityTemplate {
  id: string
  name: string
  category: string
  description: string
  config: Record<string, unknown>
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  isOfficial: boolean
  usageCount: number
  createdAt: string
}

export async function listTemplates(
  query: { page?: number; pageSize?: number; category?: string } = {},
): Promise<ApiResult<PageData<CapabilityTemplate>>> {
  return fetchApi<PageData<CapabilityTemplate>>(`/ai/templates${buildQs(query)}`)
}

export async function instantiateTemplate(
  templateId: string,
  overrides: Record<string, unknown> = {},
): Promise<ApiResult<AICapability>> {
  return fetchApi<AICapability>(`/ai/templates/${encodeURIComponent(templateId)}/instantiate`, {
    method: 'POST',
    body: JSON.stringify(overrides),
  })
}

export async function createTemplate(
  input: Omit<CapabilityTemplate, 'id' | 'usageCount' | 'createdAt'>,
): Promise<ApiResult<CapabilityTemplate>> {
  return fetchApi<CapabilityTemplate>('/ai/templates', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/* ------------------------------------------------------------------ */
/* 能力测试（testing）                                                 */
/* ------------------------------------------------------------------ */

export interface CapabilityTestCase {
  id: string
  capabilityId: string
  name: string
  input: Record<string, unknown>
  expected: Record<string, unknown>
  timeout: number
  enabled: boolean
}

export interface CapabilityTestResult {
  testCaseId: string
  capabilityId: string
  passed: boolean
  actual: unknown
  durationMs: number
  error?: string
  ranAt: string
}

export async function listTestCases(
  capabilityId: string,
): Promise<ApiResult<CapabilityTestCase[]>> {
  return fetchApi<CapabilityTestCase[]>(
    `/ai/capabilities/${encodeURIComponent(capabilityId)}/test-cases`,
  )
}

export async function runTestCase(testCaseId: string): Promise<ApiResult<CapabilityTestResult>> {
  return fetchApi<CapabilityTestResult>(`/ai/test-cases/${encodeURIComponent(testCaseId)}/run`, {
    method: 'POST',
  })
}

export async function runAllTests(
  capabilityId: string,
): Promise<
  ApiResult<{ total: number; passed: number; failed: number; results: CapabilityTestResult[] }>
> {
  return fetchApi<{
    total: number
    passed: number
    failed: number
    results: CapabilityTestResult[]
  }>(`/ai/capabilities/${encodeURIComponent(capabilityId)}/run-all-tests`, {
    method: 'POST',
  })
}
