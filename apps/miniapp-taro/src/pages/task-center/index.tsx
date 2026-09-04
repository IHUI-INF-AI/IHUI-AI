// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/task-center/TaskCenterScreen UI 与
// apps/mobile-rn TaskCenterScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import { fetchApi } from '@ihui/api-client'
import type { TaskCenterItem, TaskCenterTab } from '@ihui/types'
import ThemeRoot from '@/components/ThemeRoot'

const TABS: TaskCenterTab[] = ['daily', 'weekly', 'newbie']

/** tab 文案 key + fallback(i18n 未命中时降级) */
const TAB_KEYS: Record<TaskCenterTab, [string, string]> = {
  daily: ['taskCenter.tab_daily', '每日'],
  weekly: ['taskCenter.tab_weekly', '每周'],
  newbie: ['taskCenter.tab_newbie', '新手'],
}

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐共享屏 createStyles) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tk.surface.bg,
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: toRpx(10),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(8),
  }),
  backBtn: (): CSSProperties => ({
    alignSelf: 'flex-start',
  }),
  tabs: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
  }),
  tab: (tk: RnThemeTokens, active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: toRpx(6),
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(6),
    paddingBottom: toRpx(6),
    borderRadius: toRpx(12),
    backgroundColor: active ? tk.brand.DEFAULT : tk.surface.card,
    flexShrink: 0,
  }),
  errorBar: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
  }),
  bodyScroll: (): CSSProperties => ({
    flex: 1,
  }),
  list: (): CSSProperties => ({
    paddingLeft: toRpx(14),
    paddingRight: toRpx(14),
    paddingTop: toRpx(14),
    paddingBottom: toRpx(32),
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: toRpx(32),
    paddingBottom: toRpx(32),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(14),
    paddingRight: toRpx(14),
    paddingTop: toRpx(14),
    paddingBottom: toRpx(14),
    borderRadius: toRpx(16),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tk.border.light,
    marginBottom: toRpx(12),
    backgroundColor: tk.surface.light,
  }),
  cardHeader: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  taskTitleWrap: (): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    marginRight: toRpx(8),
  }),
  rewardBadge: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    borderRadius: toRpx(12),
    backgroundColor: tk.success.light,
    flexShrink: 0,
    overflow: 'hidden',
  }),
  progressRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: toRpx(8),
  }),
  progressBarBg: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    height: toRpx(6),
    borderRadius: toRpx(8),
    backgroundColor: tk.surface.card,
    overflow: 'hidden',
  }),
  progressBarFill: (pct: number): CSSProperties => ({
    height: '100%',
    width: `${pct}%`,
  }),
  actionBtn: (tk: RnThemeTokens, variant: 'primary' | 'muted'): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: toRpx(10),
    height: toRpx(44),
    borderRadius: toRpx(12),
    backgroundColor: variant === 'primary' ? tk.brand.DEFAULT : tk.surface.card,
  }),
}

const textStyles = {
  backText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    color: tk.text.secondary,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(22),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  subtitle: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  tab: (tk: RnThemeTokens, active: boolean): CSSProperties => ({
    fontSize: toRpx(14),
    color: active ? tk.surface.light : tk.text.secondary,
  }),
  errorText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.danger.DEFAULT,
  }),
  retryText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.primary,
  }),
  emptyText: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    color: tk.text.tertiary,
  }),
  taskTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: '600',
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  rewardText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    fontWeight: '600',
    color: tk.success.DEFAULT,
  }),
  taskDesc: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  progressText: (tk: RnThemeTokens): CSSProperties => ({
    marginLeft: toRpx(8),
    fontSize: toRpx(11),
    color: tk.text.tertiary,
    flexShrink: 0,
  }),
  actionBtnText: (tk: RnThemeTokens, variant: 'primary' | 'muted'): CSSProperties => ({
    fontSize: toRpx(14),
    color: variant === 'primary' ? tk.surface.light : tk.text.tertiary,
  }),
}

