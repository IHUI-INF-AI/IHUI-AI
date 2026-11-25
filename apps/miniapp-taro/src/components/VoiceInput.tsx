// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { useState, useRef, useEffect, useCallback } from 'react'
import { TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  VOICE_INPUT_BTN_MIN_HEIGHT_PX,
  VOICE_INPUT_RECORD_ROW_GAP_PX,
} from '@ihui/shared/ui/voice-input-spec'
import streamingRecognizer from '@/utils/streaming-recognizer'
import type { VoiceInputMinimalProps } from '@ihui/types'
import { rpx } from '@/utils/rpx'

/**
 * 逻辑 px → 本端 rpx。
 * ⚠️ 必须走这个具名换算器,不能内联写 `rpx(N * TARO_RPX_PER_PX)`:门 128 的 readGeometry
 * 只认已知换算器名(`toUnit`/`toRpx`)与 `rpx(数字字面量)` 两型,内联乘法形态**整族隐身**
 * (实测:写完小程序侧这四档一个都读不到,账面凭空多一条"仅 RN 16")。
 */
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)

// 共享类型 VoiceInputMinimalProps 已下沉到 @ihui/types。
// 识别器配置两键与 RN 端同名(aiServiceUrl/language),真实透传给 streamingRecognizer.configure。
export type VoiceInputProps = VoiceInputMinimalProps & {
  /** ai-service 基础 URL;缺省沿用识别器内置档,传了才覆盖 */
  aiServiceUrl?: string
  /** 识别语言;缺省 zh,传了才覆盖 */
  language?: string
}

const WAVE_BARS = [0, 1, 2, 3, 4, 5, 6]

export default function VoiceInput({
  disabled = false,
  placeholder,
  aiServiceUrl,
  language,
  onChange,
  onComplete,
  onError,
}: VoiceInputProps) {
  const tt = useTt()
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [partial, setPartial] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 使用 ref 避免回调变更导致重复注册
  const cbRef = useRef({ onChange, onComplete, onError })
  cbRef.current = { onChange, onComplete, onError }

  useEffect(() => {
    streamingRecognizer.configure({ aiServiceUrl, language })
  }, [aiServiceUrl, language])

  useEffect(() => {
    streamingRecognizer.on('partial', (text) => {
      setPartial(text)
      cbRef.current.onChange?.(text)
    })
    streamingRecognizer.on('final', (text) => {
      setPartial('')
      cbRef.current.onComplete?.(text)
    })
    streamingRecognizer.on('error', (msg) => {
      cbRef.current.onError?.(msg)
    })
    return () => {
      streamingRecognizer.cancel()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecord = useCallback(async () => {
    if (disabled || recording) return
    try {
      setPartial('')
      setElapsed(0)
      await streamingRecognizer.startRecognizing()
      setRecording(true)
      timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000)
    } catch (err) {
      cbRef.current.onError?.(
        String((err as Error)?.message || tt('VoiceInput.p1', '录音启动失败')),
      )
    }
  }, [disabled, recording, tt])

  const stopRecord = useCallback(async () => {
    if (!recording) return
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // 完成回调单通道:final 事件唯一出口,stopRecognizing 只等待不回调
    await streamingRecognizer.stopRecognizing()
  }, [recording])

  const cancelRecord = useCallback(() => {
    if (!recording) return
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamingRecognizer.cancel()
    setPartial('')
  }, [recording])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <View className="w-full">
      <View
        className={`flex items-center justify-center rounded-md px-4 py-3 ${
          recording ? 'bg-[var(--color-danger-tint)]' : 'bg-muted'
        } ${disabled ? 'opacity-50' : ''}`}
        style={{
          // 只统一最小高(原盒高 48 → 两端同挂 40)。
          // 横向 16 与纵向 12 仍留在本端类名里:它们是"同元素两端不同值"(RN `rnSpacing.md`=12 /
          // `rnSpacing.sm`=8),本轮**没有**硬统一 —— 值集合口径下强行取同值会拆掉另一端某个值的
          // 唯一来源(12 / 16 各自是某端唯一出处),当场变出一条新的"仅一端档"假分叉。
          // 待几何比对从"值集合"升级到"元素×键→值"之后再收口,详见 voice-input-spec 头注。
          minHeight: toUnit(VOICE_INPUT_BTN_MIN_HEIGHT_PX),
        }}
        onTouchStart={startRecord}
        onTouchEnd={stopRecord}
        onTouchCancel={cancelRecord}
      >
        {recording ? (
          <View className="flex flex-row items-center">
            {/* 录音行内间距取共享源(与 RN recordingText.marginLeft 同档),
                原 mr-2 类携带同一数字即是第二份真相 */}
            <View
              className="flex flex-row items-center h-5"
              style={{ marginRight: toUnit(VOICE_INPUT_RECORD_ROW_GAP_PX) }}
            >
              {WAVE_BARS.map((i) => (
                <View
                  key={i}
                  className="w-1 bg-danger rounded-xs animate-pulse"
                  style={{
                    height: '60%',
                    marginLeft: '2px',
                    marginRight: '2px',
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              ))}
            </View>
            <Text
              className="text-sm text-[var(--color-danger)]"
              style={{ marginRight: toUnit(VOICE_INPUT_RECORD_ROW_GAP_PX) }}
            >
              {mm}:{ss}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {tt('ai.voice.releaseToSend', '松开发送')}
            </Text>
          </View>
        ) : (
          <Text className="text-sm text-foreground">
            {partial || placeholder || tt('ai.voice.holdToSpeak', '按住说话')}
          </Text>
        )}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
