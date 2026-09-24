// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D62 语音字幕与讨论纪要 —— 判定层用例(G-76)。
//
// 四条主线:
//   ① 麦克风四类逐态:每类独立标题键 / aria 键,四类互不相同;classifyMicError
//      把浏览器 DOMException 归一到四类,未知兜底 startFailed 不丢错误态;
//   ② **互斥正反例**(本票核心):「录音纪要进行中」与「播报进行中」不得同时
//      激活 —— 3×3 = 9 组合全穷举,只有两个跨向组合判冲突;
//   ③ 静音 ≠ 隐藏字幕:subtitleView(speaking=true, muted=true) 必须 visible,
//      「静音并显示字幕」语义用例钉死;
//   ④ 双视图:二视图 + 切换判定,穷尽 switch 零 default 由 tsc 守住。

import { describe, expect, it } from 'vitest'

import {
  MIC_ERROR_KINDS,
  PLATFORM_EXCLUSIVE,
  SUBTITLE_STATES,
  SUMMARY_VIEWS,
  VOICE_ACTIVITIES,
  VOICE_SUBTITLES_NAMESPACE,
  classifyMicError,
  conflictMessageKey,
  isSummaryView,
  micErrorAriaKey,
  micErrorTitleKey,
  micErrorView,
  resolveVoiceMode,
  subtitleView,
  summaryViewLabelKey,
  toggleSummaryView,
  voiceModeConflict,
  type MicErrorKind,
  type SummaryView,
} from '../voice-subtitles'

describe('D62 麦克风四类错误 / 逐态判据', () => {
  it('四类常量就是任务原文那四类,顺序即语义顺序', () => {
    expect(MIC_ERROR_KINDS).toEqual(['noPermission', 'noDevice', 'occupied', 'startFailed'])
    expect(MIC_ERROR_KINDS).toHaveLength(4)
  })

  it('每类都能派发,且 titleKey / ariaKey 与键名辅助函数一致', () => {
    for (const kind of MIC_ERROR_KINDS) {
      const view = micErrorView(kind)
      expect(view.kind, kind).toBe(kind)
      expect(view.titleKey, kind).toBe(micErrorTitleKey(kind))
      expect(view.ariaKey, kind).toBe(micErrorAriaKey(kind))
      expect(view.titleKey, kind).toBe(`micError.${kind}`)
      expect(view.ariaKey, kind).toBe(`micErrorAria.${kind}`)
    }
  })

  it('四类标题键两两不同(不得有两类共用一个文案位)', () => {
    const keys = MIC_ERROR_KINDS.map((k) => micErrorView(k).titleKey)
    expect(new Set(keys).size).toBe(MIC_ERROR_KINDS.length)
  })

  it('四类 aria 键两两不同(读屏不得把两类念成同一句)', () => {
    const keys = MIC_ERROR_KINDS.map((k) => micErrorView(k).ariaKey)
    expect(new Set(keys).size).toBe(MIC_ERROR_KINDS.length)
  })

  it('noPermission / noDevice 必须改环境(重试无效),occupied / startFailed 可重试', () => {
    expect(micErrorView('noPermission').recoverableByRetry).toBe(false)
    expect(micErrorView('noDevice').recoverableByRetry).toBe(false)
    expect(micErrorView('occupied').recoverableByRetry).toBe(true)
    expect(micErrorView('startFailed').recoverableByRetry).toBe(true)
  })

  it('tone 四类落在三档语义色内,且逐类不同形', () => {
    const tones = MIC_ERROR_KINDS.map((k) => micErrorView(k).tone)
    for (const tone of tones) expect(['warning', 'info', 'danger'], tone).toContain(tone)
    expect(new Set(tones).size).toBe(3)
  })

  it('穷尽性:switch 覆盖四类,每类派发都不抛(漏类在 tsc 阶段就失败)', () => {
    const views = MIC_ERROR_KINDS.map((k) => micErrorView(k))
    expect(views).toHaveLength(4)
    for (const v of views) expect(v.kind).toBeTruthy()
  })
})

