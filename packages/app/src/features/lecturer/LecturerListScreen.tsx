// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ArrowRight, Search } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { LiveLecturerListItem, LiveLecturerListScreenProps } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

export type { LiveLecturerListItem, LiveLecturerListScreenProps }

/** 首屏骨架卡数量(对齐 web 列表首屏 1 列 3~4 张的观感) */
const SKELETON_COUNT = 4
/** 列表卡头像边长(web `h-12 w-12`) */
const AVATAR_SIZE = 48

/**
 * LiveLecturerListScreen 直播讲师列表(共享层)
 *
 * 2026-10-28 立,承载 web `/lecturers`(apps/web/app/(main)/lecturers/page.tsx):
 * - 结构:顶部导航行(返回 + 标题)→ 副标题 + 搜索框 → 讲师卡列表
 * - 搜索:与 web 同一口径 —— 纯前端按 `name / title / intro` 拼串小写包含匹配,
 *   **不重发请求**(端点只支持 `name` 前缀模糊,搜索头衔/简介会漏,故不在后端搜)
 * - 三态:首屏骨架(header 常驻)→ 错误态(重试)→ 空态(暂无讲师 + 刷新)
 * - 平台无关:取数/下拉刷新/导航全部由 wrapper 注入;`onSelect` 只回吐整行,路由由宿主决定
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),间距走 rnSpacing/rnType/rnRadius
 * - i18n:lecturer.*(与 web 词包同键)+ common.back / common.retry
 *
 * ⚠️ 命名:本文件在 `features/lecturer/`(直播讲师域),与 `features/lecturer-list/`
 * (教师域,`/teacher/list`)是**两个域**;导出名因此加 `Live` 前缀,防 `@ihui/rn-app`
 * 桶文件里与教师域 `LecturerListScreen` 重名。
 */
export function LiveLecturerListScreen({
  t,
  items,
  loading,
  refreshing = false,
  error,
  onRefresh,
  onSelect,
  onBack,
  colorScheme = 'light',
}: LiveLecturerListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 搜索框输入 —— 纯 UI 状态,过滤在屏内完成(见头注「搜索」一条) */
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return items
    return items.filter((item) =>
      [item.name, item.title, item.intro]
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .join(' ')
        .toLowerCase()
        .includes(kw),
    )
  }, [items, keyword])

  /** 首屏骨架:只在「首次加载且一行都没有」时占屏,已加载过的刷新不闪骨架 */
  const showSkeleton = loading && items.length === 0
  /** 错误态:同上,手里有旧数据时保留旧列表,不把用户已读内容抖掉 */
  const showError = !loading && error.length > 0 && items.length === 0

  return (
    <View style={styles.container}>
      {/* header 常驻:加载/错误也不连导航一起消失 */}
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('lecturer.title')}
        </Text>
        {/* 右侧占位:与左侧返回键等宽,标题才是真居中 */}
        <View style={styles.headerSpacer} />
      </View>

      {showSkeleton ? (
        <ScreenSkeleton variant="card" count={SKELETON_COUNT} colorScheme={colorScheme} />
      ) : showError ? (
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <FlatList<LiveLecturerListItem>
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.subtitle}>{t('lecturer.subtitle')}</Text>
              <View style={styles.searchWrap}>
                <Search size={16} color={tk.text.tertiary} strokeWidth={2} />
                <TextField
                  colorScheme={colorScheme}
                  style={styles.searchInput}
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder={t('lecturer.search')}
                  placeholderTextColor={tk.text.tertiary}
                  returnKeyType="search"
                  accessibilityLabel={t('lecturer.search')}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              glyph="◎"
              title={t('lecturer.empty')}
              actionLabel={t('common.retry')}
              onAction={onRefresh}
              colorScheme={colorScheme}
            />
          }
          renderItem={({ item }) => (
            <PressableCard
              style={styles.card}
              onPress={() => onSelect(item)}
              colorScheme={colorScheme}
            >
              <View style={styles.cardHead}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>{item.name.slice(0, 1)}</Text>
                  </View>
                )}
                <View style={styles.cardHeadBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.title ? (
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                  ) : null}
                </View>
              </View>
              {item.intro ? (
                <Text style={styles.intro} numberOfLines={3}>
                  {item.intro}
                </Text>
              ) : null}
              <View style={styles.viewDetailRow}>
                <Text style={styles.viewDetail}>{t('lecturer.viewDetail')}</Text>
                <ArrowRight size={13} color={tk.brandAccent.deep} strokeWidth={2} />
              </View>
            </PressableCard>
          )}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.md,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      flexShrink: 1,
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 32,
    },
    /* 列表头(副标题 + 搜索框) */
    listBody: {
      paddingHorizontal: rnSpacing.md,
      paddingBottom: rnSpacing['3xl'],
    },
    listHeader: {
      paddingTop: rnSpacing.xs,
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    subtitle: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      height: 36,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    searchInput: {
      flex: 1,
      padding: 0,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    separator: {
      height: rnSpacing.md,
    },
    /* 讲师卡 */
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
    },
    cardHeadBody: {
      flex: 1,
      gap: rnSpacing.xs,
    },
    /* 圆形头像取「边长的一半」作半径 —— 档位表最大档只有 16,取档位会把 48px 头像压成圆角方块 */
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      fontSize: 20,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    name: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    title: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    intro: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    viewDetailRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    viewDetail: {
      fontSize: rnType.caption.size,
      fontWeight: '500',
      color: tk.brandAccent.deep,
    },
  } satisfies Record<string, ViewStyle | TextStyle | ImageStyle>)
}
