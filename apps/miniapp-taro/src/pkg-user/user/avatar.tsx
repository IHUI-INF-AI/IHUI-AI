// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/profile-edit/ProfileEditScreen.tsx(AvatarEditor 头像编辑共享组件)
import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import { AvatarEditor } from '@ihui/rn-app/features/profile-edit/ProfileEditScreen'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getProfile, updateUserAvatar } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { uploadImage } from '@/utils/upload-image'
import ThemeRoot from '@/components/ThemeRoot'
import { onToast } from '@/host/on-toast'

const DEFAULT_AVATAR = '/static/default-avatar.png'

/** 共享 AvatarEditor 缺失 key 的中文兜底 */
const AVATAR_TEXT: Record<string, string> = {
  'user.avatar.fromAlbum': '从相册选择',
  'user.avatar.takePhoto': '拍照',
  'user.avatar.uploading': '上传中…',
  'user.avatar.formatHint': '支持 JPG、PNG 格式',
  'user.avatar.sizeHint': '建议尺寸 200×200',
  'user.avatar.noUrl': '上传成功但未返回 URL',
  'user.avatar.updateSuccess': '头像已更新',
  'user.avatar.updateFailed': '更新头像失败',
}

export default function Avatar() {
  const tt = useTt()
  const gate = useAuthReadyGate()

  const [avatar, setAvatar] = useState('')
  const [nickname, setNickname] = useState('')
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  useDidShow(() => {
    // G-933 冷启动门控:GET /user/profile(checkAuth)需鉴权,落定前不发
    gate.waitUntilReady(() => {
      void (async () => {
        try {
          const profile = await getProfile()
          setAvatar(profile.avatar || '')
          setNickname(profile.nickname || '')
        } catch (e) {
          logger.error('user/avatar', '获取用户信息', e)
          onToast(tt('common.failed', '加载失败'), { kind: 'error' })
        }
      })()
    })
  })

  /** 大图预览当前头像 */
  const previewAvatar = () => {
    const url = avatar || DEFAULT_AVATAR
    Taro.previewImage({
      current: url,
      urls: [url],
    })
  }

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const t = (key: string, params?: Record<string, string | number>) =>
    tt(key, AVATAR_TEXT[key] ?? key, params)

  /** 选图 + 上传通用流程:相册 / 拍照(平台 API 只在本端,共享组件零平台 API) */
  const pickAndUpload = (sourceType: 'album' | 'camera') => {
    if (uploading) return
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed', 'original'],
      sourceType: [sourceType],
      success: async (res) => {
        const tempPath = res.tempFilePaths && res.tempFilePaths[0]
        if (!tempPath) return
        const previousAvatar = avatar
        // 立即预览新图,提升体验
        setAvatar(tempPath)
        setAvatarError('')
        setUploading(true)
        try {
          // 1. 上传文件到文件服务,拿到 URL
          const uploaded = await uploadImage(tempPath, '/files/upload')
          if (!uploaded.url) {
            throw new Error(t('user.avatar.noUrl'))
          }
          // 2. 把 URL 写入用户资料
          await updateUserAvatar(uploaded.url)
          setAvatar(uploaded.url)
          onToast(t('user.avatar.updateSuccess'), { kind: 'success' })
        } catch (e) {
          // 上传失败:回退到旧头像
          logger.error('user/avatar', '上传头像失败', e)
          setAvatarError(t('user.avatar.updateFailed'))
          setAvatar(previousAvatar)
          onToast(t('user.avatar.updateFailed'), { kind: 'error' })
        } finally {
          setUploading(false)
        }
      },
      fail: (err) => {
        const msg = String(err?.errMsg || '').toLowerCase()
        if (msg.includes('cancel')) return // 用户取消,静默
        logger.error('user/avatar', '选图失败', err)
        setAvatarError(t('user.avatar.updateFailed'))
        onToast(t('user.avatar.updateFailed'), { kind: 'error' })
      },
    })
  }

  /** URL 入口(AvatarEditor 的 onUpload):写入头像链接 */
  const applyAvatarUrl = async (url: string) => {
    const next = url.trim()
    if (!next) return
    const previousAvatar = avatar
    setAvatar(next)
    setAvatarError('')
    try {
      await updateUserAvatar(next)
      onToast(t('user.avatar.updateSuccess'), { kind: 'success' })
    } catch (e) {
      logger.error('user/avatar', '更新头像链接失败', e)
      setAvatarError(t('user.avatar.updateFailed'))
      setAvatar(previousAvatar)
    }
  }

  return (
    <ThemeRoot>
      <AvatarEditor
        t={t}
        currentUrl={avatar || null}
        onPickFromAlbum={() => pickAndUpload('album')}
        onPickFromCamera={() => pickAndUpload('camera')}
        onUpload={(url) => void applyAvatarUrl(url)}
        uploading={uploading}
        error={avatarError || undefined}
        onPreview={previewAvatar}
        nickname={nickname}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
