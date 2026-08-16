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
 * - onBindPhone?:手机号绑定回调(待接后端/微信 SDK getPhoneNumber)
 * - onSave?:保存回调(待接后端保存)
 * - onLogout?:登出回调(待接后端:清缓存 + reLaunch)
 * - onUpgrade? / onUpgradeTrader?:升级入口回调(跳会员/操盘手介绍弹窗)
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
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

// ============ 通用授权卡尺寸 ============
const CARD_PADDING_TOP = 8
const CARD_PADDING_HORIZONTAL = 16
const CARD_PADDING_BOTTOM = 24
const DRAG_BAR_WIDTH = 36
const DRAG_BAR_HEIGHT = 4
const DRAG_BAR_MARGIN_BOTTOM = 12
const TITLE_FONT_SIZE = 16
const TITLE_MARGIN_BOTTOM = 8
const DESCRIPTION_FONT_SIZE = 14
const DESCRIPTION_MARGIN_BOTTOM = 24
const BUTTON_HEIGHT = 48
const BUTTON_BORDER_RADIUS = 8
const BUTTON_FONT_SIZE = 15
const PRIMARY_BUTTON_MARGIN_BOTTOM = 12
const SECONDARY_BUTTON_MARGIN_BOTTOM = 24
const AGREEMENT_FONT_SIZE = 11
const AGREEMENT_GAP = 4
const CHECKBOX_SIZE = 16
const CHECKBOX_BORDER_RADIUS = 4
const CLOSE_BUTTON_SIZE = 32
const CLOSE_ICON_SIZE = 18
const CLOSE_BUTTON_TOP = 8
const CLOSE_BUTTON_RIGHT = 8

