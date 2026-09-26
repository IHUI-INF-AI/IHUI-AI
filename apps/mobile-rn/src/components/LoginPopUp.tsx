// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LoginPopUp 登录弹窗 (mobile-rn 端)
 *
 * 复刻自 uniapp `src/components/loginPopUp/index.vue`,保留原通用授权卡契约,
 * 并补齐头像/昵称/角色/手机号/保存/登出等业务功能(对齐原 vue 组件)。
 *
 * 两种形态:
 * 1. 通用授权卡(默认,不传业务 props 时):标题 + 描述 + 主/次按钮 + 协议勾选。
 * 2. 资料编辑卡(传入头像/昵称/角色/手机号/保存/登出等任一业务 props 时):
 *    头像展示 + 更换、昵称输入(中英文校验)、角色展示(普通/会员/操盘手)、
 *    升级入口、手机号展示 + 绑定、保存/登出。
 *
 * Props(保留原有契约,新增均为可选):
 * - visible / title / description:弹窗显示、标题与描述
 * - primaryLabel + onPrimary:主按钮
 * - secondaryLabel + onSecondary:次按钮
 * - onClose:关闭回调
 * - agreeChecked? / onAgreeChange?:协议勾选
 * - avatarUrl? / nickname? / role? / phone? / phoneDisabled?:资料数据
 * - onChooseAvatar?:头像上传回调(待接后端/微信 SDK chooseAvatar)
 * - onBindPhone?:手机号绑定回调(carrierLogin 运营商一键登录拿到手机号并回填后触发)
 * - onSave?:保存回调(待接后端保存)
 * - onLogout?:登出回调(待接后端:清缓存 + reLaunch)
 * - onUpgrade? / onUpgradeTrader?:升级入口回调(跳会员/操盘手介绍弹窗)
 */
import { tokens } from '../theme/active-tokens'
import { withAlpha, rnRadius } from '@ihui/design-tokens'
import {
  LOGIN_POPUP_AVATAR_BOX_PX,
  LOGIN_POPUP_AVATAR_HINT_GAP_PX,
  LOGIN_POPUP_BUTTON_FONT_PX,
  LOGIN_POPUP_BUTTON_HEIGHT_PX,
  LOGIN_POPUP_CARD_PADDING_BOTTOM_PX,
  LOGIN_POPUP_CARD_PADDING_X_PX,
  LOGIN_POPUP_CHANGE_HINT_FONT_PX,
  LOGIN_POPUP_CHECKBOX_SIZE_PX,
  LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX,
  LOGIN_POPUP_CLOSE_ICON_FONT_PX,
  LOGIN_POPUP_CLOSE_ICON_LINE_HEIGHT_PX,
  LOGIN_POPUP_CLOSE_INSET_PX,
  LOGIN_POPUP_DESC_MARGIN_BOTTOM_PX,
  LOGIN_POPUP_DRAG_BAR_HEIGHT_PX,
  LOGIN_POPUP_DRAG_BAR_MARGIN_BOTTOM_PX,
  LOGIN_POPUP_DRAG_BAR_WIDTH_PX,
  LOGIN_POPUP_FOOTER_GAP_PX,
  LOGIN_POPUP_FOOTER_MARGIN_TOP_PX,
  LOGIN_POPUP_ICON_BADGE_MARGIN_RIGHT_PX,
  LOGIN_POPUP_ICON_BADGE_SIZE_PX,
  LOGIN_POPUP_ICON_GLYPH_FONT_PX,
  LOGIN_POPUP_AGREEMENT_FONT_PX,
  LOGIN_POPUP_AGREEMENT_GAP_PX,
  LOGIN_POPUP_AGREEMENT_MARK_PX,
  LOGIN_POPUP_NOTE_FONT_PX,
  LOGIN_POPUP_NOTE_MARGIN_TOP_PX,
  LOGIN_POPUP_PILL_FONT_PX,
  LOGIN_POPUP_PILL_HEIGHT_PX,
  LOGIN_POPUP_PILL_PADDING_X_PX,
  LOGIN_POPUP_ROW_HEIGHT_PX,
  LOGIN_POPUP_ROW_PADDING_X_PX,
  LOGIN_POPUP_BODY_FONT_PX,
  LOGIN_POPUP_SECTION_GAP_PX,
  LOGIN_POPUP_SECONDARY_BUTTON_MARGIN_BOTTOM_PX,
  LOGIN_POPUP_SHEET_PADDING_TOP_PX,
  LOGIN_POPUP_TITLE_FONT_PX,
  LOGIN_POPUP_TITLE_MARGIN_BOTTOM_PX,
} from '@ihui/shared/ui/login-popup-spec'
import { Check } from 'lucide-react-native'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native'
import { useState } from 'react'
import { CarrierOneClickError, carrierLogin, getRecentPhone } from '../lib/carrier-one-click'

