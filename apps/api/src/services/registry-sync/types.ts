// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { RegistrySourceType, RegistryUpstreamSource } from '@ihui/types'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

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

/**
 * 带超时的 fetch(所有适配器共享的唯一取数出口)。
 *
 * 外网出口代理闸(2026-10-25 立):`IHUI_REGISTRY_EGRESS_PROXY` 不设 ⇒ 逐字节保持今天的
 * 直连行为;设了 ⇒ 四个适配器(mcp_marketplace / github / npm / custom)的取数统一走该 HTTP(S)
 * 代理。**立因**:本机在国内,marketplace 上游(mcp.so/smithery.ai)直连常年 ETIMEDOUT(现读
 * svc-api-nssm-err.log 尾部即 `All marketplace sources failed`),而 undici 不会自动读系统代理
 * —— 于是同步队列每轮 partial failure、目录数据停更,账面只有日志知道(静默型)。代理指向哪台
 * (本机是 Clash Verge 的 127.0.0.1:7897)属**运维面**注入,代码只做"给不给闸、怎么咬合"。
 * 坏值 = 一次 console.warn + 本进程回落直连(fail-open 到**今天的行为**,不是 fail-open 到成功)。
 */
export const EGRESS_PROXY_ENV = 'IHUI_REGISTRY_EGRESS_PROXY'
// 单槽缓存按**值**成对:同一进程换值(测试注入/热改 env)不复用旧 agent;
// 构建失败也被记住(不再每请求重试构造与刷 warn),回落形态 = 不配该键。
let egressAgentFor: string | null = null
let egressAgentCache: ProxyAgent | null = null

export function registryEgressDispatcher(
  env: Record<string, string | undefined> = process.env,
): ProxyAgent | null {
  const raw = String(env[EGRESS_PROXY_ENV] ?? '').trim()
  if (raw === '') return null
  if (egressAgentFor === raw) return egressAgentCache
  try {
    egressAgentCache = new ProxyAgent(raw)
  } catch (e) {
    console.warn(
      `[registry-sync] ${EGRESS_PROXY_ENV} 值不可用(${String((e as Error)?.message ?? e).slice(0, 90)})` +
        '⇒ 回落直连(与不配该键同形;这是降级,不是成功)',
    )
    egressAgentCache = null
  }
  egressAgentFor = raw
  return egressAgentCache
}

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 30000,
  env: Record<string, string | undefined> = process.env,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const dispatcher = registryEgressDispatcher(env)
  try {
    if (dispatcher) {
      // 与 ProxyAgent 同库配对走 undici 自己的 fetch(跨 undici 版本的 dispatcher 传给
      // Node 内置 fetch 会因 symbol 校验被拒 —— 同库成对是唯一稳态)。
      const res = await undiciFetch(url, {
        ...opts,
        signal: controller.signal,
        dispatcher,
      })
      return res as unknown as Response
    }
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