// ============ 资料编辑卡尺寸(rpx→dp 2:1) ============
const AVATAR_SIZE = 72
const AVATAR_BORDER_WIDTH = 3
const AVATAR_MARGIN_BOTTOM = 6
const CHANGE_AVATAR_FONT_SIZE = 12
const ROW_HEIGHT = 44
const ROW_BORDER_RADIUS = 8
const ROW_MARGIN_BOTTOM = 12
const ROW_PADDING_HORIZONTAL = 12
const ICON_SIZE = 20
const ICON_MARGIN_RIGHT = 10
const BODY_FONT_SIZE = 14
const ACTION_FONT_SIZE = 16
const UPGRADE_HEIGHT = 24
const UPGRADE_PADDING_HORIZONTAL = 10
const UPGRADE_BORDER_RADIUS = 6
const HINT_FONT_SIZE = 11
const ERROR_FONT_SIZE = 11
const FOOTER_MARGIN_TOP = 8
const FOOTER_GAP = 10
const FOOTER_BUTTON_HEIGHT = 46

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
                    {agreeChecked ? <Text style={styles.checkboxMark}>✓</Text> : null}
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

  const handleNicknameChange = (raw: string) => {
    setNickname(filterNickname(raw))
    if (nicknameError) setNicknameError('')
  }

  const handlePhoneChange = (raw: string) => {
    setPhone(raw.replace(/[^0-9]/g, ''))
    if (phoneError) setPhoneError('')
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
        ? tokens.warning.deep
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
            onPress={onBindPhone}
            accessibilityLabel="绑定手机号"
          >
            <Text style={styles.bindLabel}>{phone ? '重绑' : '绑定'}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  } as ViewStyle,
  card: {
    width: '100%',
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: CARD_PADDING_TOP,
    paddingHorizontal: CARD_PADDING_HORIZONTAL,
    paddingBottom: CARD_PADDING_BOTTOM,
  },
  dragBar: {
    alignSelf: 'center',
    width: DRAG_BAR_WIDTH,
    height: DRAG_BAR_HEIGHT,
    borderRadius: DRAG_BAR_HEIGHT / 2,
    backgroundColor: tokens.border.light,
    marginBottom: DRAG_BAR_MARGIN_BOTTOM,
  },
  closeButton: {
    position: 'absolute',
    top: CLOSE_BUTTON_TOP,
    right: CLOSE_BUTTON_RIGHT,
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: CLOSE_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: CLOSE_ICON_SIZE,
    lineHeight: CLOSE_ICON_SIZE + 4,
    color: tokens.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tokens.text.primary,
    textAlign: 'center',
    marginBottom: TITLE_MARGIN_BOTTOM,
  },
  description: {
    fontSize: DESCRIPTION_FONT_SIZE,
    color: tokens.text.secondary,
    textAlign: 'center',
    marginBottom: DESCRIPTION_MARGIN_BOTTOM,
  },
  primaryButton: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: PRIMARY_BUTTON_MARGIN_BOTTOM,
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonLabel: {
    fontSize: BUTTON_FONT_SIZE,
    fontWeight: '500',
    color: tokens.surface.light,
    textAlign: 'center',
  },
  secondaryButton: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SECONDARY_BUTTON_MARGIN_BOTTOM,
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonLabel: {
    fontSize: BUTTON_FONT_SIZE,
    color: tokens.text.primary,
    textAlign: 'center',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: CHECKBOX_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: AGREEMENT_GAP,
  },
  checkboxChecked: {
    backgroundColor: tokens.brand.DEFAULT,
    borderColor: tokens.brand.DEFAULT,
  },
  checkboxMark: {
    fontSize: 11,
    lineHeight: 12,
    color: tokens.surface.light,
    fontWeight: '700',
  },
  agreementText: {
    fontSize: AGREEMENT_FONT_SIZE,
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
    marginBottom: ROW_MARGIN_BOTTOM,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
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
    fontSize: BODY_FONT_SIZE,
    fontWeight: '600',
    color: tokens.text.secondary,
  },
  changeAvatar: {
    marginTop: AVATAR_MARGIN_BOTTOM,
    fontSize: CHANGE_AVATAR_FONT_SIZE,
    color: tokens.brand.DEFAULT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    borderRadius: ROW_BORDER_RADIUS,
    paddingHorizontal: ROW_PADDING_HORIZONTAL,
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
    marginBottom: ROW_MARGIN_BOTTOM,
  },
  roleRow: {
    justifyContent: 'flex-start',
  },
  iconBadge: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ICON_MARGIN_RIGHT,
  },
  iconGlyph: {
    fontSize: 11,
    color: tokens.text.secondary,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: BODY_FONT_SIZE,
    color: tokens.text.primary,
    padding: 0,
  },
  roleText: {
    flex: 1,
    fontSize: BODY_FONT_SIZE,
    fontWeight: '600',
  },
  upgradeButton: {
    height: UPGRADE_HEIGHT,
    paddingHorizontal: UPGRADE_PADDING_HORIZONTAL,
    borderRadius: UPGRADE_BORDER_RADIUS,
    backgroundColor: tokens.warning.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonPressed: {
    opacity: 0.8,
  },
  upgradeLabel: {
    fontSize: HINT_FONT_SIZE,
    fontWeight: '700',
    color: tokens.danger.DEFAULT,
  },
  bindButton: {
    height: UPGRADE_HEIGHT,
    paddingHorizontal: UPGRADE_PADDING_HORIZONTAL,
    borderRadius: UPGRADE_BORDER_RADIUS,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bindButtonPressed: {
    opacity: 0.8,
  },
  bindLabel: {
    fontSize: HINT_FONT_SIZE,
    fontWeight: '600',
    color: tokens.surface.light,
  },
  hintText: {
    fontSize: HINT_FONT_SIZE,
    color: tokens.text.tertiary,
    marginTop: -ROW_MARGIN_BOTTOM + 6,
    marginBottom: ROW_MARGIN_BOTTOM,
  },
  errorText: {
    fontSize: ERROR_FONT_SIZE,
    color: tokens.danger.DEFAULT,
    marginTop: -ROW_MARGIN_BOTTOM + 6,
    marginBottom: ROW_MARGIN_BOTTOM,
  },
  footer: {
    flexDirection: 'row',
    gap: FOOTER_GAP,
    marginTop: FOOTER_MARGIN_TOP,
  },
  footerButton: {
    flex: 1,
    height: FOOTER_BUTTON_HEIGHT,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: tokens.brand.DEFAULT,
    backgroundColor: tokens.surface.light,
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
    fontSize: ACTION_FONT_SIZE,
    fontWeight: '600',
    color: tokens.brand.DEFAULT,
  },
  footerLabelLogout: {
    color: tokens.danger.DEFAULT,
  },
})

export default LoginPopUp
