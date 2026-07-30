// 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层
import { View, Text, ScrollView } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import type { TFunction, NoteListScreenProps } from '@ihui/types'
import { useTt } from '@/i18n'

/** 笔记列表项/Props 类型 re-export(单一来源 @ihui/types) */
export type { NoteListItem, NoteListScreenProps } from '@ihui/types'

/**
 * Taro 适配层:NoteListScreen
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层。
 *
 * 复用 packages/app/src/features/note-list/NoteListScreen 的 props 契约 +
 * loading/empty/error 状态机 + 下拉刷新逻辑,仅替换平台元素:
 * - `View`/`Text`/`TouchableOpacity`(RN) → `View`/`Text`(Taro)
 * - `onPress` → `onTap`
 * - RN `FlatList` + `RefreshControl` → Taro `ScrollView`(scrollY)+ `refresherEnabled` + `refresherTriggered` + `map()`
 * - RN `numberOfLines={N}` → CSS `-webkit-line-clamp: N`(多行截断)
 * - RN `StyleSheet.create` → CSSProperties 独立函数(避免 style 联合类型)
 * - px → rpx 单位换算(1px = 2rpx,750 设计稿基准)
 *
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 RN 端主题一致。
 *
 * i18n 三级降级:`t` prop → `useTt()` I18nContext → 硬编码中文 fallback。
 * NoteListScreenProps.t 为必填(契约约束),useTt 作防御性兜底,tr() 对 i18n miss 降级到硬编码。
 */
export function NoteListScreen({
  t: tProp,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onCreate,
  onBack,
  colorScheme = 'light',
}: NoteListScreenProps) {
  const tk = getRnTokens(colorScheme)
  const tt = useTt()

  // i18n 三级降级:prop t > I18nContext tt > 硬编码中文(NoteListScreenProps.t 必填,useTt 防御性兜底)
  const tFn: TFunction =
    tProp ?? ((key, options) => tt(key, key, options as Record<string, string | number> | undefined))
  /** t(key) 未命中(返回 key 原值)时降级到硬编码 fallback */
  const tr = (key: string, fallback: string): string => {
    const v = tFn(key)
    return v === key ? fallback : v
  }

  const titleText = tr('noteList.title', '笔记')
  const backText = tr('common.back', '返回')
  const loadingText = tr('common.loading', '加载中...')
  const emptyText = tr('noteList.empty', '暂无笔记')

  return (
    <View style={viewStyles.container(tk)}>
      <View style={viewStyles.header(tk)}>
        <View style={viewStyles.backBtn()} onTap={onBack}>
          <Text style={textStyles.backText(tk)}>{backText}</Text>
        </View>
        <Text style={textStyles.title(tk)}>{titleText}</Text>
        {onCreate ? (
          <View style={viewStyles.createBtn()} onTap={onCreate}>
            <Text style={textStyles.createText(tk)}>+</Text>
          </View>
        ) : null}
      </View>

      {error ? <Text style={textStyles.errorText(tk)}>{error}</Text> : null}

      <ScrollView
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
        style={viewStyles.scrollBody(tk)}
      >
        <View style={viewStyles.bodyInner(tk)}>
          {loading && items.length === 0 ? (
            <View style={viewStyles.center()}>
              <Text style={textStyles.muted(tk)}>{loadingText}</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={viewStyles.center()}>
              <Text style={textStyles.muted(tk)}>{emptyText}</Text>
            </View>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                style={viewStyles.card(tk)}
                onTap={() => onPressItem(item)}
              >
                <Text style={textStyles.cardTitle(tk)}>{item.title}</Text>
                <Text style={textStyles.cardSummary(tk)}>{item.summary}</Text>
                <View style={viewStyles.metaRow()}>
                  <Text style={textStyles.author(tk)}>{item.author}</Text>
                  <Text style={textStyles.meta(tk)}>
                    ❤ {item.likes} · {item.createdAt}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

// ===== 样式(view/text 分组,独立函数返回 CSSProperties,避免 style 联合类型) =====

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准,与 miniapp-taro 全局风格一致) */
const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: tk.surface.bg,
  }),
  header: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    backgroundColor: tk.surface.bg,
  }),
  backBtn: (): CSSProperties => ({
    paddingLeft: toRpx(4),
    paddingRight: toRpx(4),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
    marginRight: toRpx(12),
  }),
  createBtn: (): CSSProperties => ({
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(4),
    paddingBottom: toRpx(4),
    marginLeft: toRpx(12),
  }),
  scrollBody: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    backgroundColor: tk.surface.bg,
  }),
  bodyInner: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(16),
    paddingBottom: toRpx(16),
    backgroundColor: tk.surface.bg,
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    paddingTop: toRpx(48),
    paddingBottom: toRpx(48),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(16),
    paddingBottom: toRpx(16),
    borderRadius: toRpx(8),
    border: `1px solid ${tk.border.light}`,
    marginBottom: toRpx(8),
    backgroundColor: tk.surface.light,
  }),
  metaRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: toRpx(8),
  }),
}

const textStyles = {
  backText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.medium,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(18),
    fontWeight: 600,
    color: tk.text.primary,
  }),
  createText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(24),
    fontWeight: 600,
    color: tk.success.DEFAULT,
  }),
  errorText: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingBottom: toRpx(4),
    fontSize: toRpx(12),
    color: tk.danger.DEFAULT,
  }),
  muted: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
  }),
  cardTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(15),
    fontWeight: 600,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  cardSummary: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(4),
    fontSize: toRpx(13),
    color: tk.text.medium,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  }),
  author: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.success.DEFAULT,
  }),
  meta: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
}
