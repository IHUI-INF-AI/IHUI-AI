// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * iframe 沙箱「严档缺省 + 放宽必须逐处声明」在 apps/web 侧的尺子(2026-09-27 安全票)。
 *
 * 两层判据,缺一不可:
 *  ① **运行时**:渲染真实生产组件,读渲染出来的 iframe 的 `sandbox` 属性实际值 ——
 *     证明"声明的那一档确实到了 DOM"。
 *  ② **源码审计**:apps/web 里的原生 `<iframe>` 引不到 ui-react 的档常量(`@ihui/ui-react`
 *     的 barrel `src/index.ts` 没导出它们,补导出属该包持有人职权,本票禁改清单外文件),
 *     所以逐个 `sandbox="…"` 字面量按 `packages/ui-react/src/components/webview-frame.tsx`
 *     里那一份常量对账,并要求**每一处宽档都带行内 `iframe-sandbox-relax: <原因>`**。
 *     判据写法沿用 `tests/ui-upload-webview-labels-injection.test.ts` 的同一条先例
 *     (档表从被审源码读,不在测试里手抄第二份)。
 *
 * ⚠️ 覆盖面如实声明:①断言的是属性字符串,不是浏览器对沙箱的真实执行语义(happy-dom
 *    不实现 iframe sandbox 权限模型)。②只审 AUDITED 名单内的文件 —— 名单外的站点
 *    (如 admin 的 GrafanaFrame)本尺子看不见,已作为未闭环项登记在交付报告。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* ── 仓库根与档表(唯一实现,从源码读) ──────────────────────────────────────── */

function repoRoot(): string {
  // 本文件在 apps/web/tests/ 下 ⇒ 上溯三层到仓库根(不用 process.cwd():
  // 守门 70 记过"测试靠 cwd 定位夹具而脚本按定义忽略 cwd"那一型失效)
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
}
const ROOT = repoRoot()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const SOURCE_OF_TRUTH = 'packages/ui-react/src/components/webview-frame.tsx'

/** 从唯一实现里读 `export const X = '…'` 的字面值 —— 手抄常量就是第二份真相 */
function constValue(name: string): string {
  const src = read(SOURCE_OF_TRUTH)
  const m = src.match(new RegExp(`export const ${name} = '([^']*)'`))
  expect(m, `${SOURCE_OF_TRUTH} 里应导出字符串常量 ${name}`).not.toBeNull()
  return (m as RegExpMatchArray)[1] as string
}

const STRICT = constValue('STRICT_SANDBOX')
const MODEL_CONTENT = constValue('MODEL_CONTENT_SANDBOX')

/** 行内豁免族的稳定前缀 —— 判据与代码注释共用同一个字面量,不各写一遍 */
const RELAX_MARK = 'iframe-sandbox-relax:'

/* ── ① 运行时:真实组件 ⇒ 真实属性 ──────────────────────────────────────────── */

/** 取渲染出的 iframe 的 sandbox token 集;属性缺席返回 null(与"存在但为空"不同态) */
function sandboxTokens(el: Element | null): string[] | null {
  if (!el) return null
  if (!el.hasAttribute('sandbox')) return null
  return (el.getAttribute('sandbox') ?? '').split(/\s+/).filter(Boolean)
}

describe('运行时:消费端真实渲染出的 sandbox', () => {
  afterEach(() => cleanup())

  it('WebViewFrame 经 @ihui/ui-react 入口(消费端真实路径)缺省渲染 = 严档', async () => {
    const { WebViewFrame } = await import('@ihui/ui-react')
    const { container } = render(
      React.createElement(WebViewFrame, {
        mode: 'iframe',
        status: 'loaded',
        url: 'about:blank',
      }),
    )
    const el = container.querySelector('iframe')
    expect(el, 'WebViewFrame 必须渲染出 iframe').not.toBeNull()
    // 属性缺席 = 完全不限,那是最糟的一态,单独断言一次而不是靠值相等顺带覆盖
    expect((el as Element).hasAttribute('sandbox'), 'sandbox 属性必须在位').toBe(true)
    expect(sandboxTokens(el)).toEqual([])
    expect((el as Element).getAttribute('sandbox')).toBe(STRICT)
  })

  it('OfficeViewer 渲染出的档 = 源码里声明的那一档(且逐字带 same-origin 的理由声明)', async () => {
    // OfficeViewer 只用到 useTranslations('a11y') 取文案,取词不影响 iframe 属性
    vi.doMock('next-intl', () => ({
      useTranslations: () => (key: string) => key,
    }))
    const { OfficeViewer } = await import('@/components/media/OfficeViewer')
    const { container } = render(
      React.createElement(OfficeViewer, {
        url: 'https://example.com/report.docx',
        fileName: 'r.docx',
      }),
    )
    const el = container.querySelector('iframe')
    expect(el, 'OfficeViewer 必须渲染出 iframe').not.toBeNull()
    const tokens = sandboxTokens(el) as string[]
    expect(tokens).toEqual(['allow-scripts', 'allow-same-origin', 'allow-popups'])
    // 这一档是本票唯一允许同时给 scripts + same-origin 的站点,理由必须是"跨源第三方查看器"
    expect(tokens).toContain('allow-same-origin')
    expect(tokens).not.toContain('allow-forms')
    expect(tokens.some((t) => t.startsWith('allow-top-navigation'))).toBe(false)
    vi.doUnmock('next-intl')
  })
})

