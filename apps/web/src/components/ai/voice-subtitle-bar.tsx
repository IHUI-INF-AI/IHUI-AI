// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * VoiceSubtitleBar — 语音字幕条 + 纪要双视图渲染位(D62,G-76,2026-09-24 立)。
 *
 * **不新建录音栈**:录音状态继续走 `components/chat/voice-toolbar.tsx`(VoiceInput
 * 桥接),播报状态继续走 `components/chat/voice-stream-speaker.tsx`(done 边沿
 * TTS)。本组件是**纯展示位**,由宿主(AI 面板)把两个既有栈的状态映射进来:
 *   · `summaryRecording` ← VoiceInputHandle.recording(录音纪要进行中);
 *   · `speaking` / `muted` ← VoiceStreamSpeaker 播放态与 `ihui_voice_playback` 开关;
 *   · `micError` ← `classifyMicError(getUserMedia 异常)`(判定层 `voice-subtitles.ts`)。
 *
 * 判定全部下沉 `@ihui/shared/chat/voice-subtitles`(常量 + 纯函数 + 穷尽 switch),
 * 本组件只做结构渲染,不写第二套错误分类或互斥判定。
 *
 * 渲染优先级(互斥语义的 UI 落地):
 *   ① conflict —— 「录音纪要进行中」与「播报进行中」同时到达时,**只渲染互斥
 *      提示**(状态机 `voiceModeConflict` 已在判定层拦迁移;这里保证 UI 不给
 *      "边录边播"的假象);
 *   ② micError —— 四类麦克风错误逐类渲染(recoverableByRetry 决定是否给重试标);
 *   ③ subtitle —— 字幕条:播报中即显示,**静音后仍然可见**(静音 ≠ 隐藏字幕),
 *      mutedSubtitles 态额外带「静音并显示字幕」标识;
 *   ④ summary —— 纪要双视图(讨论纪要 / 任务流)切换按钮。
 *
 * 平台豁免:root 落 `data-platform-exempt="miniapp"`(web 独占,miniapp 端
 * 用原生录音 API 与原生字幕位,本族判据/文案不参与其 parity,见判定层文件头)。
 */

import * as React from 'react'
import { ListChecks, MicOff, NotebookText, Volume2, VolumeX } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  MIC_ERROR_KINDS,
  PLATFORM_EXCLUSIVE,
  SUMMARY_VIEWS,
  conflictMessageKey,
  micErrorAriaKey,
  micErrorView,
  subtitleView,
  summaryViewLabelKey,
  toggleSummaryView,
  type MicErrorKind,
  type SummaryView,
} from '@ihui/shared/chat/voice-subtitles'

export interface VoiceSubtitleBarProps {
  /** 播报(TTS)进行中 ← VoiceStreamSpeaker 播放态 */
  speaking?: boolean
  /** 播报静音中(音频关、字幕仍在) */
  muted?: boolean
  /** 当前字幕文本(宿主传入播报内容;缺省时以标题键占位) */
  subtitle?: string
  /** 麦克风四类错误之一(classifyMicError 归一产物);null = 无错误 */
  micError?: MicErrorKind | null
  /** 录音纪要进行中 ← VoiceInputHandle.recording */
  summaryRecording?: boolean
  /** 纪要当前视图(默认讨论纪要) */
  view?: SummaryView
  /** 视图切换回调 */
  onViewChange?: (view: SummaryView) => void
}

export function VoiceSubtitleBar({
  speaking = false,
  muted = false,
  subtitle,
  micError = null,
  summaryRecording = false,
  view = 'discussionSummary',
  onViewChange,
}: VoiceSubtitleBarProps) {
  const t = useTranslations('ai.pane.voiceSubtitles')

  // ① 互斥提示(最高优先):录音纪要与播报不得同时激活 —— 判定在
  //    voiceModeConflict,这里只保证 UI 不呈现双激活假象。
  if (summaryRecording && speaking) {
    return (
      <div
        data-testid="voice-subtitle-bar"
        data-voice-conflict="true"
        data-platform-exempt={PLATFORM_EXCLUSIVE}
        role="alert"
        className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400"
      >
        <MicOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span data-conflict-message>{t(conflictMessageKey())}</span>
      </div>
    )
  }

  // ② 四类麦克风错误
  if (micError && (MIC_ERROR_KINDS as readonly string[]).includes(micError)) {
    const error = micErrorView(micError)
    return (
      <div
        data-testid="voice-subtitle-bar"
        data-mic-error={error.kind}
        data-mic-error-tone={error.tone}
        data-mic-error-retryable={error.recoverableByRetry ? 'true' : 'false'}
        data-platform-exempt={PLATFORM_EXCLUSIVE}
        role="alert"
        aria-label={t(micErrorAriaKey(error.kind))}
        className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
      >
        <MicOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span data-mic-error-message>{t(error.titleKey)}</span>
      </div>
    )
  }

  // ③ 字幕可见性:播报中即显示,静音后仍显示(mutedSubtitles)
  const sub = subtitleView(speaking, muted)

  // ④ 纪要双视图
  const showSummary = summaryRecording

  // 无事可渲染:不播报 + 无错误 + 非录音 → 不留空壳
  if (!sub.visible && !showSummary) return null

  return (
    <div
      data-testid="voice-subtitle-bar"
      data-subtitle-visible={sub.visible ? 'true' : 'false'}
      data-subtitle-state={sub.state}
      data-platform-exempt={PLATFORM_EXCLUSIVE}
      aria-label={t(sub.ariaKey)}
      className="flex flex-col gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
    >
      {showSummary && (
        <div
          data-summary-recording="true"
          role="toolbar"
          aria-label={t('viewAriaLabel')}
          className="flex items-center gap-1"
        >
          {SUMMARY_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              data-view={v}
              aria-pressed={v === view}
              onClick={() => onViewChange?.(toggleSummaryView(view))}
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors',
                v === view
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {v === 'discussionSummary' ? (
                <NotebookText className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ListChecks className="h-3 w-3" aria-hidden="true" />
              )}
              {t(summaryViewLabelKey(v))}
            </button>
          ))}
        </div>
      )}
      {sub.visible && (
        <div
          data-subtitle-line="true"
          data-subtitle-muted={muted ? 'true' : 'false'}
          className="flex items-center gap-1.5"
        >
          {muted ? (
            <VolumeX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          )}
          <span data-subtitle-text={subtitle ?? ''} className="truncate">
            {subtitle ?? t(sub.titleKey)}
          </span>
        </div>
      )}
    </div>
  )
}

export default VoiceSubtitleBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
