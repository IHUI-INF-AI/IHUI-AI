import { useI18n } from '../../i18n'
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 纯抽取:从 ChatScreen 抽出「转语音(TTS)」弹窗(D126)。零行为/视觉变更。

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Loader2, Mic, X } from 'lucide-react-native'
import { tokens } from '../../theme/active-tokens'
import { rnGeometry, rnRadius } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'

/** TTS 语音类型选项(P1.1 转语音 Modal,真实 TTS 已接入) */
const TTS_VOICE_OPTIONS: readonly string[] = ['男声', '女声', '儿童'] as const

/**
 * 实时语音对话状态(FF/D126)。
 *
 * 取证结论:RN 端目前**没有**原生 WebRTC SDK(apps/mobile-rn/package.json 仅 expo-audio),
 * `@ihui/api-client` 也无 realtime/webrtc 封装,故本组件只做**契约 + 三态 UI**,
 * 真实连接由调用方(ChatScreen)拿到原生能力后接线,此处不臆造依赖。
 */
type RealtimeVoiceState = 'idle' | 'connecting' | 'live' | 'error'

/** 实时语音按钮文案(硬编码中文,与 TTS 口径一致;不新增 i18n key) */
const REALTIME_BTN_LABEL: Record<RealtimeVoiceState, string> = {
  idle: 'voice.realStart',
  connecting: 'voice.realConnecting',
  live: 'voice.realLive',
  error: 'voice.reconnect',
}

/** 实时语音失败兜底文案(realtimeErrorText 缺省值) */
const DEFAULT_REALTIME_ERROR_TEXT = 'voice.realFailDefault'

