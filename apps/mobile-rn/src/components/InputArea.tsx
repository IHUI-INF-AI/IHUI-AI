/**
 * InputArea 多行输入区(mobile-rn)— 聊天 / 反馈 / 评论场景通用输入区
 *
 * 设计要点:
 * - 容器:浅色 surface.card 底 + 顶部 1px border,flex row,底部对齐
 * - 多行 TextInput:maxHeight 100,自动撑高,1px 边框 + 圆角 8
 * - 发送按钮:40×40,品牌色底,圆角 12(rounded-xl 风格,非纯圆形;遵循 AGENTS.md §4 圆角守门)
 * - 字数统计:输入框内右下角浮层,超过 90% 警告色
 *
 * 2026-07-30:对齐历史项目 InputArea(微信小程序 miniapp-taro 版本),
 * 适配 mobile-rn StyleSheet 写法,样式 token 全部走 @ihui/design-tokens(rnLightTokens)。
 */
import { useCallback } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface InputAreaProps {
  /** 受控输入值 */
  value: string
  /** 输入变化回调(父组件维护 value 状态) */
  onChangeText: (text: string) => void
  /** 占位提示 */
  placeholder?: string
  /** 字符上限,默认 500 */
  maxLength?: number
  /** 点击发送按钮(且文本非空)时回调,已 trim */
  onSubmit: (text: string) => void
  /** 禁用输入(同时禁用发送按钮,变 muted 色) */
  disabled?: boolean
  /** 发送中:按钮显示 ActivityIndicator 替代 ➤ 图标 */
  loading?: boolean
  /** 停止回调:提供后,loading 时发送按钮切换为停止按钮(danger 色)。用于流式对话中断 */
  onStop?: () => void
  /** 停止按钮文字,缺省"停止" */
  stopLabel?: string
}

const DEFAULT_MAX_LENGTH = 500
const WARNING_RATIO = 0.9

export function InputArea({
  value,
  onChangeText,
  placeholder,
  maxLength = DEFAULT_MAX_LENGTH,
  onSubmit,
  disabled = false,
  loading = false,
  onStop,
  stopLabel,
}: InputAreaProps) {
  const isSendBlocked = disabled || loading
  const canSend = value.trim().length > 0 && !isSendBlocked
  const isOverWarning = value.length >= Math.floor(maxLength * WARNING_RATIO)

  const handleSubmit = useCallback((): void => {
    if (!canSend) return
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }, [canSend, onSubmit, value])

  return (
    <View style={styles.container}>
      <View style={styles.inputColumn}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.text.tertiary}
          maxLength={maxLength}
          multiline
          textAlignVertical="top"
          editable={!disabled}
        />
        <Text
          style={[
            styles.counter,
            isOverWarning ? styles.counterWarning : null,
          ]}
        >
          {value.length}/{maxLength}
        </Text>
      </View>

      {loading && onStop ? (
        <TouchableOpacity
          style={[styles.sendButton, styles.stopButton]}
          onPress={onStop}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={stopLabel ?? 'stop'}
        >
          <Text style={styles.sendIcon}>{stopLabel ?? '停止'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.sendButton, isSendBlocked ? styles.sendButtonDisabled : null]}
          onPress={handleSubmit}
          activeOpacity={0.7}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="send"
        >
          {loading ? (
            <ActivityIndicator size="small" color={tokens.surface.light} />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.surface.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  inputColumn: {
    flex: 1,
    position: 'relative',
  },
  input: {
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
    fontSize: 14,
    color: tokens.text.primary,
  },
  counter: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    fontSize: 11,
    color: tokens.text.tertiary,
    marginTop: 4,
    textAlign: 'right',
  },
  counterWarning: {
    color: tokens.warning.DEFAULT,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.brand.DEFAULT,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: tokens.danger.DEFAULT,
  },
  sendButtonDisabled: {
    backgroundColor: tokens.surface.muted,
  },
  sendIcon: {
    fontSize: 18,
    color: tokens.surface.light,
    fontWeight: '600',
  },
})

export default InputArea