/* ── ② 源码审计:每一处宽档必须带理由 ───────────────────────────────────────── */

/**
 * 取每个 `<iframe …>` 开标签的字符区间(花括号深度感知 —— 定长窗口会截断长 props,
 * 沿用 `tests/ui-upload-webview-labels-injection.test.ts` 的同一套取法)。
 *
 * 为什么要**区间**而不是全文扫:本仓有一处散文注释逐字写着 `sandbox="allow-scripts"`
 * (tool-call-card.tsx 的卡片说明)。按全文匹配就会把"门在解释自己"当成第二处待声明站点,
 * 而按"必须落在某个 iframe 开标签内"判,散文结构上不可能成为命中。
 * 刻意**不做**注释字符遮罩:那需要一个懂正则字面量/URL/模板串的扫描器,而它一旦漏一档
 * (`'https://x/*'` 那一型,守门 70 记过)就会把真代码抹成看不见 —— 判据失明比多一处待声明贵。
 * 反过来,若注释恰好写在标签**区间内**并被当成一处待声明,那是多要一次说明,失效方向安全。
 */
function iframeTagSpans(src: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = []
  const openRe = /<iframe(?=[\s/>])/g
  let m: RegExpExecArray | null
  while ((m = openRe.exec(src)) !== null) {
    const start = m.index
    let brace = 0
    let end = -1
    for (let i = start; i < src.length; i += 1) {
      const c = src[i] as string
      if (c === '{') brace += 1
      else if (c === '}') brace -= 1
      else if (brace === 0 && c === '>') {
        end = i + 1
        break
      }
    }
    // 配平不到开标签结尾 = 这个 iframe 整块对判据隐身,必须当场喊,不能静默跳过
    expect(
      end,
      `<iframe 开标签配平失败(判据会对该处隐身):${src.slice(start, start + 40)}`,
    ).not.toBe(-1)
    spans.push({ start, end })
    openRe.lastIndex = end
  }
  return spans
}

interface SandboxLiteral {
  file: string
  line: number
  value: string
  /** 命中的行或其上方直到开标签的注释里有没有带原因的 relax 声明 */
  declared: boolean
}

/** 只收 sandbox="…" 这种**字面量**形态(sandbox={…} 走 WebViewFrame 的对象出口,另判) */
function collectSandboxLiterals(file: string): SandboxLiteral[] {
  const src = read(file)
  const rawLines = src.split(/\r?\n/)
  const out: SandboxLiteral[] = []
  for (const span of iframeTagSpans(src)) {
    const tag = src.slice(span.start, span.end)
    for (const m of tag.matchAll(/sandbox="([^"]*)"/g)) {
      const line = src.slice(0, span.start + (m.index ?? 0)).split(/\r?\n/).length
      out.push({
        file,
        line,
        value: m[1] as string,
        declared: hasRelaxDeclaration(rawLines, line - 1),
      })
    }
  }
  return out
}

/**
 * 声明的合法落点:命中行本身,或往上直到 `<iframe` 开标签为止的任意一行。
 * 与守门 102 的 `back-label-exempt` 同一取向 —— 人按直觉把标记写在块上就得生效,
 * 只认同行会产出"标了却不算"的恒红。理由必须非空(裸标记不放行)。
 */
function hasRelaxDeclaration(lines: string[], hitIndex: number): boolean {
  for (let i = hitIndex; i >= 0; i -= 1) {
    const text = lines[i] as string
    const at = text.indexOf(RELAX_MARK)
    if (at >= 0) {
      const reason = text
        .slice(at + RELAX_MARK.length)
        .replace(/[\s*\/-]+$/, '')
        .trim()
      if (reason.length > 0) return true
    }
    // 走到开标签仍未见到非空理由 ⇒ 停止上溯(再往上就不是这个元素了)
    if (i < hitIndex && /<iframe[\s>]/.test(text)) return false
  }
  return false
}

/**
 * 本票射程内的文件。名单外不算 —— GrafanaFrame.tsx 与 ai-skills/[id]/PageClient.tsx
 * 也有 sandbox 字面量但不在本票可改清单内,已作为未闭环项登记(交付报告)。
 */
