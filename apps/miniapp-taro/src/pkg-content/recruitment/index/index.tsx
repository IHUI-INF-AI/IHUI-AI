// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Taro 渲染层 API(@tarojs/components / @tarojs/taro)与分包静态资源路径
// 对齐目标(RN 共享屏): packages/app/src/features/recruitment/RecruitmentScreen.tsx

import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import { aizhsUrl } from '@/constants/icon-urls'
import { saveNetworkImageToAlbum } from '@/utils/save-album'
import ThemeRoot from '@/components/ThemeRoot'
import {
  TRADER_PLAN_PROMO_KEYS,
  TRADER_PLAN_SEGMENTS,
  type TraderPlanImageSlot,
  type TraderPlanSegment,
} from '@ihui/shared/constants/trader-plan-promo'

/**
 * 操盘手计划宣传页(小程序端)—— 渲染层用 Taro 重写,页面构成不自己拿主意:
 * 段落、顺序、取词键、图片槽位全部读 `@ihui/shared/constants/trader-plan-promo` 的
 * TRADER_PLAN_SEGMENTS(与 RN 共享屏同一张表),档值按 rpx = 2×RN px 逐档换算。
 *
 * 历史缺陷(本轮收口):本页此前是一份 API 驱动的「岗位要求 / 专属福利 / 预估收入」页,
 * 与本页语义(历史项目 pagesA/recruitment/index.vue 的操盘手计划宣传页)无关,且它请求的
 * `info.privileges` / `info.incomeEstimates` 字段与 `POST /recruitment/apply` 后端都不存在
 * (GET /api/recruitment 返回的是 requirements/benefits/stats 三族 ⇒ map undefined 直接白屏),
 * 全仓也没有任何入口 navigateTo 到本路径。现按真相源重写。
 *
 * 平台差异两条,逐条写明:
 * ① 全屏背景用在册 CDN 键 aizhsUrl('recruitment/bigtp@2x.png') —— 本端不把 1.46MB 大图塞进分包
 *   (pkg-content 里已经打包了同一批素材的头像 688KB 与二维码 9.6KB)。该 URL 实测 HTTP 200 /
 *   1,461,621 字节,与仓内官方副本 apps/web/public/recruitment/bigtp@2x.png 逐字节同尺寸,
 *   不是编出来的地址。底图未达时的兜底用显式深色块(surface-dark),不用渐变遮罩、不用 mask-image。
 * ② 二维码用在册 CDN 键 aizhsUrl('remote-images/qewm.png')(与 /pkg-content/assets/ewm@2x.png
 *   同一张图:scripts/generate-remote-images.mjs 的 LOCAL_ALIASES 已把 recruitment/ewm@2x.png
 *   指向 images/qewm.png,三处 md5 相同)—— 网络地址才能被 saveNetworkImageToAlbum 真下载落相册,
 *   长按是真的,不留假按钮。
 */

/** 槽位 → 本端资源地址(单一源在 src/pkg-content/assets/,由 config copy.patterns 派生产物) */
const TRADER_PLAN_IMAGES: Record<TraderPlanImageSlot, string> = {
  background: aizhsUrl('recruitment/bigtp@2x.png'),
  founderAvatar: '/pkg-content/assets/xuancai@2x.png',
  groupQrcode: aizhsUrl('remote-images/qewm.png'),
}

const textClassOf = (id: TraderPlanSegment['id'], row: number): string => {
  if (id === 'founder' && row === 0) return 'block text-[length:32rpx] font-bold text-foreground'
  if (id === 'founder') return 'mt-[4rpx] block text-[length:26rpx] text-muted-foreground'
  if (id === 'intro')
    return 'mt-[24rpx] block text-center text-[length:28rpx] font-semibold leading-[40rpx] text-[color:var(--color-danger)]'
  return 'mt-[12rpx] block text-center text-[length:22rpx] text-muted-foreground'
}

export default function RecruitmentIndexPage() {
  const { t } = useI18n()

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

  const hero = TRADER_PLAN_SEGMENTS.find((seg) => seg.id === 'hero')
  const cardSegments = TRADER_PLAN_SEGMENTS.filter((seg) => seg.id !== 'hero')

  const renderTexts = (seg: TraderPlanSegment) =>
    seg.textKeys.map((key, row) => (
      <Text key={key} className={textClassOf(seg.id, row)}>
        {t(key)}
      </Text>
    ))

  return (
    <ThemeRoot>
      <View className="relative h-[100vh] w-full overflow-hidden bg-[var(--color-surface-dark)]">
        {hero?.imageSlot ? (
          <Image
            className="absolute left-0 top-0 h-full w-full"
            src={TRADER_PLAN_IMAGES[hero.imageSlot]}
            mode="aspectFill"
          />
        ) : null}

        {/* RN heroTitle:top 10 / left·right 15 / fontSize 16 / 恒定浅色(底色不翻⇒前景不翻) */}
        <View className="absolute left-[30rpx] right-[30rpx] top-[20rpx] z-[1]">
          {hero
            ? hero.textKeys.map((key) => (
                <Text
                  key={key}
                  className="block text-center text-[length:32rpx] font-bold text-[color:var(--color-surface-light)]"
                >
                  {t(key)}
                </Text>
              ))
            : null}
        </View>

        {/* RN card:bottom 30 / left·right 15 / padding 14 / radius lg(8) / brandAccent.light 底 */}
        <View className="absolute bottom-[60rpx] left-[30rpx] right-[30rpx] z-[1] rounded-lg bg-[var(--color-brand-accent-light)] p-[28rpx]">
          {cardSegments.map((seg) => {
            if (seg.id === 'purchase') {
              // RN buyBtn:height 44 / radius sm(4) / brand.cta 底 + brand.ctaForeground 字(成对)
              return (
                <View
                  key={seg.id}
                  className="mt-[28rpx] flex h-[88rpx] items-center justify-center rounded-sm bg-cta"
                  onClick={purchase}
                  hoverClass="opacity-60"
                >
                  <Text className="text-[length:32rpx] font-bold text-cta-foreground">
                    {t(TRADER_PLAN_PROMO_KEYS.purchase)}
                  </Text>
                </View>
              )
            }
            if (seg.id === 'qrcode') {
              // RN qrcode:176×176 → 352rpx;contain 不裁码;长按 = 下载并落相册
              return (
                <View key={seg.id} className="mt-[24rpx] flex flex-col items-center">
                  {seg.imageSlot ? (
                    <View className="flex flex-col items-center" onLongPress={saveQrcode}>
                      <Image
                        className="h-[352rpx] w-[352rpx]"
                        src={TRADER_PLAN_IMAGES[seg.imageSlot]}
                        mode="aspectFit"
                      />
                    </View>
                  ) : null}
                  {renderTexts(seg)}
                </View>
              )
            }
            if (seg.id === 'founder') {
              // RN avatar:50×50 → 100rpx / radius 2xl(16)
              return (
                <View key={seg.id} className="flex flex-row items-center">
                  {seg.imageSlot ? (
                    <Image
                      className="h-[100rpx] w-[100rpx] shrink-0 rounded-2xl"
                      src={TRADER_PLAN_IMAGES[seg.imageSlot]}
                      mode="aspectFill"
                    />
                  ) : null}
                  <View className="ml-[24rpx] flex flex-1 flex-col">{renderTexts(seg)}</View>
                </View>
              )
            }
            return <View key={seg.id}>{renderTexts(seg)}</View>
          })}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
