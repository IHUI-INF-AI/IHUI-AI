/**
 * 监控API
 * 提供数据库优化监控和管理功能（仅管理员）
 */

import { apiClient } from '../core/client'
import type { ApiResponse } from '@/types'

/**
 * 连接池统计信息
 */
export interface PoolStats {
  totalConnections: number
  idleConnections: number
  activeConnections: number
  waitingCount: number
  queryCount: number
  errorCount: number
  avgQueryTime: number
  recommendations: string[]
}

/**
 * 索引使用情况
 */
export interface IndexUsage {
  tableName: string
  indexName: string
  indexScans: number
  tuplesRead: number
  tuplesFetched: number
  recommendation: string
}

/**
 * 查询计划分析结果
 */
export interface QueryPlanAnalysis {
  query: string
  plan: string
  executionTime?: number
  cost?: number
  rows?: number
  recommendations: string[]
}

/**
 * 获取连接池统计信息
 */
export async function getPoolStats(): Promise<ApiResponse<PoolStats>> {
  return apiClient.get('/monitoring/db-optimization/pool-stats')
}

/**
 * 获取索引使用情况
 */
export async function getIndexUsage(tableName?: string): Promise<ApiResponse<IndexUsage[]>> {
  return apiClient.get('/monitoring/db-optimization/index-usage', {
    params: tableName ? { table: tableName } : undefined,
  })
}

/**
 * 分析查询计划
 */
export async function analyzeQueryPlan(
  query: string,
  params?: any[]
): Promise<ApiResponse<QueryPlanAnalysis>> {
  return apiClient.post('/monitoring/db-optimization/analyze-query', {
    query,
    params,
  })
}

/**
 * 批处理查询
 */
export async function batchQuery(
  queries: Array<{
    query: string
    params?: any[]
  }>,
  config?: {
    batchSize?: number
    concurrency?: number
    useCache?: boolean
    cacheTtl?: number
  }
): Promise<ApiResponse<unknown[]>> {
  return apiClient.post('/monitoring/db-optimization/batch-query', {
    queries,
    config,
  })
}

/**
 * 优化分页查询
 */
export async function optimizedPaginate(
  query: string,
  params: any[],
  page: number,
  pageSize: number,
  orderBy?: string,
  orderDirection?: 'ASC' | 'DESC'
): Promise<
  ApiResponse<{
    data: any[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  return apiClient.post('/monitoring/db-optimization/optimized-paginate', {
    query,
    params,
    page,
    pageSize,
    orderBy,
    orderDirection,
  })
}

/**
 * 清除查询缓存
 */
export async function clearQueryCache(pattern?: string): Promise<ApiResponse<{ message: string }>> {
  return apiClient.delete('/monitoring/db-optimization/clear-cache', {
    params: pattern ? { pattern } : undefined,
  })
}
