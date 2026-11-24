// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-26:`/pulls/:n/files` 必须翻页,且 `truncated` 只在"确认没有下一页"时才为 false。
 * 覆盖:两页合取、恰好一页的页尾确认、页数上限时如实标截断、page 参数逐页递增。
 * 全部 stub transport,不连 GitHub。
 */
import { describe, it, expect } from 'vitest'

import type {
  GithubApiRequest,
  GithubApiResponse,
  GithubTransport,
} from '../src/services/github-app/jwt'
import type { PrCoordinates } from '../src/services/github-app/pr-review'
import {
  MAX_REVIEW_FILES,
  MAX_REVIEW_PAGES,
  fetchPrDiff,
} from '../src/services/github-app/pr-review'

const COORD: PrCoordinates = {
  owner: 'IHUI-INF-AI',
  repo: 'IHUI-AI',
  pullNumber: 26,
  installationId: 4242,
}

/** 响应带可选 headers:用来模拟 GitHub 的 Link 头(普通对象,键小写) */
type StubResponse = GithubApiResponse & { headers?: Record<string, string> }

function makeFiles(start: number, count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    filename: `src/file-${start + index}.ts`,
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
  }))
}

function pageOf(path: string): number {
  const matched = /[?&]page=(\d+)/.exec(path)
  return matched?.[1] ? Number(matched[1]) : 1
}

function nextLink(page: number): string {
  return `<https://api.github.com/repos/IHUI-INF-AI/IHUI-AI/pulls/26/files?per_page=${MAX_REVIEW_FILES}&page=${page}>; rel="next"`
}

function makeTransport(reply: (path: string) => StubResponse): {
  calls: GithubApiRequest[]
  transport: GithubTransport
} {
  const calls: GithubApiRequest[] = []
  const transport: GithubTransport = async (request) => {
    calls.push(request)
    return reply(request.path)
  }
  return { calls, transport }
}

describe('SDB-26 PR 文件翻页', () => {
  it('两页(第一页 100 + Link next,第二页 30 无 next)⇒ 合取 130 个且 truncated=false', async () => {
    const harness = makeTransport((path) => {
      const page = pageOf(path)
      if (page === 1) {
        return { status: 200, body: makeFiles(0, 100), headers: { link: nextLink(2) } }
      }
      if (page === 2) return { status: 200, body: makeFiles(100, 30), headers: {} }
      return { status: 404, body: null, headers: {} }
    })

    const diff = await fetchPrDiff(harness.transport, COORD)

    expect(diff.files).toHaveLength(130)
    expect(diff.filesTotal).toBe(130)
    expect(diff.files[129]?.filename).toBe('src/file-129.ts')
    expect(diff.truncated).toBe(false)
    expect(harness.calls).toHaveLength(2)
  })

  it('恰好 100 个且响应头无 Link ⇒ 确认页尾,truncated=false', async () => {
    const harness = makeTransport(() => ({
      status: 200,
      body: makeFiles(0, 100),
      headers: {},
    }))

    const diff = await fetchPrDiff(harness.transport, COORD)

    expect(diff.files).toHaveLength(100)
    expect(diff.filesTotal).toBe(100)
    expect(diff.truncated).toBe(false)
    // 有 Link 头且没有 next = 官方确认页尾,不必再探
    expect(harness.calls).toHaveLength(1)
  })

  it('transport 不提供响应头时,整页必须实际探下一页,空页才确认完整', async () => {
    const harness = makeTransport((path) => {
      const page = pageOf(path)
      if (page === 1) return { status: 200, body: makeFiles(0, 100) }
      return { status: 200, body: [], headers: {} }
    })

    const diff = await fetchPrDiff(harness.transport, COORD)

    expect(diff.files).toHaveLength(100)
    expect(diff.truncated).toBe(false)
    expect(harness.calls.map((call) => pageOf(call.path))).toEqual([1, 2])
  })

  it('每页都有 next 且达到页数上限 ⇒ truncated=true,不静默', async () => {
    const harness = makeTransport((path) => {
      const page = pageOf(path)
      return {
        status: 200,
        body: makeFiles((page - 1) * MAX_REVIEW_FILES, MAX_REVIEW_FILES),
        headers: { link: nextLink(page + 1) },
      }
    })

    const diff = await fetchPrDiff(harness.transport, COORD)

    expect(harness.calls).toHaveLength(MAX_REVIEW_PAGES)
    expect(diff.files).toHaveLength(MAX_REVIEW_PAGES * MAX_REVIEW_FILES)
    expect(diff.truncated).toBe(true)
  })

  it('请求 URL 带 per_page,且 page 参数逐页递增', async () => {
    const harness = makeTransport((path) => {
      const page = pageOf(path)
      if (page === 1) {
        return { status: 200, body: makeFiles(0, 100), headers: { link: nextLink(2) } }
      }
      if (page === 2) {
        return { status: 200, body: makeFiles(100, 100), headers: { link: nextLink(3) } }
      }
      return { status: 200, body: makeFiles(200, 20), headers: {} }
    })

    const diff = await fetchPrDiff(harness.transport, COORD)

    // 首页沿用原 URL(不带 page,GitHub 缺省即第 1 页),后续页显式递增
    expect(harness.calls.map((call) => call.path)).toEqual([
      `/repos/IHUI-INF-AI/IHUI-AI/pulls/26/files?per_page=${MAX_REVIEW_FILES}`,
      `/repos/IHUI-INF-AI/IHUI-AI/pulls/26/files?per_page=${MAX_REVIEW_FILES}&page=2`,
      `/repos/IHUI-INF-AI/IHUI-AI/pulls/26/files?per_page=${MAX_REVIEW_FILES}&page=3`,
    ])
    expect(diff.files).toHaveLength(220)
    expect(diff.truncated).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
