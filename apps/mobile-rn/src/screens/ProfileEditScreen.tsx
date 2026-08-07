import { useCallback, useEffect, useState } from 'react'
import { Alert, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getProfile, updateProfile } from '@ihui/api-client'
import { ProfileEditScreen as SharedProfileEditScreen, type Gender } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ProfileEditScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<Gender>(0)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [avatarModalVisible, setAvatarModalVisible] = useState(false)
  const [avatarInput, setAvatarInput] = useState('')

  const fetchProfile = useCallback(async () => {
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
      setNickname(res.data.nickname ?? '')
      setBio(res.data.bio ?? '')
      setGender((res.data.gender ?? 0) as Gender)
      setAvatar(res.data.avatar ?? null)
    } else {
      setError(res.error || t('profileEdit.loadFailed'))
    }
  }, [token, t])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

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

  return (
    <View style={{ flex: 1 }}>
      <NavBar
        title={t('profileEdit.title')}
        onBack={() => navigation.goBack()}
      />
      <SharedProfileEditScreen
        t={t}
        nickname={nickname}
        bio={bio}
        gender={gender}
        avatar={avatar}
        loading={loading}
        saving={saving}
        error={error}
        avatarModalVisible={avatarModalVisible}
        avatarInput={avatarInput}
        onNicknameChange={setNickname}
        onBioChange={setBio}
        onGenderChange={setGender}
        onOpenAvatarModal={onOpenAvatarModal}
        onCloseAvatarModal={() => setAvatarModalVisible(false)}
        onAvatarInputChange={setAvatarInput}
        onConfirmAvatar={onConfirmAvatar}
        onSave={onSave}
        onRetry={fetchProfile}
        onBack={() => navigation.goBack()}
      />
    </View>
  )
}
