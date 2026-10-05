// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 修复编排器(2026-09-26 立)。
 *
 * 单轮 runOnce 的流水线:
 *   三源扫描 → 认领去重(ledger)→ 认领回帖(可选)→ 组装修复任务 →
 *   执行器执行 → 建分支 + 建 PR([automations] fix: <摘要>)→ 原 issue 回帖结果 → 审计。
 *
 * 韧性约定:单条目/单步骤失败只记审计、不影响其余条目;单源扫描失败降级为空集。
 * PAT 绝不落日志:所有日志走注入的 audit(实现侧已 redact),错误消息再过一次 redact 兜底。
 *
 * G-669(2026-10-01 补)改了"失败条目的下场":此前 ok=false 只 `report.failed++`,认领
 * 永不释放 ⇒ transient 失败被永久静默丢弃。现在失败条目按 failure-class 分流 ——
 * transient 且未超上限 ⇒ `ledger.release` 回队(本轮不向 issue 发"失败"公告,那不是终态);
 * permanent 或超上限 ⇒ 保留认领为终态。两种下场都逐条进 `report.dropped` 点名。
 */

import type { AuditLogger, FixExecutor, FixTask, ScanItem, TickReport } from './types.js'
import type { GitHubClient } from './github-client.js'
import type { ClaimLedger } from './ledger.js'
import type { AutomationsConfig } from './config.js'
import { redactSecrets } from './redact.js'
import { describeAutomationFailure } from './failure-class.js'
import { parseScanItemKey } from './scan-item-key.js'

const GOAL_LIMIT = 4000
const TITLE_LIMIT = 60

/** 组装修复任务 goal(纯函数,含 issue 正文/告警栈/失败日志链接)。 */
export function buildFixGoal(item: ScanItem, repo: string): string {
  const lines = [
    '【D30 无人值守修复任务】',
    `仓库:${repo}`,
    `来源:${item.source}`,
    `条目:${item.key}`,
    `标题:${item.title}`,
    item.url ? `链接:${item.url}` : '链接:(无)',
    '',
    '详情(问题正文/告警栈/失败日志线索):',
    item.detail || '(无详情,请根据标题与链接自行排查)',
    '',
    '要求:定位根因并实施修复;修复改动提交到独立分支,由编排层负责建 PR 并回帖原 issue。',
  ]
  return lines.join('\n').slice(0, GOAL_LIMIT)
}

/** PR 标题:[automations] fix: <摘要> */
export function prTitleFor(item: ScanItem): string {
  const summary = item.title.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT)
  return `[automations] fix: ${summary}`
}

/**
 * 分支名:automations/fix-<source>-<key 序号>-<时间戳>(slug 化防非法字符)。
 *
 * G-998157:序号一律经 parseScanItemKey 取,不再 `split(':')[1] ?? 'x'` ——
 * 那样空段/无冒号会静默变成占位符 'x',两个坏键撞出同一个分支名,错配一路走到底。
 * 键解析失败(空段/段数不符/未知前缀)在此显式抛错,由调用点的 try 兜住并记账。
 */
export function branchNameFor(item: ScanItem, now = new Date()): string {
  const parsed = parseScanItemKey(item.key)
  if (!parsed) throw new Error(`[automations] 条目键无法解析,拒绝生成分支名:${item.key}`)
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  return `automations/fix-${parsed.source}-${parsed.seq}-${stamp}`
}

/** 认领回帖文案 */
export function claimCommentBody(item: ScanItem): string {
  return [
    '🤖 已认领(automations 无人值守修复闭环 D30):',
    `条目 \`${item.key}\` 已进入修复队列,完成后将以 PR 形式回帖结果。`,
    '本条消息由自动编排发出;若为误认领请联系管理员移除 label。',
  ].join('\n')
}

/** 结果回帖文案(成功含 PR 链接;失败含脱敏后的错误摘要) */
export function resultCommentBody(
  item: ScanItem,
  ok: boolean,
  summary: string,
  prUrl: string | null,
): string {
  const head = ok ? '✅ 修复任务已执行' : '❌ 修复任务执行失败'
  const lines = [`${head}(automations D30,条目 \`${item.key}\`):`, '', summary || '(无摘要)']
  if (prUrl) lines.push('', `PR:${prUrl}`)
  return lines.join('\n')
}

export interface OrchestratorDeps {
  config: AutomationsConfig
  github: GitHubClient
  ledger: ClaimLedger
  executor: FixExecutor
  audit?: AuditLogger
}

export interface Orchestrator {
  runOnce(): Promise<TickReport>
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  const { config, github, ledger, executor } = deps
  const audit = deps.audit
  const secrets = [config.pat]

  /** 兜底脱敏:即使调用方传来的错误对象里混入 PAT,落日志前也再洗一遍 */
  const safe = (text: string): string => redactSecrets(text, secrets)

  async function scanAll(): Promise<ScanItem[]> {
    const [issues, alerts, runs] = await Promise.all([
      github.scanIssues(config.label).catch((err) => {
        audit?.warn('[automations] issue 扫描失败', { err: safe(String(err)) })
        return [] as ScanItem[]
      }),
      github.scanCodeScanningAlerts(),
      github.scanFailedRuns(config.maxRuns).catch((err) => {
        audit?.warn('[automations] 失败 run 扫描失败', { err: safe(String(err)) })
        return [] as ScanItem[]
      }),
    ])
    return [...issues, ...alerts, ...runs]
  }

