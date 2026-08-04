import { useMemo, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LoginScreenProps, TFunction } from '../../types'
// LoginTab / QrLoginConfig / QrLoginStatus / ThirdPartyLoginOption / ThirdPartyPlatform
// 仅在 @ihui/types 定义,packages/app/src/types.ts 未 re-export(任务约束禁止修改),
// 故直接从源 @ihui/types 导入。
import type {
  LoginTab,
  QrLoginConfig,
  QrLoginStatus,
  ThirdPartyLoginOption,
  ThirdPartyPlatform,
} from '@ihui/types'

/**
 * 登录共享屏 — RN 端 4-tab 完整版(2026-07-30 重做)。
 *
 * 视觉对齐 web ui-react LoginForm + AuthShell:
 *   - 外壳:居中 flex 1 + 卡片 maxWidth 460 + borderRadius 12 + border + padding 28
 *   - 阴影:RN shadowColor/Offset/Opacity/Radius + elevation 3(复刻 web box-shadow)
 *   - 顶部 logo 区:31×31 + "IHUI AI" 水平排列 gap 12,marginBottom 24
 *   - 4 tab 切换条:flex row 等宽,激活态 bg brand + text onBrandText
 *   - 输入框:height 40 + borderRadius 6 + border + paddingHorizontal 12 + fontSize 14
 *   - 主按钮:height 40 + borderRadius 6 + bg brand + fontSize 14 fontWeight 500
 *   - 错误提示:rgba(220,38,38,*) 红 边框/底/文字(对齐 web ErrorAlert)
 *   - 协议行:16×16 方形复选框 borderRadius 4 + 嵌套 Text 链接
 *   - 第三方登录区:3 列 flexWrap,40×40 圆形按钮
 *   - QR tab:200×200 二维码占位 + 状态文案 + 刷新按钮
 *
 * i18n:仅使用 zh-CN.json 已有 key(任务约束禁止新增 key),QR 状态文案 / a11y label 硬编码中文。
 * 所有新增 props 可选,旧调用方只传 account/password 仍可工作(渲染为单一 password tab)。
 */
export type { LoginScreenProps }

// ===== 辅助函数 =====

/** image 专有 style sheet — module 顶层 const,所有子组件可直接引用
 *  (RN Image 的 style prop 拒绝 view/text style 联合,须独立成表) */
const imageStyles = StyleSheet.create({
  thirdPartyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  // 无图标 fallback:品牌色圆形背景 + 白色首字母(对齐 web ThirdPartyLoginButtons 视觉)
  thirdPartyFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#999999',
  },
  thirdPartyFallbackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  logoImage: {
    width: 31,
    height: 31,
  },
})

/** tab key → i18n key 映射(对齐 web login-form.tsx) */
function tabLabelKey(tab: LoginTab): string {
  switch (tab) {
    case 'email':
      return 'auth.emailLogin'
    case 'phone':
      return 'auth.phoneCodeLogin'
    case 'password':
      return 'auth.passwordLogin'
    case 'qr':
      return 'auth.qrLogin'
    default:
      return 'auth.passwordLogin'
  }
}

/** QR 状态文案(硬编码中文,避免新增 i18n key 触发 parity 守门) */
function qrStatusText(status: QrLoginStatus, qrConfig?: QrLoginConfig): string {
  switch (status) {
    case 'loading':
      return '二维码加载中...'
    case 'waiting':
      return '请使用微信扫码登录'
    case 'scanned':
      return '扫码成功,请在手机上确认'
    case 'expired':
      return '二维码已过期'
    case 'error':
      return qrConfig?.errorText ?? '二维码加载失败'
    case 'idle':
      return '请使用微信扫码登录'
    default:
      return '请使用微信扫码登录'
  }
}

// ===== 样式集类型(向前引用,createStyles 在文件末尾) =====

type StyleSet = ReturnType<typeof createStyles>

// ===== 子组件 props 类型 =====