describe('D62 classifyMicError / 浏览器异常归一到四类', () => {
  it('NotAllowedError / PermissionDeniedError → noPermission', () => {
    expect(classifyMicError({ name: 'NotAllowedError' })).toBe('noPermission')
    expect(classifyMicError({ name: 'PermissionDeniedError' })).toBe('noPermission')
  })

  it('NotFoundError / DevicesNotFoundError / OverconstrainedError → noDevice', () => {
    expect(classifyMicError({ name: 'NotFoundError' })).toBe('noDevice')
    expect(classifyMicError({ name: 'DevicesNotFoundError' })).toBe('noDevice')
    expect(classifyMicError({ name: 'OverconstrainedError' })).toBe('noDevice')
  })

  it('NotReadableError / TrackStartError → occupied', () => {
    expect(classifyMicError({ name: 'NotReadableError' })).toBe('occupied')
    expect(classifyMicError({ name: 'TrackStartError' })).toBe('occupied')
  })

  it('未知异常(含无 name / 非 Error)兜底 startFailed,不丢错误态', () => {
    expect(classifyMicError({ name: 'AbortError' })).toBe('startFailed')
    expect(classifyMicError(new TypeError('x'))).toBe('startFailed')
    expect(classifyMicError('boom')).toBe('startFailed')
    expect(classifyMicError(undefined)).toBe('startFailed')
  })
})

describe('D62 互斥判据(本票核心)/ voiceModeConflict 3×3 全穷举', () => {
  it('正例:录音纪要进行中 ↔ 播报进行中,两个跨向都判冲突', () => {
    expect(voiceModeConflict('recordingSummary', 'speaking')).toBe(true)
    expect(voiceModeConflict('speaking', 'recordingSummary')).toBe(true)
  })

  it('反例 ①:idle 与任何态都不冲突(空闲可随时进入任一活动)', () => {
    for (const a of VOICE_ACTIVITIES) {
      for (const b of VOICE_ACTIVITIES) {
        if (a === 'idle' || b === 'idle') {
          expect(voiceModeConflict(a, b), `${a} × ${b}`).toBe(false)
        }
      }
    }
  })

  it('反例 ②:同态是幂等无操作,不是冲突(拦同态会把正常重复点击误报)', () => {
    for (const a of VOICE_ACTIVITIES) {
      expect(voiceModeConflict(a, a), a).toBe(false)
    }
  })

  it('3×3 = 9 组合全穷举:恰好只有两个跨向组合判冲突', () => {
    let conflictCount = 0
    for (const a of VOICE_ACTIVITIES) {
      for (const b of VOICE_ACTIVITIES) {
        if (voiceModeConflict(a, b)) conflictCount++
      }
    }
    expect(conflictCount).toBe(2)
    expect(VOICE_ACTIVITIES).toHaveLength(3)
  })
})

describe('D62 状态机迁移 / resolveVoiceMode', () => {
  it('正例:录音中切播报、播报中切录音,都被拦并回 conflict 键', () => {
    const blocked1 = resolveVoiceMode('speaking', 'recordingSummary')
    const blocked2 = resolveVoiceMode('recordingSummary', 'speaking')
    expect(blocked1.ok).toBe(false)
    expect(blocked2.ok).toBe(false)
    if (!blocked1.ok) expect(blocked1.messageKey).toBe(conflictMessageKey())
    if (!blocked2.ok) expect(blocked2.messageKey).toBe(conflictMessageKey())
  })

  it('反例:idle 进入任一活动、任一活动回 idle、同态幂等,全部放行', () => {
    for (const a of VOICE_ACTIVITIES) {
      expect(resolveVoiceMode(a, 'idle').ok, `idle → ${a}`).toBe(true)
      expect(resolveVoiceMode('idle', a).ok, `${a} → idle`).toBe(true)
      expect(resolveVoiceMode(a, a).ok, `${a} → ${a}`).toBe(true)
    }
  })

  it('放行结果带回目标活动;拦截结果带回 from/to 便于 UI 提示', () => {
    const ok = resolveVoiceMode('recordingSummary', 'idle')
    expect(ok).toEqual({ ok: true, activity: 'recordingSummary' })
    const blocked = resolveVoiceMode('speaking', 'recordingSummary')
    if (!blocked.ok) {
      expect(blocked.from).toBe('recordingSummary')
      expect(blocked.to).toBe('speaking')
    } else {
      expect.unreachable('播报切入录音中必须被拦')
    }
  })
})

