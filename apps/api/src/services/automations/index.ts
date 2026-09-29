// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 无人值守修复闭环 —— 生命周期入口(2026-09-26 立)。
 *
 * 门控铁律:IHUI_AUTOMATIONS_ENABLED 未设为 'true' 时 startAutomationsScheduler()
 * 直接返回 false —— 不建定时器、不发任何网络请求、不读任何文件。
 * 启动后为 60s 级 tick 轮询(patrol-scheduler 同款模式:unref + 单飞保护),
 * 停止走 stopAutomationsScheduler()(server.ts onClose 钩子优雅关停)。
 */

import { loadAutomationsConfig, validateConfig, defaultAudit } from './config.js'
import { makeAuditLogger } from './redact.js'
import { createFileLedger } from './ledger.js'
import { createGitHubClient } from './github-client.js'
import { createStubExecutor, createAgentExecutor } from './executor.js'
import { createOrchestrator } from './orchestrator.js'
import type { FetchLike } from './types.js'

export * from './types.js'
export { loadAutomationsConfig, validateConfig } from './config.js'
export { redactSecrets, makeAuditLogger } from './redact.js'
export { createFileLedger } from './ledger.js'
export { createGitHubClient } from './github-client.js'
export { createStubExecutor, createAgentExecutor } from './executor.js'
export { createOrchestrator, buildFixGoal, prTitleFor, branchNameFor } from './orchestrator.js'

const TICK_FALLBACK_MS = 300_000

let timer: ReturnType<typeof setInterval> | null = null
let ticking = false

/**
 * 启动调度器(env 门控)。返回是否真的启动:
 * - 未开启 / 配置缺失 → false(零副作用);
 * - 已在运行 → true(幂等)。
 */
export function startAutomationsScheduler(): boolean {
  const raw = loadAutomationsConfig(process.env)
  if (!raw.enabled) return false
  if (timer) return true

  const reject = validateConfig(raw)
  if (reject) {
    // 用未脱敏审计即可:reject 文案由 validateConfig 构造,不含凭证
    defaultAudit().warn(`[automations] 门控已开启但配置不完整,拒绝启动:${reject}`)
    return false
  }

  const audit = makeAuditLogger([raw.pat], defaultAudit())
  // 注入式 transport:生产为 global fetch(凭证只经 github-client 的 header 通道)
  const transport: FetchLike = (url, init) => fetch(url, init)
  const ledger = createFileLedger(raw.ledgerPath, audit)
  const github = createGitHubClient({ pat: raw.pat, repo: raw.repo, transport, audit })
  const executor =
    raw.executor === 'agent'
      ? createAgentExecutor({ agentId: raw.agentId })
      : createStubExecutor()
  const orchestrator = createOrchestrator({ config: raw, github, ledger, executor, audit })

  const tick = async (): Promise<void> => {
    // 单飞保护:上一轮未结束跳过本轮
    if (ticking) return
    ticking = true
    try {
      await orchestrator.runOnce()
    } catch (err) {
      audit.error('[automations] tick 异常(下轮重试)', { err: String(err) })
    } finally {
      ticking = false
    }
  }

  timer = setInterval(() => {
    void tick()
  }, raw.intervalMs || TICK_FALLBACK_MS)
  // 定时器不阻塞进程退出(与 patrol-scheduler 同款)
  if (typeof timer.unref === 'function') timer.unref()

  audit.info('[automations] D30 无人值守修复闭环已启动', {
    repo: raw.repo,
    label: raw.label,
    executor: raw.executor,
    intervalMs: raw.intervalMs,
    claimComment: raw.claimComment,
  })
  return true
}

/** 停止调度器(优雅关停 / 测试用)。 */
export function stopAutomationsScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  ticking = false
}

/** 是否在运行(测试/诊断用)。 */
export function isAutomationsSchedulerRunning(): boolean {
  return timer !== null
}