  async function handleItem(item: ScanItem, report: TickReport): Promise<void> {
    // ---- 认领去重(内存 + 文件双保险)----
    const claimed = ledger.claim(item.key, { title: item.title })
    if (!claimed) {
      report.scanned++
      return
    }
    report.scanned++
    report.claimed++
    audit?.info('[automations] 已认领条目', { key: item.key, source: item.source })

    // ---- 认领回帖(可选;仅 issue 源有可回帖面)----
    if (config.claimComment && item.issueNumber !== null) {
      try {
        await github.addIssueComment(item.issueNumber, claimCommentBody(item))
      } catch (err) {
        audit?.warn('[automations] 认领回帖失败(不影响认领)', {
          key: item.key,
          err: safe(String(err)),
        })
      }
    }

    // ---- 组装修复任务并执行 ----
    const task: FixTask = {
      key: item.key,
      source: item.source,
      repo: config.repo,
      title: item.title,
      goal: buildFixGoal(item, config.repo),
      url: item.url,
      issueNumber: item.issueNumber,
    }
    let ok = false
    let summary = ''
    try {
      const result = await executor.execute(task)
      ok = result.ok
      summary = safe(result.summary)
      if (!result.ok && result.error) {
        summary = `${summary} ${safe(result.error)}`.trim()
      }
    } catch (err) {
      ok = false
      summary = safe(String(err))
    }
    audit?.info('[automations] 修复任务执行完成', {
      key: item.key,
      ok,
      summary: summary.slice(0, 300),
    })

    // ---- G-669:失败条目必须有"下场",并且逐条点名 ----
    // 改造前这里只有 report.failed++:认领永不释放 ⇒ transient 失败(上游重启/网络抖动)
    // 被永久静默丢弃,而 dropped 名单一片空白,读报告的人以为"这一条已经被想过了"。
    let released = false
    let dropReason = ''
    if (ok) {
      report.fixed++
    } else {
      report.failed++
      const verdict = describeAutomationFailure({ message: summary })
      if (verdict.kind === 'permanent') {
        // permanent ⇒ **保留认领**就是终态:下一轮 claim 返回 false,不再对同一条 issue 反复动作。
        dropReason = `permanent 失败(重试不会变好,判据 ${verdict.reason}),保留认领为终态`
      } else {
        released = ledger.release(item.key, `${verdict.reason}:${summary.slice(0, 120)}`)
        dropReason = released
          ? `transient 失败(判据 ${verdict.reason}),已释放认领待下一轮重试`
          : `transient 失败(判据 ${verdict.reason})但释放次数已达上限,保留认领为终态`
      }
      report.dropped.push({ key: item.key, reason: dropReason, released, kind: verdict.kind })
    }

    // ---- PR + 回帖(stub 模式也走完整链路,便于用注入 transport 验证)----
    let prUrl: string | null = null
    if (ok) {
      try {
        const branch = branchNameFor(item)
        const { base } = await github.createFixBranch(branch)
        const pr = await github.createPullRequest({
          title: prTitleFor(item),
          head: branch,
          base,
          body: [
            `Automated fix attempt for \`${item.key}\`(${item.source}).`,
            '',
            task.goal,
            '',
            '---',
            `Executor: ${executor.name}`,
            `Summary: ${summary}`,
          ].join('\n'),
        })
        prUrl = pr.url
        audit?.info('[automations] PR 已创建', { key: item.key, pr: prUrl, number: pr.number })
      } catch (err) {
        // PR 失败不回滚认领:下轮不会重复认领;错误进审计 + 回帖,便于人工接管
        audit?.warn('[automations] PR 创建失败', { key: item.key, err: safe(String(err)) })
        summary = `${summary} PR 创建失败:${safe(String(err))}`.trim()
      }
    }

    // ---- 原 issue 回帖结果 ----
    // G-669 的一条推论:**回队重试的条目不回帖**。它不是终态,而 release 之后下一轮还会
    // 再执行一次 —— 每轮都发一条"❌ 执行失败"就是把一次抖动刷成 N 条公告。
    // 终态(成功 / permanent / transient 超上限)照旧逐条回帖。
    if (item.issueNumber !== null && !released) {
      try {
        await github.addIssueComment(item.issueNumber, resultCommentBody(item, ok, summary, prUrl))
      } catch (err) {
        audit?.warn('[automations] 结果回帖失败', { key: item.key, err: safe(String(err)) })
      }
    } else if (item.issueNumber !== null) {
      audit?.info('[automations] 条目已回队,本轮不发结果回帖', {
        key: item.key,
        reason: dropReason,
      })
    }
  }

  return {
    async runOnce(): Promise<TickReport> {
      const report: TickReport = { scanned: 0, claimed: 0, fixed: 0, failed: 0, dropped: [] }
      const items = await scanAll()
      audit?.info('[automations] 扫描完成', { scanned: items.length })
      // 批次上限:单轮最多认领 batchLimit 条新条目,防突发风暴
      let budget = config.batchLimit
      for (const item of items) {
        if (budget <= 0) break
        const before = report.claimed
        await handleItem(item, report)
        if (report.claimed > before) budget--
      }
      audit?.info('[automations] 本轮结束', { ...report })
      return report
    },
  }
}
