// 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层
import { View, Text, ScrollView } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import type { TFunction, PlanStatus, StudyPlanItem, StudyPlanScreenProps } from '@ihui/types'
import { useTt } from '@/i18n'

/** 学习计划状态/列表项/Props 类型 re-export(单一来源 @ihui/types) */
export type { PlanStatus, StudyPlanItem, StudyPlanScreenProps }

/**
 * Taro 适配层:StudyPlanScreen
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层。
 *
 * 复用 packages/app/src/features/study-plan/StudyPlanScreen 的 props 契约 +
 * 状态徽章配色状态机 + 进度条 clamp 逻辑 + 下拉刷新,仅替换平台元素:
 * - `div`/`span`/`TouchableOpacity` → `View`/`Text`
 * - `onPress` → `onTap`
 * - RN `ScrollView refreshControl` → Taro `ScrollView refresherEnabled + refresherTriggered`
 * - RN `numberOfLines={1}` → CSS `overflow:hidden + textOverflow:ellipsis + whiteSpace:nowrap`
 * - RN `StyleSheet.create` → CSSProperties 独立函数(避免 style 联合类型)
 * - px → rpx 单位换算(1px = 2rpx,750 设计稿基准)
 *
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 RN 端主题一致。
 *
 * i18n 三级降级:`t` prop → `useTt()` I18nContext → 硬编码中文 fallback。
 * StudyPlanScreenProps.t 为必填(契约约束),useTt 作防御性兜底,tr() 对 i18n miss 降级到硬编码。
 */
