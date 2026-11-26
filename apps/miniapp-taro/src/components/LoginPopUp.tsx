// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import LineIcon from '@/components/LineIcon'
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
  LOGIN_POPUP_SHEET_PADDING_TOP_PX,
  LOGIN_POPUP_DRAG_BAR_WIDTH_PX,
  LOGIN_POPUP_DRAG_BAR_HEIGHT_PX,
  LOGIN_POPUP_DRAG_BAR_MARGIN_BOTTOM_PX,
  LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX,
  LOGIN_POPUP_CLOSE_ICON_FONT_PX,
  LOGIN_POPUP_CLOSE_INSET_PX,
  LOGIN_POPUP_TITLE_MARGIN_BOTTOM_PX,
  LOGIN_POPUP_DESC_MARGIN_BOTTOM_PX,
  LOGIN_POPUP_ICON_BADGE_SIZE_PX,
  LOGIN_POPUP_ICON_BADGE_MARGIN_RIGHT_PX,
  LOGIN_POPUP_ICON_GLYPH_FONT_PX,
  LOGIN_POPUP_AGREEMENT_FONT_PX,
  LOGIN_POPUP_AGREEMENT_GAP_PX,
  LOGIN_POPUP_CHECKBOX_SIZE_PX,
  LOGIN_POPUP_AGREEMENT_MARK_PX,
  LOGIN_POPUP_NOTE_FONT_PX,
  LOGIN_POPUP_NOTE_MARGIN_TOP_PX,
  LOGIN_POPUP_FOOTER_MARGIN_TOP_PX,
  LOGIN_POPUP_FOOTER_GAP_PX,
  LOGIN_POPUP_SECONDARY_BUTTON_MARGIN_BOTTOM_PX,
} from '@ihui/shared/ui/login-popup-spec'
import { onToast } from '@/host/on-toast'

