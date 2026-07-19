import { useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button } from '@ihui/ui-native'
import { updatePassword } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n, type Locale } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ThemeKey = 'light' | 'dark' | 'system'

const LANGS: Array<{ value: Locale; key: 'zhCN' | 'en' | 'ja' | 'ko' | 'zhTW' }> = [
  { value: 'zh-CN', key: 'zhCN' },
  { value: 'en', key: 'en' },
  { value: 'ja', key: 'ja' },
  { value: 'ko', key: 'ko' },
  { value: 'zh-TW', key: 'zhTW' },
]

const THEMES: ThemeKey[] = ['light', 'dark', 'system']

const APP_VERSION = '1.0.0'

export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n()
  const { user, logout } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [theme, setTheme] = useState<ThemeKey>('system')
  const [pushEnabled, setPushEnabled] = useState(true)
  const [msgEnabled, setMsgEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [pwdModalVisible, setPwdModalVisible] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  const onSelectLocale = (v: Locale) => {
    if (v === locale) return
    void setLocale(v)
    Alert.alert(t('settings.languageChanged'))
  }

  const onSelectTheme = (v: ThemeKey) => {
    setTheme(v)
    Alert.alert(t('settings.themeChanged'))
  }

  const onChangePassword = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) {
      Alert.alert(t('settings.pwdFieldsRequired'))
      return
    }
    if (newPwd.length < 6) {
      Alert.alert(t('settings.pwdTooShort'))
      return
    }
    if (newPwd !== confirmPwd) {
      Alert.alert(t('settings.pwdNotMatch'))
      return
    }
    setChangingPwd(true)
    const res = await updatePassword({ oldPassword: oldPwd, newPassword: newPwd })
    setChangingPwd(false)
    if (res.success) {
      Alert.alert(t('settings.pwdChanged'))
      setPwdModalVisible(false)
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } else {
      Alert.alert(t('common.failed'), res.error || t('settings.pwdChangeFailed'))
    }
  }

  const onAbout = () => {
    Alert.alert(
      t('settings.aboutTitle'),
      `${t('settings.appName')}\n${t('settings.version')}: ${APP_VERSION}\n${t('settings.aboutDesc')}`,
    )
  }

  const onLogout = () => {
    Alert.alert(t('settings.logoutConfirmTitle'), t('settings.logoutConfirmDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: () => void logout() },
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={styles.profileCard}>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>
              {(user?.nickname || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.profileBody}>
          <Text style={styles.profileName} numberOfLines={1}>
            {user?.nickname || t('settings.notLoggedIn')}
          </Text>
          <Text style={styles.profileSub} numberOfLines={1}>
            {user?.email || user?.phone || t('settings.guest')}
          </Text>
        </View>
        <Button
          onPress={() => navigation.navigate('ProfileEdit' as never)}
          variant="outline"
          size="sm"
        >
          {t('settings.editProfile')}
        </Button>
      </View>

      <SectionCard title={t('settings.sectionAccount')}>
        <SettingRow
          label={t('settings.editProfile')}
          onPress={() => navigation.navigate('ProfileEdit' as never)}
        />
        <SettingRow label={t('settings.changePassword')} onPress={() => setPwdModalVisible(true)} />
      </SectionCard>

      <SectionCard title={t('settings.sectionNotification')}>
        <SwitchRow
          label={t('settings.pushNotification')}
          value={pushEnabled}
          onValueChange={setPushEnabled}
        />
        <SwitchRow
          label={t('settings.messageReminder')}
          value={msgEnabled}
          onValueChange={setMsgEnabled}
        />
        <SwitchRow
          label={t('settings.emailNotification')}
          value={emailEnabled}
          onValueChange={setEmailEnabled}
        />
      </SectionCard>

      <SectionCard title={t('settings.sectionLanguage')}>
        <View style={styles.langGrid}>
          {LANGS.map((l) => (
            <TouchableOpacity
              key={l.value}
              onPress={() => onSelectLocale(l.value)}
              style={[styles.langItem, locale === l.value && styles.langItemActive]}
            >
              <Text style={[styles.langText, locale === l.value && styles.langTextActive]}>
                {t(`settings.lang_${l.key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      <SectionCard title={t('settings.sectionTheme')}>
        <View style={styles.langGrid}>
          {THEMES.map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => onSelectTheme(v)}
              style={[styles.langItem, theme === v && styles.langItemActive]}
            >
              <Text style={[styles.langText, theme === v && styles.langTextActive]}>
                {t(`settings.theme_${v}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      <SectionCard title={t('settings.sectionAbout')}>
        <SettingRow label={t('settings.aboutTitle')} onPress={onAbout} />
        <SettingRow
          label={t('settings.termsOfService')}
          onPress={() => Alert.alert(t('settings.termsOfService'), t('settings.termsDesc'))}
        />
        <SettingRow
          label={t('settings.privacyPolicy')}
          onPress={() => Alert.alert(t('settings.privacyPolicy'), t('settings.privacyDesc'))}
        />
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>{t('settings.version')}</Text>
          <Text style={styles.versionValue}>{APP_VERSION}</Text>
        </View>
      </SectionCard>

      <SectionCard title={t('menu.sectionMore')}>
        <SettingRow
          label={t('menu.settingsAccount')}
          onPress={() => navigation.navigate('SettingsAccount' as never)}
        />
        <SettingRow
          label={t('menu.notificationSettings')}
          onPress={() => navigation.navigate('NotificationSettings' as never)}
        />
        <SettingRow
          label={t('menu.securitySettings')}
          onPress={() => navigation.navigate('SecuritySettings' as never)}
        />
        <SettingRow
          label={t('menu.identityVerify')}
          onPress={() => navigation.navigate('IdentityVerify' as never)}
        />
        <SettingRow
          label={t('menu.privacy')}
          onPress={() => navigation.navigate('Privacy' as never)}
        />
        <SettingRow
          label={t('menu.agreement')}
          onPress={() => navigation.navigate('Agreement' as never)}
        />
        <SettingRow label={t('menu.about')} onPress={() => navigation.navigate('About' as never)} />
        <SettingRow label={t('menu.help')} onPress={() => navigation.navigate('Help' as never)} />
        <SettingRow
          label={t('menu.feedback')}
          onPress={() => navigation.navigate('Feedback' as never)}
        />
        <SettingRow
          label={t('menu.feedbackHistory')}
          onPress={() => navigation.navigate('FeedbackHistory' as never)}
        />
        <SettingRow
          label={t('menu.customerService')}
          onPress={() => navigation.navigate('CustomerService' as never)}
        />
        <SettingRow
          label={t('menu.announcement')}
          onPress={() => navigation.navigate('Announcement' as never)}
        />
        <SettingRow label={t('menu.debug')} onPress={() => navigation.navigate('Debug' as never)} />
      </SectionCard>

      <Button onPress={onLogout} variant="destructive">
        {t('auth.logout')}
      </Button>

      <Modal
        visible={pwdModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPwdModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings.changePassword')}</Text>
            <Text style={styles.modalLabel}>{t('settings.oldPassword')}</Text>
            <TextInput
              value={oldPwd}
              onChangeText={setOldPwd}
              secureTextEntry
              style={styles.modalInput}
              placeholder={t('settings.oldPasswordPlaceholder')}
            />
            <Text style={styles.modalLabel}>{t('settings.newPassword')}</Text>
            <TextInput
              value={newPwd}
              onChangeText={setNewPwd}
              secureTextEntry
              style={styles.modalInput}
              placeholder={t('settings.newPasswordPlaceholder')}
            />
            <Text style={styles.modalLabel}>{t('settings.confirmPassword')}</Text>
            <TextInput
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              secureTextEntry
              style={styles.modalInput}
              placeholder={t('settings.confirmPasswordPlaceholder')}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setPwdModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onChangePassword}
                disabled={changingPwd}
                style={styles.modalConfirmBtn}
              >
                <Text style={styles.modalConfirmText}>
                  {changingPwd ? t('common.loading') : t('common.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function SettingRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.settingRow}>
      <Text style={styles.settingRowLabel}>{label}</Text>
      <Text style={styles.settingRowArrow}>›</Text>
    </TouchableOpacity>
  )
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.settingRowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D5DB', true: '#10B981' }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6' },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '600', color: '#4B5563' },
  profileBody: { flex: 1, marginLeft: 12 },
  profileName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  profileSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  sectionBody: { gap: 4 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingRowLabel: { fontSize: 14, color: '#111827' },
  settingRowArrow: { fontSize: 18, color: '#9CA3AF' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  langItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  langItemActive: { backgroundColor: '#10B981' },
  langText: { fontSize: 12, color: '#6B7280' },
  langTextActive: { color: '#FFFFFF' },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  versionLabel: { fontSize: 14, color: '#111827' },
  versionValue: { fontSize: 12, color: '#9CA3AF' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    width: '100%',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  modalLabel: { fontSize: 12, color: '#6B7280', marginTop: 8, marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: { fontSize: 13, color: '#6B7280' },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  modalConfirmText: { fontSize: 13, color: '#FFFFFF' },
})
