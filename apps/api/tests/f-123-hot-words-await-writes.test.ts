// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-123 回归:GitHub Trending 采集必须**等写入完成**,且计数与实际写入一致。
 *
 * 修前是 `.each((_, el) => { upsertHotWord(repo, pos++); n++ })`:
 * - 回调不是 async,`upsertHotWord` 返回的 Promise 既没 await 也没 catch ⇒ DB 失败时
 *   日志仍报 success,库里一条没写(unhandledRejection 只记日志);
 * - `n++` 在 DB 操作发起前就执行 ⇒ count 与实际写入数无关;
 * - `Math.min(n, 15)` 只截返回值,库里的条数不受 15 约束。
 *
 * 本文件用一个"慢且会失败"的假 db 驱动 `syncHotWords()`,钉住:
 * ① 写入真被 await:函数 resolve 时,所有插入已经发生(不是之后才陆续发生);
 * ② 计数与实际成功写入一致:失败一条就少一条,不虚高;
 * ③ 异常不被吞成 success:写入抛错时该源标 error,而不是"success + 0 条";
 * ④ 上限 15 在收集阶段生效:页面给 40 条时只写 15 条。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const inserted: string[] = []
let failOn: string | null = null
let insertDelayMs = 0

vi.mock('../src/db/index.js', () => {
  const chain = (rows: unknown[]) => {
    const p: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'orderBy', 'set', 'returning']) {
      p[m] = () => p
    }
    p.then = (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve)
    p.values = async (v: { word: string }) => {
      if (insertDelayMs) await new Promise((r) => setTimeout(r, insertDelayMs))
      if (failOn && v.word === failOn) throw new Error(`insert failed: ${v.word}`)
      inserted.push(v.word)
      return { ok: true }
    }
    return p
  }
  return { db: { select: () => chain([]), insert: () => chain([]), update: () => chain([]) } }
})

vi.mock('@ihui/database', () => ({
  hotWords: { id: 'id', word: 'word', sort: 'sort', status: 'status', updatedAt: 'updatedAt' },
}))

const { syncHotWords } = await import('../src/jobs/hot-words-sync.js')

function trendingHtml(count: number): string {
  const items = Array.from(
    { length: count },
    (_, i) => `<article><h2><a href="/owner${i}/repo${i}">owner${i}/repo${i}</a></h2></article>`,
  ).join('')
  return `<html><body>${items}</body></html>`
}

beforeEach(() => {
  inserted.length = 0
  failOn = null
  insertDelayMs = 0
  vi.unstubAllGlobals()
})

function stubFetch(trendingCount: number): void {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.includes('github.com/trending')) {
      return { ok: true, text: async () => trendingHtml(trendingCount) }
    }
    // HN / 百度:返回空结果,避免干扰本票判据
    return { ok: true, json: async () => ({}), text: async () => '' }
  })
}

describe('F-123 GitHub Trending 采集等待写入', () => {
  it('① 函数 resolve 时插入已全部完成(不是之后才发生)', async () => {
    stubFetch(5)
    insertDelayMs = 5

    await syncHotWords()

    // 若 Promise 未被 await,这里会是 0(插入还在后台排队)
    expect(inserted.length).toBeGreaterThanOrEqual(1)
    expect(inserted.length).toBe(5)
  })

  it('④ 上限 15 在收集阶段生效', async () => {
    stubFetch(40)
    await syncHotWords()
    expect(inserted.length).toBe(15)
  })

  it('② 计数与实际成功写入一致', async () => {
    stubFetch(3)
    const results = await syncHotWords()
    const gh = results.find((r) => r.source === 'github-trending')
    expect(gh?.count).toBe(3)
    expect(inserted.length).toBe(3)
  })

  it('③ 写入抛错时该源标 error,而不是 success + 0 条', async () => {
    stubFetch(3)
    failOn = 'owner1/repo1'

    const results = await syncHotWords()
    const gh = results.find((r) => r.source === 'github-trending')

    expect(gh?.status).toBe('error')
    expect(gh?.count).toBe(0)
    // 失败点之前的写入是真发生的(不是"整批静默丢弃")
    expect(inserted).toContain('owner0/repo0')
    expect(inserted).not.toContain('owner1/repo1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
