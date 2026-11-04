// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import { TARO_RPX_PER_PX } from '@ihui/design-tokens'
import { rpx } from '@/utils/rpx'
import {
  LOGIN_POPUP_AVATAR_BOX_PX,
  LOGIN_POPUP_AVATAR_HINT_GAP_PX,
  LOGIN_POPUP_CHANGE_HINT_FONT_PX,
  LOGIN_POPUP_SECTION_GAP_PX,
  LOGIN_POPUP_ROW_HEIGHT_PX,
  LOGIN_POPUP_ROW_PADDING_X_PX,
  LOGIN_POPUP_BODY_FONT_PX,
  LOGIN_POPUP_TITLE_FONT_PX,
  LOGIN_POPUP_PILL_HEIGHT_PX,
  LOGIN_POPUP_PILL_PADDING_X_PX,
  LOGIN_POPUP_PILL_FONT_PX,
  LOGIN_POPUP_BUTTON_HEIGHT_PX,
  LOGIN_POPUP_BUTTON_FONT_PX,
  LOGIN_POPUP_CARD_PADDING_X_PX,
  LOGIN_POPUP_CARD_PADDING_BOTTOM_PX,
  LOGIN_POPUP_DIALOG_PADDING_TOP_PX,
  LOGIN_POPUP_DIALOG_MAX_WIDTH_PX,
} from '@ihui/shared/ui/login-popup-spec'
import { onToast } from '@/host/on-toast'

/**
 * LoginPopUp 登录弹窗 — 对齐原项目 loginPopUp/index.vue
 *
 * 平台特有:本端是**居中弹窗**承载 —— 顶距四边同档、靠 maxWidth 居中,关闭走底部整宽文字按钮;
 * RN 端是底部抽屉(拖拽条 + 右上 × + 授权卡),两套顶距/宽度档属承载机制差异而非取值分叉,
 * 逐档裁决与不成对理由见 @ihui/shared/ui/login-popup-spec 头注(AGENTS §3)。
 *
 * Passkey(WebAuthn)平台豁免(G-874 / AGENTS §9,小程序端豁免标注):
 * 平台独占:小程序无 WebAuthn —— 本端登录弹窗不提供 Passkey 入口,不是漏做;
 * web 入口在 packages/ui-react 的 login-form(passkey-login-button)。
 *
 * 含:遮罩 + 弹窗主体 + 头像选择 + 昵称输入 + 角色显示(普通用户/会员/操盘手) + 升级按钮
 *
 * 角色判定(对齐原项目 loginPopUp/index.vue line 35-39):
 * - isVip==0 && identityTypy==0 → 普通用户(text-muted-foreground)
 * - isVip==1 && identityTypy==0 → 会员(text-warning)
 * - isVip==1 && identityTypy==1 → 操盘手(text-primary)
 *
 * 升级按钮显示条件(对齐原项目 line 41):仅 isVip===0 && identityTypy===0 时显示。
 *
 * 注:identityTypy 字段保留原项目拼写(原项目 loginPopUp/index.vue line 35 即为 identityTypy,
 * 非 identityType),本组件沿用以保持与后端契约一致。
 */
/** 保存载荷(与 RN LoginPopUpSavePayload 同形;phone 本端走微信一键登录不暴露手动输入,故可缺省) */
export interface LoginPopUpSavePayload {
  avatar?: string
  nickname?: string
  phone?: string
}

