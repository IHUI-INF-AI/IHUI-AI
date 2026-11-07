// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 事件源适配器配置装载(RP-40)。
 *
 * 单一真相源:事件→规则映射只在 @ihui/shared/super-agent 的 DEFAULT_SOURCE_EVENT_ROUTES,
 * 本文件只决定"哪个来源启用、来源白名单是什么",不复制映射表。
 *
 * fail-closed:机主 uuid / 仓库白名单 / IM 平台与账号白名单任一缺失,对应来源就不启用;
 * 绝不出现"没配白名单也先放进来"的路径。纯函数 + 注入 env(测试不污染 process.env)。
 */

import { parseSourceEventRoutes, type SourceEventRoute } from '@ihui/shared/super-agent'

export interface GithubEventSourceSettings {
  enabled: boolean
  /** 允许投递的仓库全名白名单(owner/repo)。 */
  repos: string[]
  /** 点名检测用的机主登录名集合。 */
  ownerLogins: string[]
}

export interface ImEventSourceSettings {
  enabled: boolean
  /** 允许回调的平台白名单。 */
  platforms: string[]
  /** 被允许代表机主的平台账号白名单。 */
  ownerAccounts: string[]
}

export interface PollEventSourceSettings {
  enabled: boolean
  pat: string
  repo: string
  label: string
  maxRuns: number
  includeCodeScanning: boolean
}

export interface EventSourceSettings {
  enabled: boolean
  ownerUserId: string
  routes: SourceEventRoute[]
  github: GithubEventSourceSettings
  im: ImEventSourceSettings
  poll: PollEventSourceSettings
  /** 装载期发现的不合法配置(点名上报,不静默)。 */
  issues: string[]
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

function csv(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function toInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * 从 env 装载。机主 uuid 是所有来源的共同前提:没有它就没有"这些事件归谁"的答案,
 * 三个来源全部保持关闭(而不是随便挑一个 owner 开工单)。
 */
export function loadEventSourceSettings(
  env: Record<string, string | undefined>,
): EventSourceSettings {
  const issues: string[] = []
  const ownerUserId = (env.IHUI_SUPER_AGENT_STATE_ACCOUNT ?? '').trim()
  const routes = parseSourceEventRoutes(env.IHUI_SUPER_AGENT_EVENT_ROUTES)

  const reposRaw = csv(env.IHUI_SUPER_AGENT_GITHUB_REPOS)
  const repos = reposRaw.filter((r) => REPO_RE.test(r))
  if (reposRaw.length > repos.length) {
    issues.push('IHUI_SUPER_AGENT_GITHUB_REPOS 含非 owner/repo 项,已剔除')
  }
  const repoOwners = repos.map((r) => r.split('/')[0] ?? '').filter((s) => s.length > 0)
  const configuredLogins = csv(env.IHUI_SUPER_AGENT_GITHUB_OWNER_LOGINS)
  const ownerLogins = configuredLogins.length > 0 ? configuredLogins : repoOwners

  const platforms = csv(env.IHUI_SUPER_AGENT_IM_PLATFORMS)
  const ownerAccounts = csv(env.IHUI_SUPER_AGENT_IM_OWNER_ACCOUNTS)

  const pollRepoRaw = (env.IHUI_AUTOMATIONS_REPO ?? '').trim()
  const pollRepo = REPO_RE.test(pollRepoRaw) ? pollRepoRaw : ''
  const pollPat = (env.IHUI_GITHUB_PAT ?? '').trim()

  const ownerReady = ownerUserId.length > 0
  if (!ownerReady) {
    issues.push('IHUI_SUPER_AGENT_STATE_ACCOUNT 未配置:所有事件来源保持关闭')
  }

  const githubEnabled = ownerReady && repos.length > 0
  const imEnabled = ownerReady && platforms.length > 0 && ownerAccounts.length > 0
  const pollEnabled =
    ownerReady &&
    env.IHUI_SUPER_AGENT_POLL_ENABLED === 'true' &&
    pollPat.length > 0 &&
    pollRepo.length > 0
  if (ownerReady && env.IHUI_SUPER_AGENT_POLL_ENABLED === 'true' && !pollEnabled) {
    issues.push('轮询已开启但 IHUI_GITHUB_PAT / IHUI_AUTOMATIONS_REPO 缺失:轮询来源保持关闭')
  }

  return {
    enabled: githubEnabled || imEnabled || pollEnabled,
    ownerUserId,
    routes,
    github: { enabled: githubEnabled, repos, ownerLogins },
    im: { enabled: imEnabled, platforms, ownerAccounts },
    poll: {
      enabled: pollEnabled,
      pat: pollPat,
      repo: pollRepo,
      label: (env.IHUI_AUTOMATIONS_LABEL ?? '').trim() || 'automations:fix',
      maxRuns: toInt(env.IHUI_AUTOMATIONS_MAX_RUNS, 10, 1, 50),
      includeCodeScanning: env.IHUI_SUPER_AGENT_POLL_CODE_SCANNING === 'true',
    },
    issues,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
