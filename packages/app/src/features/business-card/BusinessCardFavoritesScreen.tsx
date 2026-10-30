// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Star, Trash2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'businessCardFavPage'

export interface BusinessCardFavRowView {
  /** 名片 id(取消收藏的 DELETE 参数,后端按 cardId+userId 删行) */
  id: string
  name: string
  titleText: string
  companyText: string
  avatarUrl: string
  /** 薄壳按 web 同参 Intl(month/day 2-digit)格式化后的收藏时间文本 */
  favoritedText: string
  initials: string
}

export interface BusinessCardFavoritesScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate/AuthGatePrompt 同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: BusinessCardFavRowView[]
  loadingMore: boolean
  hasMore: boolean
  onEndReached: () => void
  onRefresh: () => void
  /** 任一删除请求在飞即非 null(web removeMut.isPending 禁用全部删除按钮同口径) */
  removingId: string | null
  onRemove: (cardId: string) => void
}

/** 首字母兜底(与同目录 BusinessCardScreen 私有实现同式) */
function getInitials(name: string): string {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

/**
 * 名片收藏共享屏 —— 承载 web /business-card/favorites(GET /api/business-card/favorites)。
 *
 * 口径差(如实登记):
 *  - web「查看」按钮跳 /business-card/share/[cardId] —— RN 未注册该路由(RootNavigator 现读
 *    无 share 域屏),本屏不渲染查看按钮避免死按钮;名片详情路由若日后承载,两端同批改。
 *  - web 头计数「共收藏 {items.length} 张名片」取的是当前已载行数(单页,后端默认分页截断),
 *    RN 保持同口径 rows.length(触底续页后随已载行数增长,与 web 单页读数差异属分页形态差)。
 *  - web 前端 FavListData 声明的嵌套 {card,favoriteId,createdAt} shape 与后端扁平行不符
 *    (web 现场缺陷),本屏按后端真实字段消费:收藏时间=favoritedAt、删除参数=id(cardId)。
 * 平台无关:取数 / 分页 / 时间格式化 / 首字母取法外的登录态判定全部由薄壳注入。
 */
export function BusinessCardFavoritesScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  loadingMore,
  hasMore,
  onEndReached,
  onRefresh,
  removingId,
  onRemove,
}: BusinessCardFavoritesScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Star size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.countText`, { count: rows.length })}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <Star size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.avatarUrl ? (
                <Image
                  source={{ uri: item.avatarUrl }}
                  style={styles.avatar}
                  resizeMode="cover"
                  accessibilityLabel={item.name}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {item.initials || getInitials(item.name)}
                  </Text>
                </View>
              )}
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name || '-'}
                </Text>
                {item.titleText ? (
                  <Text style={styles.rowMutedLine} numberOfLines={1}>
                    {item.titleText}
                  </Text>
                ) : null}
                {item.companyText ? (
                  <Text style={styles.rowMutedLine} numberOfLines={1}>
                    {item.companyText}
                  </Text>
                ) : null}
                <View style={styles.rowFooter}>
                  <Text style={styles.rowTime}>{item.favoritedText}</Text>
                  <TouchableOpacity
                    style={[styles.removeBtn, removingId !== null ? styles.dimBtn : null]}
                    onPress={() => onRemove(item.id)}
                    disabled={removingId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={t(`${NS}.unfavorite`)}
                  >
                    <Trash2
                      size={16}
                      color={removingId === null ? tk.text.secondary : tk.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
          onEndReached={hasMore ? onEndReached : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <Text style={styles.footerMuted}>{t('common.loading')}</Text> : null
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
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
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    list: { flex: 1, marginTop: rnSpacing.md },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    row: {
      flexDirection: 'row',
      gap: rnSpacing.md,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    avatarInitial: { fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.DEFAULT },
    rowMain: { flex: 1, gap: 2 },
    rowName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    rowMutedLine: { fontSize: rnType.label.size, color: tk.text.secondary },
    rowFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.xs,
    },
    rowTime: { fontSize: rnType.caption.size, color: tk.text.tertiary, flex: 1 },
    removeBtn: { padding: rnSpacing.xs },
    dimBtn: { opacity: 0.5 },
    footerMuted: {
      textAlign: 'center',
      paddingVertical: rnSpacing.md,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
