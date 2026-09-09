// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍‌​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, useTt } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getBusinessCard } from '@/api'
import { showShareMenu, getShareInfo } from '@/utils/share'
import { saveNetworkImageToAlbum } from '@/utils/save-album'
import ThemeRoot from '@/components/ThemeRoot'

/**
 * 名片卡页 — 样式对齐 RN 端电子名片共享屏
 * (apps/mobile-rn/src/screens/BusinessCardScreen.tsx → packages/app
 *  features/business-card/BusinessCardScreen.tsx,RN 端 carte 路由为静态社群宣传卡、
 *  与本页「用户名片」数据流不符,故按内容最接近原则对齐共享名片屏)
 * 业务逻辑不变:getBusinessCard / 分享提示 / 保存二维码 / 复制电话
 */
interface CardInfo {
  name?: string
  nickname?: string
  avatar?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  qrcode?: string
  intro?: string
}

export default function CartePage() {
  const { t } = useI18n()
  const tt = useTt()
  const [info, setInfo] = useState<CardInfo>({})

  const load = useCallback(async () => {
    try {
      const res = (await getBusinessCard()) as CardInfo
      setInfo(res)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
    showShareMenu()
  })

  const handleShare = () => {
    Taro.showToast({ title: t('carte.shareHint'), icon: 'none' })
  }

  const handleSaveQrcode = async () => {
    if (!info.qrcode) {
      Taro.showToast({ title: t('carte.noQrcode'), icon: 'none' })
      return
    }
    try {
      await saveNetworkImageToAlbum(info.qrcode)
    } catch {
      // ignore
    }
  }

  const handleCopyPhone = () => {
    if (!info.phone) return
    Taro.setClipboardData({ data: info.phone })
  }

  const onBack = useCallback(() => {
    Taro.navigateBack({ delta: 1 })
  }, [])

  const displayName = info.name || info.nickname || t('carte.anonymous')
  const shareInfo = getShareInfo('/pages/carte/index', `${displayName}${t('carte.cardSuffix')}`)

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background flex flex-col">
        {/* 顶部导航(对齐共享名片屏 header:返回 + 标题) */}
        <View className="flex items-center gap-3 px-5 pt-5 pb-3">
          <Text className="text-base text-muted-foreground w-10 leading-none" onClick={onBack}>
            ‹
          </Text>
          <Text className="text-xl font-semibold text-foreground">{tt('carte.title', '电子名片')}</Text>
        </View>

        {/* 名片主卡(RN card:白底 / 圆角16 / 描边 border-light / padding14) */}
        <View className="mx-4 p-3.5 rounded-2xl bg-card border border-border">
          <View className="flex items-center">
            {info.avatar ? (
              <Image className="w-12 h-12 rounded-2xl flex-shrink-0" src={info.avatar} mode="aspectFill" />
            ) : (
              <View className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0">
                <Text className="text-2xl font-bold text-primary-foreground">
                  {displayName.charAt(0)}
                </Text>
              </View>
            )}
            <View className="ml-3 flex-1">
              <Text className="text-xl font-semibold text-foreground">{displayName}</Text>
              {info.title ? <Text className="mt-2 text-sm text-primary">{info.title}</Text> : null}
              {info.company ? (
                <Text className="mt-2 text-sm text-muted-foreground">{info.company}</Text>
              ) : null}
            </View>
          </View>

          {info.intro ? (
            <Text className="mt-3 text-sm leading-5 text-[color:var(--color-text-medium)]">
              {info.intro}
            </Text>
          ) : null}

          {/* 联系方式(RN contactsBox:muted 底 / 圆角12 / padding14) */}
          {info.phone || info.email ? (
            <View className="mt-3 p-3.5 rounded-xl bg-muted">
              {info.phone ? (
                <View
                  className="flex items-center justify-between py-1"
                  onClick={handleCopyPhone}
                >
                  <Text className="w-10 text-[11px] text-muted-foreground">{t('carte.phone')}</Text>
                  <Text className="flex-1 text-sm text-foreground text-right">{info.phone}</Text>
                </View>
              ) : null}
              {info.email ? (
                <View className="flex items-center justify-between py-1">
                  <Text className="w-10 text-[11px] text-muted-foreground">{t('carte.email')}</Text>
                  <Text className="flex-1 text-sm text-foreground text-right">{info.email}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* 二维码(RN qrBox:140dp 方块 muted 底 圆角12) */}
          <View className="mt-4 flex flex-col items-center">
            {info.qrcode ? (
              <Image
                className="w-[140px] h-[140px] rounded-xl"
                src={info.qrcode}
                mode="aspectFit"
              />
            ) : (
              <View className="w-[140px] h-[140px] rounded-xl bg-muted flex items-center justify-center">
                <Text className="text-[11px] text-muted-foreground">{t('carte.noQrcode')}</Text>
              </View>
            )}
            <Text className="mt-2 text-[11px] text-muted-foreground">{t('carte.scanHint')}</Text>
          </View>
        </View>

        {/* 操作按钮(对齐 RN actionRow:高44 / 圆角12 / 描边) */}
        <View className="px-2.5 py-4 flex gap-2">
          <View
            className="flex-1 h-11 rounded-xl border border-border flex items-center justify-center"
            onClick={handleShare}
          >
            <Text className="text-sm text-[color:var(--color-text-medium)]">
              {t('carte.shareCard')}
            </Text>
          </View>
          <View
            className="flex-1 h-11 rounded-xl border border-border flex items-center justify-center"
            onClick={handleSaveQrcode}
          >
            <Text className="text-sm text-[color:var(--color-text-medium)]">
              {t('carte.saveQrcode')}
            </Text>
          </View>
        </View>

        <View className="px-2.5 pb-6">
          <Text className="block text-[11px] text-[color:var(--color-text-tertiary)] text-center break-all">
            {shareInfo.path}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍‌​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
