// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { useCountdown } from '@ihui/shared/hooks'
import { useI18n } from '../i18n'
import {
  VERIFY_CODE_BOX_FONT_PX,
  VERIFY_CODE_BOX_GAP_PX,
  VERIFY_CODE_BOX_HEIGHT_PX,
  VERIFY_CODE_BOX_WIDTH_PX,
  VERIFY_CODE_BUTTON_FONT_PX,
  VERIFY_CODE_BUTTON_HEIGHT_PX,
  VERIFY_CODE_CARD_MARGIN_X_PX,
  VERIFY_CODE_CARD_MAX_WIDTH_PX,
  VERIFY_CODE_CARD_PADDING_PX,
  VERIFY_CODE_CLOSE_BOX_PX,
  VERIFY_CODE_CLOSE_ICON_FONT_PX,
  VERIFY_CODE_COUNTDOWN_FONT_PX,
  VERIFY_CODE_COUNTDOWN_SECONDS,
  VERIFY_CODE_DESC_FONT_PX,
  VERIFY_CODE_HIDDEN_INPUT_PX,
  VERIFY_CODE_LENGTH,
  VERIFY_CODE_PHONE_FONT_PX,
  VERIFY_CODE_TITLE_FONT_PX,
} from '@ihui/shared/ui/verify-code-modal-spec'
import { rnRadiusFor, rnSpacing } from '@ihui/design-tokens'

/**
 * 验证码模态框(mobile-rn 端,受控纯 UI —— 与小程序端共用 @ihui/shared/ui/verify-code-modal-spec 单一源)
 *
 * 对齐历史项目(Taro 版)verify-code-modal:
 * - 6 位数字输入 + 60s 倒计时
 * - 透明 backdrop + 半透明黑色遮罩
 * - 浅色优雅风,无霓虹/无渐变,系统字体
 * - 复用 theme/active-tokens 的主题 token
 *
 * 实现要点:
 * - 单隐藏 TextInput 接收键盘输入(避免 6 个独立输入框切换焦点,Android 兼容性更好)
 * - 6 个视觉格子实时显示已输入数字,聚焦态/已填态分别走不同边框+背景
 * - 满 length 位时启用确认按钮(brand 背景,未启用 opacity 0.6)
 * - 倒计时:打开时不自动启动(count=0,短信可能已由调用方发出);
 *   点击「重新发送」且 onResend 成功后才 reset+start(对齐原版 sendTextMsg 成功后 codeMin=60)
 * - visible 关闭时重置 code/倒计时(共享 useCountdown 的 reset 出口,§3 端内不再自建 setInterval)
 * - 计时器在 unmount 与 visible=false 时清理(useCountdown 内部承担)
 * - 类型零 any,精确类型标注
 */
import { tokens } from '../theme/active-tokens'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native'

export interface VerifyCodeModalProps {
  visible: boolean
  phone: string
  length?: number
  countdown?: number
  onClose: () => void
  onSubmit: (code: string) => void
  /** 重新发送验证码回调;返回 Promise 时 await 成功后才启动倒计时(对齐原版 sendTextMsg 成功后 codeMin=60) */
  onResend: () => void | Promise<void>
}

