// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { getProfile, resolveFileUrl, updateProfile, uploadFileMultipart } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  AvatarEditor,
  ProfileEditScreen as SharedProfileEditScreen,
  type Gender,
} from '@ihui/rn-app'
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
  'profileEdit.avatarUrlApply': '应用头像链接',
  'profileEdit.avatarPermissionDenied': '需要相册/相机权限才能更换头像',
  'profileEdit.avatarUploadFailed': '头像上传失败',
  'profileEdit.avatarUrlEmpty': '请输入头像链接',
  'user.avatar.fromAlbum': '从相册选择',
  'user.avatar.takePhoto': '拍照',
  'user.avatar.uploading': '上传中…',
  'user.avatar.formatHint': '支持 JPG / PNG',
  'user.avatar.sizeHint': '建议 200x200',
  // 对齐 Uniapp loginPopUp:「昵称过长 不能超过8个字符」
  'profileEdit.nicknameTooLong': '昵称过长 不能超过8个字符',
}

export function ProfileEditScreen() {
  const { resolvedTheme } = useTheme()
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
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')

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
      setError(apiFailureToText(res, uniappT('profileEdit.loadFailed')))
    }
  }, [token, uniappT])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  const onSave = async () => {
    // 对齐 Uniapp loginPopUp 校验顺序:空昵称 → 超长
    if (!nickname.trim()) {
      appAlert(uniappT('profileEdit.nicknameRequired'))
      return
    }
    if (nickname.trim().length > NICKNAME_MAX_LENGTH) {
      appAlert(uniappT('profileEdit.nicknameTooLong'))
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
      appAlert(uniappT('profileEdit.saved'))
      navigation.goBack()
    } else {
      setError(apiFailureToText(res, uniappT('profileEdit.saveFailed')))
    }
  }

  const pickAvatar = useCallback(
    async (source: 'album' | 'camera') => {
      if (avatarUploading) return
      setAvatarError('')
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setAvatarError(uniappT('profileEdit.avatarPermissionDenied'))
        return
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            })
      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset?.uri) return
      const previousAvatar = avatar
      setAvatar(asset.uri)
      setAvatarUploading(true)
      const uploaded = await uploadFileMultipart(
        {
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: asset.fileName ?? `avatar_${Date.now()}.jpg`,
        },
        {
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          maxSize: 10 * 1024 * 1024,
        },
      )
      setAvatarUploading(false)
      if (uploaded.success) {
        setAvatar(resolveFileUrl(uploaded.data.path))
      } else {
        setAvatar(previousAvatar)
        setAvatarError(apiFailureToText(uploaded, uniappT('profileEdit.avatarUploadFailed')))
      }
    },
    [avatar, avatarUploading, uniappT],
  )

  const onUploadAvatarUrl = (url: string) => {
    if (!url) {
      setAvatarError(uniappT('profileEdit.avatarUrlEmpty'))
      return
    }
    setAvatarError('')
    setAvatar(url)
  }

  const onPreviewAvatar = () => {
    if (!avatar) {
      appAlert(uniappT('user.avatar.fromAlbum'))
      return
    }
    appAlert(avatar)
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
      avatarEditor={
        <AvatarEditor
          t={uniappT}
          currentUrl={avatar}
          onPickFromAlbum={() => void pickAvatar('album')}
          onPickFromCamera={() => void pickAvatar('camera')}
          onUpload={onUploadAvatarUrl}
          uploading={avatarUploading}
          error={avatarError}
          onPreview={onPreviewAvatar}
          nickname={nickname}
          showUrlEntry
          colorScheme={resolvedTheme}
        />
      }
      onNicknameChange={setNickname}
      onBioChange={setBio}
      onGenderChange={setGender}
      onSave={onSave}
      onRetry={fetchProfile}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
