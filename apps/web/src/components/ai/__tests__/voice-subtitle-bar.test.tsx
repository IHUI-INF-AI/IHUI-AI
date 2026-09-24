// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  MIC_ERROR_KINDS,
  PLATFORM_EXCLUSIVE,
  SUMMARY_VIEWS,
  type MicErrorKind,
} from '@ihui/shared/chat/voice-subtitles'

import { VoiceSubtitleBar } from '../voice-subtitle-bar'

// 只断言**结构与判据**(四类错误 / 互斥 / 静音仍显字幕 / 双视图),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 组件测试不依赖文案措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../..', 'packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D62 VoiceSubtitleBar / 麦克风四类错误逐态', () => {
  it('四类逐个渲染出 data-mic-error(含极易漏掉的 occupied)', () => {
    for (const kind of MIC_ERROR_KINDS) {
      const { container, unmount } = render(<VoiceSubtitleBar micError={kind} />)
      expect(container.querySelector(`[data-mic-error="${kind}"]`), kind).not.toBeNull()
      const message = container.querySelector('[data-mic-error-message]')
      expect(message?.textContent ?? '', kind).toBe(`micError.${kind}`) // t() 回 key,键位在即结构在位
      unmount()
    }
  })

  it('noPermission / noDevice 不给可重试标;occupied / startFailed 给', () => {
    for (const kind of MIC_ERROR_KINDS) {
      const { container, unmount } = render(<VoiceSubtitleBar micError={kind} />)
      const retryable = container
        .querySelector(`[data-mic-error="${kind}"]`)
        ?.getAttribute('data-mic-error-retryable')
      if (kind === 'noPermission' || kind === 'noDevice') expect(retryable, kind).toBe('false')
      else expect(retryable, kind).toBe('true')
      unmount()
    }
  })

  it('tone 落标(判定层派发,组件不得自写第二套分类)', () => {
    expect(
      render(<VoiceSubtitleBar micError="noPermission" />)
        .container.querySelector('[data-mic-error-tone]')
        ?.getAttribute('data-mic-error-tone'),
    ).toBe('warning')
    expect(
      render(<VoiceSubtitleBar micError="startFailed" />)
        .container.querySelector('[data-mic-error-tone]')
        ?.getAttribute('data-mic-error-tone'),
    ).toBe('danger')
  })

  it('aria-label 用 aria 键(与标题键不同位)', () => {
    const { container } = render(<VoiceSubtitleBar micError="occupied" />)
    const node = container.querySelector('[data-mic-error="occupied"]')
    expect(node?.getAttribute('aria-label')).toBe('micErrorAria.occupied')
    expect(node?.getAttribute('aria-label')).not.toBe('micError.occupied')
  })

  it('无错误时不渲染错误条', () => {
    const { container } = render(<VoiceSubtitleBar micError={null} />)
    expect(container.querySelector('[data-mic-error]')).toBeNull()
  })
})

describe('D62 VoiceSubtitleBar / 录音纪要 ↔ 播报互斥提示', () => {
  it('正例:双激活只渲染互斥提示,不渲染字幕,不给"边录边播"假象', () => {
    const { container } = render(<VoiceSubtitleBar summaryRecording speaking muted={false} />)
    expect(container.querySelector('[data-voice-conflict="true"]')).not.toBeNull()
    expect(container.querySelector('[data-conflict-message]')?.textContent ?? '').toBe('conflict')
    expect(container.querySelector('[data-subtitle-line]')).toBeNull()
    expect(container.querySelector('[data-mic-error]')).toBeNull()
  })

  it('反例 ①:只录音(不播报)→ 正常渲染双视图,无互斥提示', () => {
    const { container } = render(<VoiceSubtitleBar summaryRecording speaking={false} />)
    expect(container.querySelector('[data-voice-conflict]')).toBeNull()
    expect(container.querySelector('[data-summary-recording="true"]')).not.toBeNull()
  })

  it('反例 ②:只播报(不录音)→ 正常渲染字幕,无互斥提示', () => {
    const { container } = render(<VoiceSubtitleBar summaryRecording={false} speaking />)
    expect(container.querySelector('[data-voice-conflict]')).toBeNull()
    expect(container.querySelector('[data-subtitle-line]')).not.toBeNull()
  })
})

