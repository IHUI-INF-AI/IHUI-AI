import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, navigateTo } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

// 开发者智能体项(getDeveloperAgents 后端未类型化,按页面使用字段定义)
interface DeveloperAgentItem {
  id: string
  agent_id?: string
  avatar?: string
  name?: string
  uses?: number
  status?: number
}

// 开发者智能体列表响应
interface DeveloperAgentListResponse {
  list?: DeveloperAgentItem[]
  data?: DeveloperAgentItem[]
  total?: number
  success?: boolean
}

// 状态 tab(对标原项目 dev_enter/index.vue 的 headTypes)
const STATUS_TABS = [
  { id: 0, name: '待发布' },
  { id: 1, name: '审核中' },
  { id: 2, name: '已发布' },
]

// 待发布时的子 tab(对标原项目 tabbarList)
const SUB_TABS = [
  { id: 0, name: '全部' },
  { id: 4, name: '审核失败' },
  { id: 5, name: '已下架' },
]

// 状态文案映射
const STATUS_TEXT: Record<number, string> = {
  0: '待发布',
  1: '审核中',
  2: '已发布',
  4: '审核失败',
  5: '已下架',
}

const PAGE_SIZE = 10

export default function DeveloperIndex() {
  const { t } = useI18n()
  const [list, setList] = useState<DeveloperAgentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(0)
  const [subStatus, setSubStatus] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchList = useCallback(
    async (opts: { page: number; status: number; subStatus: number; search: string }) => {
      setLoading(true)
      try {
        const res = (await get('/developer/agents', {
          page: opts.page,
          page_size: PAGE_SIZE,
          status: opts.subStatus !== 0 ? opts.subStatus : opts.status,
          agent_name: opts.search,
        })) as DeveloperAgentListResponse
        const items = res?.list || res?.data || []
        setList((prev) => (opts.page === 1 ? items : [...prev, ...items]))
        setTotal(res?.total ?? items.length)
        setPage(opts.page)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useDidShow(() => {
    fetchList({ page: 1, status, subStatus, search })
  })

  const onChangeStatus = (newStatus: number) => {
    setStatus(newStatus)
    setSubStatus(0)
    setSearch('')
    fetchList({ page: 1, status: newStatus, subStatus: 0, search: '' })
  }

  const onChangeSubStatus = (newSub: number) => {
    setSubStatus(newSub)
    fetchList({ page: 1, status, subStatus: newSub, search })
  }

  const onSearchConfirm = () => {
    fetchList({ page: 1, status, subStatus, search })
  }

  const onScrollToLower = () => {
    if (!loading && list.length < total) {
      fetchList({ page: page + 1, status, subStatus, search })
    }
  }

  const onEdit = (agent: DeveloperAgentItem) => {
    const agentId = agent.agent_id || agent.id
    navigateTo({ url: `/pages/dev-enter/model-edit/index?agentId=${agentId}` })
  }

  const onDelete = (agent: DeveloperAgentItem) => {
    Taro.showModal({
      title: '提示',
      content: `确认删除智能体「${agent.name || ''}」?`,
      confirmText: '删除',
      confirmColor: '#dd524d',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await post('/developer/agents/delete', { id: agent.id })
          Taro.showToast({ title: '删除成功', icon: 'success' })
          fetchList({ page: 1, status, subStatus, search })
        } catch {
          Taro.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  }

  const showSubTabs = status === 0
  const hasMore = list.length < total

  return (
    <View className="developer-page">
      <View className="page-header">
        <Text className="page-title">{t('developer.index.title')}</Text>
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
            className={`status-tab${status === tab.id ? ' active' : ''}`}
            onClick={() => onChangeStatus(tab.id)}
          >
            <Text>{tab.name}</Text>
          </View>
        ))}
      </View>

      <View className="search-bar">
        <Input
          className="search-input"
          type="text"
          placeholder="搜索智能体名称"
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
              className={`sub-tab${subStatus === tab.id ? ' active' : ''}`}
              onClick={() => onChangeSubStatus(tab.id)}
            >
              <Text>{tab.name}</Text>
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
            <View key={agent.id} className="agent-item">
              <Image
                className="agent-avatar"
                src={agent.avatar || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="agent-body">
                <Text className="agent-name">
                  {agent.name || t('developer.index.unnamedAgent')}
                </Text>
                <Text className="agent-stat">
                  {t('developer.index.useCount', { n: agent.uses || 0 })}
                </Text>
              </View>
              <View className="agent-right">
                <Text className="agent-status">
                  {STATUS_TEXT[agent.status ?? status] || t('developer.index.published')}
                </Text>
                <View className="agent-actions">
                  <Text className="agent-action edit" onClick={() => onEdit(agent)}>
                    {status === 2 ? '修改' : '设置'}
                  </Text>
                  <Text className="agent-action delete" onClick={() => onDelete(agent)}>
                    删除
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text className="empty-text">{t('developer.index.empty')}</Text>
        )}
        {list.length > 0 && !hasMore ? (
          <Text className="list-end">没有更多了</Text>
        ) : null}
      </ScrollView>
    </View>
  )
}
