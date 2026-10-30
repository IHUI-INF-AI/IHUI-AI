// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Award, Coins, Gift, TrendingUp } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'eduPointsPage'

/** 渠道行(GET /api/edu-points/channels → data.list,薄壳做类型收窄后注入) */
export interface EduPointsChannelView {
  id: string
  name: string
  code: string | null
  description: string | null
}

/** 兑换商品行(GET /api/points/mall/redeem → data.list) */
export interface EduPointsGoodsView {
  id: string
  name: string
  cover: string | null
  /** 展示口径与 web 同:`pointsCost ?? points ?? 0`(apps/web/app/(main)/edu-points/page.tsx:204) */
  cost: number
  /** true 时按钮置灰(web 同判据 stock !== null && stock <= 0,page.tsx:205) */
  soldOut: boolean
}

export interface EduPointsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate + AuthGatePrompt 同口径,page.tsx:174-249) */
  loginRequiredText: string
  /** 未登录时后端不查,注入 null;已登录但失败也落 null(与 web 同:失败显 0) */
  myPoints: number | null
  channelsLoading: boolean
  channelsError: string | null
  channels: EduPointsChannelView[]
  goodsLoading: boolean
  goodsError: string | null
  goods: EduPointsGoodsView[]
  /** 正在兑换的商品 id,非空即该行按钮 pending */
  redeemingId: string | null
  redeemMessage: string | null
  redeemError: string | null
  onRedeem: (id: string) => void
  onRefresh: () => void
}

/**
 * 教育积分共享屏 —— 承载 web /edu-points(apps/web/app/(main)/edu-points/page.tsx)。
 *
 * 口径:web 是「概览两卡 + 渠道卡网格 + 兑换商品卡网格」,RN 落为「概览两行 + 竖向列表 +
 * 商品卡」,同端点同参数;web 页第二块标题误复用 channelsTitle(web:173),RN 照抄同一键,
 * 不新造文案。平台无关:取数、兑换 mutation、登录态由薄壳注入;本文件只管渲染与三态。
 * 未登录时不渲染「我的积分」卡与兑换区(web 门内才渲染,page.tsx:122-132 / 174-249)。
 */
export function EduPointsScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  myPoints,
  channelsLoading,
  channelsError,
  channels,
  goodsLoading,
  goodsError,
  goods,
  redeemingId,
  redeemMessage,
  redeemError,
  onRedeem,
  onRefresh,
}: EduPointsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const loggedIn = !loginRequiredText

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Award size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      >
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <View style={styles.statHead}>
              <Text style={styles.statLabel}>{t(`${NS}.activeChannels`)}</Text>
              <TrendingUp size={16} color={tk.text.tertiary} />
            </View>
            <Text style={styles.statValue}>{channels.length}</Text>
          </View>
          {loggedIn ? (
            <View style={styles.statCard}>
              <View style={styles.statHead}>
                <Text style={styles.statLabel}>{t(`${NS}.myPoints`)}</Text>
                <Coins size={16} color={tk.text.tertiary} />
              </View>
              <Text style={styles.statValue}>{myPoints ?? 0}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{t(`${NS}.channelsTitle`)}</Text>
        {!loggedIn ? (
          <Text style={styles.gate}>{loginRequiredText}</Text>
        ) : channelsLoading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
            <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
          </View>
        ) : channelsError ? (
          <Text style={styles.error}>{channelsError}</Text>
        ) : channels.length === 0 ? (
          <View style={styles.centerBlock}>
            <Award size={28} color={tk.text.tertiary} />
            <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
          </View>
        ) : (
          channels.map((channel) => (
            <View key={channel.id} style={styles.card}>
              <Text style={styles.cardTitle}>{channel.name}</Text>
              {channel.code ? <Text style={styles.cardMeta}>{channel.code}</Text> : null}
              {channel.description ? <Text style={styles.cardBody}>{channel.description}</Text> : null}
            </View>
          ))
        )}

        {loggedIn ? (
          <>
            <Text style={styles.sectionTitle}>{t(`${NS}.channelsTitle`)}</Text>
            {redeemMessage ? <Text style={styles.success}>{redeemMessage}</Text> : null}
            {redeemError ? <Text style={styles.error}>{redeemError}</Text> : null}
            {goodsLoading ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
              </View>
            ) : goodsError ? (
              <Text style={styles.error}>{goodsError}</Text>
            ) : goods.length === 0 ? (
              <View style={styles.centerBlock}>
                <Gift size={28} color={tk.text.tertiary} />
                <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
              </View>
            ) : (
              <View style={styles.goodsGrid}>
                {goods.map((item) => {
                  const pending = redeemingId === item.id
                  const disabled = pending || item.soldOut
                  return (
                    <View key={item.id} style={styles.goodsCard}>
                      {item.cover ? (
                        <Image source={{ uri: item.cover }} style={styles.goodsCover} />
                      ) : (
                        <View style={styles.goodsCoverFallback}>
                          <Gift size={26} color={tk.text.tertiary} />
                        </View>
                      )}
                      <Text style={styles.goodsName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.goodsFooter}>
                        <View style={styles.costRow}>
                          <Coins size={14} color={tk.brand.DEFAULT} />
                          <Text style={styles.costText}>{item.cost}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.redeemBtn, disabled && styles.redeemBtnDisabled]}
                          disabled={disabled}
                          onPress={() => onRedeem(item.id)}
                        >
                          {pending ? (
                            <ActivityIndicator size="small" color={tk.brand.foreground} />
                          ) : (
                            <Text style={styles.redeemBtnText}>{t(`${NS}.confirm`)}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { paddingBottom: rnSpacing['2xl'] },
    statRow: { flexDirection: 'row', gap: rnSpacing.md },
    statCard: {
      flex: 1,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    statHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statLabel: { fontSize: rnType.label.size, color: tk.text.secondary },
    statValue: {
      marginTop: rnSpacing.xs,
      fontSize: 24,
      fontWeight: '700',
      color: tk.text.primary,
    },
    sectionTitle: {
      marginTop: rnSpacing.lg,
      marginBottom: rnSpacing.sm,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    card: {
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    cardMeta: { fontSize: rnType.caption.size, color: tk.text.secondary },
    cardBody: { fontSize: rnType.label.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xl,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.sm, fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    success: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.success.deepText,
    },
    gate: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    goodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.md },
    goodsCard: {
      flexBasis: '47%',
      flexGrow: 1,
      gap: rnSpacing.xs,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    goodsCover: { width: '100%', height: 96, borderRadius: rnRadius.md },
    goodsCoverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 96,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    goodsName: { fontSize: rnType.label.size, fontWeight: '500', color: tk.text.primary },
    goodsFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    costRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    costText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.DEFAULT },
    redeemBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.DEFAULT,
    },
    redeemBtnDisabled: { backgroundColor: tk.surface.muted },
    redeemBtnText: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.brand.foreground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
