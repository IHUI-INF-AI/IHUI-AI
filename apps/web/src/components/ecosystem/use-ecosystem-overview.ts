// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 平台特有:D17 统一入口的取数层,依赖 next 端的 react-query Provider,不适合共享层。
// 三类入口的列表/计数**一律经 @ihui/api-client**(§3 共享层优先,守门 73 拦端内裸 fetch)。

import { useQuery } from '@tanstack/react-query'

import { listAiSkills, type AiSkillMeta } from '@ihui/api-client/endpoints/ai-skills'
import { getCapabilities, getMcpStore } from '@ihui/api-client/endpoints/mcp'
import { getConnectors, type ConnectorEntry } from '@ihui/api-client/endpoints/connectors'
import { fetchMarketSkills, type SkillMarketItem } from '@ihui/api-client/endpoints/skills-market'

import { useAuthStore } from '@/stores/auth'

import type { MarketKey } from './expert-packs'

/** 入口首页只展示前 N 条深链,其余走各自列表页 */
const TOP_ITEM_LIMIT = 4

type OverviewStatus = 'pending' | 'ready' | 'failed'

/**
 * 计数三态。`failed` **不得**渲染成 0 —— "取不到"与"真的是 0 项"
 * 是两件事,把前者写成后者等于伪造结论。
 */
export interface MarketCount {
  status: OverviewStatus
  count: number | null
}

async function unwrap<T>(p: Promise<{ success: true; data: T } | { success: false; error: string }>) {
  const r = await p
  if (!r.success) throw new Error(r.error || 'request failed')
  return r.data
}

function statusOf(q: { isPending: boolean; isError: boolean }): OverviewStatus {
  if (q.isError) return 'failed'
  if (q.isPending) return 'pending'
  return 'ready'
}

interface ConnectorsOverview {
  status: OverviewStatus
  entries: ConnectorEntry[]
}

/**
 * 当前登录主体 id(未取到主体时为 null)。
 * 只订阅 `user?.id` 这一个标量字段,不订阅整个 user 对象(全对象订阅会让任何
 * setUser 触发本组件重渲染,Sidebar.tsx:98 记过同一型)。
 */
function usePrincipalId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null)
}

/**
 * 连接器条目(列表 + 计数同源,避免两次请求算同一件事)
 *
 * queryKey 必须含登录主体(2026-09-29 立):后端 `GET /api/connectors` 已按调用方收窄
 * (a7379cdba:只返回你自己拥有的连接器),条目含 name / key / type ⇒ 属个人配置数据。
 * 而这份缓存落在模块级单例(lib/query-client.ts:47-53,staleTime 5min / gcTime 10min),
 * 键里不带主体时,同一浏览器换账号会在 refetch 完成前把上一个账号的条目渲染给新账号。
 *
 * 刻意**不用** `enabled: principal !== null` 把请求关掉:那会让"还没有主体"的渲染永久停在
 * pending,而 `ecosystem-hub.tsx` 的 pending 分支与"零条目"走同一个 <ul> ⇒ 整段空白,
 * 正是 D17 那条"取数未成功时分区正文不得整段空白"要防的形态(它由
 * `__tests__/ecosystem-hub.test.tsx` 钉着)。无主体时请求照发(拿 401 也好、拿数据也好),
 * 结果落在 'anonymous' 这一格;跨账号的那一半由 `providers/query-provider.tsx` 的
 * "主体由有到无 ⇒ 清空缓存"补上 —— 那一条同时覆盖全站其它按用户取数的查询,
 * 所以不在这儿给每个键单独加闸。
 */
export function useConnectors(): ConnectorsOverview {
  const principalId = usePrincipalId()
  const q = useQuery({
    queryKey: ['ecosystem', 'connectors', principalId ?? 'anonymous'],
    queryFn: () => unwrap(getConnectors()),
  })
  return { status: statusOf(q), entries: q.data?.connectors ?? [] }
}

interface SkillsOverview {
  status: OverviewStatus
  total: number | null
  items: SkillMarketItem[]
}

/** Skill 市场条目(前 N 条用于详情页深链) */
function useMarketSkills(): SkillsOverview {
  const q = useQuery({
    queryKey: ['ecosystem', 'skills-market', TOP_ITEM_LIMIT],
    queryFn: () => unwrap(fetchMarketSkills({ page: 1, pageSize: TOP_ITEM_LIMIT })),
  })
  return { status: statusOf(q), total: q.data?.total ?? null, items: q.data?.items ?? [] }
}

interface AiSkillsOverview {
  status: OverviewStatus
  items: AiSkillMeta[]
}

export interface EcosystemOverview {
  counts: Record<MarketKey, MarketCount>
  connectors: ConnectorsOverview
  skills: SkillsOverview
  aiSkills: AiSkillsOverview
}

/** 五个市场计数 + 两类深链数据;每个来源独立三态,互不牵连 */
export function useEcosystemOverview(): EcosystemOverview {
  const aiSkills = useQuery({
    queryKey: ['ecosystem', 'ai-skills'],
    queryFn: () => unwrap(listAiSkills({ category: 'all' })),
  })
  const mcpStore = useQuery({
    queryKey: ['ecosystem', 'mcp-store'],
    queryFn: () => unwrap(getMcpStore()),
  })
  const capabilityMarket = useQuery({
    queryKey: ['ecosystem', 'capabilities'],
    queryFn: () => unwrap(getCapabilities({ page: 1, page_size: 1 })),
  })
  const connectors = useConnectors()
  const skills = useMarketSkills()

  const availableAiSkills = aiSkills.data?.filter((s) => s.available) ?? null
  return {
    counts: {
      aiSkills: { status: statusOf(aiSkills), count: availableAiSkills?.length ?? null },
      mcpStore: { status: statusOf(mcpStore), count: mcpStore.data?.count ?? null },
      capabilityMarket: {
        status: statusOf(capabilityMarket),
        count: capabilityMarket.data?.total ?? null,
      },
      skillsMarket: { status: skills.status, count: skills.total },
      connectors: { status: connectors.status, count: connectors.entries.length },
    },
    connectors,
    skills,
    aiSkills: {
      status: statusOf(aiSkills),
      items: (availableAiSkills ?? []).slice(0, TOP_ITEM_LIMIT),
    },
  }
}
