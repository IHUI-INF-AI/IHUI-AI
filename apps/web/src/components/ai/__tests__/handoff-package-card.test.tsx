// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  HANDOFF_MESSAGE_KEYS,
  HANDOFF_SECTIONS,
  buildHandoffPackage,
  formatHandoffText,
  type HandoffContext,
} from '@ihui/shared/chat/handoff-package'

import { HandoffPackageCard } from '../handoff-package-card'

// 只断言**结构与判据**(四段 / 本地优先 / 空态 / 脱敏 / 降级 / 复制),
// 文案一律走 key;真实文案与五语言 parity 由最后一组「读真实词包」用例守住。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const SECRET_ERROR = [
  'POST /v1/chat failed',
  'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  'key sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
  'from 192.168.31.7:5432',
  'notify chunchuan.li@aizhs.top',
].join('\n')

const externalDownOnly: HandoffContext = {
  errorMessage: 'gateway 调用失败',
  externalSignals: [{ service: 'ai-service', status: 'down' }],
}

const fullCtx: HandoffContext = {
  errorMessage: SECRET_ERROR,
  fixSteps: [{ label: '重跑任务', outcome: 'done' }],
  localSignals: { timedOut: true, errorCode: 'REQUEST_TIMEOUT' },
  externalSignals: [{ service: 'ai-service', status: 'down' }],
  productSurface: { route: '/workspace/123', panel: '对话流' },
  incidentNames: ['INC-2041'],
}

