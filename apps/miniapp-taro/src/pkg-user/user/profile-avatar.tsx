// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 头像更换的平台动作(无渲染):选图 → 上传 → 落库 → 回报服务端 URL
// 取证(2026-10-30):PUT /user/avatar(miniapp-compat-routes.ts)把收到的字符串原样写进
// users.avatar,端内不做任何转存。旧形态把 chooseImage 的**本机临时路径**直接交给
// updateUserAvatar ⇒ 库里存下 wxfile://… 这类只在当次会话可读的路径,下次进页面/换设备即碎图。
// 正解与本目录 avatar.tsx 同一套:先 uploadImage 拿服务端 URL,再把 URL 交给 PUT。
// 薄壳后渲染全部归共享屏 ProfileScreen(头像点击走注入点 onAvatarPress),此文件只保留平台动作。
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useI18n } from '@/i18n'
import { updateUserAvatar } from '@/api'
import { uploadImage } from '@/utils/upload-image'
import { logger } from '@/utils/logger'
import { onToast } from '@/host/on-toast'

/** 选图/上传/落库三段的平台实现;成功后把服务端 URL 回报给页面写回 form */
export function useAvatarUpload(onAvatarSaved: (url: string) => void) {
  const { t } = useI18n()
  const [uploading, setUploading] = useState(false)

  const chooseAvatar = () => {
    if (uploading) return
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: async (res) => {
        const path = res.tempFilePaths && res.tempFilePaths[0]
        if (!path) return
        setUploading(true)
        Taro.showLoading({ title: t('user.profile.avatarUploading') })
        try {
          const uploaded = await uploadImage(path, '/files/upload')
          if (!uploaded.url) throw new Error(t('user.avatar.noUrl'))
          await updateUserAvatar(uploaded.url)
          onAvatarSaved(uploaded.url)
          Taro.hideLoading()
          onToast(t('user.avatar.updateSuccess'), { kind: 'success' })
        } catch (e) {
          logger.error('user/profile', '更新头像', e)
          Taro.hideLoading()
          onToast(t('user.profile.avatarUpdateFailed'), { kind: 'error' })
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

  return { uploading, chooseAvatar }
}

export default useAvatarUpload
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
