// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 防回潮形状锁(2026-10-25 立)。
 *
 * 修掉的那件事:侧边栏「自定义」栏的数据层曾经拿"此刻可见的导航项集合"当**有效性**判据,
 * 而那个集合是异步攒出来的(admin 后台路由每次挂载由 useAdminRouters() 现拉,刻意无模块级
 * 缓存)。集合不完整的那一刻,"不在集合里"被读成"这收藏已失效"⇒ 静默删用户数据,还随下一次
 * 编辑整表覆盖回云端 ⇒ 用户看到的就是"换设备要重设、各设备还不一致"。
 *
 * 现在住的边界:数据层只清洗形状,可见性判断留在渲染层(CustomNavSection 的 itemMap 查不到
 * 就不渲染)。行为面由同目录 custom-nav-sync.test.ts / custom-nav-section-overlay.test.tsx 钉;
 * 本文件钉的是**接线形状**——把可见集重新接回数据层(哪怕只是加一个可选参数)都会当场翻红,
 * 而这类改动在 code review 里最难被看出来,因为它长得像"修好了一个死链过滤"。
 */

const here = dirname(fileURLToPath(import.meta.url))
// apps/web/src/components/sidebar/__tests__ → 仓库根(六层:__tests__/sidebar/components/src/web/apps)
const repoRoot = resolve(here, '../../../../../../')
const readSrc = (rel: string): string => readFileSync(resolve(repoRoot, rel), 'utf8')

const hookPath = 'apps/web/src/components/sidebar/use-custom-nav.ts'
const sectionPath = 'apps/web/src/components/sidebar/CustomNavSection.tsx'
const hookSrc = readSrc(hookPath)
const sectionSrc = readSrc(sectionPath)

/** 取到下一个顶层标记之前的片段;锚取不到就抛,不静默返回空串冒充"没有违规"。 */
function fromAnchor(src: string, anchor: string, endAnchor: string, label: string): string {
  const s = src.indexOf(anchor)
  if (s < 0) throw new Error(`${label}:前锚不在位 ${anchor}`)
  const e = src.indexOf(endAnchor, s)
  if (e < 0) throw new Error(`${label}:后锚不在位 ${endAnchor}`)
  return src.slice(s, e)
}

describe('自定义栏数据层:可见性集合不得再接回有效性判定', () => {
  it('数据层不 import 导航表(ALL_NAV_HREFS 重新被引回 = 那个 bug 回来了)', () => {
    expect(hookSrc).not.toContain(`from './nav-data'`)
    expect(hookSrc).not.toContain('ALL_NAV_HREFS')
  })

  it('useCustomNav() 必须无参(调用方再传"当前可见项"就是重走老路)', () => {
    expect(hookSrc).toMatch(/export function useCustomNav\(\)\s*:\s*CustomNavApi/)
  })

  it('清洗函数里不许再出现集合成员判断(只判类型与重复)', () => {
    const body = fromAnchor(
      hookSrc,
      'function filterValid(',
      '\nfunction readUserHrefs(',
      'filterValid',
    )
    expect(body).not.toContain('.has(')
    expect(body).toContain('out.includes(h)') // 去重这一半必须还在,摘掉它=重复 React key
  })

  it('调用方确实不带参地用它,并保留渲染层的可见性过滤(死链由这里挡)', () => {
    expect(sectionSrc).toMatch(/useCustomNav\(\)/)
    expect(sectionSrc).toContain('itemMap.get(href)')
    expect(sectionSrc).toContain('i !== undefined')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
