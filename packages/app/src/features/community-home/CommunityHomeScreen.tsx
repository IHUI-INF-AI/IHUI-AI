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

import { useMemo } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'

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

export type CommunityHomeLabels = Record<CommunityHomeLabelKey, string>

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
}

export interface CommunityHomeScreenProps {
  labels: CommunityHomeLabels
  colorScheme?: 'light' | 'dark'
  keyword: string
  onKeywordChange: (value: string) => void
  onSearch: () => void
  banners?: CommunityHomeBanner[]
  categories?: CommunityHomeCategory[]
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
}

function AvatarDot({ agent, colorScheme }: { agent: CommunityHomeAgent; colorScheme: 'light' | 'dark' }) {
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
  container: { paddingBottom: rnSpacing.xl },
  header: { paddingHorizontal: rnSpacing.md, paddingTop: rnSpacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: { fontSize: rnType.display.size, fontWeight: '700' },
  subtitle: { marginTop: rnSpacing.xs, fontSize: rnType.body.size },
  postsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: rnRadius.md,
    paddingHorizontal: rnSpacing.md,
    height: 34,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs, marginTop: rnSpacing.md },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: rnRadius.md,
    paddingHorizontal: rnSpacing.md,
    fontSize: rnType.body.size,
  },
  searchBtn: {
    height: 44,
    paddingHorizontal: rnSpacing.md,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphBtn: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.md,
  },
  section: { marginTop: rnSpacing.lg, paddingHorizontal: rnSpacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: rnSpacing.sm,
  },
  sectionTitle: { fontSize: rnType.title.size, fontWeight: '600' },
  more: { fontSize: rnType.body.size },
  bannerRow: { gap: rnSpacing.sm },
  banner: {
    width: 260,
    height: 116,
    borderRadius: rnRadius.lg,
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bannerTitle: {
    paddingHorizontal: rnSpacing.sm,
    paddingVertical: rnSpacing.sm,
    fontSize: rnType.body.size,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.xs,
    borderWidth: 1,
    borderRadius: rnRadiusFor.chip,
    paddingHorizontal: rnSpacing.md,
    height: 32,
  },
  chipIcon: { width: 16, height: 16, borderRadius: 2 },
  chipText: { fontSize: rnType.body.size },
  empty: { fontSize: rnType.body.size },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  recentRow: { gap: rnSpacing.sm },
  recentCard: {
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.sm,
    borderWidth: 1,
    borderRadius: rnRadius.lg,
    padding: rnSpacing.sm,
  },
  recentName: { fontSize: rnType.body.size, fontWeight: '500' },
  recentHint: { marginTop: 2, fontSize: rnType.caption.size },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
  card: {
    width: '48%',
    borderWidth: 1,
    borderRadius: rnRadius.lg,
    padding: rnSpacing.md,
  },
  cardName: { fontSize: rnType.title.size, fontWeight: '600' },
  cardDesc: { marginTop: rnSpacing.xs, fontSize: rnType.body.size },
})

export function CommunityHomeScreen({
  labels,
  colorScheme = 'light',
  keyword,
  onKeywordChange,
  onSearch,
  banners = [],
  categories = [],
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
}: CommunityHomeScreenProps) {
  const tk: AppThemeTokens = useMemo(() => getTokens(colorScheme), [colorScheme])
  const txt = tk.text
  const surface = tk.surface

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: surface.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: rnSpacing.md }}>
            <Text style={[styles.title, { color: txt.primary }]}>{labels.title}</Text>
            <Text style={[styles.subtitle, { color: txt.secondary }]}>{labels.subtitle}</Text>
          </View>
          {onPressPosts ? (
            <TouchableOpacity
              style={[styles.postsBtn, { borderColor: tk.border.light, backgroundColor: surface.card }]}
              onPress={onPressPosts}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: rnType.body.size, color: txt.primary }}>{labels.posts}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <TextField
            colorScheme={colorScheme}
            style={[
              styles.input,
              { borderColor: tk.border.light, backgroundColor: surface.card },
              { color: txt.primary },
            ]}
            value={keyword}
            onChangeText={onKeywordChange}
            placeholder={labels.searchPlaceholder}
            placeholderTextColor={txt.secondary}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: tk.brand.cta }]}
            onPress={onSearch}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.ctaForeground }}>
              {labels.title.slice(0, 0) || '🔍'}
            </Text>
          </TouchableOpacity>
          {/* 与小程序 InputArea 同语义:语音/图搜只保留入口并提示「完整版使用」 */}
          {onVoiceHint ? (
            <TouchableOpacity
              style={styles.glyphBtn}
              onPress={onVoiceHint}
              accessibilityRole="button"
              accessibilityLabel={labels.voiceHint}
            >
              <Text style={{ fontSize: rnType.title.size }}>🎙️</Text>
            </TouchableOpacity>
          ) : null}
          {onImageHint ? (
            <TouchableOpacity
              style={styles.glyphBtn}
              onPress={onImageHint}
              accessibilityRole="button"
              accessibilityLabel={labels.imageHint}
            >
              <Text style={{ fontSize: rnType.title.size }}>🖼️</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {banners.length > 0 ? (
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerRow}>
            {banners.slice(0, 6).map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.banner, { backgroundColor: surface.muted }]}
                onPress={() => onPressBanner?.(b)}
                accessibilityRole="button"
                accessibilityLabel={b.title || labels.banners}
              >
                {b.image ? <Image source={{ uri: b.image }} style={styles.bannerImg} /> : null}
                <View style={styles.bannerMask} />
                <Text style={styles.bannerTitle} numberOfLines={1}>
                  {b.title || labels.banners}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: txt.primary }]}>{labels.categories}</Text>
          </View>
          <View style={styles.chipRow}>
            {categories.slice(0, 12).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, { borderColor: tk.border.light, backgroundColor: surface.card }]}
                onPress={() => onPressCategory?.(c)}
                accessibilityRole="button"
                accessibilityLabel={c.name}
              >
                {c.icon ? <Image source={{ uri: c.icon }} style={styles.chipIcon} /> : null}
                <Text style={[styles.chipText, { color: txt.primary }]} numberOfLines={1}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: txt.primary }]}>{labels.recent}</Text>
          {onPressMore ? (
            <TouchableOpacity onPress={onPressMore} accessibilityRole="button">
              <Text style={[styles.more, { color: txt.secondary }]}>{labels.more}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {recent.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
            {recent.slice(0, 8).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.recentCard, { borderColor: tk.border.light, backgroundColor: surface.card }]}
                onPress={() => onPressRecent?.(a)}
                accessibilityRole="button"
                accessibilityLabel={a.name}
              >
                <AvatarDot agent={a} colorScheme={colorScheme} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recentName, { color: txt.primary }]} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={[styles.recentHint, { color: txt.secondary }]}>{labels.recentHint}</Text>
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
                style={[styles.chip, { borderColor: tk.border.light, backgroundColor: surface.card }]}
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
            <TouchableOpacity onPress={onPressMore} accessibilityRole="button">
              <Text style={[styles.more, { color: txt.secondary }]}>{labels.more}</Text>
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
                style={[styles.card, { borderColor: tk.border.light, backgroundColor: surface.card }]}
                onPress={() => onPressRecommended?.(a)}
                accessibilityRole="button"
                accessibilityLabel={a.name}
              >
                <Text style={[styles.cardName, { color: txt.primary }]} numberOfLines={1}>
                  {a.name}
                </Text>
                {a.description ? (
                  <Text style={[styles.cardDesc, { color: txt.secondary }]} numberOfLines={2}>
                    {a.description}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