const AUDITED = [
  'apps/web/src/components/ai/markdown-stream.tsx',
  'apps/web/src/components/ai/tool-call-card.tsx',
  'apps/web/src/components/chat/artifact-canvas.tsx',
  'apps/web/src/components/chat/canvas-overlay.tsx',
  'apps/web/src/components/media/OfficeViewer.tsx',
  'apps/web/src/components/work-panel/web-work-panel.tsx',
  'apps/web/src/components/chat/skill-library.tsx',
]

/** 唯一允许同时给 scripts + same-origin 的站点(其余一律不给) */
const SAME_ORIGIN_ALLOWED_FILES = ['apps/web/src/components/media/OfficeViewer.tsx']

describe('源码审计:sandbox 字面量必须来自唯一档表,放宽必须带理由', () => {
  it('名单不为空(空扫等于判据失明,不得记为通过)', () => {
    expect(AUDITED.length).toBeGreaterThan(0)
    const all = AUDITED.flatMap(collectSandboxLiterals)
    expect(all.length, '受审文件里必须至少读到一条 sandbox 字面量').toBeGreaterThan(0)
  })

  it('每一处字面量只能是严档 / 模型内容档 / 带理由的声明档,不得有第四种', () => {
    for (const hit of AUDITED.flatMap(collectSandboxLiterals)) {
      const allowed = hit.value === STRICT || hit.value === MODEL_CONTENT || hit.declared
      const why = `${hit.file}:${hit.line} 的档不在档表上,又没带 ${RELAX_MARK} 理由`
      expect(allowed, why).toBe(true)
    }
  })

  it('凡是宽于严档的字面量,必须能在其元素内或紧邻上方找到非空理由', () => {
    const widened = AUDITED.flatMap(collectSandboxLiterals).filter((h) => h.value !== STRICT)
    expect(widened.length).toBeGreaterThan(0)
    for (const hit of widened) {
      expect(
        hit.declared,
        `${hit.file}:${hit.line} 给了 "${hit.value}" 却没有 ${RELAX_MARK}<原因> —— 无理由的放宽不成立`,
      ).toBe(true)
    }
  })

  it('allow-same-origin 只许出现在登记过的那一处,其余站点一律不得同时给 scripts+same-origin', () => {
    const offenders = AUDITED.flatMap(collectSandboxLiterals)
      .filter((h) => !SAME_ORIGIN_ALLOWED_FILES.includes(h.file))
      .filter((h) => {
        const tokens = new Set(h.value.split(/\s+/))
        return tokens.has('allow-scripts') && tokens.has('allow-same-origin')
      })
    expect(
      offenders.map((o) => `${o.file}:${o.line}`),
      'allow-scripts + allow-same-origin 同给 = 沙箱形同虚设,名单外一处都不许有',
    ).toEqual([])
  })

  it('web-work-panel 的两处 WebViewFrame 都不再走裸字符串 sandbox(裸串在新 API 下不生效)', () => {
    const src = read('apps/web/src/components/work-panel/web-work-panel.tsx')
    // WebViewFrame 的 sandbox prop 必须已是 { tokens, reason } 形态,两处调用点各一次
    const relaxProps = src.match(/sandbox=\{\{\s*tokens:/g) ?? []
    expect(relaxProps.length, '两处 WebViewFrame 调用点都必须显式声明放宽').toBe(2)
    expect(/sandbox="/.test(src), '不得再向 WebViewFrame 递裸字符串').toBe(false)
  })

  /**
   * 取材区间的双向对照 —— 只留一边就等于允许把判据改成"注释一律不算"而没人发现门瞎了。
   * A 臂:散文注释里的 `sandbox="…"` 不得成为待声明站点(本票落地时被真仓咬出过一次)。
   * B 臂:真 iframe 上的那一处必须仍然被读到(否则本门对整型缺陷全盲却一路报绿)。
   */
  it('区间双向锁:标签外的散文不计,标签内的真档必须计', () => {
    const hits = collectSandboxLiterals('apps/web/src/components/ai/tool-call-card.tsx')
    const prose = read('apps/web/src/components/ai/tool-call-card.tsx')
      .split(/\r?\n/)
      .findIndex((l) => l.includes('iframe 以 sandbox="allow-scripts" 加载产物'))
    expect(prose, '夹具前提:该文件必须有一句把档写在散文注释里的说明').toBeGreaterThan(-1)
    expect(
      hits.some((h) => h.line === prose + 1),
      '散文注释里的档不得被当成一处放宽',
    ).toBe(false)
    expect(
      hits.filter((h) => h.value === MODEL_CONTENT).length,
      '真 iframe 上那一处必须仍被读到',
    ).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
