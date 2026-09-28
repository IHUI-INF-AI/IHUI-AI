// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * iframe 沙箱「严档缺省 + 放宽必须带理由」的成对对照(2026-09-27 安全票)。
 *
 * 断言对象是**生产组件** `<WebViewFrame/>` 渲染出来的 iframe 属性值,不是测试里另抄一份
 * 判定逻辑(本仓记过"镜像测试只复读实现就是复读机"那一型)。渲染走 react-dom/client +
 * React.act —— packages/ui-react 没有 @testing-library 依赖,而 react / react-dom 是它的
 * 直接依赖,所以这两件在本包内可解析。
 *
 * ⚠️ 覆盖面如实声明:本测试断言的是渲染出的 **sandbox 属性字符串**,不是浏览器对沙箱的
 *    真实执行语义(happy-dom 不实现 iframe sandbox 的权限模型)。"严档真的收紧了权限"
 *    这一维在提交链上没有任何尺子能证,只能由属性值 + HTML 规范语义推得。
 */
// @ts-expect-error: packages/ui-react 未安装 vitest(无 vitest.config.ts、package.json 无 test
// script、devDeps 里没有它),所以 'vitest' 的类型不在本包 tsc 视野内;运行期由测试器注入。
// 本包补上 vitest 入口后必须删掉这一行 —— 留着它会让"装了却没人用"重新变成隐形。
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
  WebViewFrame,
  STRICT_SANDBOX,
  MODEL_CONTENT_SANDBOX,
  resolveSandbox,
  type SandboxRelaxation,
  type WebViewFrameProps,
} from '../webview-frame'

/* React 19 的 act() 要求宿主声明"这是 act 环境",否则每次调用只打一条
   "not configured to support act(...)" 警告并走非确定性的排空路径。 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/* ── 渲染夹具:拿真实组件,读真实属性 ────────────────────────────────────────── */

/**
 * 用 `about:blank` 而不是真实 URL:happy-dom 会**真的**去 fetch iframe 的 src,
 * 于是每个用例在 teardown 都抛一串 NetworkError/AbortError,把信号淹在噪声里。
 * 本测试断言的是 sandbox 属性值,与 src 指向何处无关。
 */
const FIXTURE_URL = 'about:blank'

const roots: Root[] = []

/** 只有 sandbox 是变量,其余三件是夹具(固定 ⇒ 每个用例都走真实的 iframe 渲染分支) */
function renderFrame(extra: Pick<WebViewFrameProps, 'sandbox'> = {}): HTMLIFrameElement {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  React.act(() => {
    root.render(
      React.createElement(WebViewFrame, {
        mode: 'iframe',
        status: 'loaded',
        url: FIXTURE_URL,
        ...extra,
      }),
    )
  })
  const el = host.querySelector('iframe')
  expect(el, 'mode=iframe 且 url 非空时必须渲染出 <iframe>').not.toBeNull()
  return el as HTMLIFrameElement
}

/** 属性里的 token 集合(空串 ⇒ 空集合;属性缺席 ⇒ null,用来区分"没沙箱"与"全禁") */
function tokensOf(el: HTMLIFrameElement): string[] | null {
  if (!el.hasAttribute('sandbox')) return null
  return (el.getAttribute('sandbox') ?? '').split(/\s+/).filter((t) => t !== '')
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    React.act(() => {
      root?.unmount()
    })
  }
  document.body.replaceChildren()
})

/* ── ① 缺省 = 严档 ────────────────────────────────────────────────────────────── */

describe('缺省档', () => {
  it('不传 sandbox 时属性仍在,且不含任何 token(严档 ≠ 没有 sandbox 属性)', () => {
    const el = renderFrame({})
    // 旧缺陷形态:缺省是一串最宽的 token。属性缺席更糟 —— 那等于完全不限。
    expect(el.hasAttribute('sandbox'), 'sandbox 属性必须存在').toBe(true)
    expect(tokensOf(el)).toEqual([])
  })

  it('缺省档不含 allow-same-origin,也不含 allow-scripts', () => {
    const el = renderFrame({})
    const value = el.getAttribute('sandbox') ?? ''
    expect(value).not.toContain('allow-same-origin')
    expect(value).not.toContain('allow-scripts')
  })
})

/* ── ② 带理由的放宽 ⇒ 得到请求的集合 ─────────────────────────────────────────── */

describe('带理由的放宽', () => {
  it('传 { tokens, reason } 时逐档生效', () => {
    const relax: SandboxRelaxation = {
      tokens: ['allow-scripts', 'allow-forms', 'allow-popups'],
      reason: '内嵌浏览器要渲染任意第三方站点,不给 allow-scripts 则整页空白',
    }
    const el = renderFrame({ sandbox: relax })
    expect(tokensOf(el)).toEqual(['allow-scripts', 'allow-forms', 'allow-popups'])
  })

  it('模型内容档(仅 allow-scripts)是可声明的档位', () => {
    const el = renderFrame({
      sandbox: { tokens: [MODEL_CONTENT_SANDBOX], reason: '预览模型生成的 HTML,需脚本' },
    })
    expect(tokensOf(el)).toEqual(['allow-scripts'])
    // 这一档的关键红线:即便声明了,也绝不同时给 same-origin
    expect(el.getAttribute('sandbox') ?? '').not.toContain('allow-same-origin')
  })
})

/* ── ③ 没有理由 = 不生效(这条是"例外必须声明"的牙) ─────────────────────────── */

describe('无理由的放宽一律不生效', () => {
  it('只有 tokens、没有 reason ⇒ 仍然严档', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = renderFrame({
      sandbox: { tokens: ['allow-scripts', 'allow-same-origin'] } as unknown as SandboxRelaxation,
    })
    expect(tokensOf(el)).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('reason 为空白串 ⇒ 仍然严档(空 reason 不算声明)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = renderFrame({ sandbox: { tokens: ['allow-scripts'], reason: '   ' } })
    expect(tokensOf(el)).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('裸 token 字符串一律不生效(静默放宽的入口就此封死)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // 这一档正是改造前 web-work-panel 代理分支的写法:一串 token 直接递进来。
    const el = renderFrame({ sandbox: 'allow-scripts allow-forms allow-popups' })
    expect(tokensOf(el)).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('词表外的 token 被丢弃,不会拼出一个浏览器不认识的"档"', () => {
    const el = renderFrame({
      sandbox: { tokens: ['allow-sandbox-please', 'allow-scripts'], reason: '混合未知档' },
    })
    expect(tokensOf(el)).toEqual(['allow-scripts'])
  })
})

/* ── ④ 唯一判定出口:resolveSandbox 与组件渲染必须同形 ───────────────────────── */

describe('resolveSandbox 就是组件用的那一份', () => {
  it('严档常量与组件缺省渲染逐字一致', () => {
    const el = renderFrame({})
    expect(el.getAttribute('sandbox')).toBe(resolveSandbox())
    expect(el.getAttribute('sandbox')).toBe(STRICT_SANDBOX)
  })

  it('同一份声明经组件与经出口得到同一个串(不存在第二处判定)', () => {
    const relax: SandboxRelaxation = {
      tokens: ['allow-scripts', 'allow-popups', 'allow-scripts'],
      reason: '去重也走同一个出口',
    }
    const el = renderFrame({ sandbox: relax })
    expect(el.getAttribute('sandbox')).toBe(resolveSandbox(relax))
    expect(tokensOf(el)).toEqual(['allow-scripts', 'allow-popups'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
