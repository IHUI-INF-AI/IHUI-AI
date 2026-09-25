// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30 GitHub REST 客户端(2026-09-26 立,PAT 基础)。
 *
 * - transport 注入式:生产传 global fetch,测试传 fake(可断言请求 shape);
 * - Bearer PAT 从注入配置带入,本模块绝不打印 headers/凭证;
 * - 三源扫描(issue/code-scanning/actions)+ 认领回帖 + 建分支/建 PR 的最小封装。
 */

import type { AuditLogger, FetchLike, ScanItem, ScanSource } from './types.js'

const API_ROOT = 'https://api.github.com'
const DETAIL_LIMIT = 4000

export interface GitHubClient {
  /** open + 指定 label 的 issues(排除 PR) */
  scanIssues(label: string): Promise<ScanItem[]>
  /** Code Scanning open 告警 */
  scanCodeScanningAlerts(): Promise<ScanItem[]>
  /** 最近失败的 workflow runs */
  scanFailedRuns(max: number): Promise<ScanItem[]>
  /** 从默认分支切出修复分支(返回 base 分支名供 PR 用) */
  createFixBranch(branch: string): Promise<{ base: string }>
  /** 创建 PR(base 为 createFixBranch 返回的基分支) */
  createPullRequest(input: { title: string; head: string; base: string; body: string }): Promise<{ url: string; number: number }>
  /** 在 issue 下回帖 */
  addIssueComment(issueNumber: number, body: string): Promise<void>
}

interface GhIssue {
  number: number
  title?: string
  body?: string | null
  html_url?: string
  pull_request?: unknown
}

interface GhAlert {
  number: number
  html_url?: string
  rule?: { id?: string; description?: string }
  most_recent_instance?: { message?: Record<string, unknown> | string }
  tool?: { name?: string }
}

interface GhRun {
  id: number
  name?: string
  display_title?: string
  html_url?: string
}

export function createGitHubClient(input: {
  pat: string
  repo: string
  transport: FetchLike
  audit?: AuditLogger
}): GitHubClient {
  const { pat, repo, transport, audit } = input

  /** 统一出站:Bearer PAT + GitHub API 版本头;非 2xx 抛错(错误消息不含凭证)。 */
  async function gh<T>(path: string, init?: RequestInit): Promise<T> {
    const resp = await transport(`${API_ROOT}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    if (!resp.ok) {
      const snippet = (await resp.text().catch(() => '')).slice(0, 200)
      throw new Error(`GitHub API ${path} → ${resp.status}${snippet ? `: ${snippet}` : ''}`)
    }
    return (await resp.json()) as T
  }

  const mapIssue = (it: GhIssue): ScanItem => ({
    key: `issue:${it.number}`,
    source: 'issue' as ScanSource,
    title: (it.title ?? `issue #${it.number}`).slice(0, 300),
    detail: (it.body ?? '').slice(0, DETAIL_LIMIT),
    url: it.html_url ?? null,
    issueNumber: it.number,
  })

  const mapAlert = (a: GhAlert): ScanItem => {
    const ruleDesc = a.rule?.description ?? a.rule?.id ?? `alert #${a.number}`
    const message = a.most_recent_instance?.message
    const stack = typeof message === 'string' ? message : JSON.stringify(message ?? '')
    return {
      key: `code-scanning:${a.number}`,
      source: 'code-scanning',
      title: `[code-scanning] ${ruleDesc}`.slice(0, 300),
      detail: stack.slice(0, DETAIL_LIMIT),
      url: a.html_url ?? null,
      // code-scanning 告警没有可回帖的 issue 面(回帖 API 不存在)→ 只入账本,不回帖
      issueNumber: null,
    }
  }

  const mapRun = (r: GhRun): ScanItem => ({
    key: `workflow-run:${r.id}`,
    source: 'workflow-run',
    title: `[workflow] ${r.name ?? 'workflow'} ${r.display_title ?? ''}`.trim().slice(0, 300),
    detail: `失败运行日志:${r.html_url ?? '(无链接)'}`,
    url: r.html_url ?? null,
    issueNumber: null,
  })

  return {
    async scanIssues(label) {
      const rows = await gh<GhIssue[]>(
        `/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&sort=updated&direction=desc&per_page=20`,
      )
      // /issues 端点混有 PR(带 pull_request 键),D30 只认领真 issue
      return rows.filter((it) => !it.pull_request).map(mapIssue)
    },

    async scanCodeScanningAlerts() {
      try {
        const rows = await gh<GhAlert[]>(`/repos/${repo}/code-scanning/alerts?state=open&per_page=20`)
        return rows.map(mapAlert)
      } catch (err) {
        // 常见:仓库未启用 code scanning → 403/404;单源失败不拖垮其余两源
        audit?.warn('[automations] code-scanning 扫描失败(可能未启用该功能)', {
          err: String(err),
        })
        return []
      }
    },

    async scanFailedRuns(max) {
      const data = await gh<{ workflow_runs?: GhRun[] }>(
        `/repos/${repo}/actions/runs?status=failure&per_page=${max}`,
      )
      return (data.workflow_runs ?? []).slice(0, max).map(mapRun)
    },

    async createFixBranch(branch) {
      const repoInfo = await gh<{ default_branch: string }>(`/repos/${repo}`)
      const base = repoInfo.default_branch || 'main'
      const ref = await gh<{ object: { sha: string } }>(`/repos/${repo}/git/ref/heads/${base}`)
      await gh(`/repos/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref.object.sha }),
      })
      return { base }
    },

    async createPullRequest({ title, head, base, body }) {
      const pr = await gh<{ number: number; html_url: string }>(`/repos/${repo}/pulls`, {
        method: 'POST',
        body: JSON.stringify({ title, head, base, body }),
      })
      return { url: pr.html_url, number: pr.number }
    },

    async addIssueComment(issueNumber, body) {
      await gh(`/repos/${repo}/issues/${issueNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
    },
  }
}