describe('D94 交接单卡 / 结构与判据', () => {
  it('四段全部渲染(data-handoff-section 四段齐全)', () => {
    const { container } = render(<HandoffPackageCard ctx={fullCtx} />)
    for (const section of HANDOFF_SECTIONS) {
      expect(container.querySelector(`[data-handoff-section="${section}"]`), section).not.toBeNull()
      expect(
        container.querySelector(`[data-handoff-section-title="${section}"]`),
        section,
      ).not.toBeNull()
    }
  })

  it('只有外部 down ⇒ local-confirmed=false / external-only=true,且必出辅助声明', () => {
    const { container } = render(<HandoffPackageCard ctx={externalDownOnly} />)
    const root = container.querySelector('[data-handoff-degraded]') as HTMLElement
    expect(root.getAttribute('data-handoff-local-confirmed')).toBe('false')
    expect(root.getAttribute('data-handoff-external-only')).toBe('true')
    expect(container.querySelector('[data-handoff-caveat]')).not.toBeNull()
    // 外部信号只能出现在 source=external 行里
    expect(container.querySelector('[data-handoff-line-source="external"]')).not.toBeNull()
    expect(container.querySelector('[data-handoff-line-source="local"]')).toBeNull()
  })

  it('有本地判据 ⇒ local-confirmed=true / external-only=false(外部 down 不抢结论)', () => {
    const { container } = render(<HandoffPackageCard ctx={fullCtx} />)
    const root = container.querySelector('[data-handoff-degraded]') as HTMLElement
    expect(root.getAttribute('data-handoff-local-confirmed')).toBe('true')
    expect(root.getAttribute('data-handoff-external-only')).toBe('false')
    expect(container.querySelector('[data-handoff-line-source="local"]')).not.toBeNull()
  })

  it('修复步骤为空 ⇒ 显式空态(不得留空假装没有)', () => {
    const { container } = render(<HandoffPackageCard ctx={{ errorMessage: 'boom' }} />)
    const empty = container.querySelector('[data-handoff-empty="fixSteps"]')
    expect(empty).not.toBeNull()
    expect((empty?.textContent ?? '').length).toBeGreaterThan(0)
    expect(container.querySelector('[data-handoff-fix-step]')).toBeNull()
  })

  it('证据必须已过脱敏:渲染出的正文不得含密钥 / 邮箱 / IP', () => {
    const { container } = render(<HandoffPackageCard ctx={fullCtx} />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')
    expect(text).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(text).not.toContain('192.168.31.7')
    expect(text).not.toContain('chunchuan.li@aizhs.top')
    expect(container.querySelector('[data-handoff-evidence-label="用户可见错误"]')).not.toBeNull()
  })

  it('截断记录渲染在证据行上(truncated 计数可见)', () => {
    const { container } = render(<HandoffPackageCard ctx={{ errorMessage: 'z'.repeat(2000) }} />)
    const line = container.querySelector('[data-handoff-evidence="0"]') as HTMLElement
    expect(Number(line.getAttribute('data-handoff-evidence-truncated'))).toBe(800)
    expect((container.querySelector('[data-handoff-degraded]') as HTMLElement).getAttribute('data-handoff-truncated')).toBe(
      '800',
    )
  })

  it('无网络降级不阻断:前三段照常渲染 + 降级说明在位', () => {
    const { container } = render(
      <HandoffPackageCard
        ctx={{
          errorMessage: 'fetch failed',
          fixSteps: [{ label: '重试', outcome: 'failed' }],
          localSignals: { dnsFailure: true },
          dataSourceReachable: false,
        }}
      />,
    )
    const root = container.querySelector('[data-handoff-degraded]') as HTMLElement
    expect(root.getAttribute('data-handoff-degraded')).toBe('true')
    expect(container.querySelector('[data-handoff-degraded-note]')).not.toBeNull()
    expect(container.querySelector('[data-handoff-section="diagnosis"]')).not.toBeNull()
    expect(container.querySelector('[data-handoff-fix-step="0"]')).not.toBeNull()
    expect(container.querySelector('[data-handoff-evidence="0"]')).not.toBeNull()
  })

  it('事件空态:无 incident ⇒ incidents-empty=true 且事件行仍渲染', () => {
    const { container } = render(<HandoffPackageCard ctx={{ errorMessage: 'x' }} />)
    const line = container.querySelector('[data-handoff-incident-line]') as HTMLElement
    expect(line.getAttribute('data-handoff-incidents-empty')).toBe('true')
    expect((line.textContent ?? '').length).toBeGreaterThan(0)
    const withIncidents = render(<HandoffPackageCard ctx={fullCtx} />)
    expect(
      withIncidents.container
        .querySelector('[data-handoff-incident-line]')
        ?.getAttribute('data-handoff-incidents-empty'),
    ).toBe('false')
  })

  it('复制动作:点击把**已脱敏纯文本**交给上层兜底链(§5e)', () => {
    const onCopy = vi.fn()
    const pkg = buildHandoffPackage(fullCtx)
    const { container } = render(<HandoffPackageCard pkg={pkg} onCopy={onCopy} />)
    const button = container.querySelector('[data-handoff-copy]') as HTMLButtonElement
    expect(button).not.toBeNull()
    expect(button.getAttribute('aria-label')).toBe('copy')
    button.click()
    expect(onCopy).toHaveBeenCalledTimes(1)
    const handed = onCopy.mock.calls[0]?.[0] as string
    expect(handed).toBe(formatHandoffText(pkg))
    expect(handed).not.toContain('sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')
    expect(handed).toContain('已脱敏证据：')
  })

  it('不传 onCopy ⇒ 不渲染复制入口(纯展示)', () => {
    const { container } = render(<HandoffPackageCard ctx={fullCtx} />)
    expect(container.querySelector('[data-handoff-copy]')).toBeNull()
  })
})

describe('D94 词包覆盖(读真实词包,不 mock)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
  const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readHandoff = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: { handoff?: Record<string, unknown> } } }
    const node = parsed.ai?.pane?.handoff
    if (!node) throw new Error(`missing ai.pane.handoff in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readHandoff('zh-CN')).sort()
    expect(base.length).toBe(HANDOFF_MESSAGE_KEYS.length)
    for (const locale of LOCALES) {
      expect(flat(readHandoff(locale)).sort(), locale).toEqual(base)
    }
  })

  it('判定层声明的 20 个叶子键五语言齐备', () => {
    for (const locale of LOCALES) {
      const keys = flat(readHandoff(locale))
      for (const key of HANDOFF_MESSAGE_KEYS) expect(keys, `${locale} ${key}`).toContain(key)
    }
  })

  it('取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      const walk = (obj: Record<string, unknown>): void => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') walk(value as Record<string, unknown>)
          else expect(typeof value === 'string' && value.trim().length > 0, `${locale}`).toBe(true)
        }
      }
      walk(readHandoff(locale))
    }
  })

  it('ICU 占位符五语言一致(incidentLine / truncated)', () => {
    for (const locale of LOCALES) {
      const node = readHandoff(locale) as {
        incidentLine: string
        truncated: string
      }
      expect(node.incidentLine, locale).toContain('{incidentNames}')
      expect(node.truncated, locale).toContain('{count}')
    }
  })

  it('zh-CN 关键文案与台账 D94 原文逐字一致(防自创措辞)', () => {
    const node = readHandoff('zh-CN') as {
      section: Record<string, string>
      empty: Record<string, string>
      incidentLine: string
      truncated: string
    }
    expect(node.section.diagnosis).toBe('诊断方法')
    expect(node.section.fixSteps).toBe('已尝试的修复步骤')
    expect(node.section.evidence).toBe('已脱敏证据：')
    expect(node.section.productSurface).toBe('产品界面')
    expect(node.incidentLine).toBe('状态：可能相关的事件：{incidentNames}')
    expect(node.empty.fixSteps).toBe('未尝试任何修复步骤')
    expect(node.truncated).toBe('已截断 {count} 字符')
  })

  it('ja / ko 不得残留简体中文词(「事件」等词在 zh-TW 里是正字,故只对 ja/ko 生效)', () => {
    const simplified = ['协作', '概览', '绑定', '脱敏', '证据', '界面', '网络', '事件', '交接单', '未尝试', '诊断方法']
    for (const locale of ['ja', 'ko'] as const) {
      const walk = (obj: Record<string, unknown>): string[] =>
        Object.values(obj).flatMap((v) =>
          v && typeof v === 'object' ? walk(v as Record<string, unknown>) : [String(v)],
        )
      for (const text of walk(readHandoff(locale))) {
        for (const word of simplified) expect(text, `${locale} 残留「${word}」`).not.toContain(word)
      }
    }
  })

  it('zh-TW 走繁体正字(不得与 zh-CN 同形)', () => {
    const node = readHandoff('zh-TW') as { section: Record<string, string>; empty: Record<string, string> }
    expect(node.section.diagnosis).toBe('診斷方法')
    expect(node.section.fixSteps).toBe('已嘗試的修復步驟')
    expect(node.section.evidence).toBe('已脫敏證據：')
    expect(node.section.productSurface).toBe('產品介面')
    expect(node.empty.fixSteps).toBe('未嘗試任何修復步驟')
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
