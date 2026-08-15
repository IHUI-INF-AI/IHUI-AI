import { useMemo, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  Linking,
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
  QrPlatformOption,
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
  // 第三方登录图标:28×28 圆角(borderRadius 6 = rounded-md,符合圆角守门)
  // 2026-08-04 从 44×44 圆形(borderRadius 22,违反圆角守门)缩小
  thirdPartyIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  // 无图标 fallback:品牌色圆角背景 + 白色首字母(对齐 web ThirdPartyLoginButtons 视觉)
  thirdPartyFallback: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#999999',
  },
  thirdPartyFallbackText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  // QR 平台切换 tab 中的平台图标:20×20(对齐第三方登录区图标风格)
  qrPlatformIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  // QR 平台切换 tab 中的 fallback:品牌色圆角背景 + 白色首字母
  qrPlatformFallback: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#999999',
  },
  qrPlatformFallbackText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 10,
  },
  // logo 图片:44×44(2026-08-04 从 31×31 加大,提升移动端视觉层次)
  logoImage: {
    width: 44,
    height: 44,
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
  /** 手机号输入框前缀节点(区号展示,如 "+86");不传则输入框独占一行 */
  phonePrefixNode?: ReactNode
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
  /** 平台切换 tab 列表(传则渲染平台切换;不传则只显示单平台占位) */
  qrPlatforms?: QrPlatformOption[]
  /** QR 面板渲染函数(平台注入:mobile-rn 传 WebView 加载 web 端真实二维码) */
  renderQrPanel?: (platform: ThirdPartyPlatform, refreshKey: number) => ReactNode
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

/** 第三方登录区 — 自适应居中网格 + 28×28 圆角图标 + 分隔线(对齐 web ThirdPartyLoginButtons 视觉)
 * 2026-08-04 优化:删除"第三方登录"标题(冗余,分隔线"或"已足够分隔);
 * 图标从 44×44 圆形(borderRadius 22,违反圆角守门)改为 28×28 圆角(borderRadius 6,rounded-md);
 * 网格从固定 4 列百分比改为居中 flexWrap,适配不同平台登录方式数量(2/4/5 个)。 */
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
  phonePrefixNode,
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
        {phonePrefixNode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {phonePrefixNode}
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={phone}
              onChangeText={(text) => onPhoneChange?.(text.replace(/\D/g, '').slice(0, 11))}
              placeholder={t('auth.phonePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              keyboardType="number-pad"
              maxLength={11}
              textContentType="telephoneNumber"
            />
          </View>
        ) : (
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
        )}
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

/** 扫码登录(对齐 web QrTab,支持平台切换 tab + 二维码占位 + 打开网页按钮)
 * 2026-08-04 升级:从简版占位升级为平台切换 tab 设计,对齐 web 端 qr-tab.tsx。
 * - 传入 qrPlatforms:渲染 4 平台切换 tab(微信/企微/钉钉/飞书)
 * - 每个平台显示二维码占位(图标 + "请使用XX扫码登录"文案)
 * - "打开网页"按钮(跳到 web 端完成扫码,RN 端无法直接加载 SDK)
 * - 未传 qrPlatforms:降级为单平台占位(旧行为) */
function QrTabContent({ styles, tk, qrConfig, qrPlatforms, renderQrPanel }: QrTabContentProps) {
  const [activePlatform, setActivePlatform] = useState<ThirdPartyPlatform | null>(
    qrPlatforms?.[0]?.key ?? null,
  )
  // refreshKey:变化时重新渲染二维码面板(renderQrPanel 注入的 WebView 会重新加载)
  const [refreshKey, setRefreshKey] = useState(0)

  const currentPlatform = qrPlatforms?.find((p) => p.key === activePlatform) ?? qrPlatforms?.[0]
  const status: QrLoginStatus = qrConfig?.status ?? 'idle'
  const showRefresh = status === 'expired' || status === 'error' || !!renderQrPanel
  const isLoading = status === 'loading'
  const qrSource = qrConfig?.qrSource ?? null

  // 有平台列表时用平台名,否则用默认文案
  const statusText = currentPlatform
    ? `请使用${currentPlatform.label}扫码登录`
    : qrStatusText(status, qrConfig)

  // 平台切换 tab 等宽:用 flex: 1 + flexBasis: 0 + minWidth: 0
  // minWidth: 0 是关键 — RN-web/CSS flexbox 默认 min-width: auto,会被内容撑宽,
  // 设置 minWidth: 0 后 flex 子元素严格等分剩余空间,不受内容(图标+文字)影响。
  // tabCount 用于无障碍标签,不参与宽度计算。
  const tabCount = qrPlatforms?.length ?? 1
  void tabCount // 仅用于潜在的无障碍标签,不参与样式计算

  // RN 端打开 web 端扫码页面(Linking)
  const handleOpenWeb = () => {
    if (!currentPlatform?.webUrl) return
    Linking.openURL(currentPlatform.webUrl).catch(() => {})
  }

  // 有平台列表:渲染平台切换 tab + 二维码占位 + 打开网页按钮
  if (qrPlatforms && qrPlatforms.length > 0) {
    return (
      <View style={styles.qrContainer}>
        {/* 平台切换 tab(对齐 web 端 qr-tab.tsx) */}
        <View style={styles.qrPlatformTabBar}>
          {qrPlatforms.map((p) => {
            const active = p.key === activePlatform
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.qrPlatformTab, active && styles.qrPlatformTabActive]}
                onPress={() => setActivePlatform(p.key)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={p.label}
              >
                {p.iconSource ? (
                  <Image
                    source={p.iconSource}
                    style={imageStyles.qrPlatformIcon}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[
                      imageStyles.qrPlatformFallback,
                      !!p.brandColor && { backgroundColor: p.brandColor },
                    ]}
                  >
                    <Text style={imageStyles.qrPlatformFallbackText}>{p.label.charAt(0)}</Text>
                  </View>
                )}
                <Text
                  style={[styles.qrPlatformTabText, active && styles.qrPlatformTabTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* 二维码区域:优先用 renderQrPanel 渲染真实二维码(WebView),否则占位 */}
        <View style={[styles.qrBox, !renderQrPanel && !qrSource && styles.qrBoxPlaceholder]}>
          {renderQrPanel && activePlatform ? (
            renderQrPanel(activePlatform, refreshKey)
          ) : isLoading ? (
            <ActivityIndicator size="large" color={tk.brand.DEFAULT} />
          ) : qrSource ? (
            <Image source={qrSource} style={imageStyles.qrImage} resizeMode="contain" />
          ) : (
            // 占位:二维码图标(用文字模拟,避免新增依赖)
            <View style={styles.qrPlaceholderIcon}>
              <Text style={styles.qrPlaceholderIconText}>{'▦'}</Text>
            </View>
          )}
        </View>

        {/* 状态文案 */}
        <Text style={styles.qrStatusText}>{statusText}</Text>

        {/* 操作行:刷新 + 打开网页 */}
        <View style={styles.qrActionRow}>
          {showRefresh ? (
            <TouchableOpacity
              style={styles.qrRefreshBtn}
              onPress={() => {
                setRefreshKey((k) => k + 1)
                qrConfig?.onRefresh?.()
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="刷新二维码"
            >
              <Text style={styles.qrRefreshText}>{'刷新二维码'}</Text>
            </TouchableOpacity>
          ) : null}
          {currentPlatform?.webUrl ? (
            <TouchableOpacity
              style={styles.qrOpenWebBtn}
              onPress={handleOpenWeb}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="打开网页扫码"
            >
              <Text style={styles.qrOpenWebText}>{'打开网页扫码'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    )
  }

  // 无平台列表:降级为单平台占位(旧行为)
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
      <Text style={styles.qrStatusText}>{qrStatusText(status, qrConfig)}</Text>
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
    phonePrefixNode,
    onPhoneChange,
    onPhoneCodeChange,
    onSendPhoneCode,
    onLoginByPhoneCode,
    // qr
    qrConfig,
    qrPlatforms,
    renderQrPanel,
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
            phonePrefixNode={phonePrefixNode}
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

        {activeTab === 'qr' ? (
          <QrTabContent
            styles={styles}
            tk={tk}
            qrConfig={qrConfig}
            qrPlatforms={qrPlatforms}
            renderQrPanel={renderQrPanel}
          />
        ) : null}

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
  // uniapp 输入框风格:浅色 #f5f5f5 底 + #eaeaea 边框(对齐 D 盘 Ai-WXMiniVue 登录页);深色沿用 surface.card
  const inputBg = colorScheme === 'dark' ? tk.surface.card : '#f5f5f5'
  const inputBorder = colorScheme === 'dark' ? tk.border.medium : '#eaeaea'
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: surface,
      paddingHorizontal: 16,
      justifyContent: 'flex-start',
    },
    // 移动端登录页应为全屏表单,非 web 端"居中悬浮卡片":无 maxWidth/圆角/边框/阴影
    card: {
      width: '100%',
      paddingVertical: 28,
      backgroundColor: surface,
    },
    header: {
      // 移动端一行并排:logo 44 + 欢迎图(≤224) + gap 12 = 280 < 288 屏幕可用宽,不超出
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 24,
    },
    // logoBox fallback:44×44(2026-08-04 从 31×31 加大,与 logoImage 同步)
    logoBox: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImage: {
      width: 44,
      height: 44,
      borderRadius: 8,
    },
    logoText: {
      color: onBrandText,
      fontSize: 14,
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
      height: 50,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 16,
      color: tk.text.primary,
      backgroundColor: inputBg,
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
      height: 50,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: inputBorder,
      backgroundColor: inputBg,
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
      height: 50,
      borderRadius: 15,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginBtnText: {
      color: onBrandText,
      fontSize: 16,
      fontWeight: '600',
    },
    btnDisabled: {
      opacity: 0.6,
    },
    // ===== SSO 按钮 =====
    ssoBtn: {
      height: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: inputBorder,
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
    // 2026-08-04:删除 thirdPartyTitle(冗余,分隔线"或"已足够分隔)
    // 自适应居中网格:不同平台登录方式数量不同(国内安卓4/国内iOS5/国际版2),
    // 用 justifyContent center + gap 让按钮居中排列,自动换行
    thirdPartyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 16,
    },
    // 按钮容器:固定宽度 44(适配 28×28 图标 + padding),不再用百分比
    thirdPartyBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thirdPartyBtnDisabled: {
      opacity: 0.5,
    },
    thirdPartyIconText: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 11,
      fontWeight: '600',
      color: tk.text.primary,
      textAlign: 'center',
      lineHeight: 26,
      overflow: 'hidden',
    },
    // ===== QR tab =====
    qrContainer: {
      alignItems: 'center',
      paddingVertical: 16,
      gap: 12,
    },
    qrBox: {
      width: 280,
      height: 280,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      // renderQrPanel 注入时由 iframe/WebView 自己渲染二维码面板(含边框/背景);
      // 未注入时由 qrBoxPlaceholder 提供 dashed border + 浅灰背景(条件应用)。
    },
    // 占位状态专用样式(未注入 renderQrPanel 时应用):dashed border + 浅灰背景
    qrBoxPlaceholder: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
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
    // ===== QR 平台切换 tab(2026-08-04 新增,对齐 web 端 qr-tab.tsx) =====
    // web 端:grid grid-cols-4 gap-1.5 rounded-md border bg-muted/40 p-1
    // RN 端:flexDirection row + 全宽 + 边框 + 浅灰背景 + padding 4
    // 注意:不用 gap,改用 marginRight 在 tab 间留白(最后一个 tab 不加 marginRight),
    // 避免 gap 占用宽度导致 width: 25% × 4 + gap × 3 超出 100%
    qrPlatformTabBar: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    // web 端默认态:rounded-[4px] px-2 py-1.5 text-xs text-muted-foreground(无边框无背景)
    // 用 flex: 1 + flexBasis: 0 + minWidth: 0 强制等宽
    // minWidth: 0 是关键 — RN-web/CSS flexbox 默认 min-width: auto,会被内容撑宽,
    // 设置 minWidth: 0 后 flex 子元素严格等分剩余空间,不受内容(图标+文字)影响
    qrPlatformTab: {
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: 4,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    // web 端激活态:bg-card text-foreground shadow-sm(白色卡片背景 + 阴影,非品牌色)
    qrPlatformTabActive: {
      backgroundColor: tk.surface.light,
      // iOS shadow(对齐 web shadow-sm)
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      // Android elevation
      elevation: 2,
    },
    qrPlatformTabText: {
      fontSize: 12,
      color: tk.text.tertiary,
      flexShrink: 1,
    },
    // web 端激活文字:text-foreground font-medium(主文字色,非白色)
    qrPlatformTabTextActive: {
      color: tk.text.primary,
      fontWeight: '500',
    },
    // QR 二维码占位图标(无真实二维码时显示)
    qrPlaceholderIcon: {
      width: 80,
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrPlaceholderIconText: {
      fontSize: 56,
      color: tk.text.tertiary,
    },
    // QR 操作行:刷新 + 打开网页
    qrActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    qrOpenWebBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.brand.DEFAULT,
    },
    qrOpenWebText: {
      fontSize: 13,
      fontWeight: '500',
      color: onBrandText,
    },
  })
}