export type LoginPopUpRole = 'normal' | 'vip' | 'trader'

export interface LoginPopUpSavePayload {
  avatar?: string
  nickname?: string
  phone?: string
}

export interface LoginPopUpProps {
  visible: boolean
  title: string
  description: string
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel: string
  onSecondary: () => void
  onClose: () => void
  agreeChecked?: boolean
  onAgreeChange?: (value: boolean) => void
  // ===== 业务资料(可选) =====
  avatarUrl?: string
  nickname?: string
  role?: LoginPopUpRole
  phone?: string
  phoneDisabled?: boolean
  // ===== 业务回调(可选,均待接后端/微信 SDK) =====
  onChooseAvatar?: () => void
  onBindPhone?: () => void
  onSave?: (payload: LoginPopUpSavePayload) => void
  onLogout?: () => void
  onUpgrade?: () => void
  onUpgradeTrader?: () => void
}

// 可见几何数字唯一源在 @ihui/shared/ui/login-popup-spec(与小程序端同表,逐档裁决见该文件注释);
// RN 单位是 dp,与逻辑 px 1:1,故本文件直接取用。
// 头像描边环宽度 3dp:RN 独有形态(小程序端头像是 1px border 类,不走本档),不属跨端对账几何。
const AVATAR_BORDER_WIDTH = 3

/** 中英文校验:汉字计 1 单位,字母/数字计 0.5 单位,上限 3 单位(对齐原 vue onInput)。 */
function filterNickname(raw: string): string {
  let out = ''
  let len = 0
  for (const char of raw) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      if (len + 1 > 3) break
      out += char
      len += 1
    } else if (/[a-zA-Z0-9]/.test(char)) {
      if (len + 0.5 > 3) break
      out += char
      len += 0.5
    }
  }
  return out
}

function roleLabel(role: LoginPopUpRole): string {
  switch (role) {
    case 'vip':
      return '会员'
    case 'trader':
      return '操盘手'
    default:
      return '普通用户'
  }
}

