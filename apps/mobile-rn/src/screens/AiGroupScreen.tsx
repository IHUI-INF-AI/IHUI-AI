// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import {} from 'react-native'
import { appAlert } from '../components/BottomPops'
import { fetchApi, getGroups, joinGroup } from '@ihui/api-client'
import type { Group as ApiGroup } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  AiGroupScreen as SharedAiGroupScreen,
  type AiGroupItem,
  type AiGroupTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useRefreshOnFocus } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface Member {
  id: string
  name: string
  role: string
}

function isMembers(v: unknown): v is Member[] {
  return (
    Array.isArray(v) &&
    v.every(
      (m) =>
        m !== null &&
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        typeof m.name === 'string',
    )
  )
}

function mapGroup(g: ApiGroup): AiGroupItem {
  const members = isMembers(g.members) ? g.members : []
  const messages = typeof g.messages === 'number' ? g.messages : 0
  const lastActive = typeof g.lastActive === 'string' ? g.lastActive : g.createdAt
  const tag = typeof g.tag === 'string' ? g.tag : (g.type ?? '')
  return {
    id: g.id,
    name: g.name,
    desc: g.description ?? '',
    members,
    messages,
    lastActive,
    tag,
  }
}

export default function AiGroupScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<Nav>()
  const [tab, setTab] = useState<AiGroupTab>('mine')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 搜索关键词(对齐 Uniapp ai_group/index.vue InputArea「搜索AI助手」)
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<AiGroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getGroups()
      if (res.success) {
        // 并行补成员腿(G-998102 AiGroup 票):列表行只有 user_groups 本行,members 恒空
        // ⇒ 详情页成员数/卡片头像名全空。GET /:id/members 已 join users 返回 name/avatar。
        const withMembers = await Promise.all(
          res.data.list.map(async (g) => {
            try {
              const mres = await fetchApi<{
                list: Array<{ userId: string; role: string | null; name: string | null }>
              }>(`/api/groups/${g.id}/members`)
              if (!mres.success) return g
              const members = (mres.data.list ?? [])
                .filter((m) => Boolean(m.name))
                .map((m) => ({ id: m.userId, name: m.name as string, role: m.role ?? 'member' }))
              return { ...g, members }
            } catch {
              return g
            }
          }),
        )
        setItems(withMembers.map(mapGroup))
      } else {
        setError(apiFailureToText(res, t('aiGroup.loadFailed')))
      }
    } catch {
      setError(t('aiGroup.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新;首次挂载由上面的 useEffect 负责)
  useRefreshOnFocus(load)

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const selected = items.find((g) => g.id === selectedId) ?? null

  const handlePressItem = async (g: AiGroupItem) => {
    if (tab === 'mine') {
      setSelectedId(g.id)
      return
    }
    // 真调加入端点(G-998102 AiGroup 票):后端为组所有者/管理员添加成员形态,
    // 普通用户自助加入会 403 ⇒ 失败分支如实透出后端文案,不再假成功
    if (!user?.id) {
      appAlert(t('aiGroup.join.title'), t('aiGroup.loadFailed'))
      return
    }
    try {
      const jres = await joinGroup(g.id, user.id)
      if (jres.success) {
        appAlert(t('aiGroup.join.title'), t('aiGroup.join.message', { name: g.name }))
        void load()
      } else {
        appAlert(t('aiGroup.join.title'), apiFailureToText(jres, t('aiGroup.loadFailed')))
      }
    } catch {
      appAlert(t('aiGroup.join.title'), t('aiGroup.loadFailed'))
    }
  }

  return (
    <SharedAiGroupScreen
      t={t}
      items={items}
      tab={tab}
      selectedItem={selected}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onTabChange={setTab}
      keyword={keyword}
      onKeywordChange={setKeyword}
      onPressItem={handlePressItem}
      onBackToList={() => setSelectedId(null)}
      // 真导航(G-998102 AiGroup 票):user_groups 本身无群会话域,/message/group 是私信
      // 会话分组(message.ts),故跳 MessageGroup 群聊列表页(端内真实群会话入口),不再弹假确认
      onEnterChat={() => navigation.navigate('MessageGroup')}
      onRefresh={onRefresh}
      onRetry={load}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
