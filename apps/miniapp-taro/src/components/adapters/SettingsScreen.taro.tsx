// 平台特有:依赖 @tarojs/components 的 View/Text/Switch/Input 组件,不适合共享层
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { View, Text, Switch, Input } from '@tarojs/components'
import { getRnTokens, type RnThemeTokens, type RnThemeMode } from '@ihui/design-tokens'
import type {
  TFunction,
  SettingsScreenProps as SharedSettingsScreenProps,
  SharedNotificationToggles,
} from '@ihui/types'
import { useTt } from '@/i18n'

/**
 * Taro 适配层:SettingsScreen
 *
 * 复用 packages/app/src/features/settings/SettingsScreen 的 props 契约 + 状态机逻辑,
 * 仅替换 react-native 原语为 @tarojs/components:
 * - View/Text → Taro View/Text
 * - TouchableOpacity → View + onTap
 * - TextInput(secureTextEntry/onChangeText) → Input(password/onInput)
 * - Switch(value/onValueChange/trackColor) → Switch(checked/onChange/color)
 * - Modal → 自绘 View 弹层(overlay + card + stopPropagation)
 *
 * 主题通过 getRnTokens(colorScheme) 注入,与 web/RN 端 token 同源。
 * i18n 三级降级:t prop → useTt() I18nContext → 硬编码中文 fallback。
 */
export type SettingsScreenProps = Omit<SharedSettingsScreenProps, 't' | 'colorScheme'> & {
  /** i18n 翻译函数(可选);未传则用 I18nContext useTt,再降级硬编码中文 */
  t?: TFunction
  /** 已解析主题,默认 'light' */
  colorScheme?: RnThemeMode
}

export type { SharedNotificationToggles } from '@ihui/types'

type NotifKey = keyof SharedNotificationToggles

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ===== 样式函数(view/text/input 分组,避免 style 联合类型) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    backgroundColor: tk.surface.bg,
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    gap: toRpx(12),
  }),
  backBtn: (): CSSProperties => ({
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
  }),
  body: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    padding: toRpx(16),
    gap: toRpx(12),
  }),
  userCard: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: toRpx(16),
    borderRadius: toRpx(8),
    backgroundColor: tk.surface.muted,
    gap: toRpx(12),
  }),
  avatar: (tk: RnThemeTokens): CSSProperties => ({
    width: toRpx(48),
    height: toRpx(48),
    borderRadius: toRpx(8),
    backgroundColor: tk.brand.DEFAULT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  userMeta: (): CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: toRpx(2),
  }),
  section: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap: toRpx(8),
  }),
  sectionCard: (tk: RnThemeTokens): CSSProperties => ({
    borderRadius: toRpx(8),
    backgroundColor: tk.surface.muted,
    padding: toRpx(4),
  }),
  plainRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
  }),
  switchRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: toRpx(10),
    paddingBottom: toRpx(10),
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
  }),
  logoutBtn: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    paddingTop: toRpx(14),
    paddingBottom: toRpx(14),
    borderRadius: toRpx(8),
    backgroundColor: tk.error.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  modalOverlay: (tk: RnThemeTokens): CSSProperties => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tk.overlay.modal,
    padding: toRpx(24),
  }),
  modalCard: (tk: RnThemeTokens): CSSProperties => ({
    backgroundColor: tk.surface.bg,
    borderRadius: toRpx(12),
    padding: toRpx(20),
    display: 'flex',
    flexDirection: 'column',
    gap: toRpx(10),
    width: '100%',
    maxWidth: toRpx(360),
  }),
  modalActions: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    gap: toRpx(10),
    marginTop: toRpx(6),
  }),
  modalBtn: (): CSSProperties => ({
    flex: 1,
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    borderRadius: toRpx(8),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  modalBtnSecondary: (tk: RnThemeTokens): CSSProperties => ({
    backgroundColor: tk.surface.card,
  }),
  modalBtnPrimary: (tk: RnThemeTokens): CSSProperties => ({
    backgroundColor: tk.brand.DEFAULT,
  }),
}

const textStyles = {
  back: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.medium,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(18),
    fontWeight: 600,
    color: tk.text.primary,
  }),
  avatarText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(20),
    fontWeight: 700,
    color: tk.surface.light,
  }),
  nickname: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(15),
    fontWeight: 600,
    color: tk.text.primary,
  }),
  subText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
  }),
  arrow: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(18),
    color: tk.text.tertiary,
  }),
  sectionTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(13),
    fontWeight: 600,
    color: tk.text.medium,
  }),
  rowLabel: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.primary,
  }),
  checkMark: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: 700,
    color: tk.brand.DEFAULT,
  }),
  logoutText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    fontWeight: 600,
    color: tk.error.text,
  }),
  versionText: (tk: RnThemeTokens): CSSProperties => ({
    textAlign: 'center',
    fontSize: toRpx(11),
    color: tk.text.tertiary,
    marginTop: toRpx(4),
  }),
  modalTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: 600,
    color: tk.text.primary,
    marginBottom: toRpx(4),
  }),
  modalBtnSecondaryText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    fontWeight: 600,
    color: tk.text.medium,
  }),
  modalBtnPrimaryText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    fontWeight: 600,
    color: tk.surface.light,
  }),
}

