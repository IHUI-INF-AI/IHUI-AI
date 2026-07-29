import { useMemo } from 'react'
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LoginScreenProps } from '../../types'

/**
 * 登录共享屏 — 视觉对齐 web AuthShell + LoginForm(2026-07-29 重做)。
 *
 * 此前是简陋"标题+2 输入框+2 按钮",与 web 登录窗(AuthShell 卡片 + logo+welcome
 * 顶部 + h-10 输入框 + h-10 主按钮 + 第三方登录区)视觉差距大,用户反馈"没跟 web
 * 登录窗一样样式"。本次按 web 视觉规范用 RN StyleSheet 复刻:
 *   - 外壳:居中 flex 1 + 卡片 max-w 460 + rounded-xl 12 + border + bg-card + p-7 28
 *   - 阴影:RN elevation + shadowOpacity 复刻 web 双层 box-shadow
 *   - 顶部 logo 区:31×31 圆角方块 + "IHUI AI" 文字(替代 web logo.png+welcome.svg)
 *   - 输入框:h 40 + rounded-md 6 + border + px 12 + fontSize 14(对齐 web h-10 Input)
 *   - 主按钮:h 40 + rounded-md 6 + bg brand + text surface.light + fontSize 14 fontWeight 500
 *   - SSO 按钮:h 40 + rounded-md 6 + border outline
 *   - 错误提示:红边框 + 红浅底 + ⚠ 图标(对齐 web ErrorAlert)
 *
 * 保留现有 3 字段(账号/密码/SSO),不引入 web 的 4-tab/第三方登录(那是功能扩展,
 * 需用户确认)。i18n 由调用方注入 t()。
 */
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
  logoSource,
}: LoginScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk, colorScheme), [tk, colorScheme])
  const disabled = loading || ssoLoading

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {/* 顶部 logo + welcome(对齐 web AuthShell 顶部区) */}
        <View style={styles.header}>
          {logoSource ? (
            <Image
              source={logoSource}
              style={styles.logoImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>IHUI</Text>
            </View>
          )}
          <Text style={styles.welcomeText}>IHUI AI</Text>
        </View>

        {/* 错误提示(对齐 web ErrorAlert) */}
        {error ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 账号输入框(对齐 web h-10 Input + Label) */}
        <View style={styles.field}>
          <Text style={styles.label}>{'账号'}</Text>
          <TextInput
            style={styles.input}
            value={account}
            onChangeText={onAccountChange}
            placeholder="账号 / 手机号 / 邮箱"
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* 密码输入框 */}
        <View style={styles.field}>
          <Text style={styles.label}>{'密码'}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={onPasswordChange}
            placeholder="密码"
            placeholderTextColor={tk.text.tertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* 主登录按钮(对齐 web h-10 Button bg-primary) */}
        <TouchableOpacity
          style={[styles.loginBtn, disabled && styles.btnDisabled]}
          onPress={onLogin}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.loginBtnText}>{loading ? '登录中...' : '登录'}</Text>
        </TouchableOpacity>

        {/* 分隔(对齐 web "或" 分隔线) */}
        <Text style={styles.orDivider}>或</Text>

        {/* SSO 按钮(对齐 web outline 按钮) */}
        <TouchableOpacity
          style={[styles.ssoBtn, disabled && styles.btnDisabled]}
          onPress={onSsoLogin}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.ssoBtnText}>
            {ssoLoading ? '打开网页登录...' : '使用网页账号登录'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.tipText}>在 IHUI AI 网页端已登录的账号,可一键授权登录移动端</Text>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens, colorScheme: 'light' | 'dark') {
  // 卡片/输入框表面:浅色用 surface.light(白),深色用 surface.card(深灰)
  // surface.light 在深色模式仍为 #FFFFFF(语义是"品牌色对比白字"),不能做卡片背景
  const surface = colorScheme === 'dark' ? tk.surface.card : tk.surface.light
  // 品牌按钮文字:浅色品牌=黑底→白字,深色品牌=白底→黑字
  const onBrandText = colorScheme === 'dark' ? tk.gray.black : tk.surface.light
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 460,
      padding: 28,
      backgroundColor: surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      // RN 复刻 web box-shadow 0_4px_24px + 0_1px_4px
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 24,
    },
    logoBox: {
      width: 31,
      height: 31,
      borderRadius: 6,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImage: {
      width: 31,
      height: 31,
      borderRadius: 6,
    },
    logoText: {
      color: onBrandText,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    welcomeText: {
      fontSize: 22,
      fontWeight: '700',
      color: tk.text.primary,
      letterSpacing: 0.5,
    },
    errorAlert: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(220, 38, 38, 0.3)',
      backgroundColor: 'rgba(220, 38, 38, 0.05)',
      marginBottom: 16,
    },
    errorIcon: {
      color: tk.danger.DEFAULT,
      fontSize: 14,
      lineHeight: 18,
    },
    errorText: {
      flex: 1,
      color: tk.danger.DEFAULT,
      fontSize: 12,
      lineHeight: 18,
    },
    field: {
      gap: 6,
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.text.primary,
    },
    input: {
      height: 40,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 6,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: surface,
    },
    loginBtn: {
      height: 40,
      borderRadius: 6,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginBtnText: {
      color: onBrandText,
      fontSize: 14,
      fontWeight: '500',
    },
    orDivider: {
      fontSize: 12,
      color: tk.text.tertiary,
      textAlign: 'center',
      marginVertical: 16,
    },
    ssoBtn: {
      height: 40,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surface,
    },
    ssoBtnText: {
      color: tk.text.primary,
      fontSize: 14,
      fontWeight: '500',
    },
    btnDisabled: {
      opacity: 0.6,
    },
    tipText: {
      fontSize: 12,
      color: tk.text.secondary,
      textAlign: 'center',
      marginTop: 12,
    },
  })
}
