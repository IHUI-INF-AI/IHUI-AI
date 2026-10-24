// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/carte/CarteScreen.tsx
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useI18n, useTt } from '@/i18n'
import LineIcon, { type IconName } from '@/components/LineIcon'
import ThemeRoot from '@/components/ThemeRoot'
import { showShareMenu } from '@/utils/share'
import {
  CARTE_I18N_KEYS,
  CARTE_SEGMENTS,
  type CarteImageSlot,
  type CarteSegment,
} from '@ihui/shared/constants'

/**
 * 社群宣传卡(小程序端)—— 渲染层用 Taro 重写,页面构成不自己拿主意:
 * 段落、顺序、取词键、字形名一律读 `@ihui/shared/constants` 的 CARTE_SEGMENTS
 * (与 RN 共享屏 packages/app/src/features/carte/CarteScreen.tsx 同一张表)。
 *
 * 历史缺陷(本轮收口):本页此前实现的是「用户电子名片」(getBusinessCard + 分享/保存二维码),
 * 与 pkg-ai/business-card 是同题两份;而 carte 路由在历史项目(pagesA/carte/index.vue)
 * 与本仓 RN/web 两端都是**社群宣传卡**。现按真实语义重写,名片功能仍由 pkg-ai/business-card 承载。
 *
 * 平台差异一条:返回 affordance 由微信原生导航栏供出,页内不再画返回键(禁双返回,守门 102 GA6);
 * 标题走 setNavigationBarTitle 取词,静态 index.config.ts 不参与判定。
 */

/** 图片槽位 → 本端分包静态路径(单一源在 src/pkg-content/assets/,由 config copy.patterns 派生产物) */
const CARTE_IMAGES: Record<CarteImageSlot, string> = {
  avatar: '/pkg-content/assets/xuancai@2x.png',
  qrcode: '/pkg-content/assets/ewm@2x.png',
}

/** 本端 LineIcon 只认注册表里真实存在的键(共享表给的是 lucide 官方 kebab 名) */
const LINE_ICON: Record<string, IconName> = { users: 'users' }

const imageOf = (seg: CarteSegment): string | undefined =>
  seg.imageSlot === null ? undefined : CARTE_IMAGES[seg.imageSlot]

export default function CartePage() {
  const { t } = useI18n()
  const tt = useTt()

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt(CARTE_I18N_KEYS.title, '智汇社社群') })
    showShareMenu()
  })

  const renderSegment = (seg: CarteSegment) => {
    const src = imageOf(seg)
    switch (seg.id) {
      case 'hero':
        return (
          <View
            key={seg.id}
            className="flex flex-row items-center gap-3 rounded-t-2xl bg-brand-accent p-4"
          >
            {src ? (
              <Image className="h-16 w-16 shrink-0 rounded-xl" src={src} mode="aspectFill" />
            ) : null}
            <View className="flex-1">
              {seg.textKeys.map((key, row) => (
                <Text
                  key={key}
                  className={
                    row === 0
                      ? 'block text-base font-bold text-brand-accent-foreground'
                      : 'mt-1 block text-sm text-brand-accent-foreground'
                  }
                >
                  {t(key)}
                </Text>
              ))}
            </View>
          </View>
        )
      case 'invite':
        return (
          <View key={seg.id} className="mt-4 px-3">
            {seg.textKeys.map((key) => (
              <Text key={key} className="block text-center text-base font-semibold text-foreground">
                {t(key)}
              </Text>
            ))}
          </View>
        )
      case 'qrcode':
        return (
          <View key={seg.id} className="mt-4 flex items-center justify-center">
            {src ? <Image className="h-48 w-48" src={src} mode="aspectFit" /> : null}
          </View>
        )
      case 'scan': {
        const glyph = seg.icon === null ? undefined : LINE_ICON[seg.icon]
        return (
          <View
            key={seg.id}
            className="mt-3 mb-4 flex flex-row items-center justify-center gap-[12rpx]"
          >
            {glyph ? <LineIcon name={glyph} size={28} /> : null}
            {seg.textKeys.map((key) => (
              <Text key={key} className="text-xs text-muted-foreground">
                {t(key)}
              </Text>
            ))}
          </View>
        )
      }
    }
  }

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background px-4 py-4">
        <Text className="text-lg font-semibold text-foreground">{t(CARTE_I18N_KEYS.title)}</Text>
        <View className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
          {CARTE_SEGMENTS.map((seg) => renderSegment(seg))}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
