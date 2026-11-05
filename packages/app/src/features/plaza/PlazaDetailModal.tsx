// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { useMemo } from 'react'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { PlazaItem } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { Tappable } from '@ihui/ui-native'

export interface PlazaDetailModalProps {
  t: TFunction
  visible: boolean
  item: PlazaItem | null
  colorScheme?: 'light' | 'dark'
  onClose: () => void
  onOpenDetail: (item: PlazaItem) => void
}

/** 卡片详情居中弹层共享实现(2026-11-05 自小程序页内联弹层上收,RN 同屏消费) */
export function PlazaDetailModal({
  t,
  visible,
  item,
  colorScheme = 'light',
  onClose,
  onOpenDetail,
}: PlazaDetailModalProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  if (!item) return null
  const tr = (key: string, fallback: string) => {
    const v = t(key)
    return v === key ? fallback : v
  }
  const rawImgs = item['imgs']
  const rawCover = item['cover']
  const cover =
    (typeof rawImgs === 'string' && rawImgs.trim() ? rawImgs.split(',')[0]?.trim() : undefined) ||
    (typeof rawCover === 'string' && rawCover.trim() ? rawCover.trim() : undefined)
  const desc = (item.description as string | undefined) ?? ''
  const track =
    (item['track'] as string | undefined) ?? (item['category'] as string | undefined) ?? '-'
  const rawStatus = item['taskStatus'] ?? item['status']
  const status =
    rawStatus === 'completed' || rawStatus === 2
      ? tr('plaza.index.tabDone', '已完成')
      : rawStatus === 'developing' || rawStatus === 1
        ? tr('plaza.index.tabOngoing', '进行中')
        : tr('plaza.index.tabAll', '全部')
  const author = item.creator || tr('plaza.index.anonymous', '匿名')
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Tappable
        style={styles.mask}
        onPress={onClose}
        accessibilityLabel={tr('plaza.index.closeDetail', '关闭详情')}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" />
            ) : null}
            {desc ? <Text style={styles.desc}>{desc}</Text> : null}
            <Text style={styles.meta}>
              {tr('plaza.index.detailTrack', '赛道')}:{track}
            </Text>
            <Text style={styles.meta}>
              {tr('plaza.index.detailStatus', '状态')}:{status}
            </Text>
            <Text style={styles.meta}>
              {tr('plaza.index.detailAuthor', '发布人')}:{author}
            </Text>
          </ScrollView>
          <Tappable
            style={styles.btn}
            onPress={() => onOpenDetail(item)}
            accessibilityRole="button"
            accessibilityLabel={tr('plaza.index.viewDetail', '查看详情')}
          >
            <Text style={styles.btnText}>{tr('plaza.index.viewDetail', '查看详情')}</Text>
          </Tappable>
        </Pressable>
      </Tappable>
    </Modal>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    mask: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: rnSpacing['2xl'],
      backgroundColor: 'rgba(0,0,0,0.45)',
    } as ViewStyle,
    card: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '78%',
      padding: rnSpacing['2xl'],
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      gap: rnSpacing.md,
    } as ViewStyle,
    title: {
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    body: {
      flexGrow: 0,
    } as ViewStyle,
    bodyContent: {
      gap: rnSpacing.sm,
    } as ViewStyle,
    cover: {
      width: '100%',
      height: 160,
      borderRadius: rnRadius.lg,
    } as ImageStyle,
    desc: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    } as TextStyle,
    meta: {
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
    } as TextStyle,
    btn: {
      marginTop: rnSpacing.sm,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    } as ViewStyle,
    btnText: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    } as TextStyle,
  })
}