/**
 * LoginPopUp 登录弹窗 — 对齐 mobile-rn 端底部抽屉形态(2026-11-26 机主定档)。
 *
 * 承载形态:两端统一为**底部抽屉** —— 拖拽条在顶、右上 × 关闭、卡整宽贴底、
 * 圆角只上方。此前小程序是居中弹窗(底部整宽文字关闭 + 300 宽上限),RN 是底部抽屉;
 * 本票把小程序对齐到 RN 的 sheet 承载,几何档共用 @ihui/shared/ui/login-popup-spec
 * (逐档裁决见该文件头注)。这是一次真收敛:小程序端真实渲染拖拽条/×/图标徽标/协议行/
 * hint 行/footer,原"仅 RN 引用"的那些档两端都取数,不再是单端分叉。
 *
 * Passkey(WebAuthn)平台豁免(G-874 / AGENTS §9):小程序无 WebAuthn,不提供 Passkey 入口;
 * web 入口在 packages/ui-react 的 login-form(passkey-login-button)。
 *
 * 含:遮罩 + 抽屉主体 + 拖拽条 + 右上关闭 + 头像选择 + 昵称输入 + 图标徽标 +
 * 角色显示(普通用户/会员/操盘手) + 升级按钮 + 微信一键登录 + 网页授权登录 +
 * 密码登录兜底 + 协议勾选 + 资料操作 footer。
 *
 * 角色判定(对齐原项目 loginPopUp/index.vue line 35-39):
 * - isVip==0 && identityTypy==0 → 普通用户
 * - isVip==1 && identityTypy==0 → 会员
 * - isVip==1 && identityTypy==1 → 操盘手
 * 升级按钮仅 isVip===0 && identityTypy===0 显示。identityTypy 保留原项目拼写(后端契约)。
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
  /** 一键登录回调(微信手机号登录):传入 loginCode(Taro.login code)+ phoneCode(onGetPhoneNumber e.detail.code)。 */
  onOneClickLogin?: (result: { loginCode: string; phoneCode: string }) => Promise<void>
  /**
   * 账号密码兜底回调 —— 只在微信手机号一键验证拿不到时给退路用。传入才渲染「密码登录」这一格。
   */
  onPasswordLogin?: (account: string, password: string) => Promise<void>
  /**
   * 网页授权登录回调(G-957)—— 导航由宿主页(pages/user)接管,本组件只回调。
   */
  onWebAuthLogin?: () => void
  /** 协议勾选态(受控;与 RN 端 agreeChecked 同槽)。传入 onAgreeChange 才渲染协议行。 */
  agreeChecked?: boolean
  /** 协议勾选变化回调(受控回传新的勾选态)。 */
  onAgreeChange?: (checked: boolean) => void
  // ===== 与 RN 端同名同义的授权卡 / 资料操作槽位(传入即渲染,不传零增量)=====
  title?: string
  description?: string
  primaryLabel?: string
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  onBindPhone?: () => void
  onSave?: (payload: LoginPopUpSavePayload) => void
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

  const showUpgrade = isNormal

  const handleNicknameInput = (e: { detail: { value?: string } }) => {
    const val = e.detail.value ?? ''
    setNickname(val)
    onNicknameChange?.(val)
  }

  /** 行首图标徽标:与 RN ProfileForm 的 User/BadgeCheck/Phone 同槽,两端共用尺寸档。 */
  const badge = (name: 'user' | 'shield-check' | 'phone') => (
    <View
      className="flex items-center justify-center rounded-2xl border border-solid border-[var(--color-border)]"
      style={{
        width: toUnit(LOGIN_POPUP_ICON_BADGE_SIZE_PX),
        height: toUnit(LOGIN_POPUP_ICON_BADGE_SIZE_PX),
        marginRight: toUnit(LOGIN_POPUP_ICON_BADGE_MARGIN_RIGHT_PX),
        flexShrink: 0,
      }}
    >
      <LineIcon
        name={name}
        size={LOGIN_POPUP_ICON_GLYPH_FONT_PX}
        color="var(--color-muted-foreground)"
      />
    </View>
  )

  return (
    <View className="fixed inset-0 z-[1500] flex items-end" onClick={onClose}>
      {/* 遮罩层 */}
      <View className="absolute inset-0 bg-[var(--color-black-50)]" />
      {/* 抽屉主体 = 角色档 panel → xl(12);圆角只上方,贴底整宽(对齐 RN sheet)。 */}
      <View
        className="relative w-full bg-card ui-panel rounded-t-xl"
        style={{
          paddingTop: toUnit(LOGIN_POPUP_SHEET_PADDING_TOP_PX),
          paddingLeft: toUnit(LOGIN_POPUP_CARD_PADDING_X_PX),
          paddingRight: toUnit(LOGIN_POPUP_CARD_PADDING_X_PX),
          paddingBottom: toUnit(LOGIN_POPUP_CARD_PADDING_BOTTOM_PX),
        }}
        onClick={(e) => e.stopPropagation()}
        hoverClass="opacity-60"
      >
        {/* 拖拽条(对齐 RN dragBar;尺寸走共享档) */}
        <View
          className="mx-auto rounded-2xl"
          style={{
            width: toUnit(LOGIN_POPUP_DRAG_BAR_WIDTH_PX),
            height: toUnit(LOGIN_POPUP_DRAG_BAR_HEIGHT_PX),
            background: 'var(--color-border)',
            marginBottom: toUnit(LOGIN_POPUP_DRAG_BAR_MARGIN_BOTTOM_PX),
          }}
        />
        {/* 右上 × 关闭(矢量 LineIcon,与 RN lucide X 同槽) */}
        <View
          className="absolute flex items-center justify-center"
          style={{
            top: toUnit(LOGIN_POPUP_CLOSE_INSET_PX),
            right: toUnit(LOGIN_POPUP_CLOSE_INSET_PX),
            width: toUnit(LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX),
            height: toUnit(LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX),
          }}
          ariaRole="button"
          ariaLabel={tt('common.close', '关闭')}
          hoverClass="opacity-60"
          onClick={onClose}
        >
          <LineIcon
            name="x"
            size={LOGIN_POPUP_CLOSE_ICON_FONT_PX}
            color="var(--color-muted-foreground)"
          />
        </View>

        {/* 授权卡标题/描述(RN 授权卡模式;缺省不渲染,不影响现有调用点) */}
        {title ? (
          <Text
            className="font-semibold text-foreground text-center block"
            style={{
              fontSize: toUnit(LOGIN_POPUP_TITLE_FONT_PX),
              marginBottom: toUnit(LOGIN_POPUP_TITLE_MARGIN_BOTTOM_PX),
            }}
          >
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text
            className="text-muted-foreground text-center block"
            style={{
              fontSize: toUnit(LOGIN_POPUP_BODY_FONT_PX),
              marginBottom: toUnit(LOGIN_POPUP_DESC_MARGIN_BOTTOM_PX),
            }}
          >
            {description}
          </Text>
        ) : null}
        {/* 授权卡主/次按钮(RN 授权卡模式;缺省不渲染) */}
        {onPrimary ? (
          <View
            className="w-full bg-primary rounded-md flex items-center justify-center"
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
            className="w-full rounded-md border border-border flex items-center justify-center"
            style={{
              height: toUnit(LOGIN_POPUP_BUTTON_HEIGHT_PX),
              marginBottom: toUnit(LOGIN_POPUP_SECONDARY_BUTTON_MARGIN_BOTTOM_PX),
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

        {/* 头像区:圆角头像(头像豁免) */}
        <View
          className="flex flex-col items-center"
          style={{ marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX) }}
        >
          <Button
            ariaLabel={tt('profileEdit.avatarTip', '点击更换头像')}
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
            className="!bg-transparent !border-none rounded-md overflow-hidden"
            style={{
              padding: 0,
              width: toUnit(LOGIN_POPUP_AVATAR_BOX_PX),
              height: toUnit(LOGIN_POPUP_AVATAR_BOX_PX),
            }}
          >
            <Image
              src={avatar || defaultAvatar}
              mode="aspectFill"
              className="rounded-2xl bg-muted border border-stroke-selected"
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

        {/* 昵称输入(带行首图标徽标) */}
        <View
          className="flex items-center rounded-md border border-solid border-[var(--color-border)]"
          style={{
            height: toUnit(LOGIN_POPUP_ROW_HEIGHT_PX),
            paddingLeft: toUnit(LOGIN_POPUP_ROW_PADDING_X_PX),
            paddingRight: toUnit(LOGIN_POPUP_ROW_PADDING_X_PX),
            marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
          }}
        >
          {badge('user')}
          <FocusInput
            value={nickname}
            placeholder={tt('user.profile.nicknamePlaceholder', '请输入用户名')}
            maxlength={20}
            onInput={handleNicknameInput}
            className="w-full bg-transparent text-foreground"
            style={{
              fontSize: toUnit(LOGIN_POPUP_BODY_FONT_PX),
            }}
          />
        </View>
        {/* 昵称长度 hint(对齐 RN hintText;共享字号档) */}
        <Text
          className="block text-muted-foreground"
          style={{
            fontSize: toUnit(LOGIN_POPUP_NOTE_FONT_PX),
            marginTop: toUnit(LOGIN_POPUP_NOTE_MARGIN_TOP_PX),
            marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
          }}
        >
          {tt('uiText.nicknameLengthHint', '2-16 个字符')}
        </Text>

        {/* 角色显示 + 升级按钮(带行首图标徽标) */}
        <View
          className="flex items-center rounded-md border border-solid border-[var(--color-border)]"
          style={{
            height: toUnit(LOGIN_POPUP_ROW_HEIGHT_PX),
            paddingLeft: toUnit(LOGIN_POPUP_ROW_PADDING_X_PX),
            paddingRight: toUnit(LOGIN_POPUP_ROW_PADDING_X_PX),
            marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
          }}
        >
          {badge('shield-check')}
          <Text
            className={`flex-1 font-medium ${roleClass}`}
            style={{ fontSize: toUnit(LOGIN_POPUP_BODY_FONT_PX) }}
          >
            {roleText}
          </Text>
          {showUpgrade ? (
            <View
              className="bg-warning rounded-md flex items-center justify-center"
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
          ) : null}
        </View>

        {/* 微信一键登录 Button(openType="getPhoneNumber" 仅微信小程序端生效)。 */}
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
            className="w-full px-lg rounded-md !border-none text-center"
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

        {/* 网页授权登录(G-957):一行收起入口,点一下由宿主页打开 web 中转页。 */}
        {onWebAuthLogin ? (
          <View
            style={{ marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX) }}
            onClick={onWebAuthLogin}
            hoverClass="opacity-60"
          >
            <Text
              className="text-label text-muted-foreground"
              style={{
                lineHeight: toUnit(LOGIN_POPUP_ROW_HEIGHT_PX),
                fontSize: toUnit(LOGIN_POPUP_NOTE_FONT_PX),
              }}
            >
              {tt('login.webAuthLogin', '网页授权登录')}
            </Text>
          </View>
        ) : null}

        {/* 账号密码兜底:默认收起成一行文字入口,点开才出字段。 */}
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
                      className="text-label text-muted-foreground"
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
                  className="w-full px-lg rounded-md !border-none text-center"
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
                className="text-label text-muted-foreground"
                style={{
                  lineHeight: toUnit(LOGIN_POPUP_ROW_HEIGHT_PX),
                  fontSize: toUnit(LOGIN_POPUP_NOTE_FONT_PX),
                }}
                onClick={() => setPwdOpen(true)}
              >
                {tt('login.passwordLogin', '密码登录')}
              </Text>
            )}
          </View>
        ) : null}

        {/* 用户协议勾选(受控;传入 onAgreeChange 才渲染)。勾选框内用矢量 LineIcon check。 */}
        {onAgreeChange ? (
          <View
            className="w-full flex items-center justify-center"
            style={{
              marginBottom: toUnit(LOGIN_POPUP_SECTION_GAP_PX),
              gap: toUnit(LOGIN_POPUP_AGREEMENT_GAP_PX),
            }}
            onClick={() => onAgreeChange(!agreeChecked)}
            hoverClass="opacity-60"
          >
            <View
              className="flex items-center justify-center rounded-md border border-solid"
              style={{
                width: toUnit(LOGIN_POPUP_CHECKBOX_SIZE_PX),
                height: toUnit(LOGIN_POPUP_CHECKBOX_SIZE_PX),
                borderColor: agreeChecked ? 'var(--color-primary)' : 'var(--color-border)',
                background: agreeChecked ? 'var(--color-primary)' : 'transparent',
              }}
            >
              {agreeChecked ? (
                <LineIcon
                  name="check"
                  size={LOGIN_POPUP_AGREEMENT_MARK_PX}
                  color="var(--color-primary-foreground)"
                />
              ) : null}
            </View>
            <Text
              className="text-muted-foreground"
              style={{ fontSize: toUnit(LOGIN_POPUP_AGREEMENT_FONT_PX) }}
            >
              {tt('login.agreement', '登录即代表同意《用户协议》和《隐私政策》')}
            </Text>
          </View>
        ) : null}

        {/* 资料操作 footer(保存 / 绑定手机 / 登出) */}
        {onSave || onBindPhone || onLogout ? (
          <View
            className="w-full flex items-center"
            style={{
              gap: toUnit(LOGIN_POPUP_FOOTER_GAP_PX),
              marginTop: toUnit(LOGIN_POPUP_FOOTER_MARGIN_TOP_PX),
            }}
          >
            {onSave ? (
              <View
                className="flex-1 bg-primary rounded-md flex items-center justify-center"
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
                className="flex-1 rounded-md border border-border flex items-center justify-center"
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
                className="flex-1 rounded-md border border-border flex items-center justify-center"
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
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