export interface LoginPopUpProps {
  visible?: boolean
  /** 默认头像 URL */
  defaultAvatar?: string
  /** 当前用户信息 */
  userInfo?: {
    nickname?: string
    avatar?: string
    isVip?: number // 0=普通 1=VIP
    // 原项目拼写为 identityTypy,保留原拼写(不修正为 identityType)
    identityTypy?: number // 0=普通/操盘手 1=操盘手
  }
  onClose?: () => void
  onChooseAvatar?: (avatarUrl: string) => void
  onNicknameChange?: (nickname: string) => void
  onUpgrade?: () => void
  /** 一键登录回调(微信手机号登录,对齐原项目 getPhoneNumber L577-712)。
   *  传入 loginCode(Taro.login code)+ phoneCode(onGetPhoneNumber e.detail.code)。 */
  onOneClickLogin?: (result: { loginCode: string; phoneCode: string }) => Promise<void>
  /**
   * 账号密码兜底回调 —— 只在微信手机号一键验证拿不到时给退路用(未配置手机号权限、
   * 用户拒授权、或压根没开该能力的 appid)。传入才渲染「密码登录」这一格,不传弹窗里
   * 一行都不多 —— 与 `onOneClickLogin` 同一条"传入才渲染"的规矩。
   */
  onPasswordLogin?: (account: string, password: string) => Promise<void>
  /**
   * 网页授权登录回调(G-957,2026-10-26)—— 用网页端账号(含 Google 等第三方)登录
   * 小程序的通道:打开 web 中转页 /sso/login 完成授权,sso_code 经 wx.miniProgram
   * postMessage 回传、由 webview 页 onMessage 换登录态(回传腿已接管)。传入才渲染
   * 这一行,与 `onOneClickLogin`/`onPasswordLogin` 同一条"传入才渲染"的规矩;
   * 导航由宿主页(pages/user)接管,本组件不持有 webview 路由(见既有"弹窗源码
   * 不往 webview 那条死路导航"锁 —— 那条链现在有双方接管,锁的形状不变)。
   */
  onWebAuthLogin?: () => void
  /**
   * 协议勾选态(受控;与 RN 端 agreeChecked 同槽)。
   * 传入 onAgreeChange 才渲染协议行 —— 与 onOneClickLogin 同一条"传入才渲染"的规矩。
   */
  agreeChecked?: boolean
  /**
   * 协议勾选变化回调(受控回传新的勾选态)。
   * 与 RN 端 onAgreeChange 同槽;登录前的拦截由宿主页决定,组件只持有并回传态。
   */
  onAgreeChange?: (checked: boolean) => void
  // ===== 对齐 RN LoginPopUpProps 公开属性(跨端属性对齐门 285 存量收敛 · B4 块)=====
  // RN 必填项在本端暂无全部调用点,先按可选落地并标注「需后手改必填 + 补调用点」。
  /** [需后手改必填] RN 必填:弹窗标题(授权卡模式) */
  title?: string
  /** [需后手改必填] RN 必填:弹窗描述(授权卡模式) */
  description?: string
  /** [需后手改必填] RN 必填:主按钮文案(授权卡模式) */
  primaryLabel?: string
  /** [需后手改必填] RN 必填:主按钮点击(授权卡模式) */
  onPrimary?: () => void
  /** [需后手改必填] RN 必填:次按钮文案(授权卡模式) */
  secondaryLabel?: string
  /** [需后手改必填] RN 必填:次按钮点击(授权卡模式) */
  onSecondary?: () => void
  /** 绑定手机号回调(carrierLogin 运营商一键登录拿到手机号并回填后触发) */
  onBindPhone?: () => void
  /** 保存回调(待接后端保存;回传 {avatar, nickname}) */
  onSave?: (payload: LoginPopUpSavePayload) => void
  /** 登出回调(待接后端:清缓存 + reLaunch) */
  onLogout?: () => void
}

const DEFAULT_AVATAR = '/static/default-avatar.png'

/// 可见几何数字唯一源在 @ihui/shared/ui/login-popup-spec(与 RN 端同表);本文件只做 rpx 换算 + 挂 Taro 原语。
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)

