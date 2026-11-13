// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 句柄族动词 ↔ @ihui/dom-actions 契约的静态对账。
 *
 * 立因：契约有 7 个动词，CLI 的注册清单长期只有 5 个（缺 `page_select` / `page_hover`），
 * 而 tsc、既有 CDP 测试、守门链三方都不红 —— 清单式数组注册的失效形态永远是"安静"。
 * 本文件要钉的是**不变量**而不是某几条名字：
 *   「凡契约登记的动词，CLI 必须有同名执行体；凡 CLI 登记的，契约必须认账」
 * 双向都判，因为多报同样是债（模型看得见却执行不了的工具名 = 谎报能力）。
 *
 * 刻意不需要真实浏览器：与 `browser-page-snapshot.cdp.test.ts` 分工不同 ——
 * 那个测的是"动词真能改页面"，本文件测的是"动词有没有被接进执行链"，后者必须能在
 * 任何环境（含 CI / 无 Chrome 的开发机）跑起来，否则它兜不住下一次漏接。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGE_ACTIONS, PAGE_READONLY_ACTIONS } from '@ihui/dom-actions'
import { BROWSER_PAGE_TOOLS } from '../src/tools/browser-page.js'
import type { Tool } from '../src/tools/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')

/** 宿主侧工具名的唯一冠词规则（与 ai-service `page_control_bridge._TOOL_NAME_PREFIX` 同形）。 */
const toolNameOf = (action: string): string => `browser_${action}`

/**
 * 取注册名时**必须**容得下"槽位是 undefined"。
 * 注册表现在由 `PAGE_ACTIONS.map(...)` 派生，契约新增动词而本端没实现时，那个槽位就是
 * undefined —— 若在这里直接 `.name`，套件会在 import 期崩成 `0 test / no tests`，
 * CI 只报"这个文件失败了"而不说缺哪个动词。第一版就是这样，变异实测过。
 */
function slotAt(index: number): { tool?: Tool; label: string } {
  const action = PAGE_ACTIONS[index]
  const tool = BROWSER_PAGE_TOOLS[index] as Tool | undefined
  return { tool, label: action ? toolNameOf(action) : `#${index}` }
}

const registeredNames = BROWSER_PAGE_TOOLS.map((t) => t?.name ?? '∅').filter((n) => n !== '∅').sort()
const contractNames = PAGE_ACTIONS.map(toolNameOf).sort()

describe('CLI 句柄族 ↔ 契约对账', () => {
  it('契约每一项在 CLI 都有执行体，且注册名与动词严格一一对应', () => {
    const problems: string[] = []
    PAGE_ACTIONS.forEach((action, i) => {
      const { tool } = slotAt(i)
      if (!tool) problems.push(`缺少执行体: ${toolNameOf(action)}`)
      else if (tool.name !== toolNameOf(action)) problems.push(`${action}: 注册名 "${tool.name}" 与契约不符`)
    })
    expect(problems).toEqual([])
  })

  it('CLI 不得申报契约之外的 browser_page_* 动词（多一个也是漂移）', () => {
    const extra = registeredNames.filter((n) => n.startsWith('browser_page_') && !contractNames.includes(n))
    expect(extra, `CLI 申报了契约里没有的动词: ${extra.join(', ')}`).toEqual([])
  })

  it('两侧数量必须等于契约长度，且顺序恒随 PAGE_ACTIONS', () => {
    expect(BROWSER_PAGE_TOOLS).toHaveLength(PAGE_ACTIONS.length)
    expect(PAGE_ACTIONS.map((_, i) => slotAt(i).tool?.name)).toEqual(PAGE_ACTIONS.map(toolNameOf))
  })

  it('只读档必须与契约同源：契约里非只读的动词不得标成 read', () => {
    const readonlyNames = new Set(PAGE_READONLY_ACTIONS.map(toolNameOf))
    for (let i = 0; i < PAGE_ACTIONS.length; i++) {
      const { tool, label } = slotAt(i)
      if (!tool) continue // 缺执行体由第一条点名，这里不重复报
      const expected = readonlyNames.has(label) ? 'read' : 'write'
      expect(tool.dangerLevel, `${label} 的 dangerLevel 与契约只读档不符`).toBe(expected)
    }
  })

  it('除两条只读动词外，每个动词都必须把 handle 列为必填', () => {
    const readonlyNames = new Set(PAGE_READONLY_ACTIONS.map(toolNameOf))
    for (let i = 0; i < PAGE_ACTIONS.length; i++) {
      const { tool, label } = slotAt(i)
      if (!tool || readonlyNames.has(label)) continue
      expect(tool.required, `${label} 必须要求 handle`).toContain('handle')
    }
  })
})

describe('装车证明', () => {
  it('BROWSER_PAGE_TOOLS 必须真的被注册进工具表（否则注册面是死的）', () => {
    const src = readFileSync(join(REPO, 'apps', 'cli', 'src', 'tools', 'index.ts'), 'utf8')
    expect(src).toMatch(/registerTools\(\s*BROWSER_PAGE_TOOLS\s*\)/)
  })

  it('注册表必须是 Record<PageActionType, Tool> —— 退回数组清单就等于拆掉编译期护栏', () => {
    const src = readFileSync(join(REPO, 'apps', 'cli', 'src', 'tools', 'browser-page.ts'), 'utf8')
    expect(src).toMatch(/Record<PageActionType,\s*Tool>/)
    expect(src).toMatch(/PAGE_ACTIONS\.map\(/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
