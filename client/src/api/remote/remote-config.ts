/**
 * P9-7 A/B 测试灰度远程配置接入
 *
 * 提供远程配置 API 接口，对接 featureFlag.ts 的 loadRemoteConfigs
 * 支持从后端加载实验配置、灰度比例、变体定义
 */

import { request } from '@/utils/request'
import { logger } from '@/utils/logger'

/** 远程实验配置 */
export interface RemoteExperimentConfig {
  /** 实验名称 */
  name: string
  /** 灰度比例 0-100 */
  rolloutPercentage: number
  /** 白名单用户 ID */
  whitelist?: string[]
  /** 黑名单用户 ID */
  blacklist?: string[]
  /** 实验变体 */
  variants?: Array<{
    name: string
    weight: number
    payload?: Record<string, unknown>
  }>
  /** 过期时间戳 */
  expiresAt?: number
  /** 远程配置 URL（覆盖默认） */
  remoteUrl?: string
}

/** 远程配置 API 端点 */
const REMOTE_CONFIG_ENDPOINT = '/api/feature-flags'

/** 获取远程实验配置 */
export async function fetchRemoteConfigs(): Promise<Record<string, RemoteExperimentConfig>> {
  try {
    const resp = await request.get<{
      code: number
      data: Record<string, RemoteExperimentConfig>
    }>(REMOTE_CONFIG_ENDPOINT)
    const body = resp.data
    if (body?.code === 200 && body.data) {
      return body.data
    }
    return {}
  } catch (error) {
    logger.warn('[RemoteConfig] Failed to load remote config', error)
    return {}
  }
}

/** 上报实验曝光 */
export async function reportExposure(
  experimentName: string,
  variantName: string,
  userId: string
): Promise<void> {
  try {
    await request.post('/api/feature-flags/exposure', {
      experiment: experimentName,
      variant: variantName,
      userId,
      timestamp: Date.now(),
    })
  } catch (error) {
    logger.warn('[RemoteConfig] Exposure report failed', error)
  }
}

/** 上报实验转化 */
export async function reportConversion(
  experimentName: string,
  variantName: string,
  userId: string,
  metric: string,
  value: number
): Promise<void> {
  try {
    await request.post('/api/feature-flags/conversion', {
      experiment: experimentName,
      variant: variantName,
      userId,
      metric,
      value,
      timestamp: Date.now(),
    })
  } catch (error) {
    logger.warn('[RemoteConfig] Conversion report failed', error)
  }
}

/** 创建新实验 */
export async function createExperiment(
  config: RemoteExperimentConfig
): Promise<boolean> {
  try {
    const resp = await request.post<{ code: number }>('/api/feature-flags/experiments', config)
    return resp.data?.code === 200
  } catch (error) {
    logger.warn('[RemoteConfig] Creating experiment failed', error)
    return false
  }
}

/** 更新实验配置 */
export async function updateExperiment(
  name: string,
  updates: Partial<RemoteExperimentConfig>
): Promise<boolean> {
  try {
    const resp = await request.put<{ code: number }>(`/api/feature-flags/experiments/${name}`, updates)
    return resp.data?.code === 200
  } catch (error) {
    logger.warn('[RemoteConfig] Updating experiment failed', error)
    return false
  }
}

/** 删除实验 */
export async function deleteExperiment(name: string): Promise<boolean> {
  try {
    const resp = await request.delete<{ code: number }>(`/api/feature-flags/experiments/${name}`)
    return resp.data?.code === 200
  } catch (error) {
    logger.warn('[RemoteConfig] Deleting experiment failed', error)
    return false
  }
}

/** 获取所有实验列表 */
export async function listExperiments(): Promise<RemoteExperimentConfig[]> {
  try {
    const resp = await request.get<{ code: number; data: RemoteExperimentConfig[] }>('/api/feature-flags/experiments')
    const body = resp.data
    if (body?.code === 200 && body.data) {
      return body.data
    }
    return []
  } catch (error) {
    logger.warn('[RemoteConfig] Getting experiment list failed', error)
    return []
  }
}

/** 远程配置管理器 */
export const remoteConfigManager = {
  fetch: fetchRemoteConfigs,
  reportExposure,
  reportConversion,
  create: createExperiment,
  update: updateExperiment,
  delete: deleteExperiment,
  list: listExperiments,
}
