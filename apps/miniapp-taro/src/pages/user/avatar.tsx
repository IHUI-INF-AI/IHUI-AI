import { logger } from '@/utils/logger'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getProfile, updateUserAvatar } from '@/api'
import { uploadImage } from '@/utils/upload-image'
import { useI18n } from '@/i18n'
import './avatar.css'

const DEFAULT_AVATAR = '/static/default-avatar.png'

export default function Avatar() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [avatar, setAvatar] = useState('')
  const [nickname, setNickname] = useState('')
  const [uploading, setUploading] = useState(false)

  useDidShow(async () => {
    try {
      const profile = await getProfile()
      setAvatar(profile.avatar || '')
      setNickname(profile.nickname || '')
    } catch (e) {
      logger.error('user/avatar', '获取用户信息', e)
      Taro.showToast({ title: tt('common.failed', '加载失败'), icon: 'none' })
    }
  })

  /** 大图预览当前头像 */
  const previewAvatar = () => {
    const url = avatar || DEFAULT_AVATAR
    Taro.previewImage({
      current: url,
      urls: [url],
    })
  }

  /** 选图 + 上传通用流程:相册 / 拍照 */
  const pickAndUpload = (sourceType: 'album' | 'camera') => {
    if (uploading) return
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed', 'original'],
      sourceType: [sourceType],
      success: async (res) => {
        const tempPath = res.tempFilePaths && res.tempFilePaths[0]
        if (!tempPath) return
        // 立即预览新图,提升体验
        setAvatar(tempPath)
        setUploading(true)
        Taro.showLoading({ title: tt('user.avatar.uploading', '上传中…') })
        try {
          // 1. 上传文件到文件服务,拿到 URL
          const uploaded = await uploadImage(tempPath, '/files/upload')
          if (!uploaded.url) {
            throw new Error(tt('user.avatar.noUrl', '上传成功但未返回 URL'))
          }
          // 2. 把 URL 写入用户资料
          await updateUserAvatar(uploaded.url)
          setAvatar(uploaded.url)
          Taro.showToast({
            title: tt('user.avatar.updateSuccess', '头像已更新'),
            icon: 'success',
          })
        } catch (e) {
          // 上传失败:回退到旧头像
          logger.error('user/avatar', '上传头像失败', e)
          Taro.showToast({
            title: tt('user.avatar.updateFailed', '更新头像失败'),
            icon: 'none',
          })
          // 重新拉取 profile 以恢复旧头像
          try {
            const profile = await getProfile()
            setAvatar(profile.avatar || '')
          } catch {
            // 忽略
          }
        } finally {
          setUploading(false)
          Taro.hideLoading()
        }
      },
      fail: (err) => {
        const msg = String(err?.errMsg || '').toLowerCase()
        if (msg.includes('cancel')) return // 用户取消,静默
        logger.error('user/avatar', '选图失败', err)
        Taro.showToast({
          title: tt('user.avatar.chooseFailed', '选图失败'),
          icon: 'none',
        })
      },
    })
  }

  const chooseFromAlbum = () => pickAndUpload('album')
  const takePhoto = () => pickAndUpload('camera')

  return (
    <View className="avatar-page">
      {/* ===== 当前头像预览 ===== */}
      <View className="avatar-preview-wrap">
        <View className="avatar-preview-box" onClick={previewAvatar}>
          <Image
            className="avatar-preview-img"
            src={avatar || DEFAULT_AVATAR}
            mode="aspectFill"
          />
          <View className="avatar-preview-tip">
            <Text className="avatar-preview-tip-text">
              {tt('user.avatar.tapPreview', '点击查看大图')}
            </Text>
          </View>
        </View>
        {nickname ? (
          <Text className="avatar-nickname">{nickname}</Text>
        ) : null}
      </View>

      {/* ===== 操作按钮 ===== */}
      <View className="avatar-actions">
        <Button
          className="avatar-btn avatar-btn-primary"
          onClick={chooseFromAlbum}
          disabled={uploading}
        >
          {tt('user.avatar.fromAlbum', '从相册选择')}
        </Button>
        <Button
          className="avatar-btn avatar-btn-outline"
          onClick={takePhoto}
          disabled={uploading}
        >
          {tt('user.avatar.takePhoto', '拍照')}
        </Button>
      </View>

      {/* ===== 提示文案 ===== */}
      <View className="avatar-hint">
        <Text className="avatar-hint-line">
          {tt('user.avatar.formatHint', '支持 JPG、PNG 格式')}
        </Text>
        <Text className="avatar-hint-line">
          {tt('user.avatar.sizeHint', '建议尺寸 200×200')}
        </Text>
        <Text className="avatar-hint-line avatar-hint-muted">
          {tt('user.avatar.previewHint', '点击头像可查看大图')}
        </Text>
      </View>

      {uploading && (
        <View className="avatar-loading-mask">
          <Text className="avatar-loading-text">
            {tt('user.avatar.uploading', '上传中…')}
          </Text>
        </View>
      )}
    </View>
  )
}
