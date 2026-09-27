// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `PLATFORM_REGISTRY[].setupHint` 指向的文档锚点必须**真的跳得到**(2026-09-27 立)。
 *
 * 起因:14 条提示写着 `docs/PUBLISH_SETUP.md#juejin` 这类锚点,而文档标题是
 * `### 4.12 \`juejin\` — 掘金(...)`,渲染器算出的 slug 是整条标题(含中文与序号),
 * **不是** `#juejin` ⇒ 用户按提示打开文档,一条都落不了地。文档新建时(同日 `beb4e0cf0`)
 * 只核了"文件在不在",没核"锚点解析不解析得到" —— 这正是本仓反复登记的
 * "产物存在 ≠ 能力在线"(守门 105/64/70/81 同型)。
 *
 * 现在文档里每个平台小节都带显式 `<a id="<platform>"></a>`,本文件钉住两件事:
 * ① 每条 `setupHint` 里的 `PUBLISH_SETUP.md#anchor` 必须能在文档里找到同名锚点;
 * ② 锚点不得只存在于文档而注册表没人指(反向腐烂),也不得注册表指了而文档没有。
 * 平台 id 列表取自源码文本、条目内容经导出的 `findPlatformEntry()` 取 ——
 * 不把第二份清单抄进测试(清单腐烂是本仓最高频失效型)。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { findPlatformEntry } from '../src/routes/publish-routes.js'

const here = dirname(fileURLToPath(import.meta.url))
const ROUTES_SRC = resolve(here, '../src/routes/publish-routes.ts')
const DOC_PATH = resolve(here, '../../../docs/PUBLISH_SETUP.md')

/** 从源码里枚举注册表写着的 platformId(注册表本体未导出,但逐条内容必须走 findPlatformEntry)。 */
function registryPlatformIds(): string[] {
  const src = readFileSync(ROUTES_SRC, 'utf8')
  const ids: string[] = []
  const re = /platformId:\s*'([a-z0-9_]+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  return ids
}

function anchorOf(hint: string): string | null {
  const m = /PUBLISH_SETUP\.md#([A-Za-z0-9_-]+)/.exec(hint)
  return m ? m[1] : null
}

describe('publish setupHint 与文档锚点的契约', () => {
  const doc = readFileSync(DOC_PATH, 'utf8')
  const ids = registryPlatformIds()
  const docAnchors = [...doc.matchAll(/<a id="([a-z0-9_]+)"><\/a>/g)].map((m) => m[1])

  it('枚举到注册表条目与文档锚点(空扫描不算通过)', () => {
    expect(ids.length).toBeGreaterThanOrEqual(14)
    expect(docAnchors.length).toBeGreaterThanOrEqual(14)
  })

  it('每条带锚点的 setupHint 都能在文档里解析得到', () => {
    const broken: string[] = []
    for (const pid of ids) {
      const entry = findPlatformEntry(pid)
      if (!entry) {
        broken.push(`${pid}: 源码写了 platformId 但 findPlatformEntry 取不到条目`)
        continue
      }
      expect(entry.setupHint, `${pid}: setupHint 为空`).toBeTruthy()
      const anchor = anchorOf(entry.setupHint)
      if (!anchor) continue
      if (!docAnchors.includes(anchor)) broken.push(`${pid}: #${anchor} 在文档里没有同名锚点`)
    }
    expect(broken, `断链清单:\n${broken.join('\n')}`).toEqual([])
  })

  it('文档里的平台锚点必须都被注册表指到(反向防腐烂)', () => {
    const referenced = new Set<string>()
    for (const pid of ids) {
      const anchor = anchorOf(findPlatformEntry(pid)?.setupHint ?? '')
      if (anchor) referenced.add(anchor)
    }
    const orphan = docAnchors.filter((a) => !referenced.has(a))
    expect(
      orphan,
      `这些锚点写在文档里却无人指向(登记表与文档不同步): ${orphan.join(', ')}`,
    ).toEqual([])
  })

  it('阳性对照:不存在的锚点必被本契约判为断链', () => {
    // 这条防的是"判据写成恒真" —— 造一个指向缺失锚点的 hint,断链清单必须点名它。
    const fake = '参考 docs/PUBLISH_SETUP.md#no-such-platform-anchor'
    expect(anchorOf(fake)).toBe('no-such-platform-anchor')
    expect(docAnchors.includes('no-such-platform-anchor')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
