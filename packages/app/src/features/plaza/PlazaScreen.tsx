import { useMemo } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** 广场任务项(共享层简化类型,保留 UI 渲染所需字段) */
export interface PlazaItem {
  id: string
  title: string
  description?: string
  creator?: string
  createdAt?: string
  status?: string
  [key: string]: unknown
}

/** 状态切换 chip */
export interface StatusChip {
  label: string
  value: string
}

export interface PlazaScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  items: PlazaItem[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  status: string
  search: string
  showSearch: boolean
  onRefresh: () => void
  onEndReached: () => void
  onStatusChange: (status: string) => void
  onSearchChange: (search: string) => void
  onSubmitSearch: () => void
  onPressItem: (item: PlazaItem) => void
  onPublish: () => void
}

const STATUS_CHIPS: readonly StatusChip[] = [
  { label: '待接单', value: '2' },
  { label: '开发中', value: '4' },
  { label: '已完成', value: '6' },
  { label: '我的任务', value: '9' },
] as const

const CYCLE_UNITS: Readonly<Record<string, string>> = {
  '0': '日',
  '1': '周',
  '2': '月',
  '3': '年',
}

const PLACEHOLDER_AVATAR = '🧑‍💻'

function formatPrice(price: string | number | undefined): string {
  const n = Number(price)
  if (!Number.isFinite(n)) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(n)
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr || dateStr === '-') return '-'
  const date = dateStr.split(' ')[0] ?? dateStr
  return date.replace(/-/g, '.')
}

function formatDateRange(start: string | undefined, end: string | undefined): string {
  return `${formatDate(start)}——${formatDate(end)}`
}

function avatarText(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : PLACEHOLDER_AVATAR
}

