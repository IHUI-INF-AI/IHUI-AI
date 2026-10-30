// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 头像更换区(点击头像 → 选图 → 上传 → 落库 → 回显)
// 取证(2026-10-30):PUT /user/avatar(miniapp-compat-routes.ts)把收到的字符串原样写进
// users.avatar,端内不做任何转存。旧形态在这里把 chooseImage 的**本机临时路径**直接交给
// updateUserAvatar ⇒ 库里存下 wxfile://… 这类只在当次会话可读的路径,下次进页面/换设备即碎图。
// 正解与本目录 avatar.tsx 同一套:先 uploadImage 拿服务端 URL,再把 URL 交给 PUT。
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useI18n } from '@/i18n'
import { updateUserAvatar } from '@/api'
import { uploadImage } from '@/utils/upload-image'
import { logger } from '@/utils/logger'
import LineIcon from '@/components/LineIcon'

interface ProfileAvatarProps {
  /** GET /user/profile 回的真值(users.avatar) */
  avatar?: string
  /** 上传+落库都成功后回报服务端 URL,由页面写回 form */
  onAvatarSaved: (url: string) => void
}

export default function ProfileAvatar({ avatar, onAvatarSaved }: ProfileAvatarProps) {
  const { t } = useI18n()
  const [uploading, setUploading] = useState(false)
  // 仅本机预览(选中但未落库)的临时路径;落库成功后由 avatar 真值接管
  const [picked, setPicked] = useState('')

  const chooseAvatar = () => {
    if (uploading) return
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: async (res) => {
        const path = res.tempFilePaths && res.tempFilePaths[0]
        if (!path) return
        setPicked(path)
        setUploading(true)
        Taro.showLoading({ title: t('user.profile.avatarUploading') })
        try {
          const uploaded = await uploadImage(path, '/files/upload')
          if (!uploaded.url) throw new Error(t('user.avatar.noUrl'))
          await updateUserAvatar(uploaded.url)
          onAvatarSaved(uploaded.url)
          setPicked('')
          Taro.hideLoading()
          Taro.showToast({ title: t('user.avatar.updateSuccess'), icon: 'success' })
        } catch (e) {
          logger.error('user/profile', '更新头像', e)
          setPicked('')
          Taro.hideLoading()
          Taro.showToast({ title: t('user.profile.avatarUpdateFailed'), icon: 'none' })
        } finally {
          setUploading(false)
        }
      },
      fail: (err) => {
        const msg = String(err?.errMsg || '').toLowerCase()
        if (msg.includes('cancel')) return
        logger.error('user/profile', '选择头像', err)
      },
    })
  }

  return (
    <View className="pf-section">
      <Text className="pf-section-title">{t('user.profile.avatar')}</Text>
      <View className="pf-section-card">
        <View className="pf-item pf-item-avatar" hoverClass="opacity-60" onClick={chooseAvatar}>
          <View className="pf-avatar-wrap">
            <Image
              className="pf-avatar-img"
              src={picked || avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <View className="pf-avatar-edit-tip">
              <Text>
                {uploading ? t('user.profile.avatarUploading') : t('user.profile.changeAvatar')}
              </Text>
            </View>
          </View>
          <Text className="pf-avatar-hint">{t('user.profile.clickToChange')}</Text>
          <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
