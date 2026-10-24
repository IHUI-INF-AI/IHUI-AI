// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AccountCancelScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

/** AccountCancelScreen props re-export(单一来源 @ihui/types) */
export type { AccountCancelScreenProps }

export function AccountCancelScreen({
  t,
  phone,
  confirmText,
  smsCode,
  countdown,
  showConfirmModal,
  confirmCountdown,
  submitting,
  onPhoneChange,
  onConfirmTextChange,
  onSmsCodeChange,
  onSendSms,
  onSubmit,
  onCloseModal,
  onBack,
  colorScheme = 'light',
}: AccountCancelScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>注销账号</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.desc}>注销账号后，您的所有数据将被永久删除且无法恢复。</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>手机号</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={phone}
            onChangeText={onPhoneChange}
            placeholder="请输入手机号"
            placeholderTextColor={tk.text.tertiary}
            keyboardType="phone-pad"
            maxLength={11}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>短信验证码</Text>
          <View style={styles.smsRow}>
            <TextField
              colorScheme={colorScheme}
              style={[styles.input, styles.smsInput]}
              value={smsCode}
              onChangeText={onSmsCodeChange}
              placeholder="请输入验证码"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.smsBtn, countdown > 0 && styles.smsBtnDisabled]}
              onPress={onSendSms}
              disabled={countdown > 0}
            >
              <Text style={[styles.smsBtnText, countdown > 0 && styles.smsBtnTextDisabled]}>
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>确认注销</Text>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={confirmText}
            onChangeText={onConfirmTextChange}
            placeholder="请输入「确认注销」"
            placeholderTextColor={tk.text.tertiary}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>{submitting ? '提交中...' : '提交注销申请'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>确认注销</Text>
            <Text style={styles.modalBody}>注销后数据不可恢复，请再次确认是否继续？</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={onCloseModal}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, confirmCountdown > 0 && styles.modalConfirmDisabled]}
                onPress={onSubmit}
                disabled={confirmCountdown > 0}
              >
                <Text style={styles.modalConfirmText}>
                  {confirmCountdown > 0 ? `${confirmCountdown}s` : '确认注销'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { ...rnType.heading, color: tk.text.primary },
    scrollContent: {
      padding: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
      gap: rnSpacing.lg,
    },
    desc: {
      ...rnType.body,
      color: tk.text.secondary,
      backgroundColor: tk.surface.light,
      padding: rnSpacing.md,
      borderRadius: rnRadius.xl,
    },
    fieldGroup: {
      gap: rnSpacing.sm,
    },
    label: {
      ...rnType.title,
      color: tk.text.primary,
    },
    input: {
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing.md,
      height: 50,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    smsRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      alignItems: 'center',
    },
    smsInput: {
      flex: 1,
    },
    smsBtn: {
      paddingHorizontal: rnSpacing.md,
      height: 44,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smsBtnDisabled: {
      backgroundColor: tk.surface.muted,
    },
    smsBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.surface.light,
    },
    smsBtnTextDisabled: {
      color: tk.text.tertiary,
    },
    submitBtn: {
      height: 50,
      justifyContent: 'center',
      borderRadius: rnRadius.md,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      marginTop: rnSpacing.sm,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      ...rnType.subtitle,
      color: tk.surface.light,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing['2xl'],
    },
    modalContent: {
      width: '100%',
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius['2xl'],
      padding: rnSpacing['2xl'],
      gap: rnSpacing.md,
    },
    modalTitle: {
      fontSize: rnType.heading.size,
      color: tk.text.primary,
      textAlign: 'center',
    },
    modalBody: {
      fontSize: rnType.title.size,
      color: tk.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalActions: {
      flexDirection: 'row',
      gap: rnSpacing.md,
    },
    modalCancel: {
      flex: 1,
      height: 44,
      justifyContent: 'center',
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    modalConfirm: {
      flex: 1,
      height: 44,
      justifyContent: 'center',
      borderRadius: rnRadius.md,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
    },
    modalConfirmDisabled: {
      backgroundColor: tk.surface.muted,
    },
    modalConfirmText: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.surface.light,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
