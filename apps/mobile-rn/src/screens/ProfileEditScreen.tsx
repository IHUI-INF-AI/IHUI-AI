import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getProfile, updateProfile } from '@ihui/api-client'
import { ProfileEditScreen as SharedProfileEditScreen, type Gender } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 对齐 Uniapp components/loginPopUp/index.vue 昵称校验:最长 8 字符 */
const NICKNAME_MAX_LENGTH = 8

/**
 * 对齐说明:Uniapp 历史项目无独立资料编辑页(仅 loginPopUp 昵称输入 + UserInfoCardOld「修改资料」入口),
 * - 单导航栏:移除 wrapper 层 NavBar,消除与 shared header 的双标题栏(Uniapp 仅一层 navigation-bars)
 * - 缺失 key 兜底:mobile-rn/shared zh-CN 暂无 profileEdit.avatarTip 等 key
 *   (translate 缺 key 返回 key 本身),文案参照 shared user.profile 命名空间,中文硬编码
 */
const UNIAPP_TEXT: Record<string, string> = {
  'profileEdit.avatarTip': '点击更换头像',
  'profileEdit.nicknamePlaceholder': '请输入昵称',
  'profileEdit.bioPlaceholder': '介绍一下自己吧',
  'profileEdit.avatarModalTitle': '更换头像',
  'profileEdit.avatarUrlLabel': '头像链接',
  'profileEdit.avatarUrlPlaceholder': '请输入头像 URL',
  'profileEdit.avatarUrlHint': '支持 JPG / PNG,建议 200x200',
  // 对齐 Uniapp loginPopUp:「昵称过长 不能超过8个字符」
  'profileEdit.nicknameTooLong': '昵称过长 不能超过8个字符',
}

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

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setLoading(false)
      setError(uniappT('profileEdit.notLoggedIn'))
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
      setError(res.error || uniappT('profileEdit.loadFailed'))
    }
  }, [token, uniappT])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  const onSave = async () => {
    // 对齐 Uniapp loginPopUp 校验顺序:空昵称 → 超长
    if (!nickname.trim()) {
      Alert.alert(uniappT('profileEdit.nicknameRequired'))
      return
    }
    if (nickname.trim().length > NICKNAME_MAX_LENGTH) {
      Alert.alert(uniappT('profileEdit.nicknameTooLong'))
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
      // uni.showToast(上传成功) → RN Alert
      Alert.alert(uniappT('profileEdit.saved'))
      navigation.goBack()
    } else {
      setError(res.error || uniappT('profileEdit.saveFailed'))
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
    <SharedProfileEditScreen
      t={uniappT}
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
  )
}
