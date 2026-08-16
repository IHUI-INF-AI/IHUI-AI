/**
 * 验证码模态框(mobile-rn 端)
 *
 * 对齐历史项目(Taro 版)verify-code-modal:
 * - 6 位数字输入 + 60s 倒计时
 * - 透明 backdrop + 半透明黑色遮罩
 * - 浅色优雅风,无霓虹/无渐变,系统字体
 * - 复用 @ihui/design-tokens 的 rnLightTokens
 *
 * 实现要点:
 * - 单隐藏 TextInput 接收键盘输入(避免 6 个独立输入框切换焦点,Android 兼容性更好)
 * - 6 个视觉格子实时显示已输入数字,聚焦态/已填态分别走不同边框+背景
 * - 满 length 位时启用确认按钮(brand 背景,未启用 opacity 0.6)
 * - 倒计时归零前显示秒数,归零后可点击重发
 * - visible 关闭时重置 code/倒计时
 * - 计时器在 unmount 与 visible=false 时清理
 * - 类型零 any,精确类型标注
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native'

export interface VerifyCodeModalProps {
  visible: boolean
  phone: string
  length?: number
  countdown?: number
  onClose: () => void
  onSubmit: (code: string) => void
  onResend: () => void
}

const DEFAULT_LENGTH = 6
const DEFAULT_COUNTDOWN_SECONDS = 60
const CARD_MAX_WIDTH = 360
const CARD_BORDER_RADIUS = 12
const CARD_PADDING = 24
const CLOSE_BUTTON_SIZE = 24
const CLOSE_ICON_SIZE = 16
const BOX_SIZE = 48
const BOX_GAP = 8
const BOX_BORDER_RADIUS = 8
const CONFIRM_BUTTON_HEIGHT = 40
const CONFIRM_BUTTON_RADIUS = 8
const HIDDEN_INPUT_SIZE = 1

export function VerifyCodeModal({
  visible,
  phone,
  length = DEFAULT_LENGTH,
  countdown = DEFAULT_COUNTDOWN_SECONDS,
  onClose,
  onSubmit,
  onResend,
}: VerifyCodeModalProps) {
  const [code, setCode] = useState<string[]>(() => Array<string>(length).fill(''))
  const [remaining, setRemaining] = useState<number>(countdown)
  const hiddenInputRef = useRef<TextInput>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(
    (seconds: number) => {
      stopTimer()
      setRemaining(seconds)
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            stopTimer()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    [stopTimer],
  )

  // visible 关闭时重置 code + 倒计时 + 计时器
  useEffect(() => {
    if (!visible) {
      setCode(Array<string>(length).fill(''))
      stopTimer()
      setRemaining(countdown)
    }
  }, [visible, length, countdown, stopTimer])

  // visible 开启时启动倒计时
  useEffect(() => {
    if (!visible) return
    startTimer(countdown)
    return () => {
      stopTimer()
    }
  }, [visible, countdown, startTimer, stopTimer])

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

  const handleResend = useCallback(() => {
    if (remaining > 0) return
    onResend()
    startTimer(countdown)
  }, [remaining, onResend, countdown, startTimer])

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
              accessibilityLabel="关闭验证码弹窗"
            >
              <Text style={styles.closeIcon}>×</Text>
            </Pressable>

            <Text style={styles.title}>请输入验证码</Text>
            <Text style={styles.description}>验证码已发送至</Text>
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
              <TextInput
                ref={hiddenInputRef}
                value={fullCode}
                onChangeText={handleChangeText}
                keyboardType="number-pad"
                maxLength={length}
                caretHidden
                contextMenuHidden
                style={styles.hiddenInput}
                accessibilityLabel="验证码输入"
              />
            </View>

            <Pressable onPress={handleResend} disabled={remaining > 0}>
              <Text
                style={[
                  styles.countdown,
                  remaining > 0 ? styles.countdownActive : styles.countdownResend,
                ]}
              >
                {remaining > 0 ? `${remaining}s 后重发` : '重新发送'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={!isComplete}
              accessibilityRole="button"
              style={[styles.confirm, !isComplete && styles.confirmDisabled]}
            >
              <Text style={styles.confirmText}>确定</Text>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    backgroundColor: tokens.surface.card,
    borderRadius: CARD_BORDER_RADIUS,
    padding: CARD_PADDING,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeIcon: {
    fontSize: CLOSE_ICON_SIZE,
    lineHeight: CLOSE_ICON_SIZE + 4,
    color: tokens.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    marginTop: 8,
  },
  description: {
    fontSize: 12,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  phone: {
    fontSize: 14,
    color: tokens.text.primary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  boxRowContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BOX_GAP,
    marginBottom: 16,
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: BOX_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: {
    borderColor: tokens.brand.DEFAULT,
  },
  boxFilled: {
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.muted,
  },
  boxText: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    lineHeight: 24,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: HIDDEN_INPUT_SIZE,
    height: HIDDEN_INPUT_SIZE,
    opacity: 0,
  } as ViewStyle,
  countdown: {
    fontSize: 12,
    textAlign: 'center',
  },
  countdownActive: {
    color: tokens.text.secondary,
  },
  countdownResend: {
    color: tokens.brand.DEFAULT,
  },
  confirm: {
    height: CONFIRM_BUTTON_HEIGHT,
    borderRadius: CONFIRM_BUTTON_RADIUS,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: tokens.surface.light,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
})
