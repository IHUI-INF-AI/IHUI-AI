// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 变更请求台账服务(F-Forge,2026-11-13 立)
 *
 * 判据全部落在"如实"二字:
 *  - 平台没适配器 ≠ 没有变更请求(必须 supported=false + provider-unsupported);
 *  - 列表失败 ≠ 空列表(fetchFailed=true,前端不得渲染空态文案);
 *  - 单条 CI 拉取失败 ≠ 整表失败(只让该条 checks=null);
 *  - 未完成的 check-run 不得宣称成功(pending)。
 */

import { describe, expect, it, vi } from 'vitest'

import {
  buildChangeRequestSnapshot,
  detectChangeRequestProvider,
  mapGithubCheckRuns,
  resolvePullRequestState,
  type ChangeRequestDeps,
} from '../src/services/change-request-service.js'

function deps(over: Partial<ChangeRequestDeps> = {}): ChangeRequestDeps {
  return {
    readRemoteUrl: async () => 'https://github.com/acme/demo.git',
    detectRepo: async () => ({ owner: 'acme', repo: 'demo' }),
    readBranches: async () => ({ currentBranch: 'feat/demo', defaultBranch: 'main' }),
    hasCredentials: () => true,
    listPullRequests: async () => [],
    listCheckRuns: async () => ({ check_runs: [] }),
    ...over,
  }
}

const rawPr = (over: Record<string, unknown> = {}) => ({
  number: 12,
  title: 'feat: demo',
  html_url: 'https://github.com/acme/demo/pull/12',
  state: 'open',
  draft: false,
  merged_at: null,
  user: { login: 'alice' },
  head: { ref: 'feat/demo', sha: 'abc123' },
  base: { ref: 'main' },
  updated_at: '2026-11-12T10:00:00Z',
  ...over,
})

describe('change-request-service / provider 与状态归并', () => {
  it('remote URL → 平台四值(github / gitee / gitlab / other)', () => {
    expect(detectChangeRequestProvider('git@github.com:o/r.git')).toBe('github')
    expect(detectChangeRequestProvider('https://gitee.com/o/r.git')).toBe('gitee')
    expect(detectChangeRequestProvider('https://gitlab.example.com/o/r.git')).toBe('gitlab')
    expect(detectChangeRequestProvider('https://example.com/o/r.git')).toBe('other')
    expect(detectChangeRequestProvider(null)).toBe('other')
    expect(detectChangeRequestProvider('')).toBe('other')
  })

  it('四态优先级 merged > closed > draft > open', () => {
    expect(resolvePullRequestState({ state: 'open', merged_at: '2026-01-01' })).toBe('merged')
    expect(resolvePullRequestState({ state: 'closed', draft: true })).toBe('closed')
    expect(resolvePullRequestState({ state: 'open', draft: true })).toBe('draft')
    expect(resolvePullRequestState({ state: 'open' })).toBe('open')
  })
})

describe('change-request-service / check-run 映射', () => {
  it('未完成 check-run 归 pending,completed 才看 conclusion', () => {
    const checks = mapGithubCheckRuns({
      check_runs: [
        { name: 'build', status: 'in_progress', conclusion: null },
        { name: 'lint', status: 'completed', conclusion: 'success' },
        { name: 'test', status: 'completed', conclusion: 'timed_out' },
      ],
    })
    expect(checks.map((c) => c.state)).toEqual(['pending', 'passed', 'failed'])
  })

  it('脏数据不抛错:缺 name 的条目直接丢弃,未知形态归 unknown', () => {
    const checks = mapGithubCheckRuns({
      check_runs: [
        { status: 'completed', conclusion: 'success' },
        null,
        { name: 'odd', status: 'completed', conclusion: 'wat' },
      ],
    })
    expect(checks).toHaveLength(1)
    expect(checks[0]).toMatchObject({ name: 'odd', state: 'unknown' })
  })

  it('非对象 / 缺 check_runs → 空数组', () => {
    expect(mapGithubCheckRuns(null)).toEqual([])
    expect(mapGithubCheckRuns({})).toEqual([])
  })
})

