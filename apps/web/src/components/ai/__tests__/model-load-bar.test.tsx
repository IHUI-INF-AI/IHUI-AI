// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  MODEL_LOAD_LEVELS,
  QUEUE_BAR_STATES,
  type ModelLoadFrame,
  type QueueBarState,
} from '@ihui/shared/chat/model-load'

import { ModelLoadBar } from '../model-load-bar'

// 只断言**结构与判据**(无帧返 null / 五态渲染 / 诱导风险标志),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 组件测试不依赖文案措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D59 ModelLoadBar / 反假数据(核心负例)', () => {
  it('无 frame → 返回 null,不渲染任何内容(不得用假数据占位)', () => {
    let container: HTMLElement | undefined
    expect(() => {
      container = render(<ModelLoadBar />).container
    }).not.toThrow()
    expect(container?.firstChild).toBeNull()
  })

  it('frame 全字段无效 → 返回 null(空帧不等于有数据)', () => {
    const { container } = render(<ModelLoadBar frame={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('半截帧(非法档位 / 第 0 位 / 0 秒等待)→ 返回 null,不显示残缺态', () => {
    for (const frame of [
      { loadLevel: 'critical' } as unknown as ModelLoadFrame,
      { queuePosition: 0 },
      { estimatedWaitSeconds: 0 },
      { lane: 'slow' as const },
    ]) {
      const { container, unmount } = render(<ModelLoadBar frame={frame} />)
      expect(container.firstChild, JSON.stringify(frame)).toBeNull()
      unmount()
    }
  })
})

describe('D59 ModelLoadBar / 五态渲染', () => {
  const frameFor = (state: QueueBarState): ModelLoadFrame => {
    switch (state) {
      case 'mayQueue':
        return { loadLevel: 'high' }
      case 'slowLane':
        return { queuePosition: 3 }
      case 'fastPass':
        return { lane: 'fast' }
      case 'recovering':
        return { recovering: true }
      case 'waitingEstimate':
        return { estimatedWaitSeconds: 300 }
    }
  }

  it('五态逐个渲染出对应 data-model-load-state', () => {
    for (const state of QUEUE_BAR_STATES) {
      const { container, unmount } = render(<ModelLoadBar frame={frameFor(state)} />)
      expect(container.querySelector(`[data-model-load-state="${state}"]`), state).not.toBeNull()
      expect(container.querySelector('[data-model-load-label]'), state).not.toBeNull()
      unmount()
    }
  })

  it('负载三档各自出 mayQueue 态(档位缺失不渲染,已在反例组钉住)', () => {
    for (const level of MODEL_LOAD_LEVELS) {
      const { container, unmount } = render(<ModelLoadBar frame={{ loadLevel: level }} />)
      expect(container.querySelector('[data-model-load-state="mayQueue"]'), level).not.toBeNull()
      expect(container.querySelector('[data-model-load-label="load.' + level + '"]'), level).not.toBeNull()
      unmount()
    }
  })

  it('slowLane 排位插值进文案(label 带 position 参数)', () => {
    const { container } = render(<ModelLoadBar frame={{ queuePosition: 7 }} />)
    const label = container.querySelector('[data-model-load-label="slowLane"]')
    expect(label).not.toBeNull()
    expect(label?.textContent).toContain('7')
  })

  it('waitingEstimate 各分档走各自文案键(约N分钟带 minutes 插值)', () => {
    const cases: Array<[number, string]> = [
      [45, 'wait.under1min'],
      [90, 'wait.about1min'],
      [300, 'wait.aboutNmin'],
      [601, 'wait.over10min'],
    ]
    for (const [seconds, key] of cases) {
      const { container, unmount } = render(<ModelLoadBar frame={{ estimatedWaitSeconds: seconds }} />)
      expect(container.querySelector(`[data-model-load-label="${key}"]`), key).not.toBeNull()
      unmount()
    }
    const nMin = render(<ModelLoadBar frame={{ estimatedWaitSeconds: 300 }} />)
    expect(nMin.container.querySelector('[data-model-load-label="wait.aboutNmin"]')?.textContent).toContain('5')
  })

  it('role=status + ariaLabel 可达', () => {
    const { container } = render(<ModelLoadBar frame={{ recovering: true }} />)
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })
})

describe('D59 ModelLoadBar / 「不充值可用心智」边界(2026-09-21 三轮口径)', () => {
  it('免费档可用(缺省)且非低负载 → inducementRisk=true;本条只做状态陈述,不渲染任何付费出口', () => {
    const { container } = render(<ModelLoadBar frame={{ loadLevel: 'high' }} />)
    expect(container.querySelector('[data-model-load-inducement-risk="true"]')).not.toBeNull()
    expect(container.querySelector('[data-action]')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  it('免费档不可用 → inducementRisk=false(付费出路是真实出路,但仍无诱导出口)', () => {
    const { container } = render(<ModelLoadBar frame={{ loadLevel: 'high' }} freeTierAvailable={false} />)
    expect(container.querySelector('[data-model-load-inducement-risk="false"]')).not.toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  it('低负载 → 无诱导风险(免费出路足够,连卖点都不存在)', () => {
    const { container } = render(<ModelLoadBar frame={{ loadLevel: 'low' }} />)
    expect(container.querySelector('[data-model-load-inducement-risk="false"]')).not.toBeNull()
  })
})

describe('D59 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const loadPane = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: Record<string, unknown> } }
    return parsed.ai?.pane ?? {}
  }

  const readModelLoad = (locale: string): Record<string, unknown> => {
    const node = loadPane(locale).modelLoad
    if (!node) throw new Error(`missing ai.pane.modelLoad in ${locale}.json`)
    return node as Record<string, unknown>
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readModelLoad('zh-CN')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readModelLoad(locale)).sort(), locale).toEqual(base)
    }
  })

  it('三档 / 五态 / 四档等待 / ariaLabel 键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readModelLoad(locale))
      for (const level of MODEL_LOAD_LEVELS) expect(keys, `${locale} load.${level}`).toContain(`load.${level}`)
      for (const state of ['slowLane', 'fastPass', 'recovering']) {
        expect(keys, `${locale} ${state}`).toContain(state)
      }
      for (const bucket of ['under1min', 'about1min', 'aboutNmin', 'over10min']) {
        expect(keys, `${locale} wait.${bucket}`).toContain(`wait.${bucket}`)
      }
      expect(keys, `${locale} ariaLabel`).toContain('ariaLabel')
    }
  })

  it('所有语言取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      const walk = (obj: Record<string, unknown>): void => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') walk(value as Record<string, unknown>)
          else expect(typeof value === 'string' && value.trim().length > 0, `${locale}`).toBe(true)
        }
      }
      walk(readModelLoad(locale))
    }
  })

  it('zh-CN 关键文案与台账原文逐字一致(防自创措辞)', () => {
    const node = readModelLoad('zh-CN') as {
      load: Record<string, string>
      slowLane: string
      fastPass: string
      recovering: string
      wait: Record<string, string>
    }
    expect(node.load.low).toBe('低负载可能排队')
    expect(node.load.medium).toBe('中负载可能排队')
    expect(node.load.high).toBe('高负载可能排队')
    expect(node.slowLane).toBe('已进入慢速队列·当前排位 {position}')
    expect(node.fastPass).toBe('已开启速通免排')
    expect(node.recovering).toBe('模型可用，正在继续请求')
    expect(node.wait.under1min).toBe('预计等待 不足1分钟')
    expect(node.wait.about1min).toBe('预计等待 约1分钟')
    expect(node.wait.aboutNmin).toBe('预计等待 约{minutes}分钟')
    expect(node.wait.over10min).toBe('预计等待 超过10分钟')
  })

  it('同批键存活:ai.pane.cloudChatOps / ai.pane.inputNotices 硬断言(词包锚点插入不得冲掉并行改动)', () => {
    for (const locale of LOCALES) {
      const pane = loadPane(locale)
      expect(pane.cloudChatOps, `${locale} cloudChatOps`).toBeDefined()
      expect(pane.inputNotices, `${locale} inputNotices`).toBeDefined()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