export function PlazaScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  error,
  status,
  search,
  showSearch,
  onRefresh,
  onEndReached,
  onStatusChange,
  onSearchChange,
  onSubmitSearch,
  onPressItem,
  onPublish,
  colorScheme = 'light',
}: PlazaScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const initialLoading = loading && items.length === 0 && !refreshing

  const renderCard = ({ item }: { item: PlazaItem }) => {
    const author = (item.creator as string | undefined) || '匿名'
    const desc = (item.description as string | undefined) || ''
    const createdAt = (item.createdAt as string | undefined) || ''
    const closingTime = item['closingTime'] as string | undefined
    const cycle = item['cycle'] as string | undefined
    const cycleUnit = item['cycleUnit'] as string | undefined
    const lowestPrice = item['lowestPrice'] as string | number | undefined
    const peakPrice = item['peakPrice'] as string | number | undefined
    const itemStatus = (item.status as string | undefined) || ''

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onPressItem(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {desc ? (
          <Text style={styles.cardDesc} numberOfLines={3}>
            {desc}
          </Text>
        ) : null}
        <Text style={styles.cardDate} allowFontScaling={false}>
          {formatDateRange(createdAt, closingTime)}
        </Text>
        {cycle ? (
          <Text style={styles.cardCycle} allowFontScaling={false}>
            {`周期时间:${cycle}${CYCLE_UNITS[cycleUnit ?? ''] ?? ''}`}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{avatarText(author)}</Text>
            </View>
          </View>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <Text
            style={[styles.price, itemStatus === '6' ? styles.priceDone : null]}
            allowFontScaling={false}
          >
            <Text style={styles.priceUnit}>￥</Text>
            {`${formatPrice(lowestPrice)}-${formatPrice(peakPrice)}`}
          </Text>
          {itemStatus === '2' ? (
            <View style={styles.chatBtn}>
              <Text style={styles.chatBtnText} allowFontScaling={false}>
                聊一聊
              </Text>
            </View>
          ) : itemStatus === '6' ? (
            <Text style={styles.statusDone} allowFontScaling={false}>
              项目已完成
            </Text>
          ) : itemStatus === '4' ? (
            <Text style={styles.statusDev} allowFontScaling={false}>
              开发中...
            </Text>
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      {/* 搜索栏 */}
      {showSearch ? (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={onSearchChange}
            placeholder="搜索需求"
            placeholderTextColor={tk.text.tertiary}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
          />
        </View>
      ) : null}
      {/* 状态切换 chips */}
      <View style={styles.chipsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipsContent}>
            {STATUS_CHIPS.map((chip) => {
              const active = status === chip.value
              return (
                <Pressable
                  key={chip.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onStatusChange(chip.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {chip.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </View>
      {/* 列表 */}
      {initialLoading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.loadingText}>{t('common.loading') || '加载中...'}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            error ? (
              <View style={styles.centerWrap}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryBtn} onPress={onRefresh}>
                  <Text style={styles.retryText}>{t('common.ok') || '重试'}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🌐</Text>
                <Text style={styles.emptyText}>当前赛道千万级空白市场,快来抢占市场!</Text>
                <Pressable style={styles.emptyBtn} onPress={onPublish}>
                  <Text style={styles.emptyBtnText}>发布需求</Text>
                </Pressable>
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? <Text style={styles.loadingMoreText}>加载更多...</Text> : null
          }
        />
      )}
      {/* 悬浮发布按钮 */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed ? styles.fabPressed : null]}
        onPress={onPublish}
        accessibilityRole="button"
        accessibilityLabel="发布需求"
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    searchBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: tk.surface.light,
    } as ViewStyle,
    searchInput: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    } as TextStyle,
    chipsBar: {
      backgroundColor: tk.surface.light,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tk.border.light,
    } as ViewStyle,
    chipsContent: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 12,
      paddingVertical: 12,
    } as ViewStyle,
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    } as ViewStyle,
    chipActive: {
      backgroundColor: tk.brand.DEFAULT,
      borderColor: tk.brand.DEFAULT,
    } as ViewStyle,
    chipText: {
      fontSize: 13,
      color: tk.text.secondary,
    } as TextStyle,
    chipTextActive: {
      color: '#fff',
      fontWeight: '600',
    } as TextStyle,
    listContent: {
      padding: 16,
      paddingBottom: 80,
    } as ViewStyle,
    columnWrapper: {
      justifyContent: 'space-between',
      gap: 12,
    } as ViewStyle,
    centerWrap: {
      alignItems: 'center',
      paddingVertical: 48,
    } as ViewStyle,
    loadingText: {
      fontSize: 14,
      color: tk.text.secondary,
    } as TextStyle,
    loadingMoreText: {
      textAlign: 'center',
      paddingVertical: 16,
      fontSize: 13,
      color: tk.text.secondary,
    } as TextStyle,
    errorText: {
      fontSize: 13,
      color: tk.danger.DEFAULT,
      textAlign: 'center',
    } as TextStyle,
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 24,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    } as ViewStyle,
    retryText: {
      fontSize: 14,
      color: '#fff',
    } as TextStyle,
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 12,
    } as ViewStyle,
    emptyIcon: {
      fontSize: 48,
    } as TextStyle,
    emptyText: {
      fontSize: 14,
      color: tk.text.secondary,
      textAlign: 'center',
    } as TextStyle,
    emptyBtn: {
      marginTop: 12,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    } as ViewStyle,
    emptyBtnText: {
      fontSize: 14,
      color: '#fff',
      fontWeight: '600',
    } as TextStyle,
    card: {
      flex: 1,
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: tk.surface.card,
      borderWidth: 1,
      borderColor: tk.border.light,
    } as ViewStyle,
    cardPressed: {
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 6,
    } as TextStyle,
    cardDesc: {
      fontSize: 12,
      color: tk.text.secondary,
      marginBottom: 6,
    } as TextStyle,
    cardDate: {
      fontSize: 11,
      color: tk.text.tertiary,
      marginBottom: 4,
    } as TextStyle,
    cardCycle: {
      fontSize: 11,
      color: tk.text.secondary,
      marginBottom: 8,
    } as TextStyle,
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    } as ViewStyle,
    avatarWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      overflow: 'hidden',
    } as ViewStyle,
    avatarFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    avatarText: {
      fontSize: 12,
    } as TextStyle,
    author: {
      flex: 1,
      fontSize: 12,
      color: tk.text.secondary,
    } as TextStyle,
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    } as ViewStyle,
    price: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    priceUnit: {
      fontSize: 11,
      fontWeight: '400',
    } as TextStyle,
    priceDone: {
      color: tk.success.DEFAULT,
    } as TextStyle,
    chatBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: tk.brand.DEFAULT,
    } as ViewStyle,
    chatBtnText: {
      fontSize: 11,
      color: '#fff',
      fontWeight: '600',
    } as TextStyle,
    statusDone: {
      fontSize: 11,
      color: tk.success.DEFAULT,
    } as TextStyle,
    statusDev: {
      fontSize: 11,
      color: tk.text.secondary,
    } as TextStyle,
    fab: {
      position: 'absolute',
      bottom: 24,
      left: 0,
      right: 0,
      alignItems: 'center',
    } as ViewStyle,
    fabPressed: {
      opacity: 0.8,
    } as ViewStyle,
    fabIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: tk.brand.DEFAULT,
      color: '#fff',
      textAlign: 'center',
      lineHeight: 50,
      fontSize: 28,
      fontWeight: '300',
    } as TextStyle,
  })
}