interface TabContentBaseProps {
  t: TFunction
  styles: StyleSet
  tk: AppThemeTokens
  loading: boolean
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  onOpenTerms?: () => void
  onOpenPrivacy?: () => void
  showAgreeErr: boolean
}

interface EmailTabContentProps extends TabContentBaseProps {
  email: string
  emailCode: string
  sending: boolean
  countdown: number
  onEmailChange?: (text: string) => void
  onEmailCodeChange?: (text: string) => void
  onSendCode?: () => void
  onLogin: () => void
}

interface PhoneTabContentProps extends TabContentBaseProps {
  phone: string
  phoneCode: string
  sending: boolean
  countdown: number
  onPhoneChange?: (text: string) => void
  onPhoneCodeChange?: (text: string) => void
  onSendCode?: () => void
  onLogin: () => void
}

interface PasswordTabContentProps extends TabContentBaseProps {
  account: string
  password: string
  onAccountChange: (text: string) => void
  onPasswordChange: (text: string) => void
  onLogin: () => void
  showPassword: boolean
  onToggleShowPassword: () => void
  onForgotPassword?: () => void
  // 密码显示/隐藏 图标(可选,对齐 web lucide Eye/EyeOff 视觉)
  // 类型为 ReactNode 以支持 lucide-react-native 的 <Eye />/<EyeOff /> SVG 组件
  // (RN <Image source={require('*.svg')} /> 在 Android/Web 不支持 SVG 渲染,会显示损坏)
  // 不传则 fallback 到 emoji(旧行为,不推荐 — emoji 在 Windows 渲染为损坏图)
  eyeIconShow?: ReactNode
  eyeIconHide?: ReactNode
}

interface QrTabContentProps {
  styles: StyleSet
  tk: AppThemeTokens
  qrConfig?: QrLoginConfig
}

interface AgreementRowProps {
  t: TFunction
  styles: StyleSet
  tk: AppThemeTokens
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  onOpenTerms?: () => void
  onOpenPrivacy?: () => void
  showAgreeErr: boolean
}

interface PrimaryLoginButtonProps {
  t: TFunction
  styles: StyleSet
  loading: boolean
  onPress: () => void
}

interface ThirdPartyLoginAreaProps {
  styles: StyleSet
  tk: AppThemeTokens
  options: ThirdPartyLoginOption[]
  loadingPlatform: ThirdPartyPlatform | null
  onLogin?: (platform: ThirdPartyPlatform) => void
}

// ===== 共享子组件 =====

/** 协议同意行 — 16×16 方形复选框 + 嵌套链接 Text(对齐 web AgreementCheckbox inline 模式) */
function AgreementRow({
  t,
  styles,
  agreed,
  onAgreedChange,
  onOpenTerms,
  onOpenPrivacy,
  showAgreeErr,
}: AgreementRowProps) {
  return (
    <View style={styles.agreementRow}>
      <View style={styles.agreementRowMain}>
        <TouchableOpacity
          style={[
            styles.checkbox,
            agreed ? styles.checkboxChecked : styles.checkboxUnchecked,
            showAgreeErr && !agreed ? styles.checkboxError : null,
          ]}
          onPress={() => onAgreedChange(!agreed)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          accessibilityLabel="同意协议复选框"
        >
          {agreed ? <Text style={styles.checkmark}>✓</Text> : null}
        </TouchableOpacity>
        <Text style={styles.agreementText}>
          {t('auth.agreePrefix')}
          <Text
            style={styles.agreementLink}
            onPress={onOpenTerms}
            accessibilityRole="link"
            accessibilityLabel="服务条款"
          >
            {t('auth.termsOfService')}
          </Text>
          {t('auth.and')}
          <Text
            style={styles.agreementLink}
            onPress={onOpenPrivacy}
            accessibilityRole="link"
            accessibilityLabel="隐私政策"
          >
            {t('auth.privacyPolicy')}
          </Text>
        </Text>
      </View>
      {showAgreeErr && !agreed ? (
        <Text style={styles.agreementErrorText}>{t('auth.agreeRequired')}</Text>
      ) : null}
    </View>
  )
}

/** 主登录按钮(对齐 web h-10 Button bg-primary) */
function PrimaryLoginButton({ t, styles, loading, onPress }: PrimaryLoginButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.loginBtn, loading && styles.btnDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <Text style={styles.loginBtnText}>{loading ? '登录中...' : t('auth.loginBtn')}</Text>
    </TouchableOpacity>
  )
}

