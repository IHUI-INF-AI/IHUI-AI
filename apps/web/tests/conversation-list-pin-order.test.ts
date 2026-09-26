// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 尾票(取消置顶即时落位)的 **web 侧装车证明**。
//
// 为什么判"源码形态"而不是渲染结果:这两页是服务端取数 + React Query 的页面级组件,
// 在 jsdom 里渲染要把 fetchApi/query client/next-intl 全套桩起来,而那套桩一旦与真实
// 取数形态漂移,测的就不是"有没有排序"而是"桩像不像"。所以这里钉的是**结构事实**
// (items 必须过唯一排序出口),行为正确性由 `packages/shared/src/chat/__tests__/
// conversation-pin-reorder.test.ts` 的 index 级断言 + 独立计数公式负责 —— 两半各判一件事。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 判据:该页面源码是否把列表items 经过 `sortPinnedFirst` 出口。
 * 只认**调用形态**(排序函数真被用到),不认"文件里出现过这个名字"——
 * 否则一句注释、一个未使用的 import 都能骗绿(本仓最高频失效型就是"看起来有、其实没装车")。
 */
function sortsItemsAtSource(src: string): boolean {
  const importsSort = /import\s*\{[^}]*\bsortPinnedFirst\b[^}]*\}\s*from\s*['"]@ihui\/shared['"]/.test(
    src,
  )
  const appliesToItems = /const\s+items\s*=\s*sortPinnedFirst\s*\(/.test(src)
  return importsSort && appliesToItems
}

const PAGES = [
  'app/(main)/chat/history/page.tsx',
  'app/(main)/chat/favorites/page.tsx',
] as const

describe('D20 web 侧置顶落位装车证明', () => {
  it('两个会话列表页都把 items 过唯一排序出口(缺一个即"取消置顶原地停留"窗口)', () => {
    for (const rel of PAGES) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      expect(sortsItemsAtSource(src), `${rel} 的 items 未经 sortPinnedFirst`).toBe(true)
    }
  })

  it('判据本身有牙:未排序的源码必须判 false,只用名字不算通过', () => {
    const unsorted = `import { sortPinnedFirst } from '@ihui/shared'\nconst items = data ?? []\n`
    expect(sortsItemsAtSource(unsorted)).toBe(false)
    // 反向:真调用了但没从共享层引(端内自造第二份排序)同样不合格
    const homemade = `const sortPinnedFirst = (x) => x\nconst items = sortPinnedFirst(data ?? [])\n`
    expect(sortsItemsAtSource(homemade)).toBe(false)
    const good = `import { sortPinnedFirst } from '@ihui/shared'\nconst items = sortPinnedFirst(data ?? [])\n`
    expect(sortsItemsAtSource(good)).toBe(true)
  })

  it('排序出口只有一份实现:页面里不得再写 pinned 分区排序', () => {
    for (const rel of PAGES) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      // 端内自写 `.sort(` 判据(守门 40 / §3 共享层优先同一取向)
      expect(src.includes('.sort('), `${rel} 里出现了第二份排序实现`).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
