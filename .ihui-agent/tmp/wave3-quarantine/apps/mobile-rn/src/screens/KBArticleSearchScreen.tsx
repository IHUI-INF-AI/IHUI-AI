/**
 * KBArticleSearchScreen 知识库文章检索(mobile-rn 端 wrapper)
 *
 * 2026-10-26 承载 web `/knowledge-base/search`
 * (apps/web/app/(main)/knowledge-base/search/PageClient.tsx:70 GET
 * `/api/knowledge-base?${search,pageSize,categoryId}`)。
 * UI 与展示逻辑住在共享层 @ihui/rn-app KBArticleSearchScreen,本 wrapper 只承担平台职责:
 * - 数据:listKBArticles({ search, pageSize: 50 })(pageSize 与 web :68 同值,后端
 *   knowledge-base-routes.ts:51 钳到 1..100)
 * - 登录门:web :58 `useAuthGate()` 的 RN 对应物 = useAuthStore 无 user ⇒ requiresLogin,
 *   登录按钮跳 `Login`(RootNavigator:901/:1258 两个分支都注册着,跳转同步可达)
 * - 分类筛选:web 只从 URL 读 `category`(:60)但页面上**没有任何分类选择器**可写它 ⇒
 *   RN 同样不造筛选器,只走关键词(造一个 web 上都不存在的控件即为假功能)
 * - 导航:关键词写回路由参数(与 web router.push 同形)/ 详情跳 KBArticleDetail
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { listKBArticles } from '@ihui/api-client'
import type { KBArticleSearchItem } from '@ihui/rn-app'
import { KBArticleSearchScreen as SharedKBArticleSearchScreen } from '@ihui/rn-app'
import { useAuthStore } from '../stores/auth-store'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端错误文案直接呈现(对齐 web :135 `(error as Error).message`),不另造兜底文案 */
function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message || String(e)
  return String(e)
}

export function KBArticleSearchScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute()
  const keyword = ((route.params as { q?: string } | undefined)?.q ?? '').trim()
  const user = useAuthStore((s) => s.user)

  const [items, setItems] = useState<KBArticleSearchItem[]>([])
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user || !keyword) {
      setSearching(false)
      return
    }
    setSearching(true)
    setError('')
    try {
      const res = await listKBArticles({ search: keyword, pageSize: 50 })
      setItems(res.list)
      setTotal(res.total)
    } catch (e) {
      setError(toMessage(e))
      setItems([])
      setTotal(0)
    } finally {
      setSearching(false)
    }
  }, [keyword, user])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedKBArticleSearchScreen
      t={t}
      keyword={keyword}
      items={items}
      total={total}
      searching={searching}
      error={error}
      requiresLogin={!user}
      onSubmit={(kw) => navigation.navigate('KBArticleSearch', { q: kw })}
      onOpenArticle={(item) =>
        navigation.navigate('KBArticleDetail', { id: item.id, title: item.title })
      }
      onLogin={() => navigation.navigate('Login')}
      onRetry={() => void load()}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