/** 第三方登录区 — 4 列网格 + 44×44 圆形按钮 + 分隔线(对齐 web ThirdPartyLoginButtons 视觉) */
function ThirdPartyLoginArea({
  styles,
  tk,
  options,
  loadingPlatform,
  onLogin,
}: ThirdPartyLoginAreaProps) {
  return (
    <View style={styles.thirdPartyArea}>
      {/* 分隔线:"或"居中(对齐 web 端 or-divider) */}
      <View style={styles.thirdPartyDivider}>
        <View style={styles.thirdPartyDividerLine} />
        <Text style={styles.thirdPartyDividerText}>{'或'}</Text>
        <View style={styles.thirdPartyDividerLine} />
      </View>
      <Text style={styles.thirdPartyTitle}>{'第三方登录'}</Text>
      <View style={styles.thirdPartyGrid}>
        {options.map((opt) => {
          const disabled = !opt.enabled || opt.forceDisabled === true
          const isLoading = loadingPlatform === opt.platform
          return (
            <TouchableOpacity
              key={opt.platform}
              style={[styles.thirdPartyBtn, disabled ? styles.thirdPartyBtnDisabled : null]}
              onPress={() => !disabled && onLogin?.(opt.platform)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              ) : opt.iconSource ? (
                <Image
                  source={opt.iconSource}
                  style={imageStyles.thirdPartyIcon}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={[
                    imageStyles.thirdPartyFallback,
                    !!opt.brandColor && { backgroundColor: opt.brandColor },
                  ]}
                >
                  <Text style={imageStyles.thirdPartyFallbackText}>
                    {opt.label.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ===== 4 个 tab 子组件 =====

/** 邮箱验证码登录(对齐 web EmailCodeLoginForm) */
function EmailTabContent({
  t,
  styles,
  tk,
  email,
  emailCode,
  sending,
  countdown,
  onEmailChange,
  onEmailCodeChange,
  onSendCode,
  onLogin,
  loading,
  agreed,
  onAgreedChange,
  onOpenTerms,
  onOpenPrivacy,
  showAgreeErr,
}: EmailTabContentProps) {
  const sendDisabled = !email || sending || countdown > 0
  return (
    <View style={styles.tabContent}>
      <View style={styles.field}>
        <Text style={styles.label}>{t('auth.email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={onEmailChange}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t('auth.code')}</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={emailCode}
            onChangeText={(text) => onEmailCodeChange?.(text.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('auth.codePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
          />
          <TouchableOpacity
            style={[styles.sendCodeBtn, sendDisabled && styles.btnDisabled]}
            onPress={onSendCode}
            disabled={sendDisabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="获取验证码"
          >
            {sending ? (
              <ActivityIndicator size="small" color={tk.text.primary} />
            ) : (
              <Text style={styles.sendCodeBtnText}>
                {countdown > 0
                  ? t('auth.resendCode', { seconds: countdown })
                  : t('auth.getVerificationCode')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <AgreementRow
        t={t}
        styles={styles}
        tk={tk}
        agreed={agreed}
        onAgreedChange={onAgreedChange}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
        showAgreeErr={showAgreeErr}
      />
      <PrimaryLoginButton t={t} styles={styles} loading={loading} onPress={onLogin} />
    </View>
  )
}

/** 手机验证码登录(对齐 web PhoneCodeLoginForm) */
function PhoneTabContent({
  t,
  styles,
  tk,
  phone,
  phoneCode,
  sending,
  countdown,
  onPhoneChange,
  onPhoneCodeChange,
  onSendCode,
  onLogin,
  loading,
  agreed,
  onAgreedChange,
  onOpenTerms,
  onOpenPrivacy,
  showAgreeErr,
}: PhoneTabContentProps) {
  const sendDisabled = !phone || sending || countdown > 0
  return (
    <View style={styles.tabContent}>
      <View style={styles.field}>
        <Text style={styles.label}>{t('auth.phone')}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={(text) => onPhoneChange?.(text.replace(/\D/g, '').slice(0, 11))}
          placeholder={t('auth.phonePlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          keyboardType="number-pad"
          maxLength={11}
          textContentType="telephoneNumber"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t('auth.code')}</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={phoneCode}
            onChangeText={(text) => onPhoneCodeChange?.(text.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('auth.codePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
          />
          <TouchableOpacity
            style={[styles.sendCodeBtn, sendDisabled && styles.btnDisabled]}
            onPress={onSendCode}
            disabled={sendDisabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="获取验证码"
          >
            {sending ? (
              <ActivityIndicator size="small" color={tk.text.primary} />
            ) : (
              <Text style={styles.sendCodeBtnText}>
                {countdown > 0
                  ? t('auth.resendCode', { seconds: countdown })
                  : t('auth.getVerificationCode')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <AgreementRow
        t={t}
        styles={styles}
        tk={tk}
        agreed={agreed}
        onAgreedChange={onAgreedChange}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
        showAgreeErr={showAgreeErr}
      />
      <PrimaryLoginButton t={t} styles={styles} loading={loading} onPress={onLogin} />
    </View>
  )
}

/** 账号密码登录(对齐 web PasswordLoginForm) */
function PasswordTabContent({
  t,
  styles,
  tk,
  account,
  password,
  onAccountChange,
  onPasswordChange,
  onLogin,
  loading,
  showPassword,
  onToggleShowPassword,
  eyeIconShow,
  eyeIconHide,
  agreed,
  onAgreedChange,
  onOpenTerms,
  onOpenPrivacy,
  showAgreeErr,
  onForgotPassword,
}: PasswordTabContentProps) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.field}>
        <Text style={styles.label}>{t('auth.account')}</Text>
        <TextInput
          style={styles.input}
          value={account}
          onChangeText={onAccountChange}
          placeholder={t('auth.accountPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
        />
      </View>
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('auth.password')}</Text>
          {onForgotPassword ? (
            <TouchableOpacity
              onPress={onForgotPassword}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="忘记密码"
            >
              <Text style={styles.forgotLink}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={password}
            onChangeText={onPasswordChange}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={onToggleShowPassword}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? '隐藏密码' : '显示密码'}
          >
            {eyeIconShow || eyeIconHide ? (
              showPassword ? (
                eyeIconHide
              ) : (
                eyeIconShow
              )
            ) : (
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <AgreementRow
        t={t}
        styles={styles}
        tk={tk}
        agreed={agreed}
        onAgreedChange={onAgreedChange}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
        showAgreeErr={showAgreeErr}
      />
      <PrimaryLoginButton t={t} styles={styles} loading={loading} onPress={onLogin} />
    </View>
  )
}

/** 扫码登录(对齐 web QrTab fallback,简版占位) */
function QrTabContent({ styles, tk, qrConfig }: QrTabContentProps) {
  const status: QrLoginStatus = qrConfig?.status ?? 'idle'
  const text = qrStatusText(status, qrConfig)
  const showRefresh = status === 'expired' || status === 'error'
  const isLoading = status === 'loading'
  const qrSource = qrConfig?.qrSource ?? null
  return (
    <View style={styles.qrContainer}>
      <View style={styles.qrBox}>
        {isLoading ? (
          <ActivityIndicator size="large" color={tk.brand.DEFAULT} />
        ) : qrSource ? (
          <Image source={qrSource} style={imageStyles.qrImage} resizeMode="contain" />
        ) : (
          <Text style={styles.qrPlaceholderText}>二维码加载中...</Text>
        )}
      </View>
      <Text style={styles.qrStatusText}>{text}</Text>
      {showRefresh && qrConfig?.onRefresh ? (
        <TouchableOpacity
          style={styles.qrRefreshBtn}
          onPress={qrConfig.onRefresh}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="刷新二维码"
        >
          <Text style={styles.qrRefreshText}>{'刷新二维码'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

// ===== 主组件 =====

export function LoginScreen(props: LoginScreenProps) {
  const {
    t,
    colorScheme = 'light',
    logoSource,
    tabs,
    defaultTab,
    account,
    password,
    loading,
    ssoLoading,
    error,
    onAccountChange,
    onPasswordChange,
    onLogin,
    onSsoLogin,
    // email
    email,
    emailCode,
    emailCodeSending,
    emailCountdown,
    onEmailChange,
    onEmailCodeChange,
    onSendEmailCode,
    onLoginByEmailCode,
    // phone
    phone,
    phoneCode,
    phoneCodeSending,
    phoneCountdown,
    onPhoneChange,
    onPhoneCodeChange,
    onSendPhoneCode,
    onLoginByPhoneCode,
    // qr
    qrConfig,
    // third party
    thirdPartyOptions,
    onThirdPartyLogin,
    thirdPartyLoadingPlatform,
    // agreement
    agreed: agreedProp,
    onAgreedChange,
    onOpenTerms,
    onOpenPrivacy,
    // forgot + register
    onForgotPassword,
    onRegister,
    // eye icons
    eyeIconShow,
    eyeIconHide,
    // welcome 图标节点(对齐 web AuthShell welcome.svg)
    welcomeNode,
  } = props

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk, colorScheme), [tk, colorScheme])

  const tabsList = useMemo<readonly LoginTab[]>(() => tabs ?? ['password'], [tabs])
  const [activeTab, setActiveTab] = useState<LoginTab>(defaultTab ?? tabsList[0] ?? 'password')
  const [internalAgreed, setInternalAgreed] = useState(false)
  const [showAgreeErr, setShowAgreeErr] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const agreed = agreedProp ?? internalAgreed
  const disabled = loading || ssoLoading
  const showTabBar = tabsList.length > 1
  const isQrTab = activeTab === 'qr'

  const handleAgreedChange = (v: boolean) => {
    setInternalAgreed(v)
    onAgreedChange?.(v)
    if (v) setShowAgreeErr(false)
  }

  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab)
    setShowAgreeErr(false)
  }

  // 协议校验:未勾选 → 阻止提交 + 显示红色提示(对齐 web inline 模式)
  const requireAgree = (): boolean => {
    if (!agreed) {
      setShowAgreeErr(true)
      return false
    }
    return true
  }

  const handlePasswordLogin = () => {
    if (!requireAgree()) return
    onLogin()
  }

  const handleEmailLogin = () => {
    if (!requireAgree()) return
    onLoginByEmailCode?.()
  }

  const handlePhoneLogin = () => {
    if (!requireAgree()) return
    onLoginByPhoneCode?.()
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {/* 顶部 logo 区(对齐 web AuthShell:logo 31×31 + welcome 图 340×52) */}
        <View style={styles.header}>
          {logoSource ? (
            <Image source={logoSource} style={imageStyles.logoImage} resizeMode="contain" />
          ) : (
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>IHUI</Text>
            </View>
          )}
          {welcomeNode ?? <Text style={styles.welcomeText}>IHUI AI</Text>}
        </View>

        {/* 错误提示(对齐 web ErrorAlert) */}
        {error ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 4 tab 切换条(仅多 tab 时显示,单 tab 默认 password 向后兼容) */}
        {showTabBar ? (
          <View style={styles.tabBar}>
            {tabsList.map((tab) => {
              const active = tab === activeTab
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabItem, active && styles.tabItemActive]}
                  onPress={() => handleTabChange(tab)}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t(tabLabelKey(tab))}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : null}

        {/* Tab 内容 */}
        {activeTab === 'email' ? (
          <EmailTabContent
            t={t}
            styles={styles}
            tk={tk}
            email={email ?? ''}
            emailCode={emailCode ?? ''}
            sending={emailCodeSending ?? false}
            countdown={emailCountdown ?? 0}
            onEmailChange={onEmailChange}
            onEmailCodeChange={onEmailCodeChange}
            onSendCode={onSendEmailCode}
            onLogin={handleEmailLogin}
            loading={loading}
            agreed={agreed}
            onAgreedChange={handleAgreedChange}
            onOpenTerms={onOpenTerms}
            onOpenPrivacy={onOpenPrivacy}
            showAgreeErr={showAgreeErr}
          />
        ) : null}

        {activeTab === 'phone' ? (
          <PhoneTabContent
            t={t}
            styles={styles}
            tk={tk}
            phone={phone ?? ''}
            phoneCode={phoneCode ?? ''}
            sending={phoneCodeSending ?? false}
            countdown={phoneCountdown ?? 0}
            onPhoneChange={onPhoneChange}
            onPhoneCodeChange={onPhoneCodeChange}
            onSendCode={onSendPhoneCode}
            onLogin={handlePhoneLogin}
            loading={loading}
            agreed={agreed}
            onAgreedChange={handleAgreedChange}
            onOpenTerms={onOpenTerms}
            onOpenPrivacy={onOpenPrivacy}
            showAgreeErr={showAgreeErr}
          />
        ) : null}

        {activeTab === 'password' ? (
          <PasswordTabContent
            t={t}
            styles={styles}
            tk={tk}
            account={account}
            password={password}
            onAccountChange={onAccountChange}
            onPasswordChange={onPasswordChange}
            onLogin={handlePasswordLogin}
            loading={loading}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword((s) => !s)}
            eyeIconShow={eyeIconShow}
            eyeIconHide={eyeIconHide}
            agreed={agreed}
            onAgreedChange={handleAgreedChange}
            onOpenTerms={onOpenTerms}
            onOpenPrivacy={onOpenPrivacy}
            showAgreeErr={showAgreeErr}
            onForgotPassword={onForgotPassword}
          />
        ) : null}

        {activeTab === 'qr' ? <QrTabContent styles={styles} tk={tk} qrConfig={qrConfig} /> : null}

        {/* 第三方登录区(qr tab 不重复显示) */}
        {!isQrTab && thirdPartyOptions && thirdPartyOptions.length > 0 ? (
          <ThirdPartyLoginArea
            styles={styles}
            tk={tk}
            options={thirdPartyOptions}
            loadingPlatform={thirdPartyLoadingPlatform ?? null}
            onLogin={onThirdPartyLogin}
          />
        ) : null}

        {/* SSO 按钮(对齐 web outline 按钮) */}
        <TouchableOpacity
          style={[styles.ssoBtn, disabled && styles.btnDisabled]}
          onPress={onSsoLogin}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.ssoBtnText}>
            {ssoLoading ? '打开网页登录...' : '使用其他方式登录'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.tipText}>{'在 IHUI AI 网页端已登录的账号,可一键授权登录'}</Text>

        {/* 注册链接(卡片底部水平排列) */}
        {onRegister ? (
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t('auth.noAccount')}</Text>
            <TouchableOpacity
              onPress={onRegister}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="立即注册"
            >
              <Text style={styles.registerLink}>{t('auth.registerNow')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  )
}

// ===== 样式 =====

function createStyles(tk: AppThemeTokens, colorScheme: 'light' | 'dark') {
  // 卡片/输入框表面:浅色用 surface.light(白),深色用 surface.card(深灰)
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
      color: 'rgba(220, 38, 38, 1)',
      fontSize: 14,
      lineHeight: 18,
    },
    errorText: {
      flex: 1,
      color: 'rgba(220, 38, 38, 1)',
      fontSize: 12,
      lineHeight: 18,
    },
    // ===== Tab 切换条 =====
    tabBar: {
      flexDirection: 'row',
      gap: 4,
      marginBottom: 16,
      padding: 4,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
    },
    tabItem: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabItemActive: {
      backgroundColor: tk.brand.DEFAULT,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '500',
      color: tk.text.secondary,
    },
    tabTextActive: {
      color: onBrandText,
    },
    tabContent: {
      gap: 0,
    },
    // ===== 输入框 =====
    field: {
      gap: 6,
      marginBottom: 16,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    codeInput: {
      flex: 1,
    },
    sendCodeBtn: {
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendCodeBtnText: {
      fontSize: 12,
      fontWeight: '500',
      color: tk.text.primary,
    },
    // ===== 密码输入 + 眼睛 =====
    passwordRow: {
      position: 'relative',
    },
    passwordInput: {
      paddingRight: 40,
    },
    eyeBtn: {
      position: 'absolute',
      right: 8,
      top: 0,
      bottom: 0,
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyeIcon: {
      fontSize: 16,
    },
    forgotLink: {
      fontSize: 12,
      color: tk.brand.DEFAULT,
    },
    // ===== 协议行 =====
    agreementRow: {
      marginBottom: 16,
    },
    agreementRowMain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    checkbox: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxUnchecked: {
      borderColor: tk.border.light,
      backgroundColor: surface,
    },
    checkboxChecked: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.brand.DEFAULT,
    },
    checkboxError: {
      borderColor: 'rgba(220, 38, 38, 1)',
    },
    checkmark: {
      color: onBrandText,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
    },
    agreementText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: tk.text.secondary,
    },
    agreementLink: {
      color: tk.brand.DEFAULT,
    },
    agreementErrorText: {
      fontSize: 12,
      color: 'rgba(220, 38, 38, 1)',
      marginTop: 4,
    },
    // ===== 主按钮 =====
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
    btnDisabled: {
      opacity: 0.6,
    },
    // ===== SSO 按钮 =====
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
    tipText: {
      fontSize: 12,
      color: tk.text.secondary,
      textAlign: 'center',
      marginTop: 12,
    },
    // ===== 注册链接 =====
    registerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 16,
    },
    registerText: {
      fontSize: 13,
      color: tk.text.secondary,
    },
    registerLink: {
      fontSize: 13,
      fontWeight: '500',
      color: tk.brand.DEFAULT,
    },
    // ===== 第三方登录区 =====
    thirdPartyArea: {
      marginTop: 20,
    },
    // "或"分隔线:左右细线 + 中间文字(对齐 web or-divider)
    thirdPartyDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
    },
    thirdPartyDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: tk.border.light,
    },
    thirdPartyDividerText: {
      fontSize: 12,
      color: tk.text.tertiary,
      marginHorizontal: 12,
    },
    thirdPartyTitle: {
      fontSize: 12,
      color: tk.text.tertiary,
      textAlign: 'center',
      marginBottom: 16,
    },
    // 4 列网格:8 个按钮整齐排成 2 行(33% → 25%,避免末行 2 个按钮偏移)
    thirdPartyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    thirdPartyBtn: {
      width: '25%',
      paddingVertical: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thirdPartyBtnDisabled: {
      opacity: 0.5,
    },
    thirdPartyIconText: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      textAlign: 'center',
      lineHeight: 42,
      overflow: 'hidden',
    },
    // ===== QR tab =====
    qrContainer: {
      alignItems: 'center',
      paddingVertical: 16,
      gap: 12,
    },
    qrBox: {
      width: 200,
      height: 200,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
    },
    qrPlaceholderText: {
      fontSize: 13,
      color: tk.text.tertiary,
    },
    qrStatusText: {
      fontSize: 13,
      color: tk.text.secondary,
      textAlign: 'center',
    },
    qrRefreshBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: surface,
    },
    qrRefreshText: {
      fontSize: 13,
      fontWeight: '500',
      color: tk.text.primary,
    },
  })
}