export function LoginPopUp({
  visible,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onClose,
  agreeChecked = false,
  onAgreeChange,
  avatarUrl,
  nickname,
  role = 'normal',
  phone,
  phoneDisabled = false,
  onChooseAvatar,
  onBindPhone,
  onSave,
  onLogout,
  onUpgrade,
  onUpgradeTrader,
}: LoginPopUpProps) {
  const handleAgreeToggle = () => {
    onAgreeChange?.(!agreeChecked)
  }

  const showAgreementRow = onAgreeChange !== undefined

  const showProfile = Boolean(
    onSave ||
    onLogout ||
    onChooseAvatar ||
    onBindPhone ||
    onUpgrade ||
    onUpgradeTrader ||
    avatarUrl !== undefined ||
    nickname !== undefined ||
    role !== undefined ||
    phone !== undefined,
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="关闭登录弹窗" />
        <View style={styles.card}>
          <View style={styles.dragBar} />
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={8}
            accessibilityLabel="关闭"
          >
            <Text style={styles.closeIcon}>×</Text>
          </Pressable>
          {showProfile ? (
            <ProfileForm
              avatarUrl={avatarUrl}
              initialNickname={nickname}
              role={role}
              initialPhone={phone}
              phoneDisabled={phoneDisabled}
              onChooseAvatar={onChooseAvatar}
              onBindPhone={onBindPhone}
              onSave={onSave}
              onLogout={onLogout}
              onUpgrade={onUpgrade}
              onUpgradeTrader={onUpgradeTrader}
            />
          ) : (
            <>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={onPrimary}
              >
                <Text style={styles.primaryButtonLabel}>{primaryLabel}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={onSecondary}
              >
                <Text style={styles.secondaryButtonLabel}>{secondaryLabel}</Text>
              </Pressable>
              {showAgreementRow ? (
                <Pressable style={styles.agreementRow} onPress={handleAgreeToggle}>
                  <View style={[styles.checkbox, agreeChecked ? styles.checkboxChecked : null]}>
                    {agreeChecked ? (
                      <Check
                        size={LOGIN_POPUP_AGREEMENT_MARK_PX}
                        color={tokens.brand.ctaForeground}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.agreementText}>
                    <Text style={styles.agreementLink}>《用户协议》</Text>
                    <Text style={styles.agreementSeparator}> 与 </Text>
                    <Text style={styles.agreementLink}>《隐私政策》</Text>
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

interface ProfileFormProps {
  avatarUrl?: string
  initialNickname?: string
  role: LoginPopUpRole
  initialPhone?: string
  phoneDisabled?: boolean
  onChooseAvatar?: () => void
  onBindPhone?: () => void
  onSave?: (payload: LoginPopUpSavePayload) => void
  onLogout?: () => void
  onUpgrade?: () => void
  onUpgradeTrader?: () => void
}

function ProfileForm({
  avatarUrl,
  initialNickname,
  role,
  initialPhone,
  phoneDisabled,
  onChooseAvatar,
  onBindPhone,
  onSave,
  onLogout,
  onUpgrade,
  onUpgradeTrader,
}: ProfileFormProps) {
  const [nickname, setNickname] = useState(initialNickname ?? '')
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [nicknameError, setNicknameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  // 运营商一键登录绑定中(绑定按钮 loading)
  const [bindPhoneLoading, setBindPhoneLoading] = useState(false)

  const handleNicknameChange = (raw: string) => {
    setNickname(filterNickname(raw))
    if (nicknameError) setNicknameError('')
  }

  const handlePhoneChange = (raw: string) => {
    setPhone(raw.replace(/[^0-9]/g, ''))
    if (phoneError) setPhoneError('')
  }

  // 绑定手机号 = 运营商一键登录拿到本机号码并回填,再触发上层 onBindPhone 完成绑定。
  // 未配置/失败 → 免费自动回填最近手机号,降级让用户手动确认。
  const handleBindPhone = async () => {
    if (bindPhoneLoading) return
    setBindPhoneLoading(true)
    setPhoneError('')
    try {
      const res = await carrierLogin()
      if (res.phone) setPhone(res.phone)
      onBindPhone?.()
    } catch (err) {
      if (!(err instanceof CarrierOneClickError)) {
        setPhoneError('运营商一键登录失败,请手动输入手机号')
      } else {
        // 未配置 / 通道失败 → 免费回填最近手机号
        const recent = getRecentPhone()
        if (recent) setPhone(recent)
      }
      onBindPhone?.()
    } finally {
      setBindPhoneLoading(false)
    }
  }

  const handleSave = () => {
    let hasError = false
    if (!nickname) {
      setNicknameError('请输入昵称')
      hasError = true
    } else if (nickname.length > 8) {
      setNicknameError('昵称过长 不能超过8个字符')
      hasError = true
    }
    if (!phone || phone.length !== 11) {
      setPhoneError('请输入正确的手机号码')
      hasError = true
    }
    if (hasError) return
    setNicknameError('')
    setPhoneError('')
    onSave?.({ avatar: avatarUrl, nickname, phone })
  }

  const showUpgrade = role === 'normal' || role === 'vip'
  const roleColor =
    role === 'vip'
      ? tokens.success.DEFAULT
      : role === 'trader'
        ? tokens.brandAccent.deep
        : tokens.text.secondary

  return (
    <View>
      {/* 头像 */}
      <View style={styles.avatarWrap}>
        <Pressable
          style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
          onPress={onChooseAvatar}
          accessibilityLabel="更换头像"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarPlaceholder}>{nickname ? nickname[0] : '?'}</Text>
          )}
        </Pressable>
        <Text style={styles.changeAvatar}>更换头像</Text>
      </View>

      {/* 昵称 */}
      <View style={styles.row}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconGlyph}>人</Text>
        </View>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={handleNicknameChange}
          placeholder="请输入用户名"
          placeholderTextColor={tokens.text.tertiary}
          maxLength={20}
        />
      </View>
      {nicknameError ? (
        <Text style={styles.errorText}>{nicknameError}</Text>
      ) : (
        <Text style={styles.hintText}>最多 3 个汉字或 6 个字母/数字</Text>
      )}

      {/* 角色 + 升级入口 */}
      <View style={[styles.row, styles.roleRow]}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconGlyph}>证</Text>
        </View>
        <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel(role)}</Text>
        {showUpgrade ? (
          <Pressable
            style={({ pressed }) => [styles.upgradeButton, pressed && styles.upgradeButtonPressed]}
            onPress={role === 'normal' ? onUpgrade : onUpgradeTrader}
            accessibilityLabel="立即升级"
          >
            <Text style={styles.upgradeLabel}>立即升级</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 手机号 */}
      <View style={styles.row}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconGlyph}>电</Text>
        </View>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={handlePhoneChange}
          placeholder="请输入电话号码"
          placeholderTextColor={tokens.text.tertiary}
          maxLength={11}
          keyboardType="phone-pad"
          editable={!phoneDisabled}
        />
        {onBindPhone ? (
          <Pressable
            style={({ pressed }) => [styles.bindButton, pressed && styles.bindButtonPressed]}
            onPress={() => void handleBindPhone()}
            disabled={bindPhoneLoading}
            accessibilityLabel="绑定手机号"
          >
            {bindPhoneLoading ? (
              <ActivityIndicator size="small" color={tokens.brand.ctaForeground} />
            ) : (
              <Text style={styles.bindLabel}>{phone ? '重绑' : '绑定'}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
      {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

      {/* 保存 / 登出 */}
      <View style={styles.footer}>
        {onSave ? (
          <Pressable
            style={({ pressed }) => [styles.footerButton, pressed && styles.footerButtonPressed]}
            onPress={handleSave}
            accessibilityLabel="保存信息"
          >
            <Text style={styles.footerLabel}>保存信息</Text>
          </Pressable>
        ) : null}
        {onLogout ? (
          <Pressable
            style={({ pressed }) => [
              styles.footerButton,
              styles.footerButtonLogout,
              pressed && styles.footerButtonPressed,
            ]}
            onPress={onLogout}
            accessibilityLabel="登出"
          >
            <Text style={[styles.footerLabel, styles.footerLabelLogout]}>登出</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(tokens.gray.black, 0.5),
  } as ViewStyle,
  card: {
    width: '100%',
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: rnRadius['2xl'],
    borderTopRightRadius: rnRadius['2xl'],
    paddingTop: LOGIN_POPUP_SHEET_PADDING_TOP_PX,
    paddingHorizontal: LOGIN_POPUP_CARD_PADDING_X_PX,
    paddingBottom: LOGIN_POPUP_CARD_PADDING_BOTTOM_PX,
  },
  dragBar: {
    alignSelf: 'center',
    width: LOGIN_POPUP_DRAG_BAR_WIDTH_PX,
    height: LOGIN_POPUP_DRAG_BAR_HEIGHT_PX,
    borderRadius: LOGIN_POPUP_DRAG_BAR_HEIGHT_PX / 2, // radius-exempt: 拖拽把手胶囊(高 4dp/2)
    backgroundColor: tokens.border.light,
    marginBottom: LOGIN_POPUP_DRAG_BAR_MARGIN_BOTTOM_PX,
  },
  closeButton: {
    position: 'absolute',
    top: LOGIN_POPUP_CLOSE_INSET_PX,
    right: LOGIN_POPUP_CLOSE_INSET_PX,
    width: LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX,
    height: LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX,
    borderRadius: LOGIN_POPUP_CLOSE_BUTTON_SIZE_PX / 2, // radius-exempt: 关闭按钮几何正圆(32dp 直径/2)
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: LOGIN_POPUP_CLOSE_ICON_FONT_PX,
    lineHeight: LOGIN_POPUP_CLOSE_ICON_LINE_HEIGHT_PX,
    color: tokens.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  title: {
    fontSize: LOGIN_POPUP_TITLE_FONT_PX,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    marginBottom: LOGIN_POPUP_TITLE_MARGIN_BOTTOM_PX,
  },
  description: {
    fontSize: LOGIN_POPUP_BODY_FONT_PX,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginBottom: LOGIN_POPUP_DESC_MARGIN_BOTTOM_PX,
  },
  primaryButton: {
    height: LOGIN_POPUP_BUTTON_HEIGHT_PX,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LOGIN_POPUP_SECTION_GAP_PX,
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonLabel: {
    fontSize: LOGIN_POPUP_BUTTON_FONT_PX,
    fontWeight: '500',
    color: tokens.brand.ctaForeground,
    textAlign: 'center',
  },
  secondaryButton: {
    height: LOGIN_POPUP_BUTTON_HEIGHT_PX,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LOGIN_POPUP_SECONDARY_BUTTON_MARGIN_BOTTOM_PX,
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonLabel: {
    fontSize: LOGIN_POPUP_BUTTON_FONT_PX,
    color: tokens.text.primary,
    textAlign: 'center',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: LOGIN_POPUP_CHECKBOX_SIZE_PX,
    height: LOGIN_POPUP_CHECKBOX_SIZE_PX,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: LOGIN_POPUP_AGREEMENT_GAP_PX,
  },
  checkboxChecked: {
    backgroundColor: tokens.brand.cta,
    borderColor: tokens.brandAccent.deep,
  },
  checkboxMark: {
    fontSize: LOGIN_POPUP_AGREEMENT_MARK_PX,
    lineHeight: LOGIN_POPUP_AGREEMENT_MARK_PX,
    color: tokens.brand.ctaForeground,
    fontWeight: '700',
  },
  agreementText: {
    fontSize: LOGIN_POPUP_AGREEMENT_FONT_PX,
    color: tokens.text.secondary,
  },
  agreementLink: {
    color: tokens.brand.DEFAULT,
  },
  agreementSeparator: {
    color: tokens.text.secondary,
  },
  // ===== 资料编辑卡 =====
  avatarWrap: {
    alignItems: 'center',
    marginBottom: LOGIN_POPUP_SECTION_GAP_PX,
  },
  avatar: {
    width: LOGIN_POPUP_AVATAR_BOX_PX,
    height: LOGIN_POPUP_AVATAR_BOX_PX,
    borderRadius: LOGIN_POPUP_AVATAR_BOX_PX / 2, // radius-exempt: 头像几何正圆(70dp 直径/2)
    borderWidth: AVATAR_BORDER_WIDTH,
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPressed: {
    opacity: 0.8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    fontSize: LOGIN_POPUP_BODY_FONT_PX,
    fontWeight: '600',
    color: tokens.text.secondary,
  },
  changeAvatar: {
    marginTop: LOGIN_POPUP_AVATAR_HINT_GAP_PX,
    fontSize: LOGIN_POPUP_CHANGE_HINT_FONT_PX,
    color: tokens.brand.DEFAULT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LOGIN_POPUP_ROW_HEIGHT_PX,
    borderRadius: rnRadius.lg,
    paddingHorizontal: LOGIN_POPUP_ROW_PADDING_X_PX,
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
    marginBottom: LOGIN_POPUP_SECTION_GAP_PX,
  },
  roleRow: {
    justifyContent: 'flex-start',
  },
  iconBadge: {
    width: LOGIN_POPUP_ICON_BADGE_SIZE_PX,
    height: LOGIN_POPUP_ICON_BADGE_SIZE_PX,
    borderRadius: LOGIN_POPUP_ICON_BADGE_SIZE_PX / 2, // radius-exempt: 行首图标徽标几何正圆(20dp 直径/2)
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: LOGIN_POPUP_ICON_BADGE_MARGIN_RIGHT_PX,
  },
  iconGlyph: {
    fontSize: LOGIN_POPUP_ICON_GLYPH_FONT_PX,
    color: tokens.text.secondary,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: LOGIN_POPUP_BODY_FONT_PX,
    color: tokens.text.primary,
    padding: 0,
  },
  roleText: {
    flex: 1,
    fontSize: LOGIN_POPUP_BODY_FONT_PX,
    fontWeight: '600',
  },
  upgradeButton: {
    height: LOGIN_POPUP_PILL_HEIGHT_PX,
    paddingHorizontal: LOGIN_POPUP_PILL_PADDING_X_PX,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.warning.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonPressed: {
    opacity: 0.8,
  },
  upgradeLabel: {
    fontSize: LOGIN_POPUP_PILL_FONT_PX,
    fontWeight: '700',
    color: tokens.danger.DEFAULT,
  },
  bindButton: {
    height: LOGIN_POPUP_PILL_HEIGHT_PX,
    paddingHorizontal: LOGIN_POPUP_PILL_PADDING_X_PX,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bindButtonPressed: {
    opacity: 0.8,
  },
  bindLabel: {
    fontSize: LOGIN_POPUP_PILL_FONT_PX,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  },
  hintText: {
    fontSize: LOGIN_POPUP_NOTE_FONT_PX,
    color: tokens.text.tertiary,
    marginTop: LOGIN_POPUP_NOTE_MARGIN_TOP_PX,
    marginBottom: LOGIN_POPUP_SECTION_GAP_PX,
  },
  errorText: {
    fontSize: LOGIN_POPUP_NOTE_FONT_PX,
    color: tokens.danger.DEFAULT,
    marginTop: LOGIN_POPUP_NOTE_MARGIN_TOP_PX,
    marginBottom: LOGIN_POPUP_SECTION_GAP_PX,
  },
  footer: {
    flexDirection: 'row',
    gap: LOGIN_POPUP_FOOTER_GAP_PX,
    marginTop: LOGIN_POPUP_FOOTER_MARGIN_TOP_PX,
  },
  footerButton: {
    flex: 1,
    height: LOGIN_POPUP_BUTTON_HEIGHT_PX,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.brandAccent.deep,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonPressed: {
    opacity: 0.8,
  },
  footerButtonLogout: {
    backgroundColor: tokens.danger.light,
    borderColor: tokens.danger.DEFAULT,
  },
  footerLabel: {
    fontSize: LOGIN_POPUP_BUTTON_FONT_PX,
    fontWeight: '600',
    color: tokens.brand.DEFAULT,
  },
  footerLabelLogout: {
    color: tokens.danger.DEFAULT,
  },
})

export default LoginPopUp
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
