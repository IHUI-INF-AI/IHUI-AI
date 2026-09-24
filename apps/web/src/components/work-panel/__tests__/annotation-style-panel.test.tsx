// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D42 浏览器视觉标注 —— 样式面板 + 点选开关(2026-09-24 立)。
 *  - 样式面板渲染:字段填充/缺失字段禁用态
 *  - 「添加到对话」:ihui:add-text-reference 同族 CustomEvent(payload 形状断言)
 *  - annotationStale:弱警示条出现/消失(打开重查 + 发送前重查)
 *  - CdpBrowserView 点选开关切换(注入/摘除脚本经既有 execute 通道)
 * e2e 全链路(标注→上下文→发送)属验收口径,单测覆盖以上四类,e2e 缺口在报告登记。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// ---- 取词面:visualAnnotation 用 zh-CN 原文逐字锁 ----
const WORDS: Record<string, string> = {
  'visualAnnotation.pickElement': '点选元素',
  'visualAnnotation.panelTitle': '样式标注',
  'visualAnnotation.contextTitle': '视觉标注',
  'visualAnnotation.elementText': '元素文本',
  'visualAnnotation.styleSnapshot': '样式快照',
  'visualAnnotation.annotationLabel': '批注',
  'visualAnnotation.annotationPlaceholder': 'PLACEHOLDER',
  'visualAnnotation.addToConversation': '添加到对话',
  'visualAnnotation.staleWarning': '标注已失效,元素已变化',
  'visualAnnotation.close': '关闭',
  'visualAnnotation.color': '颜色',
  'visualAnnotation.backgroundColor': '背景色',
  'visualAnnotation.border': '边框',
  'visualAnnotation.borderRadius': '圆角',
  'visualAnnotation.fontSize': '字号',
  'visualAnnotation.margin': '外边距',
  'visualAnnotation.padding': '内边距',
  'workPanel.devTools': '开发者工具',
  'workPanel.interactionHint': 'HINT',
  'workPanel.gotIt': '知道了',
  'a11y.close': '关闭',
  'a11y.unknownError': '未知错误',
  'a11y.closeAlert': '关闭提示',
}

vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, values?: Record<string, string | number>): string => {
      const raw = WORDS[`${ns}.${key}`] ?? key
      return raw.replace(/\{(\w+)\}/g, (_m, n: string) => String(values?.[n] ?? ''))
    },
}))

// ---- CdpBrowserView 依赖:WS 通道 + auth ----
class FakeWebSocket {
  static OPEN = 1
  static instances: FakeWebSocket[] = []
  readyState = 1
  sent: string[] = []
  private listeners = new Map<string, Set<(e: unknown) => void>>()
  constructor(_url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string): void {
    this.sent.push(data)
    // 模拟后端 execute_result 同步回执(完整 JSON 消息),驱动 executeJson 串行链前进
    const reply = JSON.stringify({ type: 'execute_result', data: 'ok' })
    for (const fn of this.listeners.get('message') ?? []) fn({ data: reply })
  }
  addEventListener(type: string, fn: (e: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(fn)
  }
  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners.get(type)?.delete(fn)
  }
  close(): void {
    /* noop */
  }
}

vi.mock('@ihui/api-client', () => ({
  buildBrowserWsUrl: vi.fn(() => 'ws://fake'),
  setBrowserWsToken: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: { getState: () => ({ token: 'test-token' }) },
}))

import {
  AnnotationStylePanel,
  type PickedVisualElement,
  type VisualAnnotationReferenceDetail,
} from '../annotation-style-panel'
import { CdpBrowserView } from '../cdp-browser-view'

// ------------------------------------------------------------- fixtures ----

const FULL_ELEMENT: PickedVisualElement = {
  selector: 'button#submit.primary',
  textExcerpt: '提交订单',
  signature: 'button#submit.primary|提交订单',
  styles: {
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgb(255, 255, 255)',
    border: '1px solid rgb(0, 0, 0)',
    borderRadius: '4px',
    fontSize: '14px',
    margin: '0px',
    padding: '8px',
  },
}

const PARTIAL_ELEMENT: PickedVisualElement = {
  ...FULL_ELEMENT,
  styles: { color: 'rgb(0, 0, 0)' },
}

// ------------------------------------------------------ event capture ----

const FAMILY_EVENT = 'ihui:add-text-reference'

function captureEvents(): VisualAnnotationReferenceDetail[] & { release: () => void } {
  const received: VisualAnnotationReferenceDetail[] = []
  const listener = (e: Event): void => {
    received.push((e as CustomEvent<VisualAnnotationReferenceDetail>).detail)
  }
  window.addEventListener(FAMILY_EVENT, listener)
  return Object.assign(received, {
    release: () => window.removeEventListener(FAMILY_EVENT, listener),
  }) as VisualAnnotationReferenceDetail[] & { release: () => void }
}

