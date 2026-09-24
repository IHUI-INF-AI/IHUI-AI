// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D69 InputNoticeBanner 用例:只断言**结构与判据**(原因分类 / 因果成对渲染 /
// 排队许可可见性),文案一律走 key;真实文案覆盖由「读真实词包」那组用例守住。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  COMPACTION_BLOCK_REASONS,
  type CompactionBlockContext,
  type QueueInteractionContext,
} from '@ihui/shared/chat/input-notices'

import { InputNoticeBanner } from '../input-notice-banner'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const compactionCtx: CompactionBlockContext = {
  turnRunning: true,
  creditsSufficient: true,
  turnBoundaryAvailable: true,
}

const queueCtx: QueueInteractionContext = {
  runtimeSupportsInterjection: true,
  streaming: true,
  hasQueuedMessages: true,
}

describe('D69 InputNoticeBanner / 压缩不可用提示面', () => {
  it('三类原因逐个渲染,且因/果成对(两个独立节点)', () => {
    for (const reason of COMPACTION_BLOCK_REASONS) {
      const { container, unmount } = render(
        <InputNoticeBanner compactionCtx={compactionCtx} compactionReason={reason} />,
      )
      expect(
        container.querySelector(`[data-input-notice-compaction="${reason}"]`),
        reason,
      ).not.toBeNull()
      expect(container.querySelector('[data-compaction-cause]')?.textContent, reason).toBe(
        `compaction.block.cause.${reason}`,
      )
      expect(
        container.querySelector('[data-compaction-consequence]')?.textContent,
        reason,
      ).toBe(`compaction.block.consequence.${reason}`)
      unmount()
    }
  })

  it('不传 compactionReason 时由上下文派生原因(积分不足优先)', () => {
    const { container } = render(
      <InputNoticeBanner
        compactionCtx={{ turnRunning: true, creditsSufficient: false, turnBoundaryAvailable: true }}
      />,
    )
    expect(
      container.querySelector('[data-input-notice-compaction="insufficientCredits"]'),
    ).not.toBeNull()
  })

  it('压缩可用(上下文全满足)时不渲染压缩提示面', () => {
    const { container } = render(
      <InputNoticeBanner
        compactionCtx={{ turnRunning: false, creditsSufficient: true, turnBoundaryAvailable: true }}
      />,
    )
    expect(container.querySelector('[data-input-notice-compaction]')).toBeNull()
  })
})

describe('D69 InputNoticeBanner / 排队提示面', () => {
  it('排队中渲染原因标签 + 原因文本;流式中重排锁定给拒绝提示', () => {
    const { container } = render(<InputNoticeBanner queueCtx={queueCtx} />)
    expect(container.querySelector('[data-input-notice-queue="turnRunning"]')).not.toBeNull()
    expect(container.querySelector('[data-queue-reason-title]')?.textContent).toBe(
      'queue.reasonTitle',
    )
    expect(container.querySelector('[data-queue-reason="turnRunning"]')?.textContent).toBe(
      'queue.reason.turnRunning',
    )
    expect(container.querySelector('[data-queue-reorder-locked]')?.textContent).toBe(
      'queue.denied.reorder',
    )
    expect(container.querySelector('[data-queue-reorder-aria]')).toBeNull()
  })

  it('Runtime 不支持插话 → 渲染插话降级句节点', () => {
    const { container } = render(
      <InputNoticeBanner
        queueCtx={{ runtimeSupportsInterjection: false, streaming: false, hasQueuedMessages: true }}
      />,
    )
    expect(
      container.querySelector('[data-input-notice-queue="runtimeNoInterject"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-queue-interject-denied]')?.textContent).toBe(
      'queue.denied.interject',
    )
  })

  it('可重排时挂"拖动调整排队顺序"读屏提示,不给拒绝提示', () => {
    const { container } = render(
      <InputNoticeBanner
        queueCtx={{ runtimeSupportsInterjection: true, streaming: false, hasQueuedMessages: true }}
      />,
    )
    expect(container.querySelector('[data-queue-reorder-aria="reorderAria"]')).not.toBeNull()
    expect(container.querySelector('[data-queue-reorder-locked]')).toBeNull()
  })

  it('队列空时不渲染排队提示面;两个上下文都缺省时不渲染任何内容', () => {
    const emptyQueue = render(
      <InputNoticeBanner
        queueCtx={{ runtimeSupportsInterjection: true, streaming: true, hasQueuedMessages: false }}
      />,
    )
    expect(emptyQueue.container.querySelector('[data-input-notice-queue]')).toBeNull()
    emptyQueue.unmount()

    let container: HTMLElement | undefined
    expect(() => {
      container = render(<InputNoticeBanner />).container
    }).not.toThrow()
    expect(container?.firstChild).toBeNull()
  })
})

