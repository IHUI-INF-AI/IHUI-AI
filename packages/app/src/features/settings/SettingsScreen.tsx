import { useState } from 'react'
import type { ReactNode } from 'react'
import { View, Text, Switch, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { TextLink } from 'solito/link'
import type { SettingsScreenProps, SharedNotificationToggles } from '../../types'

type NotifKey = keyof SharedNotificationToggles

/**
 * SettingsScreen — 跨端共享「设置」页。
 *
 * 平台无关:语言/主题切换、通知开关、密码修改、Alert/Confirm 弹窗全部通过 props 回调注入。
 * 密码修改 Modal 内置 UI(3 个输入框 + 校验),提交调用 onChangePassword,平台注入实际 API 调用。
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
}: SettingsScreenProps) {
  const [pwdModalVisible, setPwdModalVisible] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

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
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
        ) : (
          <TextLink href="/" textProps={{ style: styles.backText }}>
            {t('common.back')}
          </TextLink>
        )}
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

        <Section title={t('settings.language')}>
          {localeOptions.map((opt) => (
            <SelectRow
              key={opt.value}
              label={opt.label}
              selected={opt.value === locale}
              onPress={() => onSelectLocale(opt.value)}
            />
          ))}
        </Section>

        <Section title={t('settings.theme')}>
          {themeOptions.map((opt) => (
            <SelectRow
              key={opt.value}
              label={opt.label}
              selected={opt.value === theme}
              onPress={() => onSelectTheme(opt.value)}
            />
          ))}
        </Section>

        <Section title={t('settings.notification')}>
          {notifRows.map((row) => (
            <View key={row.key} style={styles.switchRow}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Switch
                value={notifications[row.key]}
                onValueChange={(v) => onToggleNotification(row.key, v)}
                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
              />
            </View>
          ))}
        </Section>

        <Section title={t('settings.account')}>
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

      <Modal visible={pwdModalVisible} transparent animationType="fade" onRequestClose={() => setPwdModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings.changePassword')}</Text>
            <PwdInput placeholder={t('settings.oldPassword')} value={oldPwd} onChange={setOldPwd} />
            <PwdInput placeholder={t('settings.newPassword')} value={newPwd} onChange={setNewPwd} />
            <PwdInput placeholder={t('settings.confirmPassword')} value={confirmPwd} onChange={setConfirmPwd} />
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

function SelectRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.plainRow} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      {selected ? <Text style={styles.checkMark}>✓</Text> : null}
    </TouchableOpacity>
  )
}

function PwdInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  body: { padding: 16, gap: 12 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  userMeta: { flex: 1, gap: 2 },
  nickname: { fontSize: 15, fontWeight: '600', color: '#111827' },
  subText: { fontSize: 12, color: '#6B7280' },
  arrow: { fontSize: 18, color: '#9CA3AF' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#374151' },
  sectionCard: { borderRadius: 8, backgroundColor: '#F9FAFB', padding: 4 },
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowLabel: { fontSize: 14, color: '#111827' },
  checkMark: { fontSize: 16, color: '#10B981', fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  logoutBtn: {
    marginTop: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: '#B91C1C' },
  versionText: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  pwdInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnSecondary: { backgroundColor: '#F3F4F6' },
  modalBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalBtnPrimary: { backgroundColor: '#10B981' },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
})