export function StudyPlanScreen({
  t: tProp,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: StudyPlanScreenProps) {
  const tk = getRnTokens(colorScheme)
  const tt = useTt()

  // i18n 三级降级:prop t > I18nContext tt > 硬编码中文(StudyPlanScreenProps.t 必填,useTt 防御性兜底)
  const tFn: TFunction =
    tProp ??
    ((key, options) => tt(key, key, options as Record<string, string | number> | undefined))
  /** t(key) 未命中(返回 key 原值)时降级到硬编码 fallback */
  const tr = (key: string, fallback: string): string => {
    const v = tFn(key)
    return v === key ? fallback : v
  }

  const titleText = tr('studyPlan.title', '学习计划')
  const backText = tr('common.back', '返回')
  const loadingText = tr('common.loading', '加载中...')
  const emptyText = tr('studyPlan.empty', '暂无学习计划')
  const lessonsLabel = tr('studyPlan.lessons', '课时')
  const progressLabel = tr('studyPlan.progress', '进度')
  const deadlineLabel = tr('studyPlan.deadline', '截止')
  const statusActiveText = tr('studyPlan.status.active', '进行中')
  const statusPausedText = tr('studyPlan.status.paused', '已暂停')
  const statusCompletedText = tr('studyPlan.status.completed', '已完成')
  const statusOverdueText = tr('studyPlan.status.overdue', '已逾期')

  /** 状态徽章配色(对齐 RN 源端 statusBadgeStyle 状态机:前景色 + 背景色) */
  const statusBadgeColors = (status: PlanStatus): { color: string; backgroundColor: string } => {
    switch (status) {
      case 'active':
        return { color: tk.success.DEFAULT, backgroundColor: tk.success.light }
      case 'paused':
        return { color: tk.warning.amberText, backgroundColor: tk.warning.amberLight }
      case 'completed':
        return { color: tk.success.deepText, backgroundColor: tk.success.lighter }
      case 'overdue':
        return { color: tk.danger.DEFAULT, backgroundColor: tk.danger.light }
      default:
        return { color: tk.text.secondary, backgroundColor: tk.surface.muted }
    }
  }

  /** 状态徽章文案(对齐 RN 源端 statusLabel) */
  const statusLabel = (status: PlanStatus): string => {
    switch (status) {
      case 'active':
        return statusActiveText
      case 'paused':
        return statusPausedText
      case 'completed':
        return `${statusCompletedText} ✓`
      case 'overdue':
        return statusOverdueText
      default:
        return String(status)
    }
  }

  return (
    <View style={viewStyles.container(tk)}>
      <View style={viewStyles.header(tk)}>
        <View style={viewStyles.backBtn()} onTap={onBack}>
          <Text style={textStyles.backText(tk)}>{backText}</Text>
        </View>
        <Text style={textStyles.title(tk)}>{titleText}</Text>
      </View>

      {error ? <Text style={textStyles.errorText(tk)}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={viewStyles.center()}>
          <Text style={textStyles.muted(tk)}>{loadingText}</Text>
        </View>
      ) : (
        <ScrollView
          scrollY
          refresherEnabled
          refresherTriggered={refreshing}
          onRefresherRefresh={onRefresh}
          style={viewStyles.scrollBody(tk)}
        >
          <View style={viewStyles.bodyInner(tk)}>
            {items.length === 0 ? (
              <View style={viewStyles.center()}>
                <Text style={textStyles.muted(tk)}>{emptyText}</Text>
              </View>
            ) : (
              items.map((item) => {
                const clamped = Math.max(0, Math.min(100, item.progress))
                const badge = statusBadgeColors(item.status)
                return (
                  <View key={item.id} style={viewStyles.card(tk)} onTap={() => onPressItem(item)}>
                    <View style={viewStyles.cardHead()}>
                      <View style={viewStyles.cardTitleWrap()}>
                        <Text style={textStyles.cardTitle(tk)}>{item.title}</Text>
                      </View>
                      <View
                        style={{
                          ...viewStyles.statusBadge(),
                          backgroundColor: badge.backgroundColor,
                        }}
                      >
                        <Text style={{ ...textStyles.statusText(), color: badge.color }}>
                          {statusLabel(item.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={textStyles.courseName(tk)}>{item.courseName}</Text>
                    <View style={viewStyles.progressBar(tk)}>
                      <View style={viewStyles.progressFill(tk, clamped)} />
                    </View>
                    <View style={viewStyles.cardFoot()}>
                      <Text style={textStyles.lessons(tk)}>
                        {lessonsLabel}: {item.completedLessons}/{item.totalLessons}
                      </Text>
                      <Text style={textStyles.progress(tk)}>
                        {progressLabel}: {item.progress}%
                      </Text>
                      <Text style={textStyles.deadline(tk)}>
                        {deadlineLabel}: {item.deadline}
                      </Text>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        </ScrollView>
      )}
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
  cardHead: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: toRpx(4),
  }),
  cardTitleWrap: (): CSSProperties => ({
    flex: 1,
    minWidth: 0,
  }),
  statusBadge: (): CSSProperties => ({
    paddingLeft: toRpx(6),
    paddingRight: toRpx(6),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    borderRadius: toRpx(4),
    marginLeft: toRpx(8),
    overflow: 'hidden',
    flexShrink: 0,
  }),
  progressBar: (tk: RnThemeTokens): CSSProperties => ({
    height: toRpx(4),
    backgroundColor: tk.surface.muted,
    borderRadius: toRpx(2),
    marginTop: toRpx(10),
    overflow: 'hidden',
  }),
  progressFill: (tk: RnThemeTokens, pct: number): CSSProperties => ({
    height: toRpx(4),
    width: `${pct}%`,
    backgroundColor: tk.success.DEFAULT,
    borderRadius: toRpx(2),
  }),
  cardFoot: (): CSSProperties => ({
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
    fontSize: toRpx(18),
    fontWeight: 600,
    color: tk.text.primary,
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
    fontSize: toRpx(14),
    fontWeight: 600,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  statusText: (): CSSProperties => ({
    fontSize: toRpx(10),
    fontWeight: 600,
  }),
  courseName: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(2),
    fontSize: toRpx(12),
    color: tk.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  lessons: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  progress: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    fontWeight: 500,
    color: tk.text.primary,
  }),
  deadline: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
}