describe('D69 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readNotices = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: { inputNotices?: Record<string, unknown> } } }
    const node = parsed.ai?.pane?.inputNotices
    if (!node) throw new Error(`missing ai.pane.inputNotices in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readNotices('zh-CN')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readNotices(locale)).sort(), locale).toEqual(base)
    }
  })

  it('因果成对 + 排队五条判据 + ariaLabel 键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readNotices(locale))
      for (const reason of COMPACTION_BLOCK_REASONS) {
        expect(keys, `${locale} cause.${reason}`).toContain(`compaction.block.cause.${reason}`)
        expect(keys, `${locale} consequence.${reason}`).toContain(
          `compaction.block.consequence.${reason}`,
        )
      }
      expect(keys, `${locale} reasonTitle`).toContain('queue.reasonTitle')
      expect(keys, `${locale} reason.turnRunning`).toContain('queue.reason.turnRunning')
      expect(keys, `${locale} reason.queueAhead`).toContain('queue.reason.queueAhead')
      expect(keys, `${locale} reason.runtimeNoInterject`).toContain('queue.reason.runtimeNoInterject')
      expect(keys, `${locale} denied.reorder`).toContain('queue.denied.reorder')
      expect(keys, `${locale} denied.undo`).toContain('queue.denied.undo')
      expect(keys, `${locale} denied.interject`).toContain('queue.denied.interject')
      expect(keys, `${locale} reorderAria`).toContain('queue.reorderAria')
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
      walk(readNotices(locale))
    }
  })

  it('zh-CN 判据原文逐字一致(防自创措辞)', () => {
    const node = readNotices('zh-CN') as {
      compaction: { block: { cause: Record<string, string>; consequence: Record<string, string> } }
      queue: {
        reasonTitle: string
        reason: Record<string, string>
        denied: Record<string, string>
        reorderAria: string
      }
    }
    // 压缩因/果(含两条任务原文)
    expect(node.compaction.block.cause.insufficientCredits).toBe('压缩会消耗少量积分')
    expect(node.compaction.block.consequence.runningTurn).toBe(
      '压缩在当前 Turn 完成后执行，不能插入正在运行的 Turn',
    )
    // 排队五条判据
    expect(node.queue.reasonTitle).toBe('排队原因')
    expect(node.queue.reorderAria).toBe('拖动调整排队顺序；聚焦后可使用上下方向键')
    expect(node.queue.denied.undo).toBe('无法撤回排队消息')
    expect(node.queue.denied.reorder).toBe('无法调整排队顺序')
    expect(node.queue.denied.interject).toBe('当前 Runtime 不支持插话，消息将继续排队')
    expect(node.queue.reason.runtimeNoInterject).toBe('当前 Runtime 不支持插话，消息将继续排队')
  })

  it('同批并行键存活:ai.pane.voiceSubtitles 必在;inputSources 存在则五语言必须齐(防冲掉)', () => {
    for (const locale of LOCALES) {
      const raw = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
        ai?: { pane?: Record<string, unknown> }
      }
      const pane = raw.ai?.pane
      // voiceSubtitles 是本票写入前就存在的键:被冲掉 = 本票写入事故,硬失败
      expect(pane?.voiceSubtitles, `${locale} voiceSubtitles`).toBeTruthy()
      expect(pane?.quotaOwnership, `${locale} quotaOwnership`).toBeTruthy()
      // inputSources 由同批另一子代理写入:若已落盘则五语言必须齐且不得被冲掉;
      // 若整个键族缺席,属同批未落盘(非本票冲掉 —— 本票写入前它就不存在),降级记日志
      const paneOf = (l: string): Record<string, unknown> | undefined =>
        (
          JSON.parse(readFileSync(join(MESSAGES_ROOT, `${l}.json`), 'utf8')) as {
            ai?: { pane?: Record<string, unknown> }
          }
        ).ai?.pane
      const present = LOCALES.filter((l) => {
        const p = paneOf(l)
        return p !== undefined && 'inputSources' in p
      })
      if (present.length === 0) {
        console.warn(
          `[D69] ai.pane.inputSources 尚未由同批子代理落盘(非本票键被冲掉);落盘后本断言自动转硬校验`,
        )
      } else {
        expect(present, 'inputSources 五语言 parity').toEqual([...LOCALES])
        expect(pane && 'inputSources' in pane, `${locale} inputSources`).toBe(true)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
