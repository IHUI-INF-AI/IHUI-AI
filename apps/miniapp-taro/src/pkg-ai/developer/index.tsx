// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n, t } from '@/i18n'
import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, navigateTo } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

// 智能体小类(对标原 category() 返回的 modelTypes)
interface ModelType {
  code: string | number
  showName: string
}

// 智能体收费配置(对标原 StateCard datas.category_info)
interface CategoryInfo {
  agent_main_category?: string
  agent_category?: string
  type?: string | number
  account?: number
  type_child?: string | number
  discount_month?: string | number
  limit_free?: number
}

// 智能体审核记录项(对标原 getZntList 返回)
// Note: 此类型来自管理端 API (getZntList),使用蛇形命名(agent_id/agent_name 等),
// 与 @ihui/api-client 的 Agent 类型(驼峰命名)字段结构完全不同,无法用 Pick 派生。
interface AgentItem {
  id?: string | number
  agent_id: string | number
  agent_name?: string
  agent_avatar?: string
  prologue?: string
  status?: number
  group?: string | number
  start_time?: string
  category_info?: CategoryInfo
}

// 一级状态 tab(对标原 headTypes)
const STATUS_TABS = [
  { id: 0, key: 'developer.index.pendingPublish', name: t('assistant.tabDraft') },
  { id: 1, key: 'developer.index.underReview', name: t('order.refundList.stepReview') },
  { id: 2, key: 'developer.index.published', name: t('developer.index.published') },
]

// 二级 tab(对标原 tabbarList,仅 status ∈ {0,4,5} 显示)
const SUB_TABS = [
  { id: 0, key: 'developer.index.all', name: t('common.all') },
  { id: 4, key: 'developer.index.reviewFailed', name: t('assistant.subTabRejected') },
  { id: 5, key: 'developer.index.offShelf', name: t('assistant.subTabOffline') },
]

const PAGE_SIZE = 10

