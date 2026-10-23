// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { UserCheck, UserPlus, Users } from 'lucide-react-native'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createUserFansStyles } from './user-fans-styles'

/**
 * 粉丝列表跨端共享屏 —— RN 端(及后续任何承载端)的唯一渲染真相源。
 *
 * 结构(逐元素,基准 = apps/mobile-rn 收敛前 UserFansScreen 的实现):
 * 页头(BackChevron + userFans.title) → ScrollView:
 *   四态分支 = loading(ActivityIndicator)/ failed(userFans.loadFailed + common.retry)
 *   / 空(userFans.empty + Users 图标)/ 列表(userFans.total 计数行 → 粉丝行:
 *   头像 Image 或昵称首字兜底 | 昵称 + 「userFans.followedAt 日期」| 已关注(UserCheck+success)/
 *   回关 CTA(UserPlus + brand.cta/ctaForeground))→ 分页(userFans.loadMore 按钮,rows<total 才出现)。
 *
 * 平台侧只注入取数与副作用:本屏不触网、不弹窗 ——
 * 关注态并集、回关请求与 appAlert/Taro 提示、日期 Intl 格式化都留在各端薄壳。
 * 后端契约(GET /api/follows/followers 实列只有 id/userId/nickname/avatar/createdAt,
 * 无 bio ⇒ 本屏不渲染 bio 行)。
 */
export interface UserFansRowView {
  id: string
  userId: string
  /** 展示昵称(匿名兜底已由平台侧解算) */
  nickname: string
  avatarUrl: string | null
  /** 关注时间展示文本(平台侧用 Intl.DateTimeFormat 生成) */
  followedAtText: string
  /** 我是否已回关该粉丝 */
  followed: boolean
}

export interface UserFansScreenProps {
  t: (key: string, params?: Record<string, string | number>) => string
  colorScheme?: 'light' | 'dark'
  rows: readonly UserFansRowView[]
  total: number
  /** 首屏加载(空数据时渲染指示器) */
  loading: boolean
  /** 加载更多进行中(分页按钮文案切 common.loading) */
  loadingMore: boolean
  /** 加载失败态(userFans.loadFailed + 重试) */
  failed: boolean
  /** 回关请求在途的用户 id(非 null 时全部按钮禁用,在途项半透明) */
  pendingUserId: string | null
  onBack: () => void
  onRetry: () => void
  onLoadMore: () => void
  onFollowBack: (userId: string) => void
}

export function UserFansScreen({
  t,
  colorScheme = 'light',
  rows,
  total,
  loading,
  loadingMore,
  failed,
  pendingUserId,
  onBack,
  onRetry,
  onLoadMore,
  onFollowBack,
}: UserFansScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createUserFansStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('userFans.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tk.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('userFans.loadFailed')}</Text>
            <Pressable onPress={onRetry} accessibilityRole="button">
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.stateBox}>
            <Users size={28} color={tk.text.tertiary} />
            <Text style={styles.muted}>{t('userFans.empty')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.total}>{t('userFans.total', { total })}</Text>
            {rows.map((fan) => (
              <View key={fan.id} style={styles.row}>
                {fan.avatarUrl ? (
                  <Image source={{ uri: fan.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{fan.nickname.slice(0, 1)}</Text>
                  </View>
                )}
                <View style={styles.rowMain}>
                  <Text style={styles.nickname} numberOfLines={1}>
                    {fan.nickname}
                  </Text>
                  <Text style={styles.muted}>
                    {t('userFans.followedAt')} {fan.followedAtText}
                  </Text>
                </View>
                {fan.followed ? (
                  <View style={styles.followedTag}>
                    <UserCheck size={13} color={tk.success.DEFAULT} />
                    <Text style={styles.followedText}>{t('userFans.followed')}</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[
                      styles.followBtn,
                      pendingUserId === fan.userId ? styles.btnDisabled : null,
                    ]}
                    onPress={() => onFollowBack(fan.userId)}
                    disabled={pendingUserId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={t('userFans.follow')}
                  >
                    <UserPlus size={13} color={tk.brand.ctaForeground} />
                    <Text style={styles.followBtnText}>{t('userFans.follow')}</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {rows.length < total ? (
              <Pressable
                style={styles.moreBtn}
                onPress={onLoadMore}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel={t('userFans.loadMore', { loaded: rows.length, total })}
              >
                <Text style={styles.moreText}>
                  {loadingMore
                    ? t('common.loading')
                    : t('userFans.loadMore', { loaded: rows.length, total })}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
