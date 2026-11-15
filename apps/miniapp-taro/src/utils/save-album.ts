// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { t } from '@/i18n'
import Taro from '@tarojs/taro'
import { onToast } from '@/host/on-toast'

export function saveImageToPhotosAlbum(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Taro.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        onToast(t('album.saveSuccess'), { kind: 'success' })
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
          onToast(t('album.saveFailed'), { kind: 'error' })
        }
        reject(err)
      },
    })
  })
}

export async function saveNetworkImageToAlbum(imageUrl: string): Promise<void> {
  const url = String(imageUrl || '').trim()
  if (!url) {
    onToast(t('album.urlEmpty'), { kind: 'error' })
    throw new Error(t('album.urlEmpty'))
  }

  Taro.showLoading({ title: t('album.saving') })
  let tempPath = ''
  let downloadError: unknown = null
  try {
    const res = await Taro.downloadFile({ url })
    if (res.statusCode !== 200 || !res.tempFilePath) {
      throw new Error(t('ai.chatMessageItem.downloadFailed'))
    }
    tempPath = res.tempFilePath
  } catch (e) {
    downloadError = e
  } finally {
    // XUI-037:成功分支也必须关闭 loading,否则成功保存后遮罩常驻。
    Taro.hideLoading()
  }
  // 下载失败此前整条**静默**:本文件只在相册写入失败时 toast,下载失败是直接抛出去 ——
  // 唯一调用方(recruitment/index/index.tsx:43)写的是 `.catch(() => {})`,
  // 于是用户长按二维码后只看到 loading 消失:既没有成功提示也没有失败提示,
  // 分不清"存进相册了"还是"根本没下载下来"(弱网 / 图片 404 是最常见的两种)。
  // 现在在抛之前先响一次;调用方的 .catch 只负责吃掉 rejection,不再负责提示。
  if (downloadError) {
    onToast(t('album.saveFailed'), { kind: 'error' })
    throw downloadError
  }
  // loading 已关,再把相册写入交给 saveImageToPhotosAlbum —— 它在成功分支自己 toast。
  // 不能反过来:weapp 的 showLoading / showToast 共用同一层浮层,若在它的 toast 之后
  // 才 hideLoading,成功提示会被一并关掉(「存成功但提示闪没」)。
  await saveImageToPhotosAlbum(tempPath)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
