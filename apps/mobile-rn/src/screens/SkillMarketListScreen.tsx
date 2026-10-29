// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  SkillMarketListScreen as SharedSkillMarketListScreen,
  type SkillMarketEntryView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * `GET /api/skills/market` 的裸条目(apps/api/src/routes/skills.ts:743-774 → `SkillMarketEntry`)。
 *
 * 全部字段按可选 + unknown 读取:该表是 Redis JSON 累积写入,种子里有 `rating` / `tags`,
 * 但用户上架(`POST /skills/market`)与内部自进化同步(`source: 'hub'`)两条写路径都可能
 * 只带部分列,历史条目更是没有 `enabled` 这类后加字段。归一后一律落到 `SkillMarketEntryView`,
 * 缺失即 0 / 空数组 / 空串 —— 不让一个缺字段的条目把整屏渲染成 `NaN` 或 `undefined`。
 */
interface RawMarketEntry {
  name?: unknown
  description?: unknown
  tags?: unknown
  author?: unknown
  version?: unknown
  license?: unknown
  installCount?: unknown
  rating?: unknown
  ratingCount?: unknown
  updatedAt?: unknown
}

interface MarketListPayload {
  items?: RawMarketEntry[] | null
  total?: unknown
  page?: unknown
  pageSize?: unknown
}

/** 与 web 同页大小(PageClient.tsx:92 的 `pageSize: 20`) */
const PAGE_SIZE = 20

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function toEntry(raw: RawMarketEntry): SkillMarketEntryView {
  return {
    name: toText(raw.name),
    description: toText(raw.description),
    tags: toTextArray(raw.tags),
    author: toText(raw.author),
    version: toText(raw.version),
    license: toText(raw.license),
    installCount: toNumber(raw.installCount),
    rating: toNumber(raw.rating),
    ratingCount: toNumber(raw.ratingCount),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
}

/**
 * 技能市场列表 —— RN 宿主壳,对齐 web `/skills-market`。
 *
 * 取数 + 分页状态 + 导航在此,渲染全在共享屏 `@ihui/rn-app` 的 SkillMarketListScreen。
 *
 * ⚠️ 域边界:本屏打 `GET /api/skills/market`(自进化技能市场,`SkillMarketEntry`)。
 * RN 既有的 `AiSkill` / `AiSkillDetail` 打的是 `GET /api/ai-skills`,那是另一个域,
 * 字段与后端实现都不同,不得互相复用(2026-10-25 跨端工单第 10 行判定)。
 *
 * 标签候选与 web 同口径:从**当前页**条目聚合去重、取前 12 个(后端 tag 维度有限,
 * 足够做筛选导航;不额外拉一次全量)。
 */
export function SkillMarketListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<SkillMarketEntryView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  /** 已提交的关键词(与输入框的受控值分开:输入不触发请求,回车/搜索键才提交) */
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [tag, setTag] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(
    async (targetPage: number, keyword: string, targetTag: string) => {
      setLoading(true)
      setError('')
      const params = [`page=${targetPage}`, `pageSize=${PAGE_SIZE}`]
      if (keyword) params.push(`q=${encodeURIComponent(keyword)}`)
      if (targetTag) params.push(`tag=${encodeURIComponent(targetTag)}`)
      try {
        const res = await fetchApi<MarketListPayload>(`/api/skills/market?${params.join('&')}`)
        if (!res.success) {
          setItems([])
          setTotal(0)
          setError(apiFailureToText(res, t('skillsMarket.loadFailed')))
          return
        }
        const list = Array.isArray(res.data?.items) ? res.data.items : []
        setItems(list.map(toEntry))
        setTotal(toNumber(res.data?.total))
      } catch {
        setItems([])
        setTotal(0)
        setError(t('skillsMarket.loadFailed'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load(page, appliedKeyword, tag)
  }, [load, page, appliedKeyword, tag, reloadToken])

  const tags = useMemo(() => {
    const collected = new Set<string>()
    for (const item of items) for (const tg of item.tags) collected.add(tg)
    return Array.from(collected).slice(0, 12)
  }, [items])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSearch = () => {
    // 关键词与页码都没变时,effect 不会重跑 ⇒ 显式补一次拉取(用户点搜索就该有反应)
    if (keywordInput === appliedKeyword && page === 1) {
      setReloadToken((n) => n + 1)
      return
    }
    setPage(1)
    setAppliedKeyword(keywordInput)
  }

  return (
    <SharedSkillMarketListScreen
      t={t}
      items={items}
      tags={tags}
      keyword={keywordInput}
      tag={tag}
      total={total}
      page={page}
      totalPages={totalPages}
      loading={loading}
      error={error}
      onKeywordChange={setKeywordInput}
      onSearch={handleSearch}
      onTagChange={(next) => {
        setTag(next)
        setPage(1)
      }}
      onPageChange={setPage}
      // 详情按 name 反查(与 web 深链同一条口径),不传 id
      onSelect={(item) => navigation.navigate('SkillMarketDetail', { name: item.name })}
      onBack={() => navigation.goBack()}
      onRetry={() => setReloadToken((n) => n + 1)}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
