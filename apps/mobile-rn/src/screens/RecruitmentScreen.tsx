// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Metro require()(静态资源打包契约)与 expo-asset / expo-media-library(相册写入)

import { useCallback } from 'react'
import { Asset } from 'expo-asset'
import * as MediaLibrary from 'expo-media-library'
import { RecruitmentScreen as SharedRecruitmentScreen } from '@ihui/rn-app'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * RecruitmentScreen 操盘手计划页(mobile-rn 端薄壳)
 *
 * 渲染真相源在共享层 `packages/app/src/features/recruitment/RecruitmentScreen.tsx`;段构成、
 * 顺序、取词键、图片槽位同住 `@ihui/shared/constants/trader-plan-promo` 的 TRADER_PLAN_SEGMENTS
 * (小程序端 `pkg-content/recruitment/index/index.tsx` 读同一张表)。本壳只做四件端内的事:
 * ① 图片资源句柄注入;② 取词与主题注入;③ 购买 CTA 接到在册屏 `VipTrader`;
 * ④ 长按二维码落到系统相册(与 HomeScreen 二维码弹窗同一条在册能力,不是假按钮)。
 *
 * 图片为什么在本壳:RN 静态资源打包必须走 require()(Metro asset 插件契约),共享屏拿不到;
 * 2026-10-15 本地化批次把原 bspapp 云存储 CDN(mp-aab956eb-…,整体不可达 HTTP 000)的三张图
 * 按原 CDN 路径打包进应用,文件副本与 apps/web/public 同源(小程序端用的是同一批素材):
 *   recruitment/bigtp@2x.png   → assets/images/carousel/bigtp@2x.png(全屏背景)
 *   recruitment/xuancai@2x.png → assets/images/carousel/xuancai@2x.png(创始人头像)
 *   recruitment/ewm@2x.png     → assets/images/carousel/ewm@2x.png(社群二维码)
 * 写法与 CarteScreen/BusinessLicenseScreen 同档(块级 disable,只罩资源声明行)。
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const BACKGROUND_IMAGE = require('../../assets/images/carousel/bigtp@2x.png')
const AVATAR_IMAGE = require('../../assets/images/carousel/xuancai@2x.png')
const QRCODE_IMAGE = require('../../assets/images/carousel/ewm@2x.png')
/* eslint-enable @typescript-eslint/no-require-imports */

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function RecruitmentScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  /** 长按二维码 → 保存到系统相册(对齐 HomeScreen 二维码弹窗的 handleLongPressQrCode) */
  const saveQrcodeToAlbum = useCallback(async (): Promise<void> => {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (!perm.granted) {
        appAlert(t('imageGen.needPermission'))
        return
      }
      const localAsset = Asset.fromModule(QRCODE_IMAGE)
      await localAsset.downloadAsync()
      const asset = await MediaLibrary.createAssetAsync(localAsset.localUri ?? localAsset.uri)
      await MediaLibrary.saveToLibraryAsync(asset.uri)
      appAlert(t('imageGen.saveSuccess'))
    } catch {
      appAlert(t('imageGen.saveFailed'))
    }
  }, [t])

  return (
    <SharedRecruitmentScreen
      t={t}
      backgroundSource={BACKGROUND_IMAGE}
      avatarSource={AVATAR_IMAGE}
      qrcodeSource={QRCODE_IMAGE}
      colorScheme={resolvedTheme}
      onPurchase={() => navigation.navigate('VipTrader')}
      onQrcodeLongPress={() => void saveQrcodeToAlbum()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
