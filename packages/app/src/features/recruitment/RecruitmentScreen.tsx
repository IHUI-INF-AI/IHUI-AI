// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 操盘手计划宣传页 — 跨端唯一真相源(RN 渲染这一份;小程序端逐元素同形重写)。
 *
 * 版面(段构成、顺序、取词键、图片槽位全部读 `@ihui/shared/constants/trader-plan-promo` 的
 * `TRADER_PLAN_SEGMENTS`,本屏不自己拿主意;小程序端按同一张表出段):
 *   hero     全屏背景图 + 压在背景上的居中标题
 *   founder  底部色块卡片第一行:创始人头像 + 身份行 + 推荐语
 *   intro    扫码进社群的邀请语
 *   qrcode   社群二维码(长按即落相册的在册能力,不是装饰图)
 *   purchase 购买 CTA
 *
 * 可读性靠**显式色块卡片**(brandAccent.light 底 + 随主题翻转的墨色字)达成:不用渐变遮罩、
 * 不用 mask-image 边缘淡出(AGENTS §4 禁用)。标题的浅色字取不随主题翻转的 `gray[50]` ——
 * 底(照片)不翻 ⇒ 前景也不翻,与 FloatBox 那条不变量同一条判序(surface.light 在深色档案翻成
 * #262626,压在照片上就是隐形字)。
 *
 * 平台无关:本屏只渲染,不导航、不取词、不读系统相册。注入点:
 *   - `t` 取词(RN useI18n / 小程序 @/i18n)
 *   - `backgroundSource` / `avatarSource` / `qrcodeSource` 图片句柄(RN 端 require 打进包;
 *     小程序端用本端分包静态路径与在册 CDN 键 —— 同一批官方素材,不同装载形态)
 *   - `onPurchase` 购买落点(RN navigation.navigate('VipTrader') / 小程序 navigateTo vip-trader)
 *   - `onQrcodeLongPress` 长按二维码保存(RN expo-media-library / 小程序 saveNetworkImageToAlbum)
 *
 * 历史(2026-10-24 收敛):本文件此前躺着一份**没人渲染的招聘列表屏**(FlatList + 分类 tabs +
 * 详情 Modal,props 要 jobs/activeTab/selected/appliedIds),与 `features/ai-career/AiCareerScreen`
 * 同题,还引用了 mobile-rn 词包里根本不存在的 `recruitment.tab_*` 键;而 RN 路由实际渲染的是端内
 * 自带的这份宣传页,小程序端又是第三份(API 驱动的「岗位要求/专属福利/预估收入」页,其
 * `privileges`/`incomeEstimates` 字段与 `POST /recruitment/apply` 后端都不存在)。三处没有一处
 * 是这个语义的真相 ⇒ 以完整实现提升为真相源(AGENTS §0.6)。
 */
import { useMemo } from 'react'
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native'
import {
  TRADER_PLAN_PROMO_KEYS,
  TRADER_PLAN_SEGMENTS,
  type TraderPlanImageSlot,
  type TraderPlanSegment,
} from '@ihui/shared/constants/trader-plan-promo'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'

export type { TraderPlanImageSlot, TraderPlanSegment }

export interface TraderPlanPromoProps {
  readonly t: (key: string) => string
  readonly backgroundSource: ImageSourcePropType
  readonly avatarSource: ImageSourcePropType
  readonly qrcodeSource: ImageSourcePropType
  readonly colorScheme?: 'light' | 'dark'
  readonly onPurchase: () => void
  readonly onQrcodeLongPress: () => void
}

export function RecruitmentScreen({
  t,
  backgroundSource,
  avatarSource,
  qrcodeSource,
  colorScheme = 'light',
  onPurchase,
  onQrcodeLongPress,
}: TraderPlanPromoProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 槽位 → 本端注入的资源句柄(资源本体不住在共享层,与 carte 屏同一分工) */
  const sources = useMemo<Record<TraderPlanImageSlot, ImageSourcePropType>>(
    () => ({
      background: backgroundSource,
      founderAvatar: avatarSource,
      groupQrcode: qrcodeSource,
    }),
    [backgroundSource, avatarSource, qrcodeSource],
  )

  const hero = TRADER_PLAN_SEGMENTS.find((seg) => seg.id === 'hero')
  const cardSegments = TRADER_PLAN_SEGMENTS.filter((seg) => seg.id !== 'hero')

  const renderTexts = (seg: TraderPlanSegment) =>
    seg.textKeys.map((key, row) => (
      <Text key={key} style={textStyleOf(seg.id, row, styles)}>
        {t(key)}
      </Text>
    ))

  return (
    <View style={styles.container}>
      {hero?.imageSlot ? (
        <Image source={sources[hero.imageSlot]} style={styles.background} resizeMode="cover" />
      ) : null}

      {hero ? (
        <View style={styles.heroWrap}>
          {hero.textKeys.map((key) => (
            <Text key={key} style={styles.heroTitle}>
              {t(key)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.card} testID="trader-plan-promo-card">
        {cardSegments.map((seg) => {
          if (seg.id === 'purchase') {
            return (
              <TouchableOpacity
                key={seg.id}
                style={styles.buyBtn}
                activeOpacity={0.85}
                onPress={onPurchase}
              >
                <Text style={styles.buyText}>{t(TRADER_PLAN_PROMO_KEYS.purchase)}</Text>
              </TouchableOpacity>
            )
          }
          if (seg.id === 'qrcode') {
            return (
              <View key={seg.id} style={styles.qrBlock}>
                {seg.imageSlot ? (
                  <TouchableOpacity
                    style={styles.qrWrap}
                    testID="trader-plan-qrcode"
                    activeOpacity={0.9}
                    delayLongPress={300}
                    onLongPress={onQrcodeLongPress}
                    accessibilityRole="image"
                    accessibilityLabel={t(TRADER_PLAN_PROMO_KEYS.qrcodeHint)}
                  >
                    <Image
                      source={sources[seg.imageSlot]}
                      style={styles.qrcode}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ) : null}
                {renderTexts(seg)}
              </View>
            )
          }
          if (seg.id === 'founder') {
            return (
              <View key={seg.id} style={styles.founderRow}>
                {seg.imageSlot ? (
                  <Image source={sources[seg.imageSlot]} style={styles.avatar} resizeMode="cover" />
                ) : null}
                <View style={styles.founderText}>{renderTexts(seg)}</View>
              </View>
            )
          }
          return (
            <View key={seg.id} style={styles.segmentBlock}>
              {renderTexts(seg)}
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** 段内文字档:founder 段两行分档(身份行 / 推荐语),其余段一段一档 */
function textStyleOf(
  id: TraderPlanSegment['id'],
  row: number,
  styles: ReturnType<typeof createStyles>,
) {
  if (id === 'founder') return row === 0 ? styles.founder : styles.recommend
  if (id === 'intro') return styles.intro
  return styles.auxText
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    background: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    heroWrap: { position: 'absolute', top: 10, left: 15, right: 15 },
    heroTitle: {
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      color: tk.gray[50],
    },
    card: {
      position: 'absolute',
      left: 15,
      right: 15,
      bottom: 30,
      padding: 14,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brandAccent.light,
    },
    segmentBlock: { marginTop: 12 },
    founderRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 50, height: 50, borderRadius: rnRadius['2xl'] },
    founderText: { flex: 1, marginLeft: 12 },
    founder: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    recommend: { marginTop: 2, fontSize: 13, color: tk.text.secondary },
    intro: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      textAlign: 'center',
      color: tk.danger.DEFAULT,
    },
    qrBlock: { marginTop: 12, alignItems: 'center' },
    qrWrap: { alignItems: 'center' },
    qrcode: { width: 176, height: 176 },
    auxText: { marginTop: 6, fontSize: 11, textAlign: 'center', color: tk.text.secondary },
    buyBtn: {
      marginTop: 14,
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buyText: { fontSize: 16, fontWeight: '700', color: tk.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