describe('change-request-service / 快照短路', () => {
  it('无 remote → no-remote(不查 PR、不谎报空列表)', async () => {
    const listPullRequests = vi.fn()
    const snapshot = await buildChangeRequestSnapshot(
      deps({ readRemoteUrl: async () => null, listPullRequests }),
    )
    expect(snapshot.supported).toBe(false)
    expect(snapshot.unsupportedReason).toBe('no-remote')
    expect(listPullRequests).not.toHaveBeenCalled()
  })

  it('gitee/gitlab → provider-unsupported(带 repo,仍给分支信息)', async () => {
    const snapshot = await buildChangeRequestSnapshot(
      deps({ readRemoteUrl: async () => 'https://gitee.com/acme/demo.git' }),
    )
    expect(snapshot.provider).toBe('gitee')
    expect(snapshot.supported).toBe(false)
    expect(snapshot.unsupportedReason).toBe('provider-unsupported')
    expect(snapshot.repo).toEqual({ owner: 'acme', repo: 'demo' })
    expect(snapshot.currentBranch).toBe('feat/demo')
  })

  it('无凭据 → credentials-missing,且不发任何 GitHub 请求', async () => {
    const listPullRequests = vi.fn()
    const snapshot = await buildChangeRequestSnapshot(
      deps({ hasCredentials: () => false, listPullRequests }),
    )
    expect(snapshot.supported).toBe(true)
    expect(snapshot.unsupportedReason).toBe('credentials-missing')
    expect(snapshot.credentialsReady).toBe(false)
    expect(listPullRequests).not.toHaveBeenCalled()
  })

  it('列表失败 → fetchFailed=true 且 items 为空(与 0 条严格区分)', async () => {
    const snapshot = await buildChangeRequestSnapshot(
      deps({
        listPullRequests: async () => {
          throw new Error('GitHub API 502')
        },
      }),
    )
    expect(snapshot.fetchFailed).toBe(true)
    expect(snapshot.items).toEqual([])
  })

  it('查询成功但 0 条 → fetchFailed=false', async () => {
    const snapshot = await buildChangeRequestSnapshot(deps(), { workspacePath: '/repo' })
    expect(snapshot.fetchFailed).toBe(false)
    expect(snapshot.items).toEqual([])
    expect(snapshot.credentialsReady).toBe(true)
  })
})

describe('change-request-service / 列表映射与排序', () => {
  it('当前分支优先,其余按 updatedAt 降序;CI 汇总正确', async () => {
    const snapshot = await buildChangeRequestSnapshot(
      deps({
        listPullRequests: async () => [
          rawPr({
            number: 1,
            head: { ref: 'feat/old', sha: 's1' },
            updated_at: '2026-11-01T00:00:00Z',
          }),
          rawPr({
            number: 2,
            head: { ref: 'feat/demo', sha: 's2' },
            updated_at: '2026-10-01T00:00:00Z',
          }),
          rawPr({
            number: 3,
            head: { ref: 'feat/new', sha: 's3' },
            updated_at: '2026-11-10T00:00:00Z',
          }),
        ],
        listCheckRuns: async ({ ref }) => ({
          check_runs:
            ref === 's2'
              ? [
                  { name: 'build', status: 'completed', conclusion: 'success' },
                  { name: 'test', status: 'completed', conclusion: 'failure' },
                ]
              : [],
        }),
      }),
    )
    expect(snapshot.items.map((i) => i.number)).toEqual([2, 3, 1])
    expect(snapshot.items[0]?.isCurrentBranch).toBe(true)
    expect(snapshot.items[0]?.checks).toEqual({
      summary: 'failing',
      passed: 1,
      failed: 1,
      total: 2,
    })
    // 其余条 CI 为 0 条检查 → summary='none'(已拉取但确实没有)
    expect(snapshot.items[1]?.checks).toEqual({ summary: 'none', passed: 0, failed: 0, total: 0 })
  })

  it('单条 CI 拉取失败只让该条 checks=null,不影响其他条', async () => {
    const snapshot = await buildChangeRequestSnapshot(
      deps({
        listPullRequests: async () => [
          rawPr({ number: 1, head: { ref: 'feat/a', sha: 'bad' } }),
          rawPr({ number: 2, head: { ref: 'feat/b', sha: 'good' } }),
        ],
        listCheckRuns: async ({ ref }) => {
          if (ref === 'bad') throw new Error('403')
          return { check_runs: [{ name: 'ok', status: 'completed', conclusion: 'success' }] }
        },
      }),
    )
    expect(snapshot.items.find((i) => i.number === 1)?.checks).toBeNull()
    expect(snapshot.items.find((i) => i.number === 2)?.checks?.summary).toBe('successful')
  })

  it('merged PR 归 merged 且 draft 标记为 false', async () => {
    const snapshot = await buildChangeRequestSnapshot(
      deps({
        listPullRequests: async () => [
          rawPr({ number: 9, state: 'closed', merged_at: '2026-11-01T00:00:00Z' }),
        ],
      }),
    )
    expect(snapshot.items[0]?.state).toBe('merged')
    expect(snapshot.items[0]?.draft).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
