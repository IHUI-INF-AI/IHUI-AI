// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 配置装载(2026-09-26 立)。
 *
 * 全部 env 门控:IHUI_AUTOMATIONS_ENABLED 未设为 'true' 时 enabled=false,
 * 上层启动钩子必须做到「完全不启动:零定时器、零网络」。
 * 纯函数 + 注入 env(测试直接传字面量,不污染 process.env)。
 */

import { join } from 'node:path'
import type { AuditLogger } from './types.js'

export interface AutomationsConfig {
  /** 总闸:IHUI_AUTOMATIONS_ENABLED === 'true' */
  enabled: boolean
  /** GitHub PAT(Bearer;绝不落日志,由 redact 层保证) */
  pat: string
  /** 目标仓库 owner/repo */
  repo: string
  /** 认领扫描的 issue label(默认 automations:fix) */
  label: string
  /** 修复执行器:stub(默认,仅登记)| agent(走 ai-service /api/agents/execute) */
  executor: 'stub' | 'agent'
  /** tick 轮询间隔毫秒(默认 300000,下限 30000 防误配打死上游) */
  intervalMs: number
  /** 认领时是否在 issue 回帖「已认领」(默认开) */
  claimComment: boolean
  /** 失败 workflow runs 抓取条数(默认 10) */
  maxRuns: number
  /** 单轮最多新认领条数(默认 5,防突发风暴) */
  batchLimit: number
  /** executor=agent 时的 agent id(缺省为空 → 跳过执行并告警,fail-safe 不打网络) */
  agentId: string
  /** 认领账本文件路径(默认 .ihui-agent/tmp/automations-ledger.json,gitignore 目录) */
  ledgerPath: string
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

function toInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * 从 env 装载配置。env 缺失的字段一律取安全默认值;
 * repo 形如 owner/repo 不合法时按未配置处理(启动钩子会因此拒启)。
 */
export function loadAutomationsConfig(env: Record<string, string | undefined>): AutomationsConfig {
  const repoRaw = (env.IHUI_AUTOMATIONS_REPO ?? '').trim()
  return {
    enabled: env.IHUI_AUTOMATIONS_ENABLED === 'true',
    pat: (env.IHUI_GITHUB_PAT ?? '').trim(),
    repo: REPO_RE.test(repoRaw) ? repoRaw : '',
    label: (env.IHUI_AUTOMATIONS_LABEL ?? '').trim() || 'automations:fix',
    executor: env.IHUI_AUTOMATIONS_EXECUTOR === 'agent' ? 'agent' : 'stub',
    intervalMs: toInt(env.IHUI_AUTOMATIONS_INTERVAL_MS, 300_000, 30_000, 86_400_000),
    claimComment: env.IHUI_AUTOMATIONS_CLAIM_COMMENT !== 'false',
    maxRuns: toInt(env.IHUI_AUTOMATIONS_MAX_RUNS, 10, 1, 50),
    batchLimit: toInt(env.IHUI_AUTOMATIONS_BATCH_LIMIT, 5, 1, 20),
    agentId: (env.IHUI_AUTOMATIONS_AGENT_ID ?? '').trim(),
    ledgerPath:
      (env.IHUI_AUTOMATIONS_LEDGER_PATH ?? '').trim() ||
      join(process.cwd(), '.ihui-agent', 'tmp', 'automations-ledger.json'),
  }
}

/** 启动前置校验:通过返回 null,否则返回拒启原因(启动钩子记日志后放弃)。 */
export function validateConfig(cfg: AutomationsConfig): string | null {
  if (!cfg.pat) return '缺少 IHUI_GITHUB_PAT'
  if (!cfg.repo) return '缺少或非法 IHUI_AUTOMATIONS_REPO(需形如 owner/repo)'
  if (cfg.executor === 'agent' && !cfg.agentId) return 'executor=agent 但未配置 IHUI_AUTOMATIONS_AGENT_ID'
  return null
}

/** 默认审计 logger(生产注入 utils/logger;测试注入 spy)。 */
export function defaultAudit(): AuditLogger {
  // 延迟动态 import:避免测试载入本模块时连带拉起 config/env 依赖
  return {
    info: (msg, meta) => {
      void import('../../utils/logger.js').then((m) => m.logger.info(msg, meta)).catch(() => {})
    },
    warn: (msg, meta) => {
      void import('../../utils/logger.js').then((m) => m.logger.warn(msg, meta)).catch(() => {})
    },
    error: (msg, meta) => {
      void import('../../utils/logger.js').then((m) => m.logger.error(msg, meta)).catch(() => {})
    },
  }
}
