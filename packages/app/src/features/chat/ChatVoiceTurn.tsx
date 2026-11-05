// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 实时语音回合共享层（块 6，契约见同目录 CONTRACTS.md）。
 *
 * 零平台 API：不申请麦克风权限、不调录音 / 播报 / 音频模块、不做手势识别。
 * 录音、播报、取消、重试、关闭全部经 props 回传；本文件只按 phase 决定
 * 波形、计时、转写区与按钮禁用态的显隐。
 *
 * phase 显隐口径：
 * - listening：显示波形与计时（elapsedMs）；
 * - processing：按住入口禁用并显示"思考中"，转写区保留；
 * - speaking：按住入口禁用，转写区保留；
 * - error：显示 errorMessage 与重试入口；
 * - idle：波浪 / 计时 / 转写区都不出现。
 */
import { useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export type ChatVoicePhase = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export interface ChatVoiceTurnProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  phase: ChatVoicePhase
  /** 录音时长(ms)，仅展示 */
  elapsedMs?: number
  /** 0..1 音量，仅展示 */
  level?: number
  /** 识别文本；不传不渲染 */
  transcript?: string
  errorMessage?: string
  disabled?: boolean

  onPressIn: () => void
  onPressOut: () => void
  onCancel?: () => void
  onRetry?: () => void
  onClose?: () => void
}

/** 毫秒 → m:ss；纯算术，不读平台时间。 */
function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** 波形条系数（固定形状，只随 level 缩放，不做动画）。 */
const WAVE_FACTORS: readonly number[] = [0.35, 0.6, 1, 0.55, 0.85]

function waveHeights(level: number | undefined): number[] {
  const clamped = Math.max(0, Math.min(1, level ?? 0))
  return WAVE_FACTORS.map((factor) => Math.round(4 + factor * clamped * 20))
}

export function ChatVoiceTurn({
  t,
  colorScheme = 'light',
  phase,
  elapsedMs,
  level,
  transcript,
  errorMessage,
  disabled = false,
  onPressIn,
  onPressOut,
  onCancel,
  onRetry,
  onClose,
}: ChatVoiceTurnProps) {
  const tokens = useMemo(() => getTokens(colorScheme), [colorScheme])
  const styles = useMemo(() => createStyles(tokens), [tokens])
  const [pressed, setPressed] = useState(false)

  const busy = phase === 'processing' || phase === 'speaking'
  const showWave = phase === 'listening'
  const showTimer = phase === 'listening' && typeof elapsedMs === 'number'
  const showTranscript = typeof transcript === 'string' && transcript !== '' && phase !== 'idle'
  const statusText =
    phase === 'processing'
      ? t('chat.thinking')
      : phase === 'error'
        ? (errorMessage ?? t('common.error'))
        : phase === 'speaking'
          ? t('chat.voice')
          : null

  return (
    <View style={styles.root}>
      {showWave ? (
        <View style={styles.waveRow}>
          {waveHeights(level).map((height, index) => (
            <View key={index} style={[styles.waveBar, { height }]} />
          ))}
        </View>
      ) : null}

      {showTimer ? <Text style={styles.timer}>{formatElapsed(elapsedMs ?? 0)}</Text> : null}

      {statusText ? <Text style={styles.status}>{statusText}</Text> : null}

      {showTranscript ? (
        <Text style={styles.transcript} numberOfLines={4}>
          {transcript}
        </Text>
      ) : null}

      <Pressable
        onPressIn={() => {
          setPressed(true)
          onPressIn()
        }}
        onPressOut={() => {
          setPressed(false)
          onPressOut()
        }}
        disabled={disabled || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || busy }}
      >
        <View
          style={[
            styles.talkButton,
            pressed && !busy && !disabled ? styles.talkButtonPressed : null,
            disabled || busy ? styles.talkButtonDisabled : null,
          ]}
        >
          <Text style={styles.talkGlyph}>{'◉'}</Text>
          <Text style={styles.talkText}>
            {phase === 'processing' ? t('chat.thinking') : t('voice.holdToTalk')}
          </Text>
        </View>
      </Pressable>

      <View style={styles.actions}>
        {onCancel && phase === 'listening' ? (
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
            onPress={onCancel}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        ) : null}

        {onRetry && phase === 'error' ? (
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
            onPress={onRetry}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        ) : null}

        {onClose ? (
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{t('common.close')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

export interface ChatVoicePanelProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  open: boolean
  /** 仅展示的选项文案，选择回传 key */
  tones?: readonly { key: string; label: string }[]
  activeTone?: string
  onToneChange?: (key: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function ChatVoicePanel({
  t,
  colorScheme = 'light',
  open,
  tones = [],
  activeTone,
  onToneChange,
  onConfirm,
  onClose,
}: ChatVoicePanelProps) {
  const tokens = useMemo(() => getTokens(colorScheme), [colorScheme])
  const styles = useMemo(() => createStyles(tokens), [tokens])

  if (!open) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{t('chat.menuToVoice')}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.closeGlyph}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tones}>
            {tones.map((tone) => {
              const active = tone.key === activeTone
              return (
                <TouchableOpacity
                  key={tone.key}
                  style={[styles.toneButton, active ? styles.toneButtonActive : null]}
                  activeOpacity={0.7}
                  onPress={onToneChange ? () => onToneChange(tone.key) : undefined}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.toneText, active ? styles.toneTextActive : null]}>
                    {tone.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={styles.confirmButton}
            activeOpacity={0.7}
            onPress={onConfirm}
            accessibilityRole="button"
          >
            <Text style={styles.confirmText}>{t('common.confirm')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            activeOpacity={0.7}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function createStyles(tokens: AppThemeTokens) {
  return StyleSheet.create({
    root: {
      gap: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.xl,
      backgroundColor: tokens.surface.card,
    },
    waveRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      height: 28,
    },
    waveBar: {
      width: 4,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.DEFAULT,
    },
    timer: {
      textAlign: 'center',
      fontSize: rnType.bodySm.size,
      color: tokens.text.secondary,
    },
    status: {
      textAlign: 'center',
      fontSize: rnType.bodySm.size,
      color: tokens.text.secondary,
    },
    transcript: {
      fontSize: rnType.body.size,
      color: tokens.text.primary,
    },
    talkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      minHeight: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.muted,
    },
    talkButtonPressed: {
      backgroundColor: tokens.surface.dark,
    },
    talkButtonDisabled: {
      opacity: 0.6,
    },
    talkGlyph: {
      fontSize: rnType.body.size,
      color: tokens.text.primary,
    },
    talkText: {
      fontSize: rnType.body.size,
      color: tokens.text.primary,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: rnSpacing.sm,
    },
    actionButton: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    actionText: {
      fontSize: rnType.bodySm.size,
      color: tokens.text.secondary,
    },
    overlay: {
      flex: 1,
      backgroundColor: tokens.overlay.modal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panel: {
      width: '88%',
      maxHeight: '70%',
      padding: rnSpacing.lg,
      borderRadius: rnRadius.xl,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.md,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    panelTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    closeButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeGlyph: {
      fontSize: rnType.title.size,
      color: tokens.text.tertiary,
    },
    tones: {
      gap: rnSpacing.sm,
    },
    toneButton: {
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.muted,
    },
    toneButtonActive: {
      backgroundColor: tokens.brand.cta,
    },
    toneText: {
      fontSize: rnType.body.size,
      color: tokens.text.primary,
    },
    toneTextActive: {
      color: tokens.brand.ctaForeground,
    },
    confirmButton: {
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.brand.cta,
    },
    confirmText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: rnSpacing.sm,
    },
  })
}
