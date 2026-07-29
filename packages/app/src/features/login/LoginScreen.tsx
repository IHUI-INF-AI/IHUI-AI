import { useMemo } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LoginScreenProps } from '../../types'

/** 登录共享屏 — props 注入式跨端组件(wrapper 负责 useAuth().login / loginBySso)。
 *  原屏硬编码中文(无 i18n),共享层保持原样不接入 t()。 */
export type { LoginScreenProps }

export function LoginScreen({
  account,
  password,
  loading,
  ssoLoading,
  error,
  onAccountChange,
  onPasswordChange,
  onLogin,
  onSsoLogin,
  colorScheme = 'light',
}: LoginScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const disabled = loading || ssoLoading

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>IHUI AI 登录</Text>
        <TextInput
          style={[styles.input, styles.inputMargin]}
          value={account}
          onChangeText={onAccountChange}
          placeholder="账号 / 手机号 / 邮箱"
          placeholderTextColor={tk.text.tertiary}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, styles.inputMargin]}
          value={password}
          onChangeText={onPasswordChange}
          placeholder="密码"
          placeholderTextColor={tk.text.tertiary}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.loginBtn, disabled && styles.btnDisabled]}
          onPress={onLogin}
          disabled={disabled}
        >
          <Text style={styles.loginText}>{loading ? '登录中...' : '登录'}</Text>
        </TouchableOpacity>

        <Text style={styles.or}>或</Text>

        <TouchableOpacity
          style={[styles.ssoBtn, disabled && styles.btnDisabled]}
          onPress={onSsoLogin}
          disabled={disabled}
        >
          <Text style={styles.ssoText}>
            {ssoLoading ? '打开网页登录...' : '使用网页账号登录'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.tip}>在 IHUI AI 网页端已登录的账号,可一键授权登录移动端</Text>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 16, justifyContent: 'center' },
    card: { padding: 16, backgroundColor: tk.surface.light, borderRadius: 8 },
    title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: tk.text.primary },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: tk.text.primary,
    },
    inputMargin: { marginBottom: 8 },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8 },
    loginBtn: {
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    ssoBtn: {
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    loginText: { color: tk.surface.light, fontSize: 15, fontWeight: '600' },
    ssoText: { color: tk.text.primary, fontSize: 15, fontWeight: '600' },
    or: { fontSize: 12, color: tk.text.tertiary, textAlign: 'center', marginVertical: 16 },
    tip: { fontSize: 12, color: tk.text.secondary, textAlign: 'center', marginTop: 8 },
  })
}