export default function DeveloperIndex() {
  const { t } = useI18n()
  const tt = useTt()

  const [list, setList] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(0) // 0/1/2 主 tab,4/5 子 tab
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [modelTypes, setModelTypes] = useState<ModelType[]>([])

  const fetchList = useCallback(async (opts: { page: number; status: number; search: string }) => {
    setLoading(true)
    try {
      const res = (await api.getZntList({
        page: opts.page,
        page_size: PAGE_SIZE,
        status: opts.status,
        agent_name: opts.search,
      })) as unknown
      let items: AgentItem[] = []
      let cnt = 0
      if (Array.isArray(res)) {
        items = res as AgentItem[]
        cnt = items.length
      } else if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>
        items = (r.list || r.data || []) as AgentItem[]
        cnt = typeof r.total === 'number' ? r.total : items.length
      }
      setList((prev) => (opts.page === 1 ? items : [...prev, ...items]))
      setTotal(cnt)
      setPage(opts.page)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchModelTypes = useCallback(async () => {
    try {
      const res = await api.getAgentType()
      let types: ModelType[] = []
      if (Array.isArray(res)) types = res as ModelType[]
      else if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>
        types = (r.data || r.list || []) as ModelType[]
      }
      setModelTypes(types)
    } catch {
      // ignore
    }
  }, [])

  // 智能体小类只拉一次(对标原 mounted 中 category())
  useEffect(() => {
    fetchModelTypes()
  }, [fetchModelTypes])

  useDidShow(() => {
    fetchList({ page: 1, status, search })
  })

  // 切换状态(主/子 tab 共用):重置 page=1、清空 list 与 search、重新拉取
  const onChangeStatus = (newStatus: number) => {
    setStatus(newStatus)
    setSearch('')
    setList([])
    fetchList({ page: 1, status: newStatus, search: '' })
  }

  const onSearchConfirm = () => {
    setList([])
    fetchList({ page: 1, status, search })
  }

  const onScrollToLower = () => {
    if (!loading && list.length < total) {
      fetchList({ page: page + 1, status, search })
    }
  }

  const onEdit = (agent: AgentItem) => {
    const agentId = agent.agent_id ?? agent.id
    if (agentId === undefined) return
    navigateTo({ url: `/pkg-ai/dev-enter/model-edit/index?id=${agentId}` })
  }

  const onDelete = (agent: AgentItem) => {
    const id = agent.agent_id ?? agent.id
    if (id === undefined) return
    const name = agent.agent_name || ''
    Taro.showModal({
      title: tt('developer.index.tip', '提示'),
      content: `${tt('developer.index.deleteConfirm', '确认删除智能体')}「${name}」?`,
      confirmText: tt('developer.index.deleteBtn', '删除'),
      // 保留:native API Taro.showModal confirmColor 需 hex,不支持 CSS 变量;
      // 值对齐 --color-danger(亮 #dc2626,取亮值与 theme.json 静态回退一致)
      confirmColor: '#dc2626',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.deleteZntCharge(id)
          Taro.showToast({
            title: tt('developer.index.deleteOk', '删除成功'),
            icon: 'success',
          })
          setList([])
          fetchList({ page: 1, status, search })
        } catch {
          Taro.showToast({
            title: tt('developer.index.deleteFail', '删除失败'),
            icon: 'none',
          })
        }
      },
    })
  }

  // 状态文案
  const statusText = (s: number) => {
    const map: Record<number, [string, string]> = {
      0: ['developer.index.pendingPublish', t('assistant.tabDraft')],
      1: ['developer.index.underReview', t('order.refundList.stepReview')],
      2: ['developer.index.published', t('developer.index.published')],
      4: ['developer.index.reviewFailed', t('assistant.subTabRejected')],
      5: ['developer.index.offShelf', t('assistant.subTabOffline')],
    }
    const entry = map[s]
    return entry ? tt(entry[0], entry[1]) : tt('developer.index.published', '已发布')
  }

  // 类型文案:用 modelTypes 把 category_info.agent_category 的 code 映射为 showName
  const getTypeText = (agent: AgentItem): string => {
    const info = agent.category_info
    if (!info || !info.agent_category) return tt('developer.index.noType', '—')
    return (
      info.agent_category
        .split(',')
        .map((code) => {
          const found = modelTypes.find((m) => String(m.code) === String(code))
          return found ? found.showName : ''
        })
        .filter(Boolean)
        .join(',') || tt('developer.index.noType', '—')
    )
  }

  const showSubTabs = status === 0 || status === 4 || status === 5
  const hasMore = list.length < total
  const mainTabActive = (tabId: number) =>
    status === tabId || (status === 4 && tabId === 0) || (status === 5 && tabId === 0)

  const agentStatusClass = (s: number) => {
    const base = 'text-[24rpx] px-[16rpx] py-[4rpx] rounded-[6rpx]'
    const styles: Record<number, string> = {
      0: 'text-muted-foreground bg-muted/[0.12]',
      1: 'text-warning bg-warning/[0.12]',
      2: 'text-success bg-success/[0.12]',
      4: 'text-destructive bg-destructive/[0.12]',
      5: 'text-muted-foreground bg-muted/[0.12]',
    }
    return `${base} ${styles[s] ?? styles[0]}`
  }

  return (
    <ThemeRoot>
      {/* RN shell: bg surface.bg */}
      <View className="min-h-screen bg-background flex flex-col">
        {/* RN NavBar: 高 44dp=88rpx,bg surface.card,底部描边,标题居中 18dp=36rpx semibold */}
        <View className="h-[88rpx] flex items-center justify-center bg-card border-b border-[var(--color-border)]">
          <Text className="text-[36rpx] font-semibold text-foreground">
            {tt('developer.index.myAgents', '我的智能体')}
          </Text>
        </View>

        <View
          className="flex items-center bg-primary mx-[20rpx] my-[20rpx] px-[30rpx] py-[28rpx] rounded-[16rpx]"
          onClick={() => navigateTo({ url: '/pkg-ai/developer/subscribe' })}
          hoverClass="opacity-60"
        >
          <View className="flex-1">
            <Text className="block text-[32rpx] font-semibold text-primary-foreground">
              {t('developer.index.subscribeTitle')}
            </Text>
            <Text className="block text-[24rpx] text-primary-foreground/90 mt-[8rpx]">
              {t('developer.index.subscribeDesc')}
            </Text>
          </View>
          <Text className="text-[40rpx] text-primary-foreground opacity-80">›</Text>
        </View>

        {/* RN headTabBar: px 20rpx py 16rpx gap 16rpx;tab px 24rpx py 10rpx radius 8dp=16rpx
            bg surface.muted;激活 bg brand(→primary)+白字 14dp=28rpx(RN 恒黑底白字,暗色按语义 primary-foreground 修正) */}
        <View className="flex flex-row px-[20rpx] py-[16rpx] gap-[16rpx]">
          {STATUS_TABS.map((tab) => (
            <View
              key={tab.id}
              className={`px-[24rpx] py-[10rpx] rounded-[16rpx] bg-muted${mainTabActive(tab.id) ? ' bg-primary' : ''}`}
              onClick={() => onChangeStatus(tab.id)}
              hoverClass="opacity-60"
            >
              <Text
                className={
                  mainTabActive(tab.id)
                    ? 'text-[28rpx] text-primary-foreground font-semibold'
                    : 'text-[28rpx] text-muted-foreground'
                }
              >
                {tt(tab.key, tab.name)}
              </Text>
            </View>
          ))}
        </View>

        {/* RN searchRow: gap 12rpx px 20rpx pb 8rpx;输入框 h 38dp=76rpx radius 8dp=16rpx
            描边 1dp=2rpx bg card;搜索钮 h 76rpx px 20rpx radius 16rpx bg brand(→primary) 白字 */}
        <View className="flex items-center gap-[12rpx] px-[20rpx] pb-[8rpx]">
          <Input
            className="flex-1 h-[76rpx] rounded-[16rpx] border border-[var(--color-border)] bg-card px-[16rpx] text-[28rpx] text-foreground"
            type="text"
            placeholder={tt('developer.index.searchPlaceholder', '搜索智能体名称')}
            value={search}
            onInput={(e) => setSearch(e.detail.value)}
            onConfirm={onSearchConfirm}
          />
          <View
            className="h-[76rpx] px-[20rpx] rounded-[16rpx] bg-primary flex items-center justify-center"
            onClick={onSearchConfirm}
            hoverClass="opacity-60"
          >
            <Text className="text-[28rpx] font-semibold text-primary-foreground">搜索</Text>
          </View>
        </View>

        {/* RN subTabBar: px 20rpx pb 12rpx gap 12rpx;tab px 16rpx py 6rpx radius 6dp=12rpx;
            激活 bg surface.muted + brand 字(→primary) 13dp=26rpx */}
        {showSubTabs ? (
          <View className="flex flex-row px-[20rpx] pb-[12rpx] gap-[12rpx]">
            {SUB_TABS.map((tab) => (
              <View
                key={tab.id}
                className={`px-[16rpx] py-[6rpx] rounded-[12rpx]${status === tab.id ? ' bg-muted' : ''}`}
                onClick={() => onChangeStatus(tab.id)}
                hoverClass="opacity-60"
              >
                <Text
                  className={
                    status === tab.id
                      ? 'text-[26rpx] text-primary font-semibold'
                      : 'text-[26rpx] text-muted-foreground'
                  }
                >
                  {tt(tab.key, tab.name)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <ScrollView
          className="flex-1 h-0 px-[20rpx] pb-[32rpx]"
          scrollY
          lowerThreshold={50}
          onScrollToLower={onScrollToLower}
        >
          {loading && list.length === 0 ? (
            <Text className="block text-center text-muted-foreground text-[28rpx] py-[60rpx]">
              {t('common.loading')}
            </Text>
          ) : list.length ? (
            list.map((agent) => (
              <View
                key={String(agent.agent_id ?? agent.id)}
                className="flex items-center bg-card border border-[var(--color-border-medium)] rounded-[30rpx] p-[20rpx] mb-[18rpx]"
              >
                {/* RN avatar: rpx(184)/2 dp → 184rpx,radius 8dp=16rpx */}
                <Image
                  className="w-[184rpx] h-[184rpx] rounded-[16rpx] bg-muted flex-shrink-0"
                  src={agent.agent_avatar || '/static/default-agent.png'}
                  mode="aspectFill"
                />
                <View className="flex-1 ml-[18rpx] min-w-0">
                  <Text className="block text-[32rpx] text-[var(--color-agent-name)] overflow-hidden text-ellipsis whitespace-nowrap">
                    {agent.agent_name || tt('developer.index.unnamedAgent', '未命名智能体')}
                  </Text>
                  {agent.prologue ? (
                    <Text className="block text-[24rpx] text-[var(--color-text-medium)] leading-[36rpx] mt-[8rpx] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
                      {agent.prologue}
                    </Text>
                  ) : null}
                  <Text className="text-[24rpx] text-[var(--color-text-medium)]">
                    {tt('developer.index.typeLabel', '类型')}：{getTypeText(agent)}
                  </Text>
                </View>
                <View className="flex flex-col items-end gap-[10rpx] flex-shrink-0 ml-[16rpx]">
                  <Text className={agentStatusClass(agent.status ?? status)}>
                    {statusText(agent.status ?? status)}
                  </Text>
                  <View className="flex items-center gap-[16rpx]">
                    {/* RN setBtn: px 16rpx py 6rpx radius 6dp=12rpx bg brand(→primary) 白字 12dp=24rpx */}
                    <Text
                      className="text-[24rpx] px-[16rpx] py-[6rpx] rounded-[12rpx] text-primary-foreground bg-primary font-medium"
                      onClick={() => onEdit(agent)}
                    >
                      {status === 2
                        ? tt('developer.index.editBtn2', '修改')
                        : tt('developer.index.editBtn', '设置')}
                    </Text>
                    {/* RN offlineBtn: 14dp=28rpx brandAccent(→brand-orange) 下划线文字钮 */}
                    <Text
                      className="text-[28rpx] text-[var(--color-brand-orange)] font-medium underline"
                      onClick={() => onDelete(agent)}
                    >
                      {tt('developer.index.deleteBtn', '删除')}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text className="block text-center text-muted-foreground text-[28rpx] py-[60rpx]">
              {t('developer.index.empty')}
            </Text>
          )}
          {list.length > 0 && !hasMore ? (
            <Text className="block text-center text-[24rpx] text-[var(--color-text-tertiary)] py-[16rpx]">
              {tt('developer.index.noMore', '没有更多了')}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
