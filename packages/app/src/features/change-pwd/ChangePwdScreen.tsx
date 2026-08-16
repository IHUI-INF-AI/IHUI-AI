import { useMemo } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ChangePwdScreenProps, TFunction } from '../../types'

/** 修改密码/Props 类型 re-export(单一来源 @ihui/types) */
export type { ChangePwdScreenProps }

/**
 * 修改密码共享屏 — 平台无关 UI 组件
 *
 * 平台无关:负责渲染 header(返回 + 标题) + 3 个密码输入框(旧/新/确认) + 提交按钮。
 * 平台特定(导航/API 调用/Alert 提示)由 wrapper 通过 props 注入。
 */
export function ChangePwdScreen({
  t,
  onBack,
  oldPwd,
  newPwd,
  confirmPwd,
  showOld,
  showNew,
  showConfirm,
  submitting,
  onOldChange,
  onNewChange,
  onConfirmChange,
  onToggleOld,
  onToggleNew,
  onToggleConfirm,
  onSubmit,
  colorScheme = 'light',
}: ChangePwdScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.changePassword') || '修改密码'}</Text>
      </View>
      <View style={styles.body}>
        <PwdInput
          label={t('settings.oldPassword') || '旧密码'}
          value={oldPwd}
          onChange={onOldChange}
          show={showOld}
          onToggle={onToggleOld}
          tokens={tk}
          styles={styles}
          t={t}
        />
        <PwdInput
          label={t('settings.newPassword') || '新密码'}
          value={newPwd}
          onChange={onNewChange}
          show={showNew}
          onToggle={onToggleNew}
          tokens={tk}
          styles={styles}
          t={t}
        />
        <PwdInput
          label={t('settings.confirmPassword') || '确认新密码'}
          value={confirmPwd}
          onChange={onConfirmChange}
          show={showConfirm}
          onToggle={onToggleConfirm}
          tokens={tk}
          styles={styles}
          t={t}
        />
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitDisabled]}
          activeOpacity={0.7}
          disabled={submitting}
          onPress={onSubmit}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>
            {submitting ? t('common.submitting') || '提交中...' : t('common.confirm') || '确定'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface PwdInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  tokens: AppThemeTokens
  styles: ReturnType<typeof createStyles>
  t: TFunction
}

function PwdInput({ label, value, onChange, show, onToggle, tokens, styles, t }: PwdInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={`${label}`}
          placeholderTextColor={tokens.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={onToggle} hitSlop={8}>
          <Text style={styles.eyeText}>
            {show ? t('common.hide') || '隐藏' : t('common.show') || '显示'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14, gap: 12 },
    field: { gap: 6 },
    label: { fontSize: 16, color: tk.text.secondary },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 50,
    },
    input: {
      flex: 1,
      height: 50,
      fontSize: 16,
      color: tk.text.primary,
    },
    eyeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
    eyeText: { fontSize: 14, color: tk.text.secondary },
    submitBtn: {
      marginTop: 8,
      backgroundColor: tk.brand.DEFAULT,
      borderRadius: 12,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
  })
}
