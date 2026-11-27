// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CommunityHomeScreen — 「智汇AI」社区首页(跨端共享屏,纯 UI、props 注入)。
 *
 * 单源化来源:小程序 `pages/community/index` 与 web `/community`(`PageClient.tsx`)。
 * 两端此前各写一份「标题 + 搜索 + 运营轮播 + 分类胶囊 + 最近使用 + 我的智能体 + 推荐」,
 * 本屏把区块结构与样式收口;取数/登录/支付/跳转仍由宿主负责(与 AgentMarketScreen 同约)。
 *
 * 宿主契约:
 *  - `labels` 由宿主按自己的 i18n 命名空间翻译后传入 —— 共享层不假设键名;
 *  - 各区块数据为空时按小程序语义处理:轮播/分类/我的智能体整块隐藏,最近使用显示空态文案;
 *  - 搜索防抖由宿主做(web 300ms),本屏只回调 `onKeywordChange` / `onSearch`。
 */

import { useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { rnRadius, rnSpacing, rnType, rnCssLight } from '@ihui/design-tokens'
import { COMMUNITY_BANNER_FALLBACK_TONES } from '@ihui/shared/ui/community-banner-spec'
import { ChevronRight, Clock, Image as ImageIcon, Mic, Plus, Search } from 'lucide-react-native'

/**
 * banner 文案压暗层:1×128 的透明→黑 60% 竖向渐变 PNG(data URI)。
 * RN 没有 CSS 渐变;此前用 64px 纯黑60 + 上方 24px 黑25 两段矩形拼接,交界处会在
 * 实拍图(天空/海面)上留下明显横带,且与 web/小程序的 `from-black-60 via-black-20
 * to-transparent` 不同形。这里用同一组 alpha 停点生成位图,再横向拉伸铺满 banner,
 * 三端叠的是同一条渐变曲线。
 */
const BANNER_MASK_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAACACAYAAADK+QP0AAAA1UlEQVR4nD3E5yoFYAAA0GvvvffeeyUikZtIRCISkYhEJCKRiEQkIm+rU/rOjxOJ/ItRbChO8UpQYihJyUpRaihN6cpQZihL2cpRbihP+SpQYahIxSpRqcpC5apQpapC1apRrepC9WpQo5pCzWpRq9pC7epQp7pC3epRr/rUrwENakjDGtGoxjSuCU0qqilNa0azmtO8FrSoJS1rRata07o2tKktbWtHu9rTvg50qCMd60SnOtO5LnSpK13rRre6070e9KgnPetFr3rTuz70qS9960e/f60DH+9JbBAAAAAAAElFTkSuQmCC'

/**
 * 无图 banner 的深色兜底来自 @ihui/shared/ui/community-banner-spec（三端唯一源）；
 * 真图失败后不再回落浅品牌底，而用同组深底 + 白字 + 同心圆纹理。
 */

/**
 * 分类接口的 `icon` 是**语义图标名**(code/edit/image/book/megaphone),不是图片 URL。
 * 旧实现把它塞进 `<Image source={{uri}}>`,web/RN 都会渲染出 16px 空白占位,
 * 让胶囊文字前多一段幽灵留白。三端统一只渲染文字胶囊,不用这个字段当图源。
 */

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'

export type CommunityHomeLabelKey =
  | 'title'
  | 'subtitle'
  | 'posts'
  | 'searchPlaceholder'
  | 'banners'
  | 'categories'
  | 'recent'
  | 'recentHint'
  | 'recentEmpty'
  | 'myAgents'
  | 'recommended'
  | 'more'
  | 'unknownAgent'
  | 'voiceHint'
  | 'imageHint'
  | 'free'

export type CommunityHomeLabels = Record<Exclude<CommunityHomeLabelKey, 'free'>, string> & {
  /** 免费徽标(可选;旧宿主未传时回退「免费」,避免破坏既有调用方) */
  free?: string
}

export interface CommunityHomeBanner {
  id: string
  title?: string
  description?: string
  image?: string
}

export interface CommunityHomeCategory {
  id: string
  name: string
  icon?: string
}

export interface CommunityHomeAgent {
  id: string
  name: string
  description?: string
  avatar?: string
  cover?: string
  isFree?: boolean
  price?: number
  isVipExclusive?: boolean
}

export interface CommunityHomeScreenProps {
  labels: CommunityHomeLabels
  colorScheme?: 'light' | 'dark'
  keyword: string
  onKeywordChange: (value: string) => void
  onSearch: () => void
  banners?: CommunityHomeBanner[]
  categories?: CommunityHomeCategory[]
  /** 当前选中的分类 id(可选;宿主在本地筛选时传入,用于高亮胶囊) */
  activeCategoryId?: string
  recent?: CommunityHomeAgent[]
  myAgents?: CommunityHomeAgent[]
  recommended?: CommunityHomeAgent[]
  recommendedLoading?: boolean
  onPressBanner?: (banner: CommunityHomeBanner) => void
  onPressCategory?: (category: CommunityHomeCategory) => void
  onPressRecent?: (agent: CommunityHomeAgent) => void
  onPressMyAgent?: (agent: CommunityHomeAgent) => void
  onPressRecommended?: (agent: CommunityHomeAgent) => void
  onPressPosts?: () => void
  onPressMore?: () => void
  onVoiceHint?: () => void
  onImageHint?: () => void
  /**
   * 嵌入式模式:宿主已有自己的纵向滚动容器(如 RN 首页)时传 true,
   * 本屏只渲染内容片段、不再自带第二层 ScrollView(对齐 SharedHomeScreen 的 embedded 契约)。
   */
  embedded?: boolean
  /**
   * 底部内容留白(px)。默认 96(web 无悬浮 TabBar 时的档位);RN 宿主传
   * 180 —— 悬浮胶囊 + 其上方 90px 淡出层会盖住最后一排卡片的“免费”徽标,
   * 留白必须越过淡出层顶沿,否则滚到底仍有半张卡被吃掉。
   */
  contentPaddingBottom?: number
}

function AvatarDot({
  agent,
  colorScheme,
}: {
  agent: CommunityHomeAgent
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  if (agent.avatar) {
    return <Image source={{ uri: agent.avatar }} style={styles.avatar} />
  }
  return (
    <View
      style={[
        styles.avatar,
        { alignItems: 'center', justifyContent: 'center', backgroundColor: tk.surface.muted },
      ]}
    >
      <Text style={{ fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.secondary }}>
        {(agent.name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // 底部留白必须覆盖悬浮 TabBar(约 62)+ 呼吸区(32):只留 20 时最后一行卡片在
  // 滚到底后仍有半张压在 TabBar 下面,三端横向对比时会被读成"卡片被截断"。
  container: { paddingBottom: rnSpacing['6xl'] + rnSpacing['3xl'] },
  header: { paddingHorizontal: rnSpacing.lg, paddingTop: rnSpacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: rnType.display.size, lineHeight: 32, fontWeight: '700' },
  subtitle: {
    marginTop: rnSpacing.xs,
    fontSize: rnType.body.size,
    lineHeight: rnType.body.lineHeight,
  },
  postsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: rnRadius.md,
    paddingHorizontal: rnSpacing.md,
    height: 34,
    // 标题 24/32 的字形上缘比行盒低约 6px;按钮若贴行盒顶会显得浮在标题上方,
    // 统一下移 4px,让按钮视觉中心落到标题首行(web 同位置)。
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.sm,
    marginTop: rnSpacing.sm,
  },
  searchField: { flex: 1, minWidth: 0, justifyContent: 'center' },
  searchLeading: {
    position: 'absolute',
    left: rnSpacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  searchTrailing: {
    position: 'absolute',
    right: rnSpacing.xs,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  input: {
    height: 40,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: rnRadius.md,
    paddingLeft: 36,
    paddingRight: 12,
    fontSize: rnType.body.size,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphBtn: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.md,
  },
  section: { marginTop: rnSpacing['2xl'], paddingHorizontal: rnSpacing.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: rnSpacing.md,
  },
  sectionTitle: { fontSize: rnType.heading.size, lineHeight: 28, fontWeight: '600' },
  more: { fontSize: rnType.body.size, lineHeight: rnType.body.lineHeight },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bannerRow: { gap: rnSpacing.md, paddingVertical: 2 },
  banner: {
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bannerImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bannerMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  bannerSparkle: {
    position: 'absolute',
    right: rnSpacing.lg,
    top: rnSpacing.xs,
    fontSize: 36,
    fontWeight: '600',
    opacity: 0.1,
  },
  bannerRingLarge: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    right: -22,
    top: -26,
  },
  bannerRingSmall: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    right: 30,
    top: 26,
  },
  bannerText: { paddingHorizontal: rnSpacing.md, paddingVertical: rnSpacing.sm },
  bannerTitle: {
    fontSize: rnType.body.size,
    lineHeight: rnType.body.lineHeight,
    fontWeight: '600',
    color: rnCssLight.white98,
  },
  bannerSubtitle: {
    marginTop: 2,
    fontSize: rnType.label.size,
    lineHeight: rnType.label.lineHeight,
    color: rnCssLight.white85,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: rnSpacing.md,
    height: 30,
  },
  chipText: { fontSize: rnType.body.size, lineHeight: rnType.body.lineHeight },
  empty: { fontSize: rnType.body.size, lineHeight: rnType.body.lineHeight },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  recentRow: { gap: rnSpacing.sm },
  recentCard: {
    width: 224,
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.sm,
    borderWidth: 1,
    borderRadius: rnRadius.lg,
    padding: rnSpacing.sm,
  },
  recentName: { fontSize: rnType.body.size, lineHeight: rnType.body.lineHeight, fontWeight: '500' },
  recentHintRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentHint: { fontSize: rnType.caption.size, lineHeight: rnType.caption.lineHeight },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    rowGap: rnSpacing.lg,
  },
  card: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 264,
    borderWidth: 1,
    borderRadius: rnRadius.lg,
    overflow: 'hidden',
  },
  cardCover: { height: 128, width: '100%' },
  cardCoverImg: { width: '100%', height: '100%' },
  cardCoverFallback: { alignItems: 'center', justifyContent: 'center' },
  cardAvatarLarge: { width: 64, height: 64, borderRadius: 14 },
  cardInitial: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flexGrow: 1, padding: rnSpacing.md, gap: 6 },
  vipBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceBadge: {
    alignSelf: 'flex-start',
    marginTop: 'auto',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardName: {
    minWidth: 0,
    minHeight: 44,
    fontSize: rnType.title.size,
    lineHeight: 22,
    fontWeight: '600',
  },
  cardDesc: { minHeight: 36, minWidth: 0, fontSize: rnType.bodySm.size, lineHeight: 18 },
})

export function CommunityHomeScreen({
  labels,
  colorScheme = 'light',
  keyword,
  onKeywordChange,
  onSearch,
  banners = [],
  categories = [],
  activeCategoryId,
  recent = [],
  myAgents = [],
  recommended = [],
  recommendedLoading = false,
  onPressBanner,
  onPressCategory,
  onPressRecent,
  onPressMyAgent,
  onPressRecommended,
  onPressPosts,
  onPressMore,
  onVoiceHint,
  onImageHint,
  embedded = false,
  contentPaddingBottom,
}: CommunityHomeScreenProps) {
  const tk: AppThemeTokens = useMemo(() => getTokens(colorScheme), [colorScheme])
  const txt = tk.text
  const surface = tk.surface
  const [failedBanners, setFailedBanners] = useState<Record<string, boolean>>({})
  const { width } = useWindowDimensions()
  const isWide = width >= 700
  const cardWidth = isWide ? '32%' : '48%'
  const cardMaxWidth = isWide ? '32.5%' : '49%'
  // 桌面面板实测约 790px:三张 240 宽的 banner + 两条 8px 缝正好落在 744px 内容区,
  // 不会再出现「第三张被右缘切一半」;移动端一张满宽,避免固定 260 宽在 390 屏的露边。
  const bannerWidth = isWide ? 240 : Math.max(240, width - 32)
  // web `h-32` / 小程序 128 / RN 同一档:三端 banner 都是 128 高,宽屏不再抬到 160。
  const bannerHeight = 128
  const containerStyle =
    contentPaddingBottom === undefined
      ? styles.container
      : [styles.container, { paddingBottom: contentPaddingBottom }]

  const content = (
    <>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: rnSpacing.md }}>
            <Text style={[styles.title, { color: txt.primary }]}>{labels.title}</Text>
            <Text style={[styles.subtitle, { color: txt.secondary }]}>{labels.subtitle}</Text>
          </View>
          {onPressPosts ? (
            <TouchableOpacity
              style={[
                styles.postsBtn,
                { borderColor: tk.border.light, backgroundColor: surface.card },
              ]}
              onPress={onPressPosts}
              accessibilityRole="button"
            >
              <Plus size={16} color={txt.primary} />
              <Text
                style={{
                  fontSize: rnType.body.size,
                  lineHeight: rnType.body.lineHeight,
                  color: txt.primary,
                }}
              >
                {labels.posts}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <TextField
              colorScheme={colorScheme}
              style={[
                styles.input,
                { borderColor: tk.border.light, backgroundColor: surface.card },
                { color: txt.primary },
                onVoiceHint || onImageHint ? { paddingRight: 76 } : null,
              ]}
              value={keyword}
              onChangeText={onKeywordChange}
              placeholder={labels.searchPlaceholder}
              placeholderTextColor={txt.secondary}
              onSubmitEditing={onSearch}
              returnKeyType="search"
            />
            <View style={styles.searchLeading} pointerEvents="none">
              <Search size={16} color={txt.secondary} />
            </View>
            {onVoiceHint || onImageHint ? (
              <View style={styles.searchTrailing}>
                {onVoiceHint ? (
                  <TouchableOpacity
                    style={styles.glyphBtn}
                    onPress={onVoiceHint}
                    accessibilityRole="button"
                    accessibilityLabel={labels.voiceHint}
                  >
                    <Mic size={16} color={txt.secondary} />
                  </TouchableOpacity>
                ) : null}
                {onImageHint ? (
                  <TouchableOpacity
                    style={styles.glyphBtn}
                    onPress={onImageHint}
                    accessibilityRole="button"
                    accessibilityLabel={labels.imageHint}
                  >
                    <ImageIcon size={16} color={txt.secondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: tk.brand.cta }]}
            onPress={onSearch}
            accessibilityRole="button"
            accessibilityLabel={labels.searchPlaceholder}
          >
            <Search size={16} color={tk.brand.ctaForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {banners.length > 0 ? (
        <View style={styles.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bannerRow}
          >
            {banners.slice(0, 6).map((b, index) => {
              const hasImage = !!b.image && !failedBanners[b.id]
              const fallbackTone =
                COMMUNITY_BANNER_FALLBACK_TONES[index % COMMUNITY_BANNER_FALLBACK_TONES.length]
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.banner,
                    {
                      backgroundColor: fallbackTone,
                      borderColor: hasImage ? tk.border.light : 'rgba(255,255,255,0.18)',
                      width: bannerWidth,
                      height: bannerHeight,
                    },
                  ]}
                  onPress={() => onPressBanner?.(b)}
                  accessibilityRole="button"
                  accessibilityLabel={b.title || labels.banners}
                >
                  {!hasImage ? (
                    <>
                      <View style={styles.bannerRingLarge} />
                      <View style={styles.bannerRingSmall} />
                      <Text style={[styles.bannerSparkle, { color: '#fff', opacity: 0.16 }]}>
                        ✦
                      </Text>
                    </>
                  ) : null}
                  {hasImage ? (
                    <Image
                      source={{ uri: b.image as string }}
                      style={styles.bannerImg}
                      onError={() => setFailedBanners((prev) => ({ ...prev, [b.id]: true }))}
                    />
                  ) : null}
                  {hasImage ? (
                    <Image
                      source={{ uri: BANNER_MASK_URI }}
                      style={styles.bannerMask}
                      resizeMode="stretch"
                    />
                  ) : null}
                  <View style={styles.bannerText}>
                    <Text style={styles.bannerTitle} numberOfLines={1}>
                      {b.title || labels.banners}
                    </Text>
                    {b.description ? (
                      <Text style={styles.bannerSubtitle} numberOfLines={1}>
                        {b.description}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: txt.primary }]}>{labels.categories}</Text>
          </View>
          <View style={styles.chipRow}>
            {categories.slice(0, 12).map((c) => {
              const active = activeCategoryId === c.id
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? tk.brand.cta : tk.border.light,
                      backgroundColor: active ? tk.brand.cta : surface.card,
                    },
                  ]}
                  onPress={() => onPressCategory?.(c)}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? tk.brand.ctaForeground : txt.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: txt.primary }]}>{labels.recent}</Text>
          {onPressMore ? (
            <TouchableOpacity
              onPress={onPressMore}
              accessibilityRole="button"
              style={styles.moreRow}
            >
              <Text style={[styles.more, { color: txt.secondary }]}>{labels.more}</Text>
              <ChevronRight size={16} color={txt.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {recent.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {recent.slice(0, 8).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.recentCard,
                  { borderColor: tk.border.light, backgroundColor: surface.card },
                ]}
                onPress={() => onPressRecent?.(a)}
                accessibilityRole="button"
                accessibilityLabel={a.name}
              >
                <AvatarDot agent={a} colorScheme={colorScheme} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recentName, { color: txt.primary }]} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <View style={styles.recentHintRow}>
                    <Clock size={12} color={txt.secondary} />
                    <Text style={[styles.recentHint, { color: txt.secondary }]}>
                      {labels.recentHint}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.empty, { color: txt.secondary }]}>{labels.recentEmpty}</Text>
        )}
      </View>

      {myAgents.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: txt.primary }]}>{labels.myAgents}</Text>
          </View>
          <View style={styles.chipRow}>
            {myAgents.slice(0, 8).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.chip,
                  { borderColor: tk.border.light, backgroundColor: surface.card },
                ]}
                onPress={() => onPressMyAgent?.(a)}
                accessibilityRole="button"
                accessibilityLabel={a.name}
              >
                <Text style={[styles.chipText, { color: txt.primary }]} numberOfLines={1}>
                  🤖 {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: txt.primary }]}>{labels.recommended}</Text>
          {onPressMore ? (
            <TouchableOpacity
              onPress={onPressMore}
              accessibilityRole="button"
              style={styles.moreRow}
            >
              <Text style={[styles.more, { color: txt.secondary }]}>{labels.more}</Text>
              <ChevronRight size={16} color={txt.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {recommendedLoading && recommended.length === 0 ? (
          <Text style={[styles.empty, { color: txt.secondary }]}>…</Text>
        ) : (
          <View style={styles.grid}>
            {recommended.map((a) => (
              <Pressable
                key={a.id}
                style={[
                  styles.card,
                  {
                    borderColor: tk.border.light,
                    backgroundColor: surface.card,
                    width: cardWidth,
                    maxWidth: cardMaxWidth,
                  },
                ]}
                onPress={() => onPressRecommended?.(a)}
                accessibilityRole="button"
                accessibilityLabel={a.name}
              >
                <View style={[styles.cardCover, { backgroundColor: surface.muted }]}>
                  {a.cover ? (
                    <Image
                      source={{ uri: a.cover }}
                      style={styles.cardCoverImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.cardCoverImg, styles.cardCoverFallback]}>
                      {a.avatar ? (
                        <Image source={{ uri: a.avatar }} style={styles.cardAvatarLarge} />
                      ) : (
                        <View style={[styles.cardInitial, { backgroundColor: surface.card }]}>
                          <Text style={{ fontSize: 24, fontWeight: '700', color: txt.primary }}>
                            {(a.name || '?').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {a.isVipExclusive ? (
                    <View style={[styles.vipBadge, { backgroundColor: tk.brand.cta }]}>
                      <Text
                        style={{ fontSize: 10, fontWeight: '700', color: tk.brand.ctaForeground }}
                      >
                        VIP
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardName, { color: txt.primary }]} numberOfLines={2}>
                    {a.name}
                  </Text>
                  {a.description ? (
                    <Text style={[styles.cardDesc, { color: txt.secondary }]} numberOfLines={2}>
                      {a.description}
                    </Text>
                  ) : (
                    <View style={{ minHeight: 36 }} />
                  )}
                  <View
                    style={[
                      styles.priceBadge,
                      {
                        backgroundColor: a.isFree ? tk.success.lightest : surface.muted,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: rnType.label.size,
                        fontWeight: '600',
                        color: a.isFree ? tk.success.deepText : tk.brand.cta,
                      }}
                    >
                      {a.isFree
                        ? (labels.free ?? '免费')
                        : typeof a.price === 'number'
                          ? `¥${(a.price / 100).toFixed(2)}`
                          : ''}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </>
  )

  if (embedded) {
    return <View style={[{ backgroundColor: surface.bg }, containerStyle]}>{content}</View>
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: surface.bg }}
      contentContainerStyle={containerStyle}
      keyboardShouldPersistTaps="handled"
    >
      {content}
    </ScrollView>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
