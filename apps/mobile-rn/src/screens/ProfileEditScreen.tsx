import { useEffect, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { tokens } from '@ihui/rn-app'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Input } from '@ihui/ui-native'
import { getProfile, updateProfile, type AuthUser } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { Gender, GENDERS, GENDER_KEYS } from '@ihui/shared/constants'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>



export function ProfileEditScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<Gender>(0)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [avatarModalVisible, setAvatarModalVisible] = useState(false)
  const [avatarInput, setAvatarInput] = useState('')

  const fetchProfile = async () => {
    if (!token) {
      setLoading(false)
      setError(t('profileEdit.notLoggedIn'))
      return
    }
    setLoading(true)
    setError('')
    const res = await getProfile()
    setLoading(false)
    if (res.success) {
      setProfile(res.data)
      setNickname(res.data.nickname ?? '')
      setBio(res.data.bio ?? '')
      setGender((res.data.gender ?? 0) as Gender)
      setAvatar(res.data.avatar ?? null)
    } else {
      setError(res.error || t('profileEdit.loadFailed'))
    }
  }

  useEffect(() => {
    void fetchProfile()
  }, [token])

  const onSave = async () => {
    if (!nickname.trim()) {
      Alert.alert(t('profileEdit.nicknameRequired'))
      return
    }
    setSaving(true)
    setError('')
    const res = await updateProfile({
      nickname: nickname.trim(),
      bio: bio.trim() || null,
      gender,
      avatar: avatar || null,
    })
    setSaving(false)
    if (res.success) {
      Alert.alert(t('profileEdit.saved'))
      navigation.goBack()
    } else {
      setError(res.error || t('profileEdit.saveFailed'))
    }
  }

  const onOpenAvatarModal = () => {
    setAvatarInput(avatar ?? '')
    setAvatarModalVisible(true)
  }

  const onConfirmAvatar = () => {
    setAvatar(avatarInput.trim() || null)
    setAvatarModalVisible(false)
  }

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !profile) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.errorText}>{error}</Text>
        <View style={{ height: 12 }} />
        <Button onPress={fetchProfile} variant="outline" size="sm">
          {t('profileEdit.retry')}
        </Button>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('profileEdit.title')}</Text>
      </View>

      <View style={styles.avatarWrap}>
        <TouchableOpacity onPress={onOpenAvatarModal} activeOpacity={0.8}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarEmoji}>📷</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditBadgeText}>✎</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarTip}>{t('profileEdit.avatarTip')}</Text>
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{t('profileEdit.nickname')}</Text>
        <Input
          value={nickname}
          onChangeText={setNickname}
          style={styles.fieldInput}
          placeholder={t('profileEdit.nicknamePlaceholder')}
          maxLength={32}
        />
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{t('profileEdit.gender')}</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g.value}
              onPress={() => setGender(g.value)}
              style={[styles.genderItem, gender === g.value && styles.genderItemActive]}
            >
              <Text style={[styles.genderText, gender === g.value && styles.genderTextActive]}>
                {t(GENDER_KEYS[g.key])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{t('profileEdit.bio')}</Text>
        <Input
          className="h-auto min-h-[120px]"
          value={bio}
          onChangeText={setBio}
          style={[styles.fieldInput, styles.bioInput]}
          placeholder={t('profileEdit.bioPlaceholder')}
          multiline
          maxLength={200}
          textAlignVertical="top"
        />
        <Text style={styles.bioCounter}>{bio.length}/200</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button onPress={onSave} loading={saving} disabled={saving}>
        {saving ? t('profileEdit.saving') : t('profileEdit.save')}
      </Button>

      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profileEdit.avatarModalTitle')}</Text>
            <Text style={styles.modalLabel}>{t('profileEdit.avatarUrlLabel')}</Text>
            <Input
              value={avatarInput}
              onChangeText={setAvatarInput}
              style={styles.modalInput}
              placeholder={t('profileEdit.avatarUrlPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.modalHint}>{t('profileEdit.avatarUrlHint')}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setAvatarModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onConfirmAvatar} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.muted },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  avatarWrap: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 8, backgroundColor: tokens.surface.card },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 28 },
  avatarEditBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadgeText: { fontSize: 12, color: tokens.surface.light },
  avatarTip: { fontSize: 11, color: tokens.text.tertiary },
  fieldCard: {
    backgroundColor: tokens.surface.light,
    borderRadius: 8,
    padding: 12,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: tokens.text.secondary, marginBottom: 8 },
  fieldInput: {
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: tokens.text.primary,
  },
  bioInput: { minHeight: 80, paddingTop: 8 },
  bioCounter: { fontSize: 10, color: tokens.text.tertiary, textAlign: 'right', marginTop: 4 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
  },
  genderItemActive: { backgroundColor: tokens.brand.DEFAULT },
  genderText: { fontSize: 12, color: tokens.text.secondary },
  genderTextActive: { color: tokens.surface.light },
  errorBar: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  errorText: { fontSize: 12, color: tokens.error.text },
  emptyText: { fontSize: 12, color: tokens.text.secondary },
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: tokens.surface.light, borderRadius: 8, padding: 16, width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: tokens.text.primary, marginBottom: 12 },
  modalLabel: { fontSize: 12, color: tokens.text.secondary, marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: tokens.text.primary,
  },
  modalHint: { fontSize: 11, color: tokens.text.tertiary, marginTop: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  modalCancelText: { fontSize: 13, color: tokens.text.secondary },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
  },
  modalConfirmText: { fontSize: 13, color: tokens.surface.light },
})