// ---------------------------------------------------------------- tests ----

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        /* noop */
      }
      unobserve(): void {
        /* noop */
      }
      disconnect(): void {
        /* noop */
      }
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('D42 AnnotationStylePanel', () => {
  it('① 样式面板渲染:computedStyle 字段填充,缺失字段禁用态', () => {
    const { unmount } = render(<AnnotationStylePanel element={FULL_ELEMENT} />)
    for (const field of ['color', 'backgroundColor', 'border', 'borderRadius', 'fontSize', 'margin', 'padding']) {
      const input = screen.getByTestId(`style-${field}`) as HTMLInputElement
      expect(input.disabled).toBe(false)
      expect(input.value).toBe(FULL_ELEMENT.styles[field as keyof typeof FULL_ELEMENT.styles])
    }
    expect(screen.getByTestId('picked-element-text').textContent).toBe('提交订单')
    expect(screen.queryByTestId('stale-warning')).toBeNull()
    unmount()

    // 缺失字段:禁用态(拿不到的 computedStyle 禁用)
    render(<AnnotationStylePanel element={PARTIAL_ELEMENT} />)
    expect((screen.getByTestId('style-color') as HTMLInputElement).disabled).toBe(false)
    for (const field of ['backgroundColor', 'border', 'borderRadius', 'fontSize', 'margin', 'padding']) {
      expect((screen.getByTestId(`style-${field}`) as HTMLInputElement).disabled).toBe(true)
    }
  })

  it('② 添加到对话:派发 ihui:add-text-reference 同族事件,payload 形状断言', async () => {
    const received = captureEvents()
    try {
      const recheckStale = vi.fn(() => false)
      render(<AnnotationStylePanel element={FULL_ELEMENT} recheckStale={recheckStale} />)
      // 用户改一个样式字段 + 填批注
      fireEvent.change(screen.getByTestId('style-borderRadius'), { target: { value: '8px' } })
      fireEvent.change(screen.getByTestId('annotation-note'), { target: { value: '把圆角改大' } })
      fireEvent.click(screen.getByTestId('add-to-conversation'))

      await waitFor(() => expect(received.length).toBe(1))
      const detail = received[0]
      if (!detail) throw new Error('missing event detail')
      expect(detail.source).toBe('browser-visual-annotation')
      expect(detail.selector).toBe('button#submit.primary')
      expect(detail.note).toBe('把圆角改大')
      expect(detail.styles.borderRadius).toBe('8px')
      expect(detail.styles.fontSize).toBe('14px')
      // 结构化文本:text 兼容 D22 消费者(含选择器摘要/样式快照/批注)
      expect(detail.text).toContain('视觉标注 [button#submit.primary]')
      expect(detail.text).toContain('元素文本: 提交订单')
      expect(detail.text).toContain('圆角: 8px')
      expect(detail.text).toContain('批注: 把圆角改大')
      // 重查:面板打开一次 + 发送前一次
      await waitFor(() => expect(recheckStale).toHaveBeenCalledTimes(2))
    } finally {
      received.release()
    }
  })

  it('③ annotationStale:重查失败显示弱警示条,重查通过后消失', async () => {
    const { rerender } = render(
      <AnnotationStylePanel element={FULL_ELEMENT} recheckStale={() => true} />,
    )
    await waitFor(() => expect(screen.getByTestId('stale-warning').textContent).toBe('标注已失效,元素已变化'))

    // 元素恢复(DOM 未变)→ 提示条消失
    rerender(<AnnotationStylePanel element={FULL_ELEMENT} recheckStale={() => false} />)
    await waitFor(() => expect(screen.queryByTestId('stale-warning')).toBeNull())
  })

  it('④ 点选开关切换:开 → 注入采集脚本,关 → 摘除脚本(复用 execute 通道)', async () => {
    render(<CdpBrowserView sessionId="s1" />)
    const ws = FakeWebSocket.instances.at(-1)
    expect(ws).toBeTruthy()

    const toggle = () => screen.getByTestId('pick-element-toggle') as HTMLButtonElement
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-pressed')).toBe('true')
    // 注入脚本走既有 execute 消息类型
    await waitFor(() => {
      const execs = ws!.sent.map((s) => JSON.parse(s) as { type: string; script?: string })
      expect(
        execs.some((m) => m.type === 'execute' && m.script?.includes('__ihuiPickInstalled')),
      ).toBe(true)
    })

    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    await waitFor(() => {
      const execs = ws!.sent.map((s) => JSON.parse(s) as { type: string; script?: string })
      expect(execs.some((m) => m.type === 'execute' && m.script?.includes('st.remove()'))).toBe(true)
    })
  })
})

// i18n 五语键对齐哨兵(visualAnnotation 17 键)
describe('D42 i18n 五语对齐', () => {
  it('visualAnnotation 五语键集一致', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../../../..', 'packages/i18n/messages/web')
    const langs = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'] as const
    const keySets = langs.map((l) =>
      Object.keys(JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8')).visualAnnotation).sort(),
    )
    for (let i = 1; i < keySets.length; i++) expect(keySets[i]).toEqual(keySets[0])
    expect(keySets[0]?.length).toBe(17)
  })
})