describe('D62 VoiceSubtitleBar / 字幕可见性(静音 ≠ 隐藏字幕)', () => {
  it('播报中未静音 → 可见 live 态,且无静音标', () => {
    const { container } = render(<VoiceSubtitleBar speaking muted={false} />)
    expect(container.querySelector('[data-subtitle-visible="true"]')).not.toBeNull()
    expect(container.querySelector('[data-subtitle-state="live"]')).not.toBeNull()
    expect(container.querySelector('[data-subtitle-muted="false"]')).not.toBeNull()
  })

  it('「静音并显示字幕」用例钉死:播报中已静音 → 字幕**仍然可见**(mutedSubtitles 态)', () => {
    const { container } = render(<VoiceSubtitleBar speaking muted />)
    expect(container.querySelector('[data-subtitle-visible="true"]')).not.toBeNull()
    expect(container.querySelector('[data-subtitle-state="mutedSubtitles"]')).not.toBeNull()
    expect(container.querySelector('[data-subtitle-muted="true"]')).not.toBeNull()
    // 字幕行本体在位(不是只留外框)
    expect(container.querySelector('[data-subtitle-text]')).not.toBeNull()
  })

  it('未播报 → 不渲染字幕条(无错误、非录音时整条为 null)', () => {
    const { container } = render(<VoiceSubtitleBar speaking={false} muted={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('字幕文本透传宿主内容', () => {
    const { container } = render(<VoiceSubtitleBar speaking subtitle="今天讨论了三个结论" />)
    expect(container.querySelector('[data-subtitle-text="今天讨论了三个结论"]')).not.toBeNull()
  })
})

describe('D62 VoiceSubtitleBar / 纪要双视图', () => {
  it('录音中渲染两视图按钮,当前视图 aria-pressed', () => {
    const { container } = render(<VoiceSubtitleBar summaryRecording view="discussionSummary" />)
    for (const v of SUMMARY_VIEWS) {
      expect(container.querySelector(`[data-view="${v}"]`), v).not.toBeNull()
    }
    expect(
      container.querySelector('[data-view="discussionSummary"]')?.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(container.querySelector('[data-view="taskFlow"]')?.getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('点击非当前视图 → 回调带上对侧视图(toggleSummaryView 同源)', () => {
    const onViewChange = vi.fn()
    const { container } = render(
      <VoiceSubtitleBar summaryRecording view="taskFlow" onViewChange={onViewChange} />,
    )
    ;(container.querySelector('[data-view="discussionSummary"]') as HTMLButtonElement).click()
    expect(onViewChange).toHaveBeenCalledWith('discussionSummary')
  })

  it('非录音态不渲染双视图按钮', () => {
    const { container } = render(<VoiceSubtitleBar speaking />)
    expect(container.querySelector('[data-summary-recording]')).toBeNull()
    expect(container.querySelector('[data-view]')).toBeNull()
  })
})

describe('D62 VoiceSubtitleBar / 平台豁免标注', () => {
  it('三个渲染分支都落 data-platform-exempt="miniapp"', () => {
    for (const props of [
      { micError: 'occupied' as MicErrorKind },
      { summaryRecording: true, speaking: true },
      { speaking: true },
    ]) {
      const { container, unmount } = render(<VoiceSubtitleBar {...props} />)
      expect(
        container
          .querySelector('[data-testid="voice-subtitle-bar"]')
          ?.getAttribute('data-platform-exempt'),
        JSON.stringify(props),
      ).toBe(PLATFORM_EXCLUSIVE)
      unmount()
    }
  })
})

describe('D62 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    )

  const readVoiceSubtitles = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as {
      ai?: { pane?: { voiceSubtitles?: Record<string, unknown> } }
    }
    const node = parsed.ai?.pane?.voiceSubtitles
    if (!node) throw new Error(`missing ai.pane.voiceSubtitles in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readVoiceSubtitles('zh-CN')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readVoiceSubtitles(locale)).sort(), locale).toEqual(base)
    }
  })

  it('四类错误 / aria / 双视图 / 标题 / 互斥 / ariaLabel 键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readVoiceSubtitles(locale))
      for (const kind of MIC_ERROR_KINDS) {
        expect(keys, `${locale} micError.${kind}`).toContain(`micError.${kind}`)
        expect(keys, `${locale} micErrorAria.${kind}`).toContain(`micErrorAria.${kind}`)
      }
      for (const v of SUMMARY_VIEWS) {
        expect(keys, `${locale} view.${v}`).toContain(`view.${v}`)
      }
      for (const key of [
        'muteAndShowSubtitles',
        'subtitleTitle',
        'conflict',
        'viewAriaLabel',
        'ariaLabel',
      ]) {
        expect(keys, `${locale} ${key}`).toContain(key)
      }
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
      walk(readVoiceSubtitles(locale))
    }
  })

  it('zh-CN 关键文案与任务原文逐字一致(防自创措辞)', () => {
    const node = readVoiceSubtitles('zh-CN') as {
      muteAndShowSubtitles: string
      subtitleTitle: string
      micError: Record<string, string>
      conflict: string
      view: Record<string, string>
    }
    // 「静音并显示字幕」= 任务原文
    expect(node.muteAndShowSubtitles).toBe('静音并显示字幕')
    expect(node.subtitleTitle).toBe('语音字幕')
    expect(node.micError.noPermission).toBe('无麦克风权限,请在浏览器或系统设置中允许麦克风访问')
    expect(node.micError.noDevice).toBe('未检测到麦克风设备,请接入麦克风后重试')
    expect(node.micError.occupied).toBe('麦克风被其他应用占用,请关闭占用后重试')
    expect(node.micError.startFailed).toBe('麦克风启动失败,请重试')
    expect(node.conflict).toBe('录音纪要进行中,语音播报已暂停;录音与播报不能同时进行')
    expect(node.view.discussionSummary).toBe('讨论纪要')
    expect(node.view.taskFlow).toBe('任务流')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
