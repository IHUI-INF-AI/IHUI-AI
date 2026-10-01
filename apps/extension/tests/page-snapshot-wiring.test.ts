// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展侧接线对账（防"造好没装车"）。
 *
 * 这里刻意**不测 DOM**（扩展 vitest 档案是 environment:'node'，本机无可解析的 jsdom），
 * 测的是三件只在这里才成立的事：
 * 1. 共享包的 `executeDomAction` 真的认识句柄族动词 —— 否则 background 的 `isDomAction`
 *    判 false，动作在转发前就被打成 UNSUPPORTED_ACTION；
 * 2. `entrypoints/content.ts` 的 `agent.action.dom` 通道确实把动作交给了同一个
 *    `executeDomAction`，端内没有第二份执行体；
 * 3. 本端 adapter 只做"文档身份 + 委派"，没有把语义再实现一遍。
 * 真实浏览器上的行为取证在 CLI 侧（apps/cli/tests/browser-page-snapshot.cdp.test.ts）；
 * 两端跑的是同一份页内实现，所以那次的结论对本端同样成立。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DOM_ACTIONS, PAGE_ACTIONS, isDomAction } from '@ihui/dom-actions'
import { executePageActionInThisDocument } from '../lib/page-snapshot-adapter'

const contentSource = readFileSync(
  fileURLToPath(new URL('../entrypoints/content.ts', import.meta.url)),
  'utf8',
)
const agentControlSource = readFileSync(
  fileURLToPath(new URL('../lib/agent-control.ts', import.meta.url)),
  'utf8',
)
const adapterSource = readFileSync(
  fileURLToPath(new URL('../lib/page-snapshot-adapter.ts', import.meta.url)),
  'utf8',
)
const bridgeSource = readFileSync(
  fileURLToPath(new URL('../lib/agent-control-bridge.ts', import.meta.url)),
  'utf8',
)

describe('句柄族动词已进入扩展的 DOM 转发面', () => {
  it('DOM_ACTIONS 覆盖全部页内动词，且 isDomAction 认它们', () => {
    for (const action of PAGE_ACTIONS) {
      expect(DOM_ACTIONS.has(action), `${action} 未进 DOM_ACTIONS`).toBe(true)
      expect(isDomAction(action)).toBe(true)
    }
  })

  it('content.ts 的 agent.action.dom 通道指向共享执行器（端内不再实现一份）', () => {
    const channel = contentSource.slice(contentSource.indexOf("'agent.action.dom'"))
    expect(channel.slice(0, 900)).toContain('executeDomAction')
    expect(agentControlSource).toContain('export { executeDomAction, isDomAction }')
  })

  it('adapter 只加文档身份并委派，不复制语义', () => {
    expect(adapterSource).toContain('executeDomAction(action as PageActionType')
    expect(adapterSource).toContain('pageScope')
    expect(adapterSource).not.toContain('querySelector')
    expect(adapterSource).not.toContain('dispatchEvent')
  })
})

describe('句柄族动词已进入能力申报（防"能执行但没人知道自己能"）', () => {
  it('bridge 上报 browserPageActions，动词派生自 PAGE_ACTIONS 而非手抄第二份清单', () => {
    // 端内 `isDomAction` 早已认下这七个动词（上面第一段已证），缺的只是申报那一行。
    expect(bridgeSource).toContain('browserPageActions: BROWSER_PAGE_ACTIONS')
    // 派生而非手抄：手抄一份字面量就是第二份真相，共享包扩动词时它不会跟着长。
    expect(bridgeSource).toContain(
      'const BROWSER_PAGE_ACTIONS: BrowserPageControlActionType[] = [...PAGE_ACTIONS]',
    )
    const handCopied = bridgeSource.match(/'page_[a-z_]+'/g) ?? []
    expect(handCopied, `bridge 里出现了手抄的 page_* 动词字面量：${handCopied.join(', ')}`).toEqual(
      [],
    )
  })

  it('运行期真值：PAGE_ACTIONS 七条全部进入 DOM_ACTIONS，因此申报出去的名字端上确实接得住', () => {
    // 上面那条管"有没有装车"，这条管"装的是不是同一份"：断言的是集合关系，
    // 不重复抄一遍动词清单（抄了就又成了第三份真相）。
    expect(PAGE_ACTIONS).toHaveLength(7)
    for (const action of PAGE_ACTIONS) expect(DOM_ACTIONS.has(action)).toBe(true)
  })
})

describe('非页内环境的诚实返回（扩展 service worker 落这一支）', () => {
  it('无 DOM 上下文时报 PAGE_API_UNAVAILABLE 而非崩，并照实说"没有 scope"', async () => {
    const result = await executePageActionInThisDocument('page_snapshot', {})
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('PAGE_API_UNAVAILABLE')
    expect(result.data?.sideEffect).toBe('none')
    expect(result.data?.pageScope).toBeNull()
  })

  it('非句柄族动词被本端挡下，不投给共享执行器', async () => {
    const result = await executePageActionInThisDocument('click_element', { selector: '#x' })
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('UNSUPPORTED_ACTION')
  })

  it('旧选择器动词没被新支路吞掉（两支在同一个入口里分流）', () => {
    expect(isDomAction('click_element')).toBe(true)
    const { isPageAction } = { isPageAction: (a: string) => PAGE_ACTIONS.includes(a as never) }
    expect(isPageAction('click_element')).toBe(false)
    expect(isPageAction('page_click')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
