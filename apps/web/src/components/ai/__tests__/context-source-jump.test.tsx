// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 上下文条目「可点击跳转到源」的机制测试(D13①,2026-09-26 立)。
//
// 锁四件事,前三件是行为,最后一件是"不得有第二份实现":
//  ① 命中落点 → 滚动到该元素 + 打上临时高亮,高亮在 1400ms 后还原(不污染样式);
//  ② **取不到落点必须返回 false 且不动任何样式** —— 这是"不许伪造可点入口"的机器出口:
//     调用方据此把该行渲染成普通文本,而不是一个点了没反应的假链接;
//  ③ 外链判据 http/https 为真、页内锚点与仓库相对路径为假(后者走 WorkPanel,不走滚动);
//  ④ 单源:全 `apps/web/src` 里高亮环那一串声明只能出现在 `scroll-to-source.ts` 一处,
//     引用条必须改为 import —— 出现第二份即红(本票立票的原始症状就是"机制只活在引用条里")。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  findSourceTarget,
  hasSourceTarget,
  isExternalHttpUrl,
  scrollToSource,
} from '../scroll-to-source'

const HERE = dirname(fileURLToPath(import.meta.url))
const AI_DIR = resolve(HERE, '..')
/** 第二份实现不会只长在同一个目录里,扫描面取整个 web 源码树 */
const WEB_SRC = resolve(HERE, '..', '..', '..')

/** happy-dom 不一定实现 scrollIntoView(仓库既有测试同样先补桩),补桩后才能断言调用参数 */
function stubScrollIntoView(): void {
  if (!Element.prototype.scrollIntoView) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: () => {},
      writable: true,
      configurable: true,
    })
  }
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
}

function mountTarget(id: string): HTMLElement {
  const el = document.createElement('div')
  el.id = id
  document.body.appendChild(el)
  return el
}

beforeAll(stubScrollIntoView)

afterEach(() => {
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
  stubScrollIntoView()
})

describe('scrollToSource — 命中落点', () => {
  it('滚到目标元素并带上高亮,1400ms 后还原原样式', () => {
    vi.useFakeTimers()
    const el = mountTarget('ctx-seg-42')
    const spy = Element.prototype.scrollIntoView as unknown as {
      mock: { calls: unknown[][] }
    }

    expect(scrollToSource('ctx-seg-42')).toBe(true)
    // 口径逐字钉死:block:'start'(锚点语义)而不是 MessageList 跳消息用的 'center'
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ behavior: 'smooth', block: 'start' })
    expect(el.style.boxShadow).toBe('0 0 0 3px rgba(59,130,246,0.45)')
    expect(el.style.transition).toBe('box-shadow 0.6s ease')

    vi.advanceTimersByTime(1400)
    expect(el.style.boxShadow).toBe('')
  })

  it('百分号编码的锚点引用能解码后命中', () => {
    const el = mountTarget('注入段/接口 3')
    expect(el.id).toBe('注入段/接口 3')
    expect(scrollToSource(encodeURIComponent('注入段/接口 3'))).toBe(true)
  })

  it('畸形编码不抛错,退回原串再查一次', () => {
    mountTarget('%ZZ')
    expect(scrollToSource('%ZZ')).toBe(true)
  })
})

describe('scrollToSource — 无落点时不得伪装成功', () => {
  it('取不到元素返回 false,且不产生任何滚动/样式副作用', () => {
    const spy = Element.prototype.scrollIntoView as unknown as { mock: { calls: unknown[][] } }
    const before = spy.mock.calls.length
    expect(scrollToSource('never-rendered-anchor')).toBe(false)
    expect(spy.mock.calls.length).toBe(before)
  })

  it('hasSourceTarget 与 findSourceTarget 同判据(渲染期靠它决定是否给可点外观)', () => {
    expect(hasSourceTarget('anchor-x')).toBe(false)
    expect(findSourceTarget('anchor-x')).toBeNull()
    mountTarget('anchor-x')
    expect(hasSourceTarget('anchor-x')).toBe(true)
    expect(findSourceTarget('anchor-x')?.id).toBe('anchor-x')
  })
})

describe('isExternalHttpUrl — 三分类里的"外链"一档', () => {
  it.each([
    ['https://aizhs.top/doc', true],
    ['HTTP://example.com', true],
    ['#ctx-seg-1', false],
    ['src/components/ai/x.tsx', false],
    ['//example.com/x', false],
  ])('%s → %s', (url, expected) => {
    expect(isExternalHttpUrl(url)).toBe(expected)
  })
})

describe('单源:不得有第二份跳转实现', () => {
  /** 递归收集 apps/web/src 下的源码文件(跳过测试目录,夹具里的字面量不算债务) */
  function collectSources(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue
        out.push(...collectSources(p))
      } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
        out.push(p)
      }
    }
    return out
  }

  const sources = collectSources(WEB_SRC)

  it('扫描面非空(空扫描等于恒绿的假测试)', () => {
    expect(sources.length).toBeGreaterThan(100)
  })

  it('高亮环声明只允许出现在 scroll-to-source.ts 一处', () => {
    const owners = sources.filter((f) =>
      readFileSync(f, 'utf8').includes('0 0 0 3px rgba(59,130,246,0.45)'),
    )
    expect(owners.map((f) => f.replace(/\\/g, '/'))).toEqual([
      `${AI_DIR.replace(/\\/g, '/')}/scroll-to-source.ts`,
    ])
  })

  it('引用条改为 import 机制,自身不再定义 scrollAndHighlight / isExternalUrl', () => {
    const bar = join(AI_DIR, 'progress-sections', 'citation-bar.tsx')
    expect(existsSync(bar)).toBe(true)
    const src = readFileSync(bar, 'utf8')
    expect(src).toContain('@/components/ai/scroll-to-source')
    expect(src).toContain('scrollToSource(url.slice(1))')
    expect(src).not.toMatch(/function\s+scrollAndHighlight/)
    expect(src).not.toMatch(/function\s+isExternalUrl\b/)
  })

  it('全端源码里 scrollAndHighlight 这个旧名字已无残留', () => {
    const hits = sources.filter((f) => readFileSync(f, 'utf8').includes('scrollAndHighlight'))
    expect(hits).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
