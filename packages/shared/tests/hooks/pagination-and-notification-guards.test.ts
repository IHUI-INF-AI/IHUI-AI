// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * XUI-022 / XUI-025 / XUI-032 结构锁。
 * 本包 vitest 跑在 node 环境(无 jsdom/@testing-library),hooks 无法渲染;
 * 这三条缺陷的判据恰好是"入口同步锁 / finally 解锁 / 引用稳定",用源码级断言钉住,
 * 防止后续把 ref 锁改回 state 闭包。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const LOAD_MORE = read('src/hooks/use-load-more.ts')
const PAGINATED = read('src/hooks/use-paginated-list.ts')
const STORE = read('src/notifications/notification-store.tsx')

describe('XUI-025 useLoadMore:fetch 失败必须 finally 解锁', () => {
  it('await fetch 被 try 包住,解锁写在 finally 里', () => {
    expect(LOAD_MORE).toMatch(/try \{\s*const hasMore = await fetch\(/)
    expect(LOAD_MORE).toMatch(/finally \{\s*loadingRef\.current = false/)
  })
})

describe('XUI-032 usePaginatedList:同 tick 连点只取一页', () => {
  it('loadMore 用 ref 同步锁,而不是 state loadingMore', () => {
    expect(PAGINATED).toMatch(/if \(loadingMoreLockRef\.current \|\| !hasMore\) return/)
    expect(PAGINATED).toMatch(/const loadingMoreLockRef = useRef\(false\)/)
  })

  it('过期响应由 requestSeq 丢弃,且收尾在 finally 中只由最新请求执行', () => {
    expect(PAGINATED).toMatch(/const requestSeqRef = useRef\(0\)/)
    expect(PAGINATED).toMatch(/if \(seq !== requestSeqRef\.current\) return/)
    expect(PAGINATED).toMatch(/finally \{[\s\S]*?if \(seq === requestSeqRef\.current\)/)
  })

  it('fetcher 抛错也收尾(不再把 loadingMore 永久挂住)', () => {
    expect(PAGINATED).toMatch(/catch \(err\) \{[\s\S]*?setError\(/)
  })
})

describe('XUI-022 NotificationProvider:addFromWs 引用稳定且按 id 去重', () => {
  it('addFromWs 由 useCallback 包裹(空依赖)', () => {
    expect(STORE).toMatch(/const addFromWs = useCallback\(\(msg: WSNotification \| null\) => \{/)
    expect(STORE).toMatch(/\}, \[\]\)\s*\n\s*\n\s*const markAllRead/)
  })

  it('插入前按 id 去重,重连重放不会重复入列', () => {
    expect(STORE).toMatch(/if \(prev\.some\(\(n\) => n\.id === entry\.id\)\) return prev/)
  })

  it('Context value 用 useMemo 收敛(consumer effect 不因每次渲染重建而重跑)', () => {
    expect(STORE).toMatch(/const value = useMemo\(/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
