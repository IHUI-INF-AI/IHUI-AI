// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  addSupportTicketComment,
  createSupportTicket,
  getSupportCategories,
  getSupportTicketDetail,
  getSupportTickets,
  rateSupportTicket,
} from '@ihui/api-client'
import type { SupportCategory, SupportTicket } from '@ihui/api-client'
import { SupportScreen as SharedSupportScreen } from '@ihui/rn-app'
import type { SupportTicketCreateInput, SupportTicketDetailData } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * 本票 Wave1 路由由 manifest 交集成方统一注册(禁改 RootNavigator)。
 * 本地交叉类型让薄壳在注册前也能过 typecheck;注册后与 RootStackParamList 并集等值。
 */
type ShellParams = RootStackParamList & {
  Support: undefined
}
type NavigationProp = NativeStackNavigationProp<ShellParams>

/**
 * RN 端「客服中心(工单中心)」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/support/SupportScreen.tsx`,本文件只管平台侧:
 * 取词、主题、导航落点,以及工单列表/分类取数与创建/回复/评价三条写通道
 * (经 @ihui/api-client /api/customer-service 端点,对齐 web TicketList/NewTicketForm/TicketDetailDialog)。
 */
export function SupportScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [categories, setCategories] = useState<SupportCategory[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ticketsRes, categoriesRes] = await Promise.all([
        getSupportTickets(),
        getSupportCategories(),
      ])
      if (!ticketsRes.success) {
        setError(ticketsRes.error || t('supportPage.fetchFailed'))
        return
      }
      setTickets(ticketsRes.data.list ?? [])
      if (categoriesRes.success) {
        setCategories(categoriesRes.data.list ?? [])
      }
      setError(null)
    } catch {
      setError(t('supportPage.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = useCallback(
    async (input: SupportTicketCreateInput): Promise<boolean> => {
      try {
        const res = await createSupportTicket(input)
        if (res.success) {
          void load()
          return true
        }
        return false
      } catch {
        return false
      }
    },
    [load],
  )

  const handleOpenDetail = useCallback(
    async (id: string): Promise<SupportTicketDetailData | null> => {
      try {
        const res = await getSupportTicketDetail(id)
        if (res.success) {
          return {
            ticket: res.data.ticket,
            comments: res.data.comments ?? [],
            rating: res.data.rating ?? null,
          }
        }
        return null
      } catch {
        return null
      }
    },
    [],
  )

  const handleAddComment = useCallback(async (id: string, content: string): Promise<boolean> => {
    try {
      const res = await addSupportTicketComment(id, content)
      return res.success
    } catch {
      return false
    }
  }, [])

  const handleRate = useCallback(
    async (id: string, rating: number, comment: string | null): Promise<boolean> => {
      try {
        const res = await rateSupportTicket(id, rating, comment)
        return res.success
      } catch {
        return false
      }
    },
    [],
  )

  return (
    <SharedSupportScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      tickets={tickets}
      categories={categories}
      onRefresh={() => void load()}
      onCreate={handleCreate}
      onOpenDetail={handleOpenDetail}
      onAddComment={handleAddComment}
      onRate={handleRate}
    />
  )
}

export default SupportScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
