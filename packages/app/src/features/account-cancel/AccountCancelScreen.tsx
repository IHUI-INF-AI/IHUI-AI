import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AccountCancelScreenProps } from '../../types'

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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>注销账号</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.desc}>注销账号后，您的所有数据将被永久删除且无法恢复。</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>手机号</Text>
          <TextInput
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
            <TextInput
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
          <TextInput
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
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    scrollContent: {
      padding: 14,
      paddingBottom: 32,
      gap: 12,
    },
    desc: {
      fontSize: 14,
      color: tk.text.secondary,
      lineHeight: 18,
      backgroundColor: tk.surface.light,
      padding: 12,
      borderRadius: 12,
    },
    fieldGroup: {
      gap: 8,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    input: {
      backgroundColor: '#f5f5f5',
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 50,
      fontSize: 16,
      color: tk.text.primary,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    smsRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    smsInput: {
      flex: 1,
    },
    smsBtn: {
      paddingHorizontal: 12,
      height: 44,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smsBtnDisabled: {
      backgroundColor: tk.surface.muted,
    },
    smsBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.surface.light,
    },
    smsBtnTextDisabled: {
      color: tk.text.tertiary,
    },
    submitBtn: {
      height: 50,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      marginTop: 8,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.surface.light,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalContent: {
      width: '100%',
      backgroundColor: tk.surface.light,
      borderRadius: 16,
      padding: 24,
      gap: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: tk.text.primary,
      textAlign: 'center',
    },
    modalBody: {
      fontSize: 16,
      color: tk.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalCancel: {
      flex: 1,
      height: 44,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    modalConfirm: {
      flex: 1,
      height: 44,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
    },
    modalConfirmDisabled: {
      backgroundColor: tk.surface.muted,
    },
    modalConfirmText: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.surface.light,
    },
  })
}
