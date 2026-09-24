// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 句柄族契约测试（CLI 侧，纯逻辑）。
 *
 * 覆盖不依赖浏览器的四条判据中的三条（预算分账 / 截断阶梯 / 确定性标记）+ 句柄格式。
 * 真实 DOM 取证在同目录 `browser-page-snapshot.cdp.test.ts`（真 Chrome + 真 HTTP 页）。
 * 这里的行数据是**合成夹具**，只用于验证宿主侧算法，不代表页面抓取结果。
 */
import { describe, expect, it } from 'vitest'
import {
  PAGE_ACTIONS,
  SNAPSHOT_ROW_PROTECTED_FIELDS,
  clampPageSnapshotBudget,
  formatPageHandle,
  isPageAction,
  parsePageHandle,
  renderSnapshot,
  runPageAction,
  serializeSnapshotResult,
  type PageElementRow,
  type PageSnapshotBudget,
  type PageSnapshotRaw,
} from '@ihui/dom-actions'

const SCOPE = 'abcdefgh'

function row(serial: number, over?: Partial<PageElementRow>): PageElementRow {
  return {
    handle: formatPageHandle(SCOPE, serial),
    role: 'button',
    name: `按钮 ${serial}`,
    value: 'x',
    inViewport: true,
    depth: 3,
    attrs: { id: `b${serial}` },
    rect: [10, 20, 100, 30],
    ...over,
  }
}

function rawOf(overrides: Partial<PageSnapshotRaw> = {}): PageSnapshotRaw {
  return {
    schema: 1,
    scope: SCOPE,
    title: '测试页',
    url: 'https://example.test/',
    rows: [row(0), row(1)],
    body: [{ text: '甲'.repeat(50), heading: '第一章' }],
    counts: {
      interactiveFound: 2,
      rowsEmitted: 2,
      bodyCharsFound: 50,
      bodyCharsEmitted: 50,
      crossOriginFrames: 0,
    },
    ...overrides,
  }
}

function budgetOf(over: Partial<PageSnapshotBudget> = {}): PageSnapshotBudget {
  return {
    maxRows: 40,
    maxRowChars: 200,
    bodyChars: 120,
    maxBodyBlocks: 20,
    attrsChars: 60,
    labelChars: 40,
    ...over,
  }
}

describe('契约：句柄格式', () => {
  it('页内拼出的句柄必须被宿主解析器原样读回', () => {
    const handle = formatPageHandle(SCOPE, 42)
    expect(parsePageHandle(handle)).toEqual({ scope: SCOPE, serial: 42 })
  })

  it('非规范串一律判不合法，不得当成"没找到"糊过去', () => {
    expect(parsePageHandle('el:short:1')).toBeNull()
    expect(parsePageHandle('css:#submit')).toBeNull()
    expect(parsePageHandle(`el:${SCOPE}:00`)).toBeNull()
    expect(parsePageHandle(undefined)).toBeNull()
  })

  it('七个动词全部在册，且与选择器族动词分得清', () => {
    expect(PAGE_ACTIONS).toHaveLength(7)
    expect(isPageAction('page_snapshot')).toBe(true)
    expect(isPageAction('click_element')).toBe(false)
  })
})

describe('契约：预算分账（正文不得吃掉句柄配额）', () => {
  it('正文体积远超预算时，出行数仍等于句柄配额', () => {
    const fat = rawOf({
      rows: Array.from({ length: 40 }, (_, i) => row(i)),
      body: Array.from({ length: 12 }, (_, i) => ({ text: `段落${i}：` + '乙'.repeat(400) })),
      counts: {
        interactiveFound: 40,
        rowsEmitted: 40,
        bodyCharsFound: 4800,
        bodyCharsEmitted: 4800,
        crossOriginFrames: 0,
      },
    })
    const result = serializeSnapshotResult(fat, budgetOf())
    expect(result.rows).toHaveLength(40)
    const emitted = result.body.reduce((sum, block) => sum + block.text.length, 0)
    expect(emitted).toBeLessThanOrEqual(120)
    expect(result.notices.join('\n')).toContain('正文预算')
  })

  it('句柄配额截行时不牵连正文', () => {
    const many = rawOf({
      rows: Array.from({ length: 60 }, (_, i) => row(i)),
      counts: {
        interactiveFound: 60,
        rowsEmitted: 60,
        bodyCharsFound: 50,
        bodyCharsEmitted: 50,
        crossOriginFrames: 0,
      },
    })
    const result = serializeSnapshotResult(many, budgetOf())
    expect(result.rows).toHaveLength(40)
    expect(result.body.length).toBe(1)
    expect(result.notices.join('\n')).toContain('未出表')
  })

  it('越界预算被钳到上限而不是抛错（预算来自模型传参，报错等于打死可用请求）', () => {
    const clamped = clampPageSnapshotBudget({ maxRows: 999_999, bodyChars: -5, maxRowChars: 'x' })
    expect(clamped.maxRows).toBe(300)
    expect(clamped.bodyChars).toBe(4000)
    expect(clamped.maxRowChars).toBe(200)
  })
})

describe('契约：截断阶梯只动定位细节', () => {
  it('超预算行仍含 role/name/handle，rect 与 attrs 先掉', () => {
    const wide = row(7, { attrs: { 'data-testid': 'x'.repeat(120), href: '/some/long/path/here' } })
    const result = serializeSnapshotResult(rawOf({ rows: [wide] }), budgetOf({ maxRowChars: 40 }))
    const line = renderSnapshot(result)
      .split('\n')
      .find((l) => l.includes(wide.handle))
    expect(line).toBeDefined()
    expect(line).toContain('role=button')
    expect(line).toContain(wide.handle)
    expect(line).not.toContain('rect=')
    expect(line).not.toContain('data-testid')
    // 受保护字段**在本行里有值的**必须都还在（无值的可选字段不该被凭空补上，也不该被算成丢失）
    expect(result.rows[0].handle).toBe(wide.handle)
    expect(result.rows[0].role).toBe('button')
    expect(result.rows[0].name).toBe('按钮 7')
    expect(SNAPSHOT_ROW_PROTECTED_FIELDS).toContain('handle')
    expect(SNAPSHOT_ROW_PROTECTED_FIELDS).not.toContain('rect')
    expect(SNAPSHOT_ROW_PROTECTED_FIELDS).not.toContain('attrs')
  })
})

describe('契约：无 DOM 环境不得静默', () => {
  it('页内 API 不可用 ⇒ 显式 PAGE_API_UNAVAILABLE 且 sideEffect=none', () => {
    const result = runPageAction('page_snapshot', {})
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('PAGE_API_UNAVAILABLE')
    expect(result.dispatched).toBe(false)
    expect(result.sideEffect).toBe('none')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