export default function TaskCenter() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  const [tasks, setTasks] = useState<TaskCenterItem[]>([])
  const [activeTab, setActiveTab] = useState<TaskCenterTab>('daily')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [claimingId, setClaimingId] = useState<string | null>(null)

  // 加载:对齐 mobile-rn load 状态机(端点 /points/tasks?type=)
  const load = useCallback(
    async (tab: TaskCenterTab, refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const resp = await fetchApi<{ list: TaskCenterItem[] }>('/points/tasks', {
        params: { type: tab },
      })
      if (!resp.success) {
        setError(tt('taskCenter.loadFailed', '加载任务失败'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setTasks(resp.data?.list ?? [])
      setLoading(false)
      setRefreshing(false)
    },
    [tt],
  )

  const switchTab = (tab: TaskCenterTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    void load(tab)
  }

  // 领取:对齐 mobile-rn handleClaim(POST /points/tasks/{id}/claim,成功 toast + 刷新)
  const handleClaim = async (task: TaskCenterItem) => {
    setClaimingId(task.id)
    try {
      const resp = await fetchApi<unknown>(`/points/tasks/${task.id}/claim`, { method: 'POST' })
      if (resp.success) {
        Taro.showToast({
          title: `${tt('taskCenter.claimed', '已领取')} +${task.reward}`,
          icon: 'none',
        })
        void load(activeTab, true)
      } else {
        Taro.showToast({ title: tt('taskCenter.claimFailed', '领取失败'), icon: 'none' })
      }
    } finally {
      setClaimingId(null)
    }
  }

  // 去完成:对齐 mobile-rn handleAction(actionUrl 为 goBack 时返回上一页)
  const handleAction = (task: TaskCenterItem) => {
    if (task.actionUrl === 'goBack') {
      Taro.navigateBack({ delta: 1 }).catch(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      })
    }
  }

  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  const tabLabel = (tab: TaskCenterTab): string => {
    const entry = TAB_KEYS[tab]
    return tt(entry[0], entry[1])
  }

  if (loading) {
    return (
      <ThemeRoot>
        <View style={viewStyles.container(tk)}>
          <View style={viewStyles.center()}>
            <Text style={textStyles.emptyText(tk)}>{tt('common.loading', '加载中...')}</Text>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  // 对齐共享屏过滤语义(接口已按 type 返回,双保险)
  const filtered = tasks.filter((task) => task.type === activeTab)

  return (
    <ThemeRoot>
      <View style={viewStyles.container(tk)}>
        <ScrollView
          scrollY
          style={viewStyles.bodyScroll()}
          refresherEnabled
          refresherTriggered={refreshing}
          onRefresherRefresh={() => void load(activeTab, true)}
        >
          <View style={viewStyles.header()}>
            <View style={viewStyles.backBtn()} onTap={goBack}>
              <Text style={textStyles.backText(tk)}>{tt('common.back', '返回')}</Text>
            </View>
            <Text style={textStyles.title(tk)}>{tt('taskCenter.title', '任务中心')}</Text>
            <Text style={textStyles.subtitle(tk)}>
              {tt('taskCenter.subtitle', '做任务,拿奖励')}
            </Text>
          </View>

          <View style={viewStyles.tabs()}>
            {TABS.map((tab) => {
              const active = tab === activeTab
              return (
                <View key={tab} style={viewStyles.tab(tk, active)} onTap={() => switchTab(tab)}>
                  <Text style={textStyles.tab(tk, active)}>{tabLabel(tab)}</Text>
                </View>
              )
            })}
          </View>

          {error ? (
            <View style={viewStyles.errorBar()}>
              <Text style={textStyles.errorText(tk)}>{error}</Text>
              <View onTap={() => void load(activeTab)}>
                <Text style={textStyles.retryText(tk)}>{tt('taskCenter.retry', '重试')}</Text>
              </View>
            </View>
          ) : null}

          <View style={viewStyles.list()}>
            {filtered.length === 0 ? (
              <View style={viewStyles.center()}>
                <Text style={textStyles.emptyText(tk)}>
                  {tt('taskCenter.empty', '暂无可做的任务')}
                </Text>
              </View>
            ) : (
              filtered.map((task) => {
                const progressPct =
                  task.target > 0
                    ? Math.min(100, Math.round((task.progress / task.target) * 100))
                    : 0
                return (
                  <View key={task.id} style={viewStyles.card(tk)}>
                    <View style={viewStyles.cardHeader()}>
                      <View style={viewStyles.taskTitleWrap()}>
                        <Text style={textStyles.taskTitle(tk)}>{task.title}</Text>
                      </View>
                      <View style={viewStyles.rewardBadge(tk)}>
                        <Text style={textStyles.rewardText(tk)}>+{task.reward}</Text>
                      </View>
                    </View>
                    <Text style={textStyles.taskDesc(tk)}>{task.description}</Text>
                    <View style={viewStyles.progressRow()}>
                      <View style={viewStyles.progressBarBg(tk)}>
                        <View
                          style={{
                            ...viewStyles.progressBarFill(progressPct),
                            backgroundColor: tk.success.DEFAULT,
                            borderRadius: toRpx(8),
                          }}
                        />
                      </View>
                      <Text style={textStyles.progressText(tk)}>
                        {tt('taskCenter.progress', '{current}/{target}')
                          .replace('{current}', String(task.progress))
                          .replace('{target}', String(task.target))}
                      </Text>
                    </View>
                    {task.claimed ? (
                      <View style={viewStyles.actionBtn(tk, 'muted')}>
                        <Text style={textStyles.actionBtnText(tk, 'muted')}>
                          {tt('taskCenter.claimed', '已领取')}
                        </Text>
                      </View>
                    ) : task.completed ? (
                      <View
                        style={viewStyles.actionBtn(tk, 'primary')}
                        onTap={() => void handleClaim(task)}
                      >
                        <Text style={textStyles.actionBtnText(tk, 'primary')}>
                          {claimingId === task.id
                            ? tt('common.loading', '加载中...')
                            : tt('taskCenter.claim', '领取')}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={viewStyles.actionBtn(tk, 'muted')}
                        onTap={() => handleAction(task)}
                      >
                        <Text style={textStyles.actionBtnText(tk, 'muted')}>
                          {tt('taskCenter.goToDo', '去完成')}
                        </Text>
                      </View>
                    )}
                  </View>
                )
              })
            )}
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
