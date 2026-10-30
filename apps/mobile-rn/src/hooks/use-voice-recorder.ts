// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useVoiceRecorder — 语音录音 + STT 转写 hook(mobile-rn)
 *
 * 从 VoiceInput 组件提取录音/转写核心逻辑(expo-audio 录音 → ai-service
 * /api/voice/stt 转文字),供 InputArea 内嵌麦克风(HomeScreen 大输入框)复用。
 * VoiceInput 组件本身保持不动(AiAssistantN8nScreen 仍在使用)。
 *
 * 交互契约(对齐 VoiceInput):长按 start → 松开 stop → 转写完成回调 onComplete(text);
 * 失败/无权限/空录音回调 onComplete('')。
 * 2026-10-15:新增 onUnavailable(无权限/录音启动失败的用户可见反馈入口)+ 授权懒补办
 * (web 端挂载期预请求无手势上下文必失败,原先此后长按永远静默)+ 松开竞态守卫。
 * 2026-10-16:新增原始录音模式(transcribe=false):松开不走 STT,经 onRecorded(uri, 秒)
 * 把本地录音文件交给调用方上传发送(语音气泡消息),duration 用 ref 镜像供 stop 读取。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio'
import { voiceSttFromReactNative } from '@ihui/api-client'
import { isCredentialRejected, runWithFreshToken } from '../lib/token'

const RECORD_MAX_SECONDS = 60
// 授权请求兜底超时:内嵌/无麦克风的浏览器里 getUserMedia 系授权可能永远 pending
// (不 resolve 也不 reject),不兜底 = 长按再次陷入静默。4s 与业务探测超时同量级。
const PERMISSION_REQUEST_TIMEOUT_MS = 4_000

export interface UseVoiceRecorderOptions {
  /** 转写完成回调(空串 = 失败/无权限/空录音) */
  onComplete?: (text: string) => void
  /** 录音无法开始的用户可见反馈回调(无权限 / prepare 失败)。
   *  2026-10-15:此前 start() 的两条失败路径都只回调 onComplete(''),界面零反馈,
   *  web 预览长按麦克风表现为「点了没反应」(用户报障)。 */
  onUnavailable?: (reason: 'permission-denied' | 'record-failed') => void
  /**
   * STT 转写失败的用户可见原因(2026-10-26 立)。
   *
   * 立项理由:`onComplete('')` 把"没说话"与"上传被服务端拒了"压成同一个信号,界面上
   * 永远是静默;而续期+只重试一次都失败之后,除了把原因递出去没有任何出路(不许静默成功)。
   * `'credential'` = 续期后重试仍被服务端否定凭据(判据单源见 lib/token 的
   * `isCredentialRejected`,端内不写第二份 401 口径);`'other'` = 其余(网络/5xx/超时)。
   * 不接线时退化为 console.warn,行为与本钩子改造前一致(空串回填),不破坏现有调用方。
   */
  onSttFailed?: (reason: 'credential' | 'other') => void
  /**
   * 原始录音回调(transcribe=false 时生效):松开后把本地录音 uri + 时长(秒)交出,
   * 供调用方上传并发语音气泡消息。转写模式下不触发。
   */
  onRecorded?: (uri: string, durationSec: number) => void
  /**
   * 是否转写为文字(默认 true,原行为)。
   * false = 原始录音模式:跳过 STT,走 onRecorded(录音消息)。
   */
  transcribe?: boolean
  /** ai-service URL(默认 http://localhost:8803,与 VoiceInput 一致) */
  aiServiceUrl?: string
  /** 语言提示(默认 zh) */
  language?: string
}

