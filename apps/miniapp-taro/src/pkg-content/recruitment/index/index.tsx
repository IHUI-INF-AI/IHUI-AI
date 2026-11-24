// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/recruitment/RecruitmentScreen.tsx(直载共享屏 + 注入本端事实)
//
// 本端只保留三件平台事实,其余全部由共享屏输出(段落/顺序/取词键/图片槽位同一张
// TRADER_PLAN_SEGMENTS 表):
//   ① 导航栏标题(Taro.setNavigationBarTitle,RN 用原生 title)
//   ② 长按二维码落相册(saveNetworkImageToAlbum,RN 用 expo-media-library)
//   ③ 购买落点(navigateTo /pkg-shop/vip-trader/index/index,RN 用 navigation.navigate)
// 图片槽位裁剪不变:背景与二维码用本端在册 CDN 键,头像用 pkg-content 分包静态路径。

import Taro, { useDidShow } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import { aizhsUrl } from '@/constants/icon-urls'
import { saveNetworkImageToAlbum } from '@/utils/save-album'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import {
  TRADER_PLAN_PROMO_KEYS,
  type TraderPlanImageSlot,
} from '@ihui/shared/constants/trader-plan-promo'
import { RecruitmentScreen as SharedRecruitmentScreen } from '@ihui/rn-app/features/recruitment/RecruitmentScreen'

/** 槽位 → 本端资源地址(单一源在 src/pkg-content/assets/,由 config copy.patterns 派生产物) */
const TRADER_PLAN_IMAGES: Record<TraderPlanImageSlot, string> = {
  background: aizhsUrl('recruitment/bigtp@2x.png'),
  founderAvatar: '/pkg-content/assets/xuancai@2x.png',
  groupQrcode: aizhsUrl('remote-images/qewm.png'),
}

export default function RecruitmentIndexPage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: t(TRADER_PLAN_PROMO_KEYS.heroTitle) })
  })

  /** 长按二维码 → 下载并保存到系统相册(在册能力;失败提示由 save-album 自己响) */
  const saveQrcode = () => {
    void saveNetworkImageToAlbum(TRADER_PLAN_IMAGES.groupQrcode).catch(() => {})
  }

  const purchase = () => {
    void Taro.navigateTo({ url: '/pkg-shop/vip-trader/index/index' }).catch(() => {})
  }

  return (
    <ThemeRoot>
      <SharedRecruitmentScreen
        t={t}
        backgroundSource={{ uri: TRADER_PLAN_IMAGES.background }}
        avatarSource={{ uri: TRADER_PLAN_IMAGES.founderAvatar }}
        qrcodeSource={{ uri: TRADER_PLAN_IMAGES.groupQrcode }}
        colorScheme={resolvedTheme}
        onPurchase={purchase}
        onQrcodeLongPress={saveQrcode}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