const inputStyles = {
  pwd: (tk: RnThemeTokens): CSSProperties => ({
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tk.border.light,
    borderRadius: toRpx(8),
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(10),
    paddingBottom: toRpx(10),
    fontSize: toRpx(14),
    color: tk.text.primary,
  }),
}

// ===== 主组件 =====

export function SettingsScreen({
  t,
  user,
  locale,
  localeOptions,
  onSelectLocale,
  theme,
  themeOptions,
  onSelectTheme,
  notifications,
  onToggleNotification,
  onEditProfile,
  onChangePassword,
  onAlert,
  onConfirm,
  onLogout,
  menuItems,
  onMenuPress,
  appVersion,
  onBack,
  colorScheme = 'light',
}: SettingsScreenProps) {
  const [pwdModalVisible, setPwdModalVisible] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  const tk = getRnTokens(colorScheme)
  const tt = useTt()

  // i18n 三级降级:t prop → useTt() I18nContext → 硬编码中文 fallback
  const tr = (key: string, fallback: string, params?: Record<string, string | number>): string => {
    if (t) {
      const v = params ? t(key, params) : t(key)
      return v !== key ? v : fallback
    }
    return tt(key, fallback, params)
  }

  const openPwdModal = () => {
    setOldPwd('')
    setNewPwd('')
    setConfirmPwd('')
    setPwdModalVisible(true)
  }

  const submitChangePassword = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) {
      onAlert(tr('settings.pwdFieldsRequired', '请填写所有密码字段'))
      return
    }
    if (newPwd.length < 6) {
      onAlert(tr('settings.pwdTooShort', '密码长度不能少于 6 位'))
      return
    }
    if (newPwd !== confirmPwd) {
      onAlert(tr('settings.pwdNotMatch', '两次输入的密码不一致'))
      return
    }
    setChangingPwd(true)
    const ok = await onChangePassword(oldPwd, newPwd)
    setChangingPwd(false)
    if (ok) {
      setPwdModalVisible(false)
      onAlert(tr('settings.pwdChanged', '密码修改成功'))
    } else {
      onAlert(tr('settings.pwdChangeFailed', '密码修改失败'))
    }
  }

  const onLogoutPress = () => {
    onConfirm(
      tr('profile.logout', '退出登录'),
      tr('settings.logoutConfirm', '确定要退出登录吗?'),
      onLogout,
    )
  }

  const notifRows: Array<{ key: NotifKey; label: string }> = [
    { key: 'push', label: tr('settings.notifPush', '推送通知') },
    { key: 'message', label: tr('settings.notifMessage', '消息通知') },
    { key: 'email', label: tr('settings.notifEmail', '邮件通知') },
  ]

  const handleModalCardTap = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }

  return (
    <View style={viewStyles.container(tk)}>
      <View style={viewStyles.header()}>
        <View style={viewStyles.backBtn()} onTap={onBack}>
          <Text style={textStyles.back(tk)}>{tr('common.back', '返回')}</Text>
        </View>
        <Text style={textStyles.title(tk)}>{tr('settings.title', '设置')}</Text>
      </View>

      <View style={viewStyles.body()}>
        {user && onEditProfile ? (
          <View style={viewStyles.userCard(tk)} onTap={onEditProfile}>
            <View style={viewStyles.avatar(tk)}>
              <Text style={textStyles.avatarText(tk)}>
                {user.nickname?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={viewStyles.userMeta()}>
              <Text style={textStyles.nickname(tk)}>
                {user.nickname || tr('profile.nickname', '昵称')}
              </Text>
              <Text style={textStyles.subText(tk)}>{tr('profile.editProfile', '编辑资料')}</Text>
            </View>
            <Text style={textStyles.arrow(tk)}>{'›'}</Text>
          </View>
        ) : null}

        <Section title={tr('settings.language', '语言')} tk={tk}>
          {localeOptions.map((opt) => (
            <SelectRow
              key={opt.value}
              label={opt.label}
              selected={opt.value === locale}
              onPress={() => onSelectLocale(opt.value)}
              tk={tk}
            />
          ))}
        </Section>

        <Section title={tr('settings.theme', '主题')} tk={tk}>
          {themeOptions.map((opt) => (
            <SelectRow
              key={opt.value}
              label={opt.label}
              selected={opt.value === theme}
              onPress={() => onSelectTheme(opt.value)}
              tk={tk}
            />
          ))}
        </Section>

        <Section title={tr('settings.notification', '通知')} tk={tk}>
          {notifRows.map((row) => (
            <View key={row.key} style={viewStyles.switchRow()}>
              <Text style={textStyles.rowLabel(tk)}>{row.label}</Text>
              <Switch
                checked={notifications[row.key]}
                onChange={(e) => onToggleNotification(row.key, e.detail.value)}
                color={tk.brand.DEFAULT}
              />
            </View>
          ))}
        </Section>

        <Section title={tr('settings.account', '账户')} tk={tk}>
          <View style={viewStyles.plainRow()} onTap={openPwdModal}>
            <Text style={textStyles.rowLabel(tk)}>{tr('settings.changePassword', '修改密码')}</Text>
            <Text style={textStyles.arrow(tk)}>{'›'}</Text>
          </View>
          {menuItems.map((item) => (
            <View key={item.key} style={viewStyles.plainRow()} onTap={() => onMenuPress(item.key)}>
              <Text style={textStyles.rowLabel(tk)}>{item.label}</Text>
              <Text style={textStyles.arrow(tk)}>{'›'}</Text>
            </View>
          ))}
        </Section>

        <View style={viewStyles.logoutBtn(tk)} onTap={onLogoutPress}>
          <Text style={textStyles.logoutText(tk)}>{tr('profile.logout', '退出登录')}</Text>
        </View>

        {appVersion ? (
          <Text style={textStyles.versionText(tk)}>
            {tr('settings.version', '版本')} {appVersion}
          </Text>
        ) : null}
      </View>

      {pwdModalVisible ? (
        <View
          style={viewStyles.modalOverlay(tk)}
          onTap={() => !changingPwd && setPwdModalVisible(false)}
        >
          <View style={viewStyles.modalCard(tk)} onTap={handleModalCardTap}>
            <Text style={textStyles.modalTitle(tk)}>
              {tr('settings.changePassword', '修改密码')}
            </Text>
            <PwdInput
              placeholder={tr('settings.oldPassword', '原密码')}
              value={oldPwd}
              onChange={setOldPwd}
              tk={tk}
            />
            <PwdInput
              placeholder={tr('settings.newPassword', '新密码')}
              value={newPwd}
              onChange={setNewPwd}
              tk={tk}
            />
            <PwdInput
              placeholder={tr('settings.confirmPassword', '确认密码')}
              value={confirmPwd}
              onChange={setConfirmPwd}
              tk={tk}
            />
            <View style={viewStyles.modalActions()}>
              <View
                style={{
                  ...viewStyles.modalBtn(),
                  ...viewStyles.modalBtnSecondary(tk),
                  opacity: changingPwd ? 0.5 : 1,
                }}
                onTap={() => !changingPwd && setPwdModalVisible(false)}
              >
                <Text style={textStyles.modalBtnSecondaryText(tk)}>
                  {tr('common.cancel', '取消')}
                </Text>
              </View>
              <View
                style={{
                  ...viewStyles.modalBtn(),
                  ...viewStyles.modalBtnPrimary(tk),
                  opacity: changingPwd ? 0.5 : 1,
                }}
                onTap={changingPwd ? undefined : submitChangePassword}
              >
                <Text style={textStyles.modalBtnPrimaryText(tk)}>
                  {changingPwd ? tr('common.loading', '加载中...') : tr('common.confirm', '确认')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}

// ===== 子组件 =====

function Section({
  title,
  children,
  tk,
}: {
  title: string
  children: ReactNode
  tk: RnThemeTokens
}) {
  return (
    <View style={viewStyles.section()}>
      <Text style={textStyles.sectionTitle(tk)}>{title}</Text>
      <View style={viewStyles.sectionCard(tk)}>{children}</View>
    </View>
  )
}

function SelectRow({
  label,
  selected,
  onPress,
  tk,
}: {
  label: string
  selected: boolean
  onPress: () => void
  tk: RnThemeTokens
}) {
  return (
    <View style={viewStyles.plainRow()} onTap={onPress}>
      <Text style={textStyles.rowLabel(tk)}>{label}</Text>
      {selected ? <Text style={textStyles.checkMark(tk)}>{'✓'}</Text> : null}
    </View>
  )
}

function PwdInput({
  placeholder,
  value,
  onChange,
  tk,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  tk: RnThemeTokens
}) {
  return (
    <Input
      style={inputStyles.pwd(tk)}
      placeholder={placeholder}
      value={value}
      password
      onInput={(e) => onChange(e.detail.value)}
    />
  )
}
