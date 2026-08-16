import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { View, Text, Switch, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import type { SettingsScreenProps, SharedNotificationToggles } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

type NotifKey = keyof SharedNotificationToggles

/**
 * SettingsScreen — 跨端共享「设置」页。
 *
 * 平台无关:语言/主题切换、通知开关、密码修改、Alert/Confirm 弹窗全部通过 props 回调注入。
 * 密码修改 Modal 内置 UI(3 个输入框 + 校验),提交调用 onChangePassword,平台注入实际 API 调用。
 * 配色:由 colorScheme prop('light' | 'dark',默认 'light')经 getTokens 解析为明/暗 token 集。
 */
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

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk, colorScheme), [tk, colorScheme])

  const openPwdModal = () => {
    setOldPwd('')
    setNewPwd('')
    setConfirmPwd('')
    setPwdModalVisible(true)
  }

  const submitChangePassword = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) {
      onAlert(t('settings.pwdFieldsRequired'))
      return
    }
    if (newPwd.length < 6) {
      onAlert(t('settings.pwdTooShort'))
      return
    }
    if (newPwd !== confirmPwd) {
      onAlert(t('settings.pwdNotMatch'))
      return
    }
    setChangingPwd(true)
    const ok = await onChangePassword(oldPwd, newPwd)
    setChangingPwd(false)
    if (ok) {
      setPwdModalVisible(false)
      onAlert(t('settings.pwdChanged'))
    } else {
      onAlert(t('settings.pwdChangeFailed'))
    }
  }

  const onLogoutPress = () => {
    onConfirm(t('profile.logout'), t('settings.logoutConfirm'), onLogout)
  }

  const notifRows: Array<{ key: NotifKey; label: string }> = [
    { key: 'push', label: t('settings.notifPush') },
    { key: 'message', label: t('settings.notifMessage') },
    { key: 'email', label: t('settings.notifEmail') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <View style={styles.body}>
        {user && onEditProfile ? (
          <TouchableOpacity style={styles.userCard} onPress={onEditProfile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.nickname?.charAt(0).toUpperCase() || 'U'}</Text>
            </View>
            <View style={styles.userMeta}>
              <Text style={styles.nickname}>{user.nickname || t('profile.nickname')}</Text>
              <Text style={styles.subText}>{t('profile.editProfile')}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ) : null}

        <Section title={t('settings.language')} styles={styles}>
          {localeOptions.map((opt) => (
            <SelectRow
              key={opt.value}
              label={opt.label}
              selected={opt.value === locale}
              onPress={() => onSelectLocale(opt.value)}
              styles={styles}
            />
          ))}
        </Section>

        <Section title={t('settings.theme')} styles={styles}>
          {themeOptions.map((opt) => (
            <SelectRow
              key={opt.value}
              label={opt.label}
              selected={opt.value === theme}
              onPress={() => onSelectTheme(opt.value)}
              styles={styles}
            />
          ))}
        </Section>

        <Section title={t('settings.notification')} styles={styles}>
          {notifRows.map((row) => (
            <View key={row.key} style={styles.switchRow}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Switch
                value={notifications[row.key]}
                onValueChange={(v) => onToggleNotification(row.key, v)}
                trackColor={{ false: tk.border.medium, true: tk.brand.DEFAULT }}
              />
            </View>
          ))}
        </Section>

        <Section title={t('settings.account')} styles={styles}>
          <TouchableOpacity style={styles.plainRow} onPress={openPwdModal}>
            <Text style={styles.rowLabel}>{t('settings.changePassword')}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.plainRow}
              onPress={() => onMenuPress(item.key)}
            >
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </Section>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogoutPress}>
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        {appVersion ? (
          <Text style={styles.versionText}>
            {t('settings.version')} {appVersion}
          </Text>
        ) : null}
      </View>

      <Modal
        visible={pwdModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPwdModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings.changePassword')}</Text>
            <PwdInput
              placeholder={t('settings.oldPassword')}
              value={oldPwd}
              onChange={setOldPwd}
              styles={styles}
            />
            <PwdInput
              placeholder={t('settings.newPassword')}
              value={newPwd}
              onChange={setNewPwd}
              styles={styles}
            />
            <PwdInput
              placeholder={t('settings.confirmPassword')}
              value={confirmPwd}
              onChange={setConfirmPwd}
              styles={styles}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setPwdModalVisible(false)}
                disabled={changingPwd}
              >
                <Text style={styles.modalBtnSecondaryText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={submitChangePassword}
                disabled={changingPwd}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {changingPwd ? t('common.loading') : t('common.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

type ThemedStyles = ReturnType<typeof createStyles>

function Section({
  title,
  children,
  styles,
}: {
  title: string
  children: ReactNode
  styles: ThemedStyles
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

function SelectRow({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string
  selected: boolean
  onPress: () => void
  styles: ThemedStyles
}) {
  return (
    <TouchableOpacity style={styles.plainRow} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      {selected ? <Text style={styles.checkMark}>✓</Text> : null}
    </TouchableOpacity>
  )
}

function PwdInput({
  placeholder,
  value,
  onChange,
  styles,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  styles: ThemedStyles
}) {
  return (
    <TextInput
      style={styles.pwdInput}
      placeholder={placeholder}
      value={value}
      onChangeText={onChange}
      secureTextEntry
      autoCapitalize="none"
    />
  )
}

function createStyles(tk: AppThemeTokens, colorScheme: 'light' | 'dark') {
  // 页面背景:浅色 #f5f5f5(对齐 D 盘 Ai-WXMiniVue 设置页),深色沿用 surface.bg
  const pageBg = colorScheme === 'dark' ? tk.surface.bg : '#f5f5f5'
  // 卡片表面:浅色纯白 #fff(对齐 uniapp section-card),深色沿用 surface.muted
  const cardBg = colorScheme === 'dark' ? tk.surface.muted : '#ffffff'
  // 分隔线:浅色 #f0f0f0(对齐 uniapp border-bottom),深色沿用 border.light
  const divider = colorScheme === 'dark' ? tk.border.light : '#f0f0f0'
  // cell 标签文字:浅色 #333(对齐 uniapp item-label),深色沿用 text.primary
  const rowLabelColor = colorScheme === 'dark' ? tk.text.primary : '#333333'
  // 箭头:浅色 #999(对齐 uniapp arrow-icon),深色沿用 text.tertiary
  const arrowColor = colorScheme === 'dark' ? tk.text.tertiary : '#999999'
  // 分组标题:浅色 #999(对齐 uniapp section-title),深色沿用 text.secondary
  const sectionTitleColor = colorScheme === 'dark' ? tk.text.secondary : '#999999'
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: pageBg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    body: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 24, gap: 16 },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 20, fontWeight: '700', color: tk.surface.light },
    userMeta: { flex: 1, gap: 2 },
    nickname: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    subText: { fontSize: 14, color: tk.text.secondary },
    arrow: { fontSize: 20, color: arrowColor },
    section: { gap: 8 },
    sectionTitle: { fontSize: 14, color: sectionTitleColor },
    sectionCard: {
      borderRadius: 8,
      backgroundColor: divider,
      overflow: 'hidden',
      gap: StyleSheet.hairlineWidth,
    },
    plainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 60,
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: cardBg,
    },
    rowLabel: { fontSize: 16, color: rowLabelColor },
    checkMark: { fontSize: 16, color: tk.brand.DEFAULT, fontWeight: '700' },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 60,
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: cardBg,
    },
    logoutBtn: {
      marginTop: 8,
      height: 50,
      borderRadius: 8,
      backgroundColor: cardBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutText: { fontSize: 16, fontWeight: '600', color: '#e64340' },
    versionText: { textAlign: 'center', fontSize: 12, color: tk.text.tertiary, marginTop: 4 },
    modalOverlay: {
      flex: 1,
      backgroundColor: tk.overlay.modal,
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: { backgroundColor: tk.surface.bg, borderRadius: 12, padding: 14, gap: 10 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary, marginBottom: 4 },
    pwdInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 50,
      fontSize: 16,
      color: tk.text.primary,
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    modalBtn: {
      flex: 1,
      height: 50,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnSecondary: { backgroundColor: tk.surface.card },
    modalBtnSecondaryText: { fontSize: 16, fontWeight: '600', color: tk.text.medium },
    modalBtnPrimary: { backgroundColor: tk.brand.DEFAULT },
    modalBtnPrimaryText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
  })
}
