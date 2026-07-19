import { useEffect, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button } from '@ihui/ui-native'
import { getProfile, updateProfile, type AuthUser } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type Gender = 0 | 1 | 2

const GENDERS: Array<{ value: Gender; key: 'male' | 'female' | 'secret' }> = [
  { value: 1, key: 'male' },
  { value: 2, key: 'female' },
  { value: 0, key: 'secret' },
]

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
        <TextInput
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
              <Text
                style={[styles.genderText, gender === g.value && styles.genderTextActive]}
              >
                {t(`profileEdit.gender_${g.key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>{t('profileEdit.bio')}</Text>
        <TextInput
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
            <TextInput
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  avatarWrap: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#F3F4F6' },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
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
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadgeText: { fontSize: 12, color: '#FFFFFF' },
  avatarTip: { fontSize: 11, color: '#9CA3AF' },
  fieldCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  bioInput: { minHeight: 80, paddingTop: 8 },
  bioCounter: { fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  genderItemActive: { backgroundColor: '#10B981' },
  genderText: { fontSize: 12, color: '#6B7280' },
  genderTextActive: { color: '#FFFFFF' },
  errorBar: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  errorText: { fontSize: 12, color: '#DC2626' },
  emptyText: { fontSize: 12, color: '#6B7280' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 16, width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  modalLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  modalHint: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
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