const styles = StyleSheet.create({
  // ── 二维码弹窗 / 列表弹窗共用容器 ──
  modalMask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDialogContent: {
    width: '88%',
    maxHeight: '70%',
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.xl,
    overflow: 'hidden',
  },
  listDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(20),
    backgroundColor: tokens.surface.card,
  },
  listDialogTitle: {
    fontSize: rnGeometry.textStrong,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  listDialogClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── P1.1 转语音 Modal ──
  ttsLoadingWrap: {
    paddingVertical: rpx(64),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttsLoadingText: {
    fontSize: rnGeometry.textBody,
    color: tokens.text.secondary,
  },
  ttsOptions: {
    paddingVertical: rpx(16),
    gap: rpx(8),
  },
  // 守门 131 改型:ttsOptionBtn 的 marginHorizontal 搬到外层槽位档,可视盒原样留内层。
  ttsOptionBtnSlot: {
    marginHorizontal: rpx(32),
  },
  ttsOptionBtn: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(28),
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.sm,
    alignItems: 'center',
  },
  ttsOptionText: {
    fontSize: rnGeometry.textStrong,
    color: tokens.text.primary,
  },
  // ── FF(D126)实时语音对话区 ──
  realtimeSection: {
    paddingHorizontal: rpx(32),
    paddingTop: rpx(12),
    paddingBottom: rpx(12),
  },
  realtimeTitle: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  realtimeErrorText: {
    marginTop: rpx(6),
    fontSize: 13,
    color: tokens.error.text,
  },
  realtimeBtn: {
    marginTop: rpx(10),
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(24),
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rpx(8),
  },
  realtimeBtnDisabled: {
    opacity: 0.6,
  },
  realtimeBtnText: {
    fontSize: rnGeometry.textStrong,
    color: tokens.text.primary,
  },
  // ── D126 语音回合「按住说话」──
  talkBtn: {
    marginTop: rpx(16),
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(32),
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rpx(8),
  },
  turnNoteText: {
    marginTop: rpx(8),
    fontSize: 13,
    color: tokens.text.secondary,
  },
  // ── 功能面板/来源面板(BottomPops 子内容样式) ──
  panelCancelBtn: {
    marginHorizontal: rpx(32),
    marginTop: rpx(16),
    height: 48,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelItemPressed: {
    opacity: 0.85,
  },
  ttsCancelBtn: {
    marginTop: rpx(24),
    marginBottom: rpx(32),
  },
  panelCancelText: {
    fontSize: rnGeometry.textBody,
    fontWeight: '500',
    color: tokens.text.primary,
  },
})

interface VoicePanelProps {
  /** 弹窗可见性(对齐 ChatScreen ttsVisible) */
  visible: boolean
  /** TTS 转换中(对齐 ChatScreen ttsLoading;转换中禁止关闭) */
  loading: boolean
  /** 选中语音类型回调(对齐 handleTtsSelect) */
  onSelect: (voiceType: string) => void
  /** 关闭弹窗(对齐 setTtsVisible(false);内部按 loading 守卫) */
  onClose: () => void
  /**
   * FF(D126)发起实时语音对话(可选)。未传时按钮点击为空操作。
   * 返回值可为 Promise —— 连接状态由调用方通过 realtimeState 回传。
   */
  onStartRealtimeVoice?: () => void | Promise<void>
  /** FF(D126)实时语音连接状态(缺省 'idle') */
  realtimeState?: RealtimeVoiceState
  /** FF(D126)实时语音失败文案(缺省「连接失败,请重试」) */
  realtimeErrorText?: string
  /**
   * D126 语音回合「按住说话」按压回调(可选)。
   * 按下 onPressIn→true、松开 onPressOut→false;录音由上层 use-voice-recorder
   * 体系管理,面板只发按压事件,不在面板内做录音。
   */
  onTalkPress?: (pressed: boolean) => void
  /** D126 语音回合处理中(true 时「按住说话」禁用并显示「思考中…」) */
  turnBusy?: boolean
  /** D126 服务端备注(turn 结果 note,非空显示一行灰字) */
  turnNote?: string
}

/**
 * 转语音(TTS)弹窗:语音类型选项 + 真实 TTS loading。
 * 关闭行为与原 ChatScreen 一致:loading 中仅取消按钮可关闭(其余关闭入口被 loading 守卫拦截)。
 */
export function VoicePanel({
  visible,
  loading,
  onSelect,
  onClose,
  onStartRealtimeVoice,
  realtimeState = 'idle',
  realtimeErrorText = DEFAULT_REALTIME_ERROR_TEXT,
  onTalkPress,
  turnBusy = false,
  turnNote,
}: VoicePanelProps) {
  const { t } = useI18n()
  const errText = realtimeErrorText ?? t(DEFAULT_REALTIME_ERROR_TEXT)
  if (!visible) return null
  // connecting/live 期间禁止重复发起;error 态允许再点重试
  const realtimeBusy = realtimeState === 'connecting' || realtimeState === 'live'
  const realtimeLabel = t(REALTIME_BTN_LABEL[realtimeState])
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) onClose()
      }}
    >
      <Pressable
        style={styles.modalMask}
        onPress={() => {
          if (!loading) onClose()
        }}
      >
        <Pressable style={styles.listDialogContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.listDialogHeader}>
            <Text style={styles.listDialogTitle}>转语音</Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                if (!loading) onClose()
              }}
              style={styles.listDialogClose}
            >
              <X size={20} color={tokens.text.primary} />
            </Pressable>
          </View>
          {/* FF(D126)实时语音对话区:三态 UI 与回调契约(真实连接由调用方接线) */}
          <View style={styles.realtimeSection}>
            <Text style={styles.realtimeTitle}>实时语音对话</Text>
            {realtimeState === 'error' ? (
              <Text style={styles.realtimeErrorText}>{errText}</Text>
            ) : null}
            <Pressable
              onPress={() => {
                void onStartRealtimeVoice?.()
              }}
              disabled={realtimeBusy}
              accessibilityRole="button"
              accessibilityLabel={realtimeLabel}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.realtimeBtn,
                    pressed && styles.panelItemPressed,
                    realtimeBusy ? styles.realtimeBtnDisabled : undefined,
                  ]}
                >
                  {realtimeState === 'connecting' ? (
                    <Loader2 size={18} color={tokens.text.secondary} />
                  ) : (
                    <Mic size={18} color={tokens.text.primary} />
                  )}
                  <Text style={styles.realtimeBtnText}>{realtimeLabel}</Text>
                </View>
              )}
            </Pressable>
            {/* D126 语音回合:live 态下在三态区下渲染「按住说话」按压入口。
                只发按压事件(onPressIn/onPressOut),录音/回合调用都由上层接线。 */}
            {realtimeState === 'live' ? (
              <>
                <Pressable
                  onPressIn={() => onTalkPress?.(true)}
                  onPressOut={() => onTalkPress?.(false)}
                  disabled={turnBusy}
                  accessibilityRole="button"
                  accessibilityLabel={turnBusy ? t('chat.thinkingShort') : t('voice.holdToTalk')}
                >
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.talkBtn,
                        pressed && !turnBusy ? styles.panelItemPressed : undefined,
                        turnBusy ? styles.realtimeBtnDisabled : undefined,
                      ]}
                    >
                      {turnBusy ? (
                        <Loader2 size={18} color={tokens.text.secondary} />
                      ) : (
                        <Mic size={18} color={tokens.text.primary} />
                      )}
                      <Text style={styles.realtimeBtnText}>
                        {turnBusy ? t('chat.thinking') : t('voice.holdToTalk')}
                      </Text>
                    </View>
                  )}
                </Pressable>
                {typeof turnNote === 'string' && turnNote.trim() !== '' ? (
                  <Text style={styles.turnNoteText}>{turnNote}</Text>
                ) : null}
              </>
            ) : null}
          </View>
          {loading ? (
            <View style={styles.ttsLoadingWrap}>
              <Text style={styles.ttsLoadingText}>TTS 转换中...</Text>
            </View>
          ) : (
            <View style={styles.ttsOptions}>
              {TTS_VOICE_OPTIONS.map((opt) => (
                // 守门 131 改型:marginHorizontal 槽位留外层,可视盒(ttsOptionBtn)+pressed
                // 淡出落内层数组形态(ttsOptionBtn 的边距已搬到 slot 档,数值原样)。
                <Pressable
                  key={opt}
                  onPress={() => onSelect(opt)}
                  style={styles.ttsOptionBtnSlot}
                  accessibilityRole="button"
                  accessibilityLabel={opt}
                >
                  {({ pressed }) => (
                    <View style={[styles.ttsOptionBtn, pressed && styles.panelItemPressed]}>
                      <Text style={styles.ttsOptionText}>{opt}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
          {!loading ? (
            <Pressable
              onPress={onClose}
              style={[styles.panelCancelBtn, styles.ttsCancelBtn]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.panelCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
