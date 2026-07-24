import type { RegistrySourceType, RegistryUpstreamSource } from '@ihui/types'

/** 单个上游条目的标准化中间表示(适配器输出,主调度器消费) */
export interface RawRegistryItem {
  sourceType: RegistrySourceType
  source: RegistryUpstreamSource
  sourceId: string
  name: string
  description: string | null
  version: string | null
  author: string | null
  homepage: string | null
  repoUrl: string | null
  downloadUrl: string | null
  categories: string[]
  tags: string[]
  /** 原始上游 payload */
  payload: Record<string, unknown>
  /** 适配器可填的元数据,供评分计算用 */
  meta?: {
    stars?: number
    forks?: number
    recentReleases?: number
    hasDocumentation?: boolean
    lastCommitAt?: string
    /** npm 周下载量(由 npm 适配器填充,供热度评分消费) */
    downloads?: number
    /** 上次同步时间(ISO 字符串,force 透传语义:worker 层据此跳过 payload_hash 变更检测) */
    lastSyncedAt?: string
  }
}

/** 适配器接口 */
export interface RegistryAdapter {
  name: string
  source: RegistryUpstreamSource
  /** 拉取某类资源的全部条目 */
  fetch(sourceType: RegistrySourceType, options?: SyncOptions): Promise<RawRegistryItem[]>
}

export interface SyncOptions {
  /**
   * 强制全量同步(跳过 payload_hash 变更检测)。
   * 适配器层总是全量拉取(无本地缓存),force 的真正消费方是 worker 层:
   * worker 在 force=true 时不比较 payload_hash,直接 upsert 全部条目。
   * 适配器层只通过日志标记透传 force,便于排查。
   */
  force?: boolean
  /** GitHub token(避免 rate limit) */
  githubToken?: string
  /** 自定义 registry URL */
  customRegistryUrl?: string
  /** 超时(ms) */
  timeoutMs?: number
}

export class RegistryAdapterError extends Error {
  constructor(
    message: string,
    public readonly source: RegistryUpstreamSource,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'RegistryAdapterError'
  }
}

/** 带超时的 fetch(AbortController 实现,所有适配器共享) */
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
