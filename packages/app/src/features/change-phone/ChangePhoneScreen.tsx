import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ChangePhoneScreenProps } from '../../types'

/** 换绑手机共享屏 — props 注入式跨端组件(wrapper 负责 fetchApi + setInterval 倒计时)。
 *  原屏硬编码中文(无 i18n),共享层保持原样不接入 t()。 */
export type { ChangePhoneScreenProps }

export function ChangePhoneScreen({
  phoneNumber,
  codeValue,
  phoneHead,
  nationShow,
  codeMin,
  sendCodeShow,
  tip,
  submitting,
  nations,
  onPhoneChange,
  onCodeChange,
  onToggleNationShow,
  onSelectNation,
  onSendCode,
  onSubmit,
  colorScheme = 'light',
}: ChangePhoneScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>绑定手机号</Text>

      <View style={styles.inputWbox}>
        <View style={styles.inputBox}>
          <Pressable
            style={styles.areaBox}
            onPress={onToggleNationShow}
            accessibilityLabel="选择区号"
          >
            <Text style={styles.areaText}>{phoneHead}</Text>
            <Text style={styles.areaArrow}>▾</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={onPhoneChange}
            placeholder="手机号码"
            placeholderTextColor={tk.text.tertiary}
            keyboardType="phone-pad"
            maxLength={11}
          />
        </View>
        {nationShow ? (
          <View style={styles.nationBox}>
            {nations.map((n) => (
              <Pressable
                key={n.id}
                style={styles.nationItem}
                onPress={() => onSelectNation(n)}
                accessibilityLabel={`${n.title} ${n.content}`}
              >
                <Text style={styles.nationTitle}>{n.title}</Text>
                <Text style={styles.nationCode}>{n.content}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.inputWbox}>
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            value={codeValue}
            onChangeText={onCodeChange}
            placeholder="验证码"
            placeholderTextColor={tk.text.tertiary}
            keyboardType="number-pad"
            maxLength={6}
          />
          {sendCodeShow ? (
            <Pressable style={styles.sendBtn} onPress={onSendCode} accessibilityLabel="发送验证码">
              <Text style={styles.sendText}>发送验证码</Text>
            </Pressable>
          ) : codeMin > 0 ? (
            <Text style={styles.countdownText}>{codeMin}秒后重新获取</Text>
          ) : (
            <Pressable
              style={styles.sendBtn}
              onPress={onSendCode}
              accessibilityLabel="重新获取验证码"
            >
              <Text style={styles.sendText}>获取验证码</Text>
            </Pressable>
          )}
        </View>
      </View>

      {tip ? <Text style={styles.tipText}>{tip}</Text> : null}

      <Pressable
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
        accessibilityLabel="确定"
      >
        <Text style={styles.submitText}>{submitting ? '提交中...' : '确定'}</Text>
      </Pressable>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { padding: 24 },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: tk.text.primary,
      textAlign: 'center',
      marginBottom: 24,
    },
    inputWbox: { width: '100%', marginBottom: 16 },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 50,
      backgroundColor: '#f5f5f5',
    },
    areaBox: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, marginRight: 12 },
    areaText: { fontSize: 16, color: tk.text.medium },
    areaArrow: { fontSize: 10, color: tk.text.tertiary, marginLeft: 8 },
    input: { flex: 1, fontSize: 16, color: tk.text.primary, padding: 0 },
    sendBtn: { paddingLeft: 12 },
    sendText: { fontSize: 14, fontWeight: '700', color: tk.brand.DEFAULT },
    countdownText: { fontSize: 14, color: tk.text.secondary, paddingLeft: 12 },
    nationBox: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
      overflow: 'hidden',
    },
    nationItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 12,
    },
    nationTitle: { fontSize: 14, color: tk.text.primary },
    nationCode: { fontSize: 14, color: tk.text.tertiary },
    tipText: { fontSize: 14, color: tk.danger.DEFAULT, marginBottom: 12 },
    submitBtn: {
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { fontSize: 16, fontWeight: '700', color: tk.surface.light },
  })
}
