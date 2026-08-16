import { View, Text, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useUserStore } from '@/stores/user'
import { sendSmsCode, loginBySms, loginByPassword } from '@/api'
import { getSsoLoginUrl } from '@/utils/sso'
import { useI18n, useTt } from '@/i18n'
import { useLoginForm, type LoginApiResult, type LoginUser } from '@ihui/shared/hooks'
import { credentialStorage } from '@/lib/credential-storage'
import type { UserInfo } from '@/utils/auth'
import PhoneAreaCodePicker from '@/components/PhoneAreaCodePicker'
import PasswordVisibilityToggle from '@/components/PasswordVisibilityToggle'
import AuthButton from '@/components/AuthButton'
import LoginPopUp from '@/components/LoginPopUp'
import './login.css'

export default function Login() {
  const { t } = useI18n()
  const tt = useTt()
  const { setAuth } = useUserStore()
  const [loginType, setLoginType] = useState<'phone' | 'password'>('phone')

  // 视觉状态:区号 / 密码可见性 / 输入框聚焦 / 协议勾选(对齐 login.vue)
  const [phoneHead, setPhoneHead] = useState('+86')
  const [showPwd, setShowPwd] = useState(false)
  const [isPhoneFocused, setIsPhoneFocused] = useState(false)
  const [isCodeFocused, setIsCodeFocused] = useState(false)
  const [isPwdFocused, setIsPwdFocused] = useState(false)
  const [isAccountFocused, setIsAccountFocused] = useState(false)
  const [isChecked, setIsChecked] = useState(false)

  // 登录成功后的角色展示弹窗(可选增强,LoginPopUp)
  const [showLoginPopUp, setShowLoginPopUp] = useState(false)
  const [popupUser, setPopupUser] = useState<UserInfo | null>(null)

  // ===== 短信验证码登录状态(保持现状,未接入 useLoginForm) =====
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isSmsLogging, setIsSmsLogging] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const codeBtnText = useMemo(
    () =>
      countdown > 0
        ? `${countdown}${tt('login.codeCountdownSuffix', '秒后重新获取')}`
        : tt('login.sendCode', '发送验证码'),
    [countdown, tt],
  )
  const codeBtnDisabled = useMemo(() => countdown > 0 || phone.length !== 11, [countdown, phone])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function sendCode() {
    if (codeBtnDisabled) return
    try {
      await sendSmsCode(phone)
      Taro.showToast({ title: t('login.codeSent'), icon: 'success' })
      setCountdown(60)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1 && timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return prev <= 1 ? 0 : prev - 1
        })
      }, 1000)
    } catch {
      // 错误已由 request 统一提示
    }
  }

  // ===== 短信验证码登录(逻辑保持不变,仅从原 handleLogin 拆出 phone 分支) =====
  async function handleSmsLogin() {
    if (isSmsLogging) return
    if (phone.length !== 11) {
      Taro.showToast({ title: t('login.phoneInvalid'), icon: 'none' })
      return
    }
    setIsSmsLogging(true)
    try {
      const res = await loginBySms(phone, code)
      setAuth(res.accessToken, res.user, res.refreshToken)
      // 登录成功:弹出角色展示弹窗(可选增强),关闭后再跳首页
      setPopupUser(res.user ?? null)
      setShowLoginPopUp(true)
    } catch {
      // 错误已统一提示
    } finally {
      setIsSmsLogging(false)
    }
  }

  // ===== 密码登录:用 @ihui/shared useLoginForm 替代本地 useState + handleLogin =====
  const lastLoginUserRef = useRef<UserInfo | undefined>(undefined)

  const loginApi = useCallback(
    async (account: string, password: string): Promise<LoginApiResult> => {
      try {
        const res = await loginByPassword(account, password)
        lastLoginUserRef.current = res.user
        const user: LoginUser | undefined = res.user
          ? {
              id: String(res.user.id ?? ''),
              nickname: res.user.nickname ?? '',
              avatar: res.user.avatar,
            }
          : undefined
        return {
          success: true,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          user,
        }
      } catch {
        return { success: false, error: '' }
      }
    },
    [],
  )

  const handlePasswordLoginSuccess = useCallback(
    (accessToken: string, refreshToken: string, user?: LoginUser) => {
      const fullUser: UserInfo | undefined = lastLoginUserRef.current ?? user
      if (fullUser) {
        setAuth(accessToken, fullUser, refreshToken)
      }
    },
    [setAuth],
  )

  const handlePasswordSuccess = useCallback(() => {
    // 登录成功:弹出角色展示弹窗(可选增强),关闭后再跳首页
    setPopupUser(lastLoginUserRef.current ?? null)
    setShowLoginPopUp(true)
  }, [])

  const form = useLoginForm({
    loginApi,
    storage: credentialStorage,
    onLoginSuccess: handlePasswordLoginSuccess,
    onSuccess: handlePasswordSuccess,
  })

  useEffect(() => {
    if (form.error) {
      Taro.showToast({ title: t(form.error), icon: 'none' })
    }
  }, [form.error, t])

  const isLogging = loginType === 'phone' ? isSmsLogging : form.loading

  function handleLoginClick() {
    if (isLogging) return
    if (loginType === 'phone') {
      void handleSmsLogin()
    } else {
      void form.login()
    }
  }

  function handleWechatLogin() {
    if (process.env.TARO_ENV === 'weapp' || process.env.TARO_ENV === 'alipay') {
      setIsSmsLogging(true)
      useUserStore
        .getState()
        .loginByMiniApp({ withProfile: false })
        .then(() => {
          Taro.showToast({ title: t('login.loginSuccess'), icon: 'success' })
          setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 600)
        })
        .catch(() => {
          Taro.showToast({ title: t('login.wechatFailed'), icon: 'none' })
        })
        .finally(() => setIsSmsLogging(false))
    } else {
      Taro.showToast({ title: t('login.wechatOnly'), icon: 'none' })
    }
  }

  function handleSsoLogin() {
    const redirectUri = 'ihui-miniapp://sso/callback'
    const ssoUrl = getSsoLoginUrl(redirectUri)
    const encoded = encodeURIComponent(ssoUrl)
    Taro.navigateTo({ url: `/pages/webview/index?url=${encoded}` })
  }

  // phone 输入框:phone 模式绑定本地 state,password 模式绑定 form.account
  const accountValue = loginType === 'phone' ? phone : form.account
  const onAccountInput = (e: { detail: { value: string } }) =>
    loginType === 'phone' ? setPhone(e.detail.value) : form.setAccount(e.detail.value)

  // identityTypy 不在 UserInfo 类型中,用交叉类型 + typeof 守卫安全读取(禁 any)
  const popupUserExt = popupUser as (UserInfo & { identityTypy?: unknown }) | null
  const popupIdentityTypy =
    typeof popupUserExt?.identityTypy === 'number' ? popupUserExt.identityTypy : 0

  return (
    <View className="container-ali">
      <View className="container1">
        <Image className="bg-image" src="/static/images/loginbackk.png" mode="aspectFill" />
        <View className="container-box">
          {/* 顶部 logo + 标题图 */}
          <View className="top_box">
            <View className="logobox">
              <Image className="logo" src="/static/images/sqlogo.svg" mode="aspectFit" />
            </View>
            <View className="titlebox">
              <Image
                className="titlebox-image"
                src="/static/images/loginengtexta.png"
                mode="aspectFit"
              />
              <Image
                className="titlebox-image1"
                src="/static/images/loginzhtext.png"
                mode="aspectFit"
              />
            </View>
          </View>

          <View className="center_box">
            {/* tab 切换:手机号验证码登录 / 手机号密码登录 */}
            <View className="select-box-above-input">
              <View className="login-type-tabs">
                <View
                  className={`login-type-tab ${loginType === 'phone' ? 'login-type-tab-active' : ''}`}
                  onClick={() => setLoginType('phone')}
                >
                  <Text>{tt('login.smsTab', '手机号验证码登录')}</Text>
                </View>
                <View
                  className={`login-type-tab ${loginType === 'password' ? 'login-type-tab-active' : ''}`}
                  onClick={() => setLoginType('password')}
                >
                  <Text>{tt('login.passwordTab', '手机号密码登录')}</Text>
                </View>
              </View>
            </View>

            {/* 手机号输入框(phone 模式) */}
            {loginType === 'phone' ? (
              <View className="input-wbox">
                <View className={`input-nbox ${isPhoneFocused ? 'input-nbox-focused' : ''}`}>
                  <View className="input-box">
                    <View className="input-icon" />
                    <PhoneAreaCodePicker
                      value={phoneHead}
                      onChange={setPhoneHead}
                      focused={isPhoneFocused}
                    />
                    <Input
                      className="input iponeinput input-text"
                      type="number"
                      maxlength={11}
                      placeholder={tt('login.phonePlaceholder', '手机号码')}
                      placeholderStyle="color:#6B6980;font-size: 36rpx;font-weight: normal;"
                      value={accountValue}
                      onInput={onAccountInput}
                      onFocus={() => setIsPhoneFocused(true)}
                      onBlur={() => setIsPhoneFocused(false)}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* 账号输入框(password 模式) */}
            {loginType === 'password' ? (
              <View className="input-wbox">
                <View className={`input-nbox ${isAccountFocused ? 'input-nbox-focused' : ''}`}>
                  <View className="input-box">
                    <View className="input-icon" />
                    <Input
                      className="input iponeinput input-text"
                      type="text"
                      placeholder={tt('login.phonePlaceholder', '手机号码')}
                      placeholderStyle="color:#6B6980;font-size: 36rpx;font-weight: normal;"
                      value={accountValue}
                      onInput={onAccountInput}
                      onFocus={() => setIsAccountFocused(true)}
                      onBlur={() => setIsAccountFocused(false)}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* 密码输入框(password 模式)+ 忘记密码 */}
            {loginType === 'password' ? (
              <View className="input-wbox input-wbox-column">
                <View
                  className={`input-nbox ${isPwdFocused ? 'input-nbox-focused' : ''}`}
                  style={{ marginTop: '18rpx' }}
                >
                  <View className="input-box">
                    <View className="input-icon" />
                    <Input
                      className="input iponeinput input-text"
                      password={!showPwd}
                      placeholder={tt('login.passwordPlaceholder', '密码')}
                      placeholderStyle="color:#6B6980;font-size: 36rpx;font-weight: normal;"
                      value={form.password}
                      onInput={(e) => form.setPassword(e.detail.value)}
                      onFocus={() => setIsPwdFocused(true)}
                      onBlur={() => setIsPwdFocused(false)}
                    />
                    <PasswordVisibilityToggle
                      visible={showPwd}
                      onToggle={() => setShowPwd((v) => !v)}
                    />
                  </View>
                </View>
                <View className="forgot-pwd-row">
                  <Text
                    className="forgot-pwd-btn"
                    onClick={() => Taro.navigateTo({ url: '/pages/forgot-password/index' })}
                  >
                    {t('login.forgotPassword')}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* 验证码输入框(phone 模式) */}
            {loginType === 'phone' ? (
              <View className="input-wbox">
                <View
                  className={`input-nbox ${isCodeFocused ? 'input-nbox-focused' : ''}`}
                  style={{ marginTop: '18rpx' }}
                >
                  <View className="input-box">
                    <View className="input-icon" />
                    <Input
                      className="input input-text"
                      type="number"
                      maxlength={6}
                      placeholder={tt('login.codePlaceholder', '验证码')}
                      placeholderStyle="color:#6B6980;font-size: 36rpx;font-weight: normal;"
                      value={code}
                      onInput={(e) => setCode(e.detail.value)}
                      onFocus={() => setIsCodeFocused(true)}
                      onBlur={() => setIsCodeFocused(false)}
                    />
                    <View className="send-code" onClick={sendCode}>
                      <Text>{codeBtnText}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={{ height: '100rpx' }} />
          </View>

          {/* 底部:登录按钮 + 快捷登录 + 协议 */}
          <View className="bottom-section">
            <View className="bottom_box">
              <AuthButton onClick={handleLoginClick} disabled={isLogging}>
                {isLogging
                  ? tt('login.loading', '登录中…')
                  : tt('login.loginOrRegister', '登录/注册')}
              </AuthButton>

              {/* 快捷登录分割线(三段式) */}
              <View className="switch-login">
                <View className="switch-login-line" />
                <Text className="switch-login-text">{tt('login.quickLogin', '快捷登录')}</Text>
                <View className="switch-login-line" />
              </View>

              {/* 第三方登录图标:wx + alipay 占位 + google */}
              <View className="icon-all">
                <View className="icon-all-box" onClick={handleWechatLogin}>
                  <Image className="third-icon" src="/static/images/wx.svg" mode="aspectFit" />
                </View>
                <View className="icon-all-box" onClick={handleWechatLogin}>
                  <View className="third-icon" />
                </View>
                <View className="icon-all-box" onClick={handleSsoLogin}>
                  <Image className="third-icon" src="/static/images/google.svg" mode="aspectFit" />
                </View>
              </View>
            </View>

            {/* 协议勾选:自定义 checkbox + checkmark 旋转动画 */}
            <View className="bottom-agreement">
              <View className="yiyue-box" onClick={() => setIsChecked((v) => !v)}>
                <View className="custom-checkbox">
                  <View className={`checkmark ${isChecked ? 'checked' : ''}`} />
                </View>
                <Text className="arge">
                  {tt('login.agreementPrefix', '点击登录/注册按钮即视为同意')}
                  <Text className="textItem">{tt('login.privacyPolicy', '《隐私政策》')}</Text>
                  {tt('login.and', '和')}
                  <Text className="textItem">{tt('login.serviceAgreement', '《服务协议》')}</Text>
                  {tt('login.autoRegisterHint', ';未注册用户将自动创建账号')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 登录后角色展示弹窗(可选增强) */}
      <LoginPopUp
        visible={showLoginPopUp}
        userInfo={{
          nickname: popupUser?.nickname || popupUser?.userName || '',
          avatar: popupUser?.avatar || '',
          isVip: popupUser?.isVip ? 1 : 0,
          identityTypy: popupIdentityTypy,
        }}
        onClose={() => {
          setShowLoginPopUp(false)
          Taro.reLaunch({ url: '/pages/index/index' })
        }}
        onUpgrade={() => {
          setShowLoginPopUp(false)
          Taro.navigateTo({ url: '/pages/vip/index' })
        }}
      />
    </View>
  )
}
