import Taro from '@tarojs/taro'
import { t } from '@/i18n'

export function saveImageToPhotosAlbum(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Taro.saveImageToPhotosAlbum({
    filePath,
    success: () => {
      Taro.showToast({ title: t('album.saveSuccess'), icon: 'success' })
      resolve()
    },
    fail: (err) => {
      const msg = String(err?.errMsg || '')
      if (msg.includes('auth') || msg.includes('deny')) {
        Taro.showModal({
          title: t('album.authTitle'),
          content: t('album.authContent'),
          confirmText: t('common.goSettings'),
          success: (res) => {
            if (res.confirm) Taro.openSetting()
          },
        })
      } else {
        Taro.showToast({ title: t('album.saveFailed'), icon: 'none' })
      }
      reject(err)
    },
  })
  })
}

export async function saveNetworkImageToAlbum(imageUrl: string): Promise<void> {
  const url = String(imageUrl || '').trim()
  if (!url) {
    Taro.showToast({ title: t('album.urlEmpty'), icon: 'none' })
    throw new Error('图片地址为空')
  }

  Taro.showLoading({ title: t('album.saving') })
  try {
    const res = await Taro.downloadFile({ url })
    if (res.statusCode !== 200 || !res.tempFilePath) {
      throw new Error('下载失败')
    }
    await saveImageToPhotosAlbum(res.tempFilePath)
  } catch (err) {
    Taro.hideLoading()
    throw err
  }
}
