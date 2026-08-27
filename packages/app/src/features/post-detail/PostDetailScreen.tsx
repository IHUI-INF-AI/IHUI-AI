import { useMemo } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PostDetailScreenProps } from '../../types'

/**
 * 动态详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染返回按钮 + 标题 + 作者/圈子/时间 metaRow
 * + 内容 + 点赞评论 statRow + loading / error 态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function PostDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: PostDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const imageUrls =
    typeof item?.imgs === 'string'
      ? item.imgs
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean)
      : (item?.imgs ?? [])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('postDetail.loadFailed')}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{item.author}</Text>
        {item.circleName ? <Text style={styles.circle}>#{item.circleName}</Text> : null}
        <Text style={styles.meta}>{item.createdAt}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      {imageUrls.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageRow}
        >
          {imageUrls.map((url, index) => (
            <TouchableOpacity key={`${url}-${index}`} activeOpacity={0.8}>
              <Image source={{ uri: url }} style={styles.detailImage} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      {item.types?.length || item.categories?.length ? (
        <Text style={styles.detailText}>
          类型：{item.types?.join('、') || '-'} 分类：{item.categories?.join('、') || '-'}
        </Text>
      ) : null}
      {item.taskStatus || item.status ? (
        <Text style={styles.detailText}>
          任务状态：{item.taskStatus || '-'} 审核状态：{item.status || '-'}
        </Text>
      ) : null}
      {item.lowestPrice !== null ||
      item.lowestPrice !== undefined ||
      item.peakPrice !== null ||
      item.peakPrice !== undefined ? (
        <Text style={styles.detailText}>
          价格：￥{item.lowestPrice ?? '-'} - ￥{item.peakPrice ?? '-'}
        </Text>
      ) : null}
      {item.cycle ? (
        <Text style={styles.detailText}>
          周期：{item.cycle}
          {item.cycleUnit ?? ''}
        </Text>
      ) : null}
      {item.closingTime ? (
        <Text style={styles.detailText}>截止时间：{item.closingTime}</Text>
      ) : null}
      {item.contact ? <Text style={styles.detailText}>联系方式：{item.contact}</Text> : null}
      <View style={styles.statRow}>
        <TouchableOpacity style={styles.statBtn}>
          <Text style={styles.statText}>❤ {item.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statBtn}>
          <Text style={styles.statText}>💬 {item.comments}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 32,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    back: { fontSize: 16, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 12 },
    author: { fontSize: 14, color: tk.text.secondary, fontWeight: '500' },
    circle: {
      fontSize: 11,
      color: tk.text.secondary,
      backgroundColor: tk.surface.card,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    meta: { fontSize: 11, color: tk.text.tertiary },
    content: { fontSize: 16, lineHeight: 22, color: tk.text.medium },
    detailText: { marginTop: 8, fontSize: 14, lineHeight: 20, color: tk.text.secondary },
    statRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    statBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    statText: { fontSize: 12, color: tk.text.medium },
    backBtn: { marginTop: 12 },
    imageRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' } as ViewStyle,
    detailImage: { width: 100, height: 100, borderRadius: 8 } as ImageStyle,
  })
}