export function VerifyCodeModal({
  visible,
  phone,
  length = VERIFY_CODE_LENGTH,
  countdown = VERIFY_CODE_COUNTDOWN_SECONDS,
  onClose,
  onSubmit,
  onResend,
}: VerifyCodeModalProps) {
  const [code, setCode] = useState<string[]>(() => Array<string>(length).fill(''))
  // 共享 useCountdown:@ihui/shared/hooks 单一实现(§3 端内禁止重复造 setInterval;小程序端同源)
  const { count: remaining, start, reset: resetCountdown } = useCountdown(0)
  const { t } = useI18n()
  const hiddenInputRef = useRef<TextInput>(null)

  // visible 关闭时重置 code + 倒计时(reset(0) 同步清理计时器)
  useEffect(() => {
    if (!visible) {
      setCode(Array<string>(length).fill(''))
      resetCountdown(0)
    }
  }, [visible, length, resetCountdown])

  // 弹起时自动 focus 隐藏输入
  useEffect(() => {
    if (!visible) return
    const focusTimer = setTimeout(() => {
      hiddenInputRef.current?.focus()
    }, 120)
    return () => clearTimeout(focusTimer)
  }, [visible])

  const fullCode = code.join('')
  const isComplete = fullCode.length === length
  const filledCount = code.reduce<number>((acc, c) => (c !== '' ? acc + 1 : acc), 0)
  const focusIndex = Math.min(filledCount, length - 1)

  const handleChangeText = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, length).split('')
      const next: string[] = Array<string>(length).fill('')
      digits.forEach((d, i) => {
        next[i] = d
      })
      setCode(next)
    },
    [length],
  )

  const handleConfirm = useCallback(() => {
    if (!isComplete) return
    onSubmit(fullCode)
  }, [isComplete, fullCode, onSubmit])

  const handleResend = useCallback(async () => {
    if (remaining > 0) return
    // 对齐原版:sendTextMsg 发送成功后才启动倒计时,避免"倒计时在走但短信未发"
    await onResend()
    resetCountdown(countdown)
    start()
  }, [remaining, onResend, countdown, resetCountdown, start])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.center}>
          <View style={styles.card}>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={t('verify.closeA11y')}
            >
              <Text style={styles.closeIcon}>×</Text>
            </Pressable>

            <Text style={styles.title}>{t('verify.getCode')}</Text>
            <Text style={styles.description}>{t('verify.desc')}</Text>
            <Text style={styles.phone}>{phone}</Text>

            <View style={styles.boxRowContainer}>
              {code.map((digit, idx) => {
                const isFilled = digit !== ''
                const isFocused = idx === focusIndex
                return (
                  <View
                    key={idx}
                    style={[
                      styles.box,
                      isFocused && styles.boxFocused,
                      isFilled && styles.boxFilled,
                    ]}
                  >
                    <Text style={styles.boxText}>{digit}</Text>
                  </View>
                )
              })}
              {/* G-978007:此 TextInput 是隐藏的键盘接收器(1×1、opacity 0,见头注),
                  永不产生可见描边,聚焦视觉由上方 6 个格子的 isFocused 档承担
                  (boxFocused 已对齐墨档);故不改套共享 TextField —— 套了也没有
                  任何像素可见,反而给注册表添一个假输入框。 */}
              <TextInput
                ref={hiddenInputRef}
                value={fullCode}
                onChangeText={handleChangeText}
                keyboardType="number-pad"
                maxLength={length}
                caretHidden
                contextMenuHidden
                style={styles.hiddenInput}
                accessibilityLabel={t('verify.inputA11y')}
              />
            </View>

            <Pressable onPress={handleResend} disabled={remaining > 0}>
              <Text
                style={[
                  styles.countdown,
                  remaining > 0 ? styles.countdownActive : styles.countdownResend,
                ]}
              >
                {remaining > 0 ? t('auth.resendCode', { seconds: remaining }) : t('verify.resend')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={!isComplete}
              accessibilityRole="button"
              style={[styles.confirm, !isComplete && styles.confirmDisabled]}
            >
              <Text style={styles.confirmText}>{t('verify.confirm')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default VerifyCodeModal

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VERIFY_CODE_CARD_MARGIN_X_PX,
  },
  card: {
    width: '100%',
    maxWidth: VERIFY_CODE_CARD_MAX_WIDTH_PX,
    backgroundColor: tokens.surface.card,
    // 角色档 panel(弹窗体)→ xl(12),与小程序端 VerifyCodeModal 的 ui-panel rounded-xl 同档
    borderRadius: rnRadiusFor.panel,
    padding: VERIFY_CODE_CARD_PADDING_PX,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: VERIFY_CODE_CLOSE_BOX_PX,
    height: VERIFY_CODE_CLOSE_BOX_PX,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeIcon: {
    fontSize: VERIFY_CODE_CLOSE_ICON_FONT_PX,
    lineHeight: VERIFY_CODE_CLOSE_ICON_FONT_PX + 4,
    color: tokens.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  title: {
    fontSize: VERIFY_CODE_TITLE_FONT_PX,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    marginTop: rnSpacing.sm,
  },
  description: {
    fontSize: VERIFY_CODE_DESC_FONT_PX,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginTop: rnSpacing.sm,
  },
  phone: {
    fontSize: VERIFY_CODE_PHONE_FONT_PX,
    color: tokens.text.primary,
    textAlign: 'center',
    marginTop: rnSpacing.xs,
    marginBottom: rnSpacing.xl,
  },
  boxRowContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: VERIFY_CODE_BOX_GAP_PX,
    marginBottom: rnSpacing.lg,
  },
  box: {
    width: VERIFY_CODE_BOX_WIDTH_PX,
    height: VERIFY_CODE_BOX_HEIGHT_PX,
    // 角色档 control(验证码输入格 = 输入框)→ sm(4),与小程序端同位格子的 rounded-sm 同档;
    // 此前写 lg(8) 是"卡片档套在控件上"
    borderRadius: rnRadiusFor.control,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: {
    // G-978007:聚焦档取墨档(tokens.brand.DEFAULT = 亮纯黑/暗纯白,与共享 TextField
    // 的 focusedStyle 通道同一出处 @ihui/design-tokens brand.DEFAULT);
    // 此前取 brandAccent.deep 是灰蓝强调档,不是聚焦墨档。
    // 只换色不改宽:描边变粗会压缩固定尺寸格子的内容区(同型位移 2026-10-20 在登录框真机实测)
    borderColor: tokens.brand.DEFAULT,
  },
  boxFilled: {
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.muted,
  },
  boxText: {
    fontSize: VERIFY_CODE_BOX_FONT_PX,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    lineHeight: VERIFY_CODE_BOX_FONT_PX + 8,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: VERIFY_CODE_HIDDEN_INPUT_PX,
    height: VERIFY_CODE_HIDDEN_INPUT_PX,
    opacity: 0,
  } as ViewStyle,
  countdown: {
    fontSize: VERIFY_CODE_COUNTDOWN_FONT_PX,
    textAlign: 'center',
  },
  countdownActive: {
    color: tokens.text.secondary,
  },
  countdownResend: {
    color: tokens.brand.DEFAULT,
  },
  confirm: {
    height: VERIFY_CODE_BUTTON_HEIGHT_PX,
    // 角色档 control(按钮)→ sm(4),与 web @ihui/ui-react Button 基座同档
    borderRadius: rnRadiusFor.control,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: rnSpacing.lg,
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: tokens.brand.ctaForeground,
    fontSize: VERIFY_CODE_BUTTON_FONT_PX,
    textAlign: 'center',
    fontWeight: '500',
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