export function useVoiceRecorder({
  onComplete,
  onUnavailable,
  onSttFailed,
  onRecorded,
  transcribe = true,
  aiServiceUrl = 'http://localhost:8803',
  language = 'zh',
}: UseVoiceRecorderOptions = {}) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingRef = useRef(false)
  // duration 的 ref 镜像:stop() 是 useCallback,不随每秒 tick 重建,
  // 原始录音模式要在 stop 里读「松手这一瞬」的时长,只能走 ref。
  const durationRef = useRef(0)
  const permissionRef = useRef(false)
  // start 异步续体的代次:授权等待/prepare 期间用户松开(stop)会推进代次,
  // 续体据此放弃开始,避免「手指已抬起却凭空进入录音态」。
  const startEpochRef = useRef(0)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY!)

  // 请求麦克风权限 + 配置音频模式
  useEffect(() => {
    void (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync()
        permissionRef.current = status.granted
        if (status.granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true })
        }
      } catch {
        permissionRef.current = false
      }
    })()
  }, [])

  // 卸载时停止录音
  useEffect(
    () => () => {
      if (recordingRef.current) {
        recordingRef.current = false
        void recorder.stop().catch(() => {})
      }
    },
    [recorder],
  )

  const stop = useCallback(async () => {
    // 推进代次:让仍在等待授权/prepare 的 start 续体放弃(用户已松开)
    startEpochRef.current += 1
    if (!recordingRef.current) return
    recordingRef.current = false
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    let uri = ''
    try {
      await recorder.stop()
      uri = recorder.uri ?? ''
    } catch {
      uri = ''
    }

    if (!uri) {
      onComplete?.('')
      return
    }

    // 原始录音模式(2026-10-16):跳过 STT,把录音文件 + 时长交给调用方上传发送
    if (!transcribe) {
      onRecorded?.(uri, durationRef.current)
      return
    }

    // 录音 URI → ai-service STT 转文字(空串 = 失败,调用方自行忽略)
    setTranscribing(true)
    try {
      // 2026-10-26:这一腿原先把 `getToken()` 的快照直接塞进 Bearer 头 —— access token 只有
      // 15 分钟,过期后 ai-service 恒 401,而这次 401 不经过 api-client 的出口,没有任何一层
      // 会替它续期 ⇒ "录了半天每次都白录"且不自愈。改走 lib/token 的新鲜度兜带
      // (上传前到点先续期;被否定则续期后**只重试一次**)。
      const text = await runWithFreshToken((token) =>
        voiceSttFromReactNative(uri, {
          language,
          aiServiceUrl,
          token: token ?? undefined,
        }),
      )
      onComplete?.(text)
    } catch (e) {
      // 失败要可归因:此前"空录音/无权限/上传被拒"在界面上是同一个"没说话"。
      // reason 走 isCredentialRejected(判据单源在 lib/token,端内不再写第二份 401 口径);
      // 未接线时退化为 console.warn —— 两条分支都不清凭据、都不结束会话。
      const reason: 'credential' | 'other' = isCredentialRejected(e) ? 'credential' : 'other'
      console.warn(
        `[rn-voice] useVoiceRecorder STT failed reason=${reason} ` +
          `detail=${e instanceof Error ? e.message : 'unknown error'}`,
      )
      onSttFailed?.(reason)
      onComplete?.('')
    } finally {
      setTranscribing(false)
    }
  }, [onComplete, onRecorded, onSttFailed, recorder, transcribe, language, aiServiceUrl])

  /**
   * 取消录音(2026-10-27 立,D03 语音笔记 RN 腿)。
   *
   * 与 `stop()` 的区别就是本函数存在的理由:stop 是「录完了」——收尾、上传、走 STT、
   * 回调 onComplete;cancel 是「不要了」——只把麦克风释放掉,**不上传、不转写、不回调任何
   * 回调**。语音笔记的 cancel / interrupt 两条事件(共享 12 相机里的 recording --cancel-->
   * cancelled 与 * --interrupt--> interrupted)若复用 stop,就会产生一次「被取消的录音还要
   * 上传转写」的请求,并且转写结果迟到后还会回调到上层 ⇒ 上层必须自己判「这一条是不是
   * 被丢弃的那次」,那等于把状态机的语义搬到端内做二次判定(§0.6 单一真相源不许)。
   * 取消不产生结果 ⇒ 上层不必判,竞态从结构上不存在。
   */
  const cancel = useCallback(async () => {
    // 推进代次:让仍在等待授权/prepare 的 start 续体放弃(与 stop 同一条规矩)
    startEpochRef.current += 1
    if (!recordingRef.current) {
      setRecording(false)
      return
    }
    recordingRef.current = false
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    try {
      await recorder.stop()
    } catch {
      /* 释放失败无所谓:不产生结果,也不回调 */
    }
  }, [recorder])

  const start = useCallback(() => {
    if (recordingRef.current) return
    const epoch = ++startEpochRef.current
    void (async () => {
      // 授权懒补办:挂载期的预请求在 web 端没有用户手势上下文(浏览器要求权限弹窗必须
      // 挂在手势上),一旦失败 permissionRef 恒 false ⇒ 此后长按永远静默无反应(web 预览
      // 实测病灶)。长按本身就是手势,在这里补一次请求;真机已授权时此分支零开销。
      if (!permissionRef.current) {
        try {
          // Promise.race 兜底:授权永不 resolve 的环境(无麦克风设备的内嵌浏览器)按无权限处理,
          // 保证 onUnavailable 反馈必然触达
          const status = await Promise.race([
            AudioModule.requestRecordingPermissionsAsync(),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), PERMISSION_REQUEST_TIMEOUT_MS),
            ),
          ])
          permissionRef.current = status !== null && status.granted
          if (permissionRef.current) {
            try {
              await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true })
            } catch {
              /* 音频模式配置失败不拦录音,prepareToRecordAsync 自己会报 */
            }
          }
        } catch {
          permissionRef.current = false
        }
      }
      // 授权等待期间用户已松开 ⇒ 不要凭空进入录音态
      if (epoch !== startEpochRef.current) return
      if (!permissionRef.current) {
        onUnavailable?.('permission-denied')
        onComplete?.('')
        return
      }
      recordingRef.current = true
      setRecording(true)
      setDuration(0)
      durationRef.current = 0
      timerRef.current = setInterval(() => {
        durationRef.current += 1
        setDuration(durationRef.current)
      }, 1000)
      try {
        await recorder.prepareToRecordAsync()
        if (!recordingRef.current) {
          // 用户在 prepare 期间松开 → 直接停止
          try {
            await recorder.stop()
          } catch {
            /* ignore */
          }
          return
        }
        recorder.record()
      } catch {
        if (recordingRef.current) {
          recordingRef.current = false
          setRecording(false)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          onUnavailable?.('record-failed')
          onComplete?.('')
        }
      }
    })()
  }, [recorder, onComplete, onUnavailable])

  // 达到上限自动结束
  useEffect(() => {
    if (recording && duration >= RECORD_MAX_SECONDS) void stop()
  }, [recording, duration, stop])

  return { recording, transcribing, duration, start, stop, cancel }
}

export default useVoiceRecorder
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
