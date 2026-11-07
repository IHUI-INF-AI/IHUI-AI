// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 定时轮询来源(RP-40):复用 automations 的 GitHub 三源扫描客户端与复合键,
 * 不新造调度器 —— 由既有的 SuperAgentPump 节拍每轮调用 fetchTriggers()。
 *
 * 与推送型来源同样的纪律:**本层不去重**。同一条 open issue 在下一轮仍会被扫到,
 * 交给引擎判 duplicate;若在这里维护"已投递集合",就又出现第二套幂等,违背 RP-40 判据。
 */

import {
  normalizePollItem,
  toIncomingTrigger,
  type IncomingTrigger,
  type SourceEventRoute,
  type TriggerSourcePort,
} from '@ihui/shared/super-agent'
import { createGitHubClient, type GitHubClient } from '../automations/github-client.js'
import type { FetchLike, ScanItem } from '../automations/types.js'

export interface GithubPollPortOptions {
  sourceId: string
  ownerUserId: string
  repo: string
  pat: string
  label: string
  maxRuns: number
  includeCodeScanning: boolean
  routes: readonly SourceEventRoute[]
  transport: FetchLike
  /** 单个扫描源失败时的点名出口(不吞错);不注入则静默计数。 */
  onWarn?: (source: string, error: string) => void
}

/**
 * 三源扫描共用一个 GitHubClient;某一源失败不拖死其它源,
 * 但三源全失败时整体抛错,由泵按端口故障隔离并计数。
 */
export function createGithubPollPort(options: GithubPollPortOptions): TriggerSourcePort {
  const github: GitHubClient = createGitHubClient({
    pat: options.pat,
    repo: options.repo,
    transport: options.transport,
  })

  return {
    sourceId: options.sourceId,
    ownerUserId: options.ownerUserId,
    async fetchTriggers() {
      const scanErrors: string[] = []
      const items: ScanItem[] = []
      const run = async (name: string, fn: () => Promise<ScanItem[]>) => {
        try {
          items.push(...(await fn()))
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          scanErrors.push(`${name}: ${msg}`)
          options.onWarn?.(name, msg)
        }
      }

      await run('issue', () => github.scanIssues(options.label))
      await run('workflow-run', () => github.scanFailedRuns(options.maxRuns))
      if (options.includeCodeScanning)
        await run('code-scanning', () => github.scanCodeScanningAlerts())

      if (items.length === 0 && scanErrors.length > 0) {
        throw new Error(`poll 全源失败: ${scanErrors.join(' | ')}`)
      }

      const triggers: IncomingTrigger[] = []
      for (const item of items) {
        const normalized = normalizePollItem({
          source: item.source,
          key: item.key,
          title: item.title,
          detail: item.detail,
          url: item.url,
          repo: options.repo,
          ownerUserId: options.ownerUserId,
          routes: options.routes,
        })
        if (normalized.accepted) {
          triggers.push(toIncomingTrigger(normalized.event, options.sourceId))
        }
      }
      return triggers
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
