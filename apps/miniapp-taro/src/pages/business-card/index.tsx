import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

type StoredData = {
  uuid?: string
  thirdPartyAccounts?: { card?: string } & Record<string, unknown>
} & Record<string, unknown>

export default function BusinessCardIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const [card, setCard] = useState('')
  const [isShow, setIsShow] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadCardData = useCallback(() => {
    const data = (Taro.getStorageSync('data') || {}) as StoredData
    const cardUrl = data?.thirdPartyAccounts?.card || ''
    setCard(cardUrl)
    setIsShow(Boolean(cardUrl))
  }, [])

  useDidShow(loadCardData)

  const onUploadClick = useCallback(async () => {
    if (uploading) return
    setUploading(true)
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const tempPath = res.tempFilePaths?.[0]
      if (!tempPath) return
      const data = (Taro.getStorageSync('data') || {}) as StoredData
      const uuid = data.uuid || ''
      await api.updateBusinessCard({ uuid, card: tempPath })
      const merged: StoredData = {
        ...data,
        thirdPartyAccounts: { ...(data.thirdPartyAccounts || {}), card: tempPath },
      }
      Taro.setStorageSync('data', merged)
      setCard(tempPath)
      setIsShow(true)
      Taro.showToast({ title: tt('businessCard.uploaded', '名片已上传'), icon: 'success' })
    } catch {
      // ignore
    } finally {
      setUploading(false)
    }
  }, [uploading, tt])

  const onSaveAlbum = useCallback(async () => {
    if (!card) return
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: card })
      Taro.showToast({ title: tt('businessCard.savedToAlbum', '已保存到相册'), icon: 'success' })
    } catch {
      Taro.showToast({ title: tt('businessCard.saveFailed', '保存失败'), icon: 'none' })
    }
  }, [card, tt])

  const buyToken = useCallback(() => {
    Taro.navigateTo({ url: '/pages/wallet/recharge/index' })
  }, [])

  const onBack = useCallback(() => {
    Taro.navigateBack({ delta: 1 })
  }, [])

  const shareTitle = tt('businessCard.shareTitle', '我的社区名片')

  useShareAppMessage(() => ({
    title: shareTitle,
    path: '/pages/business-card/index',
    imageUrl: card,
  }))

  useShareTimeline(() => ({
    title: shareTitle,
    imageUrl: card,
  }))

  return (
    <View className="card-page">
      <View className="page-header">
        <Text className="back-btn" onClick={onBack}>
          ‹
        </Text>
        <Text className="page-title">{tt('businessCard.title', '我的社区名片')}</Text>
      </View>

      <View className="card-entry" onClick={buyToken}>
        <Text className="card-entry-icon">👤</Text>
        <Text className="card-entry-text">{tt('businessCard.customEntry', '社区名片定制入口')}</Text>
        <Text className="card-entry-arrow">›</Text>
      </View>

      <View className="card-content">
        {isShow && card ? (
          <View className="card-preview">
            <Image className="card-image" src={card} mode="widthFix" />
            <View className="card-actions">
              <Button
                className="action-btn"
                loading={uploading}
                disabled={uploading}
                onClick={onUploadClick}
              >
                {tt('businessCard.reupload', '重新上传')}
              </Button>
              <Button className="action-btn" onClick={onSaveAlbum}>
                {tt('businessCard.saveToAlbum', '保存到相册')}
              </Button>
              <Button className="action-btn" openType="share">
                {tt('businessCard.shareWx', '分享给好友')}
              </Button>
              <Button className="action-btn" openType={'shareTimeline' as 'share'}>
                {tt('businessCard.sharePyq', '分享到朋友圈')}
              </Button>
            </View>
          </View>
        ) : (
          <View className="upload-placeholder" onClick={onUploadClick}>
            <Text className="upload-icon">+</Text>
            <Text className="upload-text">
              {uploading
                ? tt('businessCard.uploading', '上传中…')
                : tt('businessCard.uploadPlaceholder', '上传名片')}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