describe('D62 字幕可见性 / 静音 ≠ 隐藏字幕', () => {
  it('正例「静音并显示字幕」:播报中且已静音 → 字幕**仍然可见**,态为 mutedSubtitles', () => {
    const view = subtitleView(true, true)
    expect(view.visible).toBe(true)
    expect(view.state).toBe('mutedSubtitles')
    expect(view.titleKey).toBe('muteAndShowSubtitles')
  })

  it('播报中且未静音 → 可见,live 态', () => {
    const view = subtitleView(true, false)
    expect(view.visible).toBe(true)
    expect(view.state).toBe('live')
  })

  it('未播报 → 隐藏(无论是否静音)', () => {
    expect(subtitleView(false, false).visible).toBe(false)
    expect(subtitleView(false, false).state).toBe('hidden')
    expect(subtitleView(false, true).visible).toBe(false)
  })

  it('三态互不相同,静音可见与 live 可见是两个态(不共用一个渲染位)', () => {
    const states = [subtitleView(true, false).state, subtitleView(true, true).state, subtitleView(false, false).state]
    expect(new Set(states).size).toBe(SUBTITLE_STATES.length)
    expect(SUBTITLE_STATES).toEqual(['hidden', 'live', 'mutedSubtitles'])
  })

  it('静音可见与隐藏不可混淆(muted ≠ hidden 的判据边界)', () => {
    expect(subtitleView(true, true).visible).toBe(true)
    expect(subtitleView(true, true).state).not.toBe(subtitleView(false, true).state)
  })
})

describe('D62 双视图 / 讨论纪要与任务流', () => {
  it('双视图常量与任务原文一致', () => {
    expect(SUMMARY_VIEWS).toEqual(['discussionSummary', 'taskFlow'])
  })

  it('isSummaryView 只认两视图', () => {
    for (const v of SUMMARY_VIEWS) expect(isSummaryView(v), v).toBe(true)
    for (const bad of ['', 'summary', 'discussionSummary ', 'taskflow']) {
      expect(isSummaryView(bad), bad).toBe(false)
    }
  })

  it('切换判定:二视图互为对侧,切两次回到原位', () => {
    expect(toggleSummaryView('discussionSummary')).toBe('taskFlow')
    expect(toggleSummaryView('taskFlow')).toBe('discussionSummary')
    for (const v of SUMMARY_VIEWS as readonly SummaryView[]) {
      expect(toggleSummaryView(toggleSummaryView(v))).toBe(v)
    }
  })

  it('视图标签键与常量一致(`view.<key>`)', () => {
    for (const v of SUMMARY_VIEWS) {
      expect(summaryViewLabelKey(v)).toBe(`view.${v}`)
    }
  })
})

describe('D62 常量与键名生成器', () => {
  it('词包命名空间与平台豁免常量', () => {
    expect(VOICE_SUBTITLES_NAMESPACE).toBe('ai.pane.voiceSubtitles')
    expect(PLATFORM_EXCLUSIVE).toBe('miniapp')
  })

  it('VOICE_ACTIVITIES 三态齐备(互斥判据的取值域)', () => {
    expect(VOICE_ACTIVITIES).toEqual(['idle', 'recordingSummary', 'speaking'])
  })

  it('所有键名生成器都落在 voiceSubtitles 命名空间语义内(不含斜杠/空格)', () => {
    const keys = [
      conflictMessageKey(),
      ...MIC_ERROR_KINDS.map((k: MicErrorKind) => micErrorTitleKey(k)),
      ...MIC_ERROR_KINDS.map((k: MicErrorKind) => micErrorAriaKey(k)),
      ...SUMMARY_VIEWS.map((v) => summaryViewLabelKey(v)),
    ]
    for (const key of keys) {
      expect(key, key).toMatch(/^[A-Za-z][A-Za-z0-9.]*$/)
      expect(key.includes(' '), key).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
