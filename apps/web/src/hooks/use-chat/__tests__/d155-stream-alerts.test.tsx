// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D155(2026-09-29 立)web 消费端装车证明:下行告警三档(config-warning /
// deprecation-notice / guardian-warning)。
//
// 钉四件事:
//   ① 三档帧各一条:帧进 store(setStreamAlert,send-message on* 回调的唯一写点)⇒
//      StreamAlertBar 渲染出**真语包**的档位名 + 帧上的 message 正文;
//      文案断言走真语包(packages/i18n/messages/{shared,web}/zh-CN.json 深合并,与
//      apps/web/src/i18n/request.ts 同一口径)—— 用假 t() 证不出"新键真的在五语言里"。
//   ② 未知 severity 回退不崩:直写一帧表外强度值(绕过 api-client 解析层的形状),
//      落点归一成 warning 上屏,不抛不崩、message 不丢(D34/D40 教训:至少
//      message/severity 要进落点,不整帧静默丢)。
//   ③ 可选字段不丢:帧上的可选字段原样保存在落点里(不静默裁剪)。
//   ④ 接线:send-message.ts 的 streamChat options 里三条 on* 必须是**代码行**且函数体
//      真的调用 setStreamAlert —— 只测 store 与组件证不出"帧真的有人接"。

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → use-chat → hooks → src → web → apps → 仓库根(6 层)
const repoRoot = resolve(here, '../../../../../../')
const readPack = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(repoRoot, 'packages/i18n/messages', name), 'utf8')) as Record<
    string,
    unknown
  >
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
/** 与 @ihui/i18n mergeMessages 同语义:web 端覆盖 shared */
const mergePack = (
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = out[k]
    out[k] = isRecord(b) && isRecord(v) ? mergePack(b, v) : v
  }
  return out
}
const PACK = mergePack(readPack('shared/zh-CN.json'), readPack('web/zh-CN.json'))
const lookup = (ns: string, key: string): unknown =>
  [...ns.split('.'), ...key.split('.')].reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' && !Array.isArray(node)
        ? (node as Record<string, unknown>)[part]
        : undefined,
    PACK,
  )

// mock 必须是模块级稳定引用:工厂内一次性定义,渲染间不换新函数 ——
// 若 t 每次渲染都是新引用且进了 effect 依赖,React 无限重跑直至 worker OOM 假死。
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string): string => {
      const raw = lookup(ns, key)
      // 缺键必须喊出来:"词包没这条"与"组件没渲染"是两种病,混起来就只能靠猜
      return typeof raw === 'string' && raw !== '' ? raw : `MISSING:${ns}.${key}`
    },
  useLocale: () => 'zh-CN',
}))

import { StreamAlertBar } from '../../../components/chat/stream-alert-bar'
import {
  clearAllStreamAlerts,
  getStreamAlerts,
  setStreamAlert,
} from '../stream-alerts'

afterEach(() => {
  cleanup()
  clearAllStreamAlerts()
})

describe('D155 ① 三档帧进落点并上屏(真语包)', () => {
  it('config-warning ⇒ 渲染「配置提醒」+ 帧正文 message', () => {
    setStreamAlert('configWarning', {
      severity: 'warning',
      message: 'base URL 已被覆盖到非官方端点',
      field: 'baseUrl',
      provider: 'deepseek',
    })
    const { container } = render(<StreamAlertBar />)
    const row = container.querySelector<HTMLElement>('[data-testid="stream-alert-configWarning"]')
    expect(row).not.toBeNull()
    expect(row?.getAttribute('data-severity')).toBe('warning')
    expect(row?.textContent).toContain('配置提醒')
    expect(row?.textContent).toContain('base URL 已被覆盖到非官方端点')
    expect(container.textContent ?? '').not.toContain('MISSING:')
  })

  it('deprecation-notice ⇒ 渲染「能力弃用预告」+ 帧正文 message', () => {
    setStreamAlert('deprecationNotice', {
      severity: 'info',
      message: '旧版补全端点将于下月停用',
      capability: 'legacy-completions',
      sunsetAt: '2026-11-01T00:00:00.000Z',
    })
    const { container } = render(<StreamAlertBar />)
    const row = container.querySelector<HTMLElement>(
      '[data-testid="stream-alert-deprecationNotice"]',
    )
    expect(row).not.toBeNull()
    expect(row?.getAttribute('data-severity')).toBe('info')
    expect(row?.textContent).toContain('能力弃用预告')
    expect(row?.textContent).toContain('旧版补全端点将于下月停用')
    expect(container.textContent ?? '').not.toContain('MISSING:')
  })

  it('guardian-warning ⇒ 渲染「安全审查提醒」+ 帧正文 message', () => {
    setStreamAlert('guardianWarning', {
      severity: 'critical',
      message: '自动审查发现命令包含递归删除',
      category: 'destructive-command',
      reviewId: 'gr-77',
    })
    const { container } = render(<StreamAlertBar />)
    const row = container.querySelector<HTMLElement>(
      '[data-testid="stream-alert-guardianWarning"]',
    )
    expect(row).not.toBeNull()
    expect(row?.getAttribute('data-severity')).toBe('critical')
    expect(row?.textContent).toContain('安全审查提醒')
    expect(row?.textContent).toContain('自动审查发现命令包含递归删除')
    expect(container.textContent ?? '').not.toContain('MISSING:')
  })

  it('未收到帧 ⇒ 整条不渲染不占位', () => {
    const { container } = render(<StreamAlertBar />)
    expect(container.querySelector('[data-testid="stream-alert-bar"]')).toBeNull()
  })
})

