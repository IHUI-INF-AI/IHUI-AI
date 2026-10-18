// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// 纯抽取:从 ChatScreen 抽出「转语音(TTS)」弹窗(D126)。零行为/视觉变更。

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { tokens } from '../../theme/active-tokens'
import { rnRadius } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'

/** TTS 语音类型选项(P1.1 转语音 Modal,真实 TTS 已接入) */
const TTS_VOICE_OPTIONS: readonly string[] = ['男声', '女声', '儿童'] as const

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
    fontSize: 15,
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
    fontSize: 14,
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
    fontSize: 15,
    color: tokens.text.primary,
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
    fontSize: 16,
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
}

/**
 * 转语音(TTS)弹窗:语音类型选项 + 真实 TTS loading。
 * 关闭行为与原 ChatScreen 一致:loading 中仅取消按钮可关闭(其余关闭入口被 loading 守卫拦截)。
 */
export function VoicePanel({ visible, loading, onSelect, onClose }: VoicePanelProps) {
  if (!visible) return null
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
              accessibilityLabel="取消"
            >
              <Text style={styles.panelCancelText}>取消</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
