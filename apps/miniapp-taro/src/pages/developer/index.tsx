import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, navigateTo } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

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
  { id: 0, key: 'developer.index.pendingPublish', name: '待发布' },
  { id: 1, key: 'developer.index.underReview', name: '审核中' },
  { id: 2, key: 'developer.index.published', name: '已发布' },
]

// 二级 tab(对标原 tabbarList,仅 status ∈ {0,4,5} 显示)
const SUB_TABS = [
  { id: 0, key: 'developer.index.all', name: '全部' },
  { id: 4, key: 'developer.index.reviewFailed', name: '审核失败' },
  { id: 5, key: 'developer.index.offShelf', name: '已下架' },
]

const PAGE_SIZE = 10

export default function DeveloperIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }

  const [list, setList] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(0) // 0/1/2 主 tab,4/5 子 tab
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [modelTypes, setModelTypes] = useState<ModelType[]>([])

  const fetchList = useCallback(
    async (opts: { page: number; status: number; search: string }) => {
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
    },
    [],
  )

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
    navigateTo({ url: `/pages/dev-enter/model-edit/index?id=${agentId}` })
  }

  const onDelete = (agent: AgentItem) => {
    const id = agent.agent_id ?? agent.id
    if (id === undefined) return
    const name = agent.agent_name || ''
    Taro.showModal({
      title: tt('developer.index.tip', '提示'),
      content: `${tt('developer.index.deleteConfirm', '确认删除智能体')}「${name}」?`,
      confirmText: tt('developer.index.deleteBtn', '删除'),
      confirmColor: '#dd524d',
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
      0: ['developer.index.pendingPublish', '待发布'],
      1: ['developer.index.underReview', '审核中'],
      2: ['developer.index.published', '已发布'],
      4: ['developer.index.reviewFailed', '审核失败'],
      5: ['developer.index.offShelf', '已下架'],
    }
    const entry = map[s]
    return entry ? tt(entry[0], entry[1]) : tt('developer.index.published', '已发布')
  }

  // 类型文案:用 modelTypes 把 category_info.agent_category 的 code 映射为 showName
  const getTypeText = (agent: AgentItem): string => {
    const info = agent.category_info
    if (!info || !info.agent_category) return tt('developer.index.noType', '—')
    return info.agent_category
      .split(',')
      .map((code) => {
        const found = modelTypes.find((m) => String(m.code) === String(code))
        return found ? found.showName : ''
      })
      .filter(Boolean)
      .join(',') || tt('developer.index.noType', '—')
  }

  const showSubTabs = status === 0 || status === 4 || status === 5
  const hasMore = list.length < total
  const mainTabActive = (tabId: number) =>
    status === tabId || (status === 4 && tabId === 0) || (status === 5 && tabId === 0)

  return (
    <View className="developer-page">
      <View className="page-header">
        <Text className="page-title">{tt('developer.index.myAgents', '我的智能体')}</Text>
      </View>
      <View
        className="subscribe-entry"
        onClick={() => navigateTo({ url: '/pages/developer/subscribe' })}
      >
        <View className="subscribe-entry-body">
          <Text className="subscribe-entry-title">{t('developer.index.subscribeTitle')}</Text>
          <Text className="subscribe-entry-desc">{t('developer.index.subscribeDesc')}</Text>
        </View>
        <Text className="subscribe-entry-arrow">›</Text>
      </View>

      <View className="status-tabs">
        {STATUS_TABS.map((tab) => (
          <View
            key={tab.id}
            className={`status-tab${mainTabActive(tab.id) ? ' active' : ''}`}
            onClick={() => onChangeStatus(tab.id)}
          >
            <Text>{tt(tab.key, tab.name)}</Text>
          </View>
        ))}
      </View>

      <View className="search-bar">
        <Input
          className="search-input"
          type="text"
          placeholder={tt('developer.index.searchPlaceholder', '搜索智能体名称')}
          value={search}
          onInput={(e) => setSearch(e.detail.value)}
          onConfirm={onSearchConfirm}
        />
      </View>

      {showSubTabs ? (
        <View className="sub-tabs">
          {SUB_TABS.map((tab) => (
            <View
              key={tab.id}
              className={`sub-tab${status === tab.id ? ' active' : ''}`}
              onClick={() => onChangeStatus(tab.id)}
            >
              <Text>{tt(tab.key, tab.name)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView
        className="agent-scroll"
        scrollY
        lowerThreshold={50}
        onScrollToLower={onScrollToLower}
      >
        {loading && list.length === 0 ? (
          <Text className="loading-text">{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((agent) => (
            <View key={String(agent.agent_id ?? agent.id)} className="agent-item">
              <Image
                className="agent-avatar"
                src={agent.agent_avatar || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="agent-body">
                <Text className="agent-name">
                  {agent.agent_name || tt('developer.index.unnamedAgent', '未命名智能体')}
                </Text>
                {agent.prologue ? <Text className="agent-desc">{agent.prologue}</Text> : null}
                <Text className="agent-type">
                  {tt('developer.index.typeLabel', '类型')}：{getTypeText(agent)}
                </Text>
              </View>
              <View className="agent-right">
                <Text className={`agent-status status-${agent.status ?? status}`}>
                  {statusText(agent.status ?? status)}
                </Text>
                <View className="agent-actions">
                  <Text className="agent-action edit" onClick={() => onEdit(agent)}>
                    {status === 2
                      ? tt('developer.index.editBtn2', '修改')
                      : tt('developer.index.editBtn', '设置')}
                  </Text>
                  <Text className="agent-action delete" onClick={() => onDelete(agent)}>
                    {tt('developer.index.deleteBtn', '删除')}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text className="empty-text">{t('developer.index.empty')}</Text>
        )}
        {list.length > 0 && !hasMore ? (
          <Text className="list-end">{tt('developer.index.noMore', '没有更多了')}</Text>
        ) : null}
      </ScrollView>
    </View>
  )
}
