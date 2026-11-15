// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-123 回归锁(2026-11-13)。
 *
 * 本文件锁「GitHub 热搜写入必须逐条 await、失败逐条计入 failed」:
 *   注入假写入函数,三条候选分别走 inserted / updated / reject;
 *   ① resolve 时 inserted/updated/failed/count 与实际写入一致,失败摘要保留;
 *   ② 用 pending 计数器证明 resolve 前所有写入 Promise 都已 settled,
 *      且串行执行(任意时刻只有一条在写)。
 * 回退到 `.each` 不 await(或只收集不 await)时,② 的 pending 不为 0、计数为 0 ⇒ 红。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

vi.mock('@ihui/database', () => ({
  hotWords: { id: 'id', word: 'word', sort: 'sort', status: 'status', updatedAt: 'updatedAt' },
}))

const { syncHotWords } = await import('../src/jobs/hot-words-sync.js')

const GITHUB_HTML = `<html><body>
<article><h2><a href="/acme/ok">acme/ok</a></h2></article>
<article><h2><a href="/acme/upd">acme/upd</a></h2></article>
<article><h2><a href="/acme/boom">acme/boom</a></h2></article>
</body></html>`

/** 假 fetch:HN/百度返回空,只有 GitHub 给 3 条候选,避免干扰判据。 */
function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: string) => {
    const url = String(input)
    if (url.includes('github.com/trending')) {
      return { ok: true, text: async () => GITHUB_HTML }
    }
    if (url.includes('hacker-news.firebaseio.com')) {
      return { ok: true, json: async () => [] }
    }
    return { ok: true, json: async () => ({}) }
  })
}

let pendingWrites = 0
let maxPendingWrites = 0
const attempted: string[] = []

/** 假写入:慢 10ms 后落定;acme/boom 抛错,acme/upd 走更新分支。 */
async function fakeWrite(word: string): Promise<'inserted' | 'updated'> {
  pendingWrites++
  maxPendingWrites = Math.max(maxPendingWrites, pendingWrites)
  try {
    await new Promise((resolve) => setTimeout(resolve, 10))
    attempted.push(word)
    if (word === 'acme/boom') throw new Error('db write failed: acme/boom')
    return word === 'acme/upd' ? 'updated' : 'inserted'
  } finally {
    pendingWrites--
  }
}

beforeEach(() => {
  pendingWrites = 0
  maxPendingWrites = 0
  attempted.length = 0
  vi.unstubAllGlobals()
})

describe('F-123 热搜写入 await 与逐条失败计数', () => {
  it('① 失败被计数、成功按 inserted/updated 拆分,摘要保留', async () => {
    stubFetch()

    const results = await syncHotWords({ write: fakeWrite })
    const gh = results.find((r) => r.source === 'github-trending')

    expect(gh?.inserted).toBe(1)
    expect(gh?.updated).toBe(1)
    expect(gh?.failed).toBe(1)
    expect(gh?.count).toBe(2)
    expect(gh?.status).toBe('error')
    expect(gh?.errors).toHaveLength(1)
    expect(gh?.errors?.[0]).toContain('acme/boom')
    expect(gh?.errors?.[0]).toContain('db write failed')
    // 串行:三条按页面顺序逐条尝试,失败不中断后续
    expect(attempted).toEqual(['acme/ok', 'acme/upd', 'acme/boom'])
  })

  it('② 函数返回前所有写入 Promise 已 settled,且串行无并发', async () => {
    stubFetch()

    const results = await syncHotWords({ write: fakeWrite })
    const gh = results.find((r) => r.source === 'github-trending')

    // 回退成不 await:这里会是 3(仍在等待 10ms 的假写入)或计数为 0
    expect(pendingWrites).toBe(0)
    expect(maxPendingWrites).toBe(1)
    expect(gh?.inserted).toBe(1)
    expect(gh?.updated).toBe(1)
    expect(gh?.failed).toBe(1)
  })
})