export default function LoginPopUp({
  visible = false,
  defaultAvatar = DEFAULT_AVATAR,
  userInfo,
  onClose,
  onChooseAvatar,
  onNicknameChange,
  onUpgrade,
  onOneClickLogin,
  onPasswordLogin,
  onWebAuthLogin,
  agreeChecked = false,
  onAgreeChange,
  // ===== B4 块:对齐 RN 公开属性(授权卡模式 / 资料操作)=====
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onBindPhone,
  onSave,
  onLogout,
}: LoginPopUpProps) {
  const tt = useTt()

  const [nickname, setNickname] = useState<string>(userInfo?.nickname ?? '')
  const [avatar, setAvatar] = useState<string>(userInfo?.avatar ?? '')
  /** 账号密码兜底默认收起:它是退路,不是主路径,不该跟一键登录抢第一眼。 */
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdAccount, setPwdAccount] = useState('')
  const [pwdValue, setPwdValue] = useState('')
  const [pwdSubmitting, setPwdSubmitting] = useState(false)

  if (!visible) return null

  const isVip = userInfo?.isVip ?? 0
  const identityTypy = userInfo?.identityTypy ?? 0

  // 角色显示(对齐原项目 loginPopUp/index.vue line 35-39)
  const isOperator = isVip === 1 && identityTypy === 1
  const isMember = isVip === 1 && identityTypy === 0
  const isNormal = isVip === 0 && identityTypy === 0
  const roleText = isOperator
    ? tt('user.operator', '操盘手')
    : isMember
      ? tt('user.member', '会员')
      : tt('user.normalUser', '普通用户')
  const roleClass = isOperator
    ? 'text-primary'
    : isMember
      ? 'text-warning'
      : 'text-muted-foreground'

  // 升级按钮:仅 普通用户(isVip===0 && identityTypy===0) 显示(对齐原项目 line 41)
  const showUpgrade = isNormal

  // 头像选择:微信小程序用 <Button open-type="chooseAvatar"> + onChooseAvatar 事件
  // (对齐原项目 loginPopUp/index.vue 的 chooseAvatar 实现)。
  // H5 端 openType 不生效,用 Taro.chooseImage 兜底(见 Button onClick)。

  const handleNicknameInput = (e: { detail: { value?: string } }) => {
    const val = e.detail.value ?? ''
    setNickname(val)
    onNicknameChange?.(val)
  }

  return (
    <View className="fixed inset-0 z-[1500] flex items-center justify-center" onClick={onClose}>
      {/* 遮罩层 */}
      <View className="absolute inset-0 bg-[var(--color-black-50)]" />
      {/* 弹窗主体 = 角色档 panel(弹窗 / 底部弹层)→ xl(12)。旧写法在这里挂 `ui-bubble`
          并按 bubble 档取 rounded-2xl(16) —— 它是登录弹窗,不是会话流里的消息气泡,
          两端同一元素因此一档之差(守门 150 对 panel 取 2xl 判红,依据见 radius.js RADIUS_ROLES)。 */}
      <View
        className="relative bg-card ui-panel rounded-xl w-[85%]"
        style={{
          paddingTop: toUnit(LOGIN_POPUP_DIALOG_PADDING_TOP_PX),
          paddingLeft: toUnit(LOGIN_POPUP_CARD_PADDING_X_PX),
          paddingRight: toUnit(LOGIN_POPUP_CARD_PADDING_X_PX),
          paddingBottom: toUnit(LOGIN_POPUP_CARD_PADDING_BOTTOM_PX),
          maxWidth: toUnit(LOGIN_POPUP_DIALOG_MAX_WIDTH_PX),
        }}
        onClick={(e) => e.stopPropagation()}
        hoverClass="opacity-60"
      >
        {/* 授权卡标题/描述(RN 授权卡模式;本端缺省不渲染,不影响现有调用点) */}
        {title ? (
          <Text
            className="font-semibold text-foreground text-center"
            style={{
              fontSize: toUnit(LOGIN_POPUP_TITLE_FONT_PX),
              marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
            }}
          >
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text
            className="text-muted-foreground text-center"
            style={{
              fontSize: toUnit(LOGIN_POPUP_BODY_FONT_PX),
              marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
            }}
          >
            {description}
          </Text>
        ) : null}
        {/* 授权卡主/次按钮(RN 授权卡模式;缺省不渲染) */}
        {onPrimary ? (
          <View
            className="w-full bg-primary rounded-sm flex items-center justify-center"
            style={{
              height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX),
              marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
            }}
            onClick={onPrimary}
            hoverClass="opacity-60"
          >
            <Text
              className="text-primary-foreground font-medium"
              style={{ fontSize: toUnit(LOGIN_POPUP_BUTTON_FONT_PX) }}
            >
              {primaryLabel}
            </Text>
          </View>
        ) : null}
        {onSecondary ? (
          <View
            className="w-full rounded-sm border border-border flex items-center justify-center"
            style={{
              height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX),
              marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
            }}
            onClick={onSecondary}
            hoverClass="opacity-60"
          >
            <Text
              className="text-foreground font-medium"
              style={{ fontSize: toUnit(LOGIN_POPUP_BUTTON_FONT_PX) }}
            >
              {secondaryLabel}
            </Text>
          </View>
        ) : null}

        {/* 头像区:圆形头像(rounded-full 豁免,AGENTS.md §4 头像豁免) */}
        <View
          className="flex flex-col items-center"
          style={{ marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX) }}
        >
          <Button
            openType="chooseAvatar"
            onChooseAvatar={(e: { detail: { avatarUrl?: string } }) => {
              const url = e.detail.avatarUrl ?? ''
              if (url) {
                setAvatar(url)
                onChooseAvatar?.(url)
              }
            }}
            onClick={() => {
              // H5 端 openType 不生效,用 Taro.chooseImage 兜底
              if (process.env.TARO_ENV === 'h5') {
                Taro.chooseImage({
                  count: 1,
                  sizeType: ['compressed'],
                  success: (res) => {
                    const url = res.tempFilePaths[0] ?? ''
                    if (url) {
                      setAvatar(url)
                      onChooseAvatar?.(url)
                    }
                  },
                })
              }
            }}
            className="!bg-transparent !border-none rounded-sm overflow-hidden"
            style={{
              padding: 0,
              width: toUnit(LOGIN_POPUP_AVATAR_BOX_PX),
              height: toUnit(LOGIN_POPUP_AVATAR_BOX_PX),
            }}
          >
            <Image
              src={avatar || defaultAvatar}
              mode="aspectFill"
              className="rounded-2xl bg-muted border border-primary/20"
              style={{
                width: toUnit(LOGIN_POPUP_AVATAR_BOX_PX),
                height: toUnit(LOGIN_POPUP_AVATAR_BOX_PX),
              }}
            />
          </Button>
          <Text
            className="text-muted-foreground"
            style={{
              fontSize: toUnit(LOGIN_POPUP_CHANGE_HINT_FONT_PX),
              marginTop: toUnit(LOGIN_POPUP_AVATAR_HINT_GAP_PX),
            }}
          >
            {tt('user.profile.clickToChange', '点击更换头像')}
          </Text>
        </View>

        {/* 昵称输入 */}
        <View style={{ marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX) }}>
          <FocusInput
            value={nickname}
            placeholder={tt('user.profile.nicknamePlaceholder', '请输入用户名')}
            maxlength={20}
            onInput={handleNicknameInput}
            className="w-full rounded-sm bg-muted text-foreground"
            style={{
              height: toUnit(LOGIN_POPUP_ROW_HEIGHT_PX),
              paddingLeft: toUnit(LOGIN_POPUP_ROW_PADDING_X_PX),
              paddingRight: toUnit(LOGIN_POPUP_ROW_PADDING_X_PX),
              fontSize: toUnit(LOGIN_POPUP_BODY_FONT_PX),
            }}
          />
        </View>

        {/* 角色显示 + 升级按钮 */}
        <View
          className="flex items-center justify-between"
          style={{ marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX) }}
        >
          <Text
            className={`font-medium ${roleClass}`}
            style={{ fontSize: toUnit(LOGIN_POPUP_BODY_FONT_PX) }}
          >
            {roleText}
          </Text>
          {/* 「立即升级」是可点按钮(与 RN styles.upgradeButton 同一元素、同一 spec 盒档)
              ⇒ 角色 control → sm(4);旧写法 rounded-md 取的是 chip 档,同一元素两端各一档。 */}
          {showUpgrade && (
            <View
              className="bg-warning rounded-sm flex items-center justify-center"
              style={{
                height: toUnit(LOGIN_POPUP_PILL_HEIGHT_PX),
                paddingLeft: toUnit(LOGIN_POPUP_PILL_PADDING_X_PX),
                paddingRight: toUnit(LOGIN_POPUP_PILL_PADDING_X_PX),
              }}
              onClick={onUpgrade}
              hoverClass="opacity-60"
            >
              <Text
                className="text-warning-foreground"
                style={{ fontSize: toUnit(LOGIN_POPUP_PILL_FONT_PX) }}
              >
                {tt('vip.upgradeNow', '立即升级')}
              </Text>
            </View>
          )}
        </View>

        {/* 微信一键登录 Button(对齐原项目 getPhoneNumber L577-712)。
            openType="getPhoneNumber" 仅微信小程序端生效,H5 端降级为普通按钮不触发 onGetPhoneNumber。
            仅当父组件传入 onOneClickLogin 回调时渲染。 */}
        {onOneClickLogin ? (
          <Button
            openType="getPhoneNumber"
            onGetPhoneNumber={async (e) => {
              if (e.detail.errMsg !== 'getPhoneNumber:ok') {
                onToast(tt('login.cancelAuth', '取消授权'), { kind: 'info' })
                return
              }
              const phoneCode = e.detail.code
              if (!phoneCode) {
                onToast(tt('login.getPhoneFail', '获取手机号失败'), { kind: 'error' })
                return
              }
              // 获取微信 login code(对齐原项目:Taro.login → api.openId → api.getPhoneNumber)
              try {
                const loginRes = await Taro.login()
                const loginCode = loginRes.code
                if (!loginCode) {
                  onToast(tt('login.wechatFailed', '微信登录失败'), { kind: 'error' })
                  return
                }
                await onOneClickLogin({ loginCode, phoneCode })
              } catch {
                onToast(tt('login.loginFailed', '登录失败,请重试'), { kind: 'error' })
              }
            }}
            className="w-full px-4 rounded-sm !border-none text-center"
            style={{
              paddingTop: 0,
              paddingBottom: 0,
              height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX),
              background: 'var(--color-primary)',
              marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
            }}
          >
            <Text
              className="text-primary-foreground font-medium"
              style={{ fontSize: toUnit(LOGIN_POPUP_BUTTON_FONT_PX) }}
            >
              {tt('login.wechatOneClick', '微信一键登录')}
            </Text>
          </Button>
        ) : null}

        {/* 网页授权登录(G-957):用网页端账号(含 Google 等第三方)登录小程序的通道。
            与密码兜底同一退路形态:一行收起入口,点一下即由宿主页打开 web 中转页。 */}
        {onWebAuthLogin ? (
          <View
            style={{ marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX) }}
            onClick={onWebAuthLogin}
            hoverClass="opacity-60"
          >
            <Text
              className="text-xs text-muted-foreground"
              style={{ lineHeight: toUnit(LOGIN_POPUP_ROW_HEIGHT_PX) }}
            >
              {tt('login.webAuthLogin', '网页授权登录')}
            </Text>
          </View>
        ) : null}

        {/* 账号密码兜底(2026-10-23 机主定档:小程序不该有登录页,这条是"微信手机号一键验证
            拿不到"时的退路 —— 权限没开通、用户拒授权、或 appid 压根没该能力)。
            默认收起成一行文字入口,点开才出字段:它是退路,不该跟一键登录抢第一眼。
            样式全部走全局那一份(app.css 的「登录字段」块)+ Tailwind 全局 utility,
            不在这里再写一套输入框视觉。 */}
        {onPasswordLogin ? (
          <View className="w-full" style={{ marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX) }}>
            {pwdOpen ? (
              <>
                <View className="login-field">
                  <Text className="login-label">{tt('login.account', '账号')}</Text>
                  <FocusInput
                    className="login-input"
                    type="text"
                    placeholder={tt('login.accountPlaceholder', '手机号 / 邮箱 / 账号')}
                    placeholderStyle="color: var(--color-muted-foreground);font-size: 28rpx;font-weight: normal;"
                    value={pwdAccount}
                    onInput={(e) => setPwdAccount(e.detail.value)}
                  />
                </View>
                <View className="login-field">
                  <View className="login-label-row">
                    <Text className="login-label">{tt('login.password', '密码')}</Text>
                    <Text
                      className="text-xs text-muted-foreground"
                      onClick={() => Taro.navigateTo({ url: '/pages/forgot-password/index' })}
                    >
                      {tt('login.forgotPassword', '忘记密码')}
                    </Text>
                  </View>
                  <FocusInput
                    className="login-input"
                    password
                    type="text"
                    placeholder={tt('login.passwordPlaceholder', '请输入密码')}
                    placeholderStyle="color: var(--color-muted-foreground);font-size: 28rpx;font-weight: normal;"
                    value={pwdValue}
                    onInput={(e) => setPwdValue(e.detail.value)}
                  />
                </View>
                <Button
                  className="w-full px-4 rounded-sm !border-none text-center"
                  style={{
                    paddingTop: 0,
                    paddingBottom: 0,
                    height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX),
                    background: 'var(--color-primary)',
                  }}
                  hoverClass="opacity-60"
                  onClick={async () => {
                    if (pwdSubmitting) return
                    const account = pwdAccount.trim()
                    const password = pwdValue
                    if (!account || !password) {
                      onToast(tt('login.accountPlaceholder', '手机号 / 邮箱 / 账号'), {
                        kind: 'info',
                      })
                      return
                    }
                    setPwdSubmitting(true)
                    try {
                      await onPasswordLogin(account, password)
                    } catch (e) {
                      onToast(
                        e instanceof Error && e.message
                          ? e.message
                          : tt('login.loginFailed', '登录失败,请重试'),
                        { kind: 'error' },
                      )
                    } finally {
                      setPwdSubmitting(false)
                    }
                  }}
                >
                  <Text
                    className="text-primary-foreground font-medium"
                    style={{ fontSize: toUnit(LOGIN_POPUP_BUTTON_FONT_PX) }}
                  >
                    {pwdSubmitting ? tt('login.logging', '登录中…') : tt('login.login', '登录')}
                  </Text>
                </Button>
              </>
            ) : (
              <Text
                className="text-xs text-muted-foreground"
                style={{ lineHeight: toUnit(LOGIN_POPUP_ROW_HEIGHT_PX) }}
                onClick={() => setPwdOpen(true)}
              >
                {tt('login.passwordLogin', '密码登录')}
              </Text>
            )}
          </View>
        ) : null}

        {/* 用户协议勾选(受控;传入 onAgreeChange 才渲染,与 RN 端协议行同槽) */}
        {onAgreeChange ? (
          <View
            className="w-full flex items-center justify-center"
            style={{
              marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
              gap: toUnit(8),
            }}
            onClick={() => onAgreeChange(!agreeChecked)}
            hoverClass="opacity-60"
          >
            <View
              className="flex items-center justify-center rounded-full border border-solid"
              style={{
                width: toUnit(18),
                height: toUnit(18),
                borderColor: agreeChecked ? 'var(--color-primary)' : 'var(--color-border)',
                background: agreeChecked ? 'var(--color-primary)' : 'transparent',
              }}
            >
              {agreeChecked ? (
                <Text
                  className="text-primary-foreground"
                  style={{ fontSize: toUnit(12), lineHeight: toUnit(12) }}
                >
                  {'✓'}
                </Text>
              ) : null}
            </View>
            <Text className="text-xs text-muted-foreground">
              {tt('login.agreement', '登录即代表同意《用户协议》和《隐私政策》')}
            </Text>
          </View>
        ) : null}

        {/* 资料操作按钮(RN footer:保存 / 绑定手机 / 登出;缺省不渲染,不影响现有调用点) */}
        {onSave || onBindPhone || onLogout ? (
          <View
            className="w-full flex items-center"
            style={{
              gap: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
              marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
            }}
          >
            {onSave ? (
              <View
                className="flex-1 bg-primary rounded-sm flex items-center justify-center"
                style={{ height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX) }}
                onClick={() => onSave?.({ avatar, nickname })}
                hoverClass="opacity-60"
              >
                <Text
                  className="text-primary-foreground font-medium"
                  style={{ fontSize: toUnit(LOGIN_POPUP_BUTTON_FONT_PX) }}
                >
                  {tt('common.save', '保存')}
                </Text>
              </View>
            ) : null}
            {onBindPhone ? (
              <View
                className="flex-1 rounded-sm border border-border flex items-center justify-center"
                style={{ height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX) }}
                onClick={onBindPhone}
                hoverClass="opacity-60"
              >
                <Text
                  className="text-foreground font-medium"
                  style={{ fontSize: toUnit(LOGIN_POPUP_BUTTON_FONT_PX) }}
                >
                  {tt('user.bindPhone', '绑定手机')}
                </Text>
              </View>
            ) : null}
            {onLogout ? (
              <View
                className="flex-1 rounded-sm border border-border flex items-center justify-center"
                style={{ height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX) }}
                onClick={onLogout}
                hoverClass="opacity-60"
              >
                <Text
                  className="text-foreground font-medium"
                  style={{ fontSize: toUnit(LOGIN_POPUP_BUTTON_FONT_PX) }}
                >
                  {tt('common.logout', '登出')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 关闭按钮 */}
        <View
          className="w-full rounded-sm bg-muted flex items-center justify-center"
          style={{ height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX) }}
          onClick={onClose}
          hoverClass="opacity-60"
        >
          <Text
            className="text-foreground"
            style={{ fontSize: toUnit(LOGIN_POPUP_BUTTON_FONT_PX) }}
          >
            {tt('common.close', '关闭')}
          </Text>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
