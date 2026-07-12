import Taro from '@tarojs/taro'

export function saveImageToPhotosAlbum(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Taro.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        resolve()
      },
      fail: (err) => {
        const msg = String(err?.errMsg || '')
        if (msg.includes('auth') || msg.includes('deny')) {
          Taro.showModal({
            title: '授权提示',
            content: '需要相册权限才能保存图片，请前往设置开启',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) Taro.openSetting()
            },
          })
        } else {
          Taro.showToast({ title: '保存失败', icon: 'none' })
        }
        reject(err)
      },
    })
  })
}

export async function saveNetworkImageToAlbum(imageUrl: string): Promise<void> {
  const url = String(imageUrl || '').trim()
  if (!url) {
    Taro.showToast({ title: '图片地址为空', icon: 'none' })
    throw new Error('图片地址为空')
  }

  Taro.showLoading({ title: '正在保存...' })
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