describe('D155 ② 未知 severity 回退不崩 + ③ 可选字段不丢', () => {
  it('表外强度值直写 ⇒ 归一成 warning 上屏,message 不丢、不抛', () => {
    // 模拟绕过 api-client 解析层的原始帧(severity 表外):落点是上屏真相的最后一道闸
    setStreamAlert('configWarning', {
      severity: 'fatal' as unknown as 'warning',
      message: '未知强度的配置告警也要上屏',
    })
    expect(() => render(<StreamAlertBar />)).not.toThrow()
    const row = document.querySelector<HTMLElement>('[data-testid="stream-alert-configWarning"]')
    expect(row?.getAttribute('data-severity')).toBe('warning')
    expect(row?.textContent).toContain('未知强度的配置告警也要上屏')
  })

  it('severity 缺席直写 ⇒ 同样回退 warning(不崩)', () => {
    setStreamAlert('guardianWarning', {
      severity: undefined as unknown as 'critical',
      message: '没有强度档的守护告警',
    })
    expect(() => render(<StreamAlertBar />)).not.toThrow()
    const row = document.querySelector<HTMLElement>(
      '[data-testid="stream-alert-guardianWarning"]',
    )
    expect(row?.getAttribute('data-severity')).toBe('warning')
    expect(row?.textContent).toContain('没有强度档的守护告警')
  })

  it('帧上的可选字段在落点里原样保留(不静默裁剪)', () => {
    setStreamAlert('deprecationNotice', {
      severity: 'warning',
      message: 'm',
      capability: 'legacy-completions',
      alternative: 'chat-completions',
    })
    const frame = getStreamAlerts().deprecationNotice
    expect(frame?.message).toBe('m')
    // 逐字段断言:落点保留 api-client 解析出的可选字段
    expect((frame as { capability?: string }).capability).toBe('legacy-completions')
    expect((frame as { alternative?: string }).alternative).toBe('chat-completions')
  })
})

describe('D155 ④ send-message.ts 接线(代码行断言)', () => {
  const srcPath = resolve(here, '../send-message.ts')

  /** 代码面:整行剥掉注释行(// 与 /* 与 *),行内注释截断 —— 防止把注释当成接线 */
  function codeLines(src: string): string[] {
    return src
      .split('\n')
      .map((line) => {
        const idx = line.indexOf('//')
        return idx === -1 ? line : line.slice(0, idx)
      })
      .filter((line) => {
        const t = line.trim()
        return t !== '' && !t.startsWith('/*') && !t.startsWith('*')
      })
  }

  it('三条 on* 回调都是真代码行,且函数体真的调用 setStreamAlert(对应档位)', () => {
    const lines = codeLines(readFileSync(srcPath, 'utf8'))
    const cases: Array<{ cb: RegExp; kind: string }> = [
      { cb: /onConfigWarning:\s*\(evt:\s*ConfigWarningEvent\)\s*=>/, kind: 'configWarning' },
      {
        cb: /onDeprecationNotice:\s*\(evt:\s*DeprecationNoticeEvent\)\s*=>/,
        kind: 'deprecationNotice',
      },
      { cb: /onGuardianWarning:\s*\(evt:\s*GuardianWarningEvent\)\s*=>/, kind: 'guardianWarning' },
    ]
    for (const { cb, kind } of cases) {
      const idx = lines.findIndex((l) => cb.test(l))
      expect(idx, `缺少 ${kind} 的 on* 接线行`).toBeGreaterThanOrEqual(0)
      const body = lines.slice(idx, idx + 3).join('\n')
      expect(body, `${kind} 的回调体必须真的调用 setStreamAlert`).toContain(
        `setStreamAlert('${kind}', evt)`,
      )
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
