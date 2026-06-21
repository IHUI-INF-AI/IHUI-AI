/**
 * AI 世界 API
 *
 * @description 列表数据来自 GET /bot/sites/kind（通过 /api-kou 代理到 Python 后端）
 * 返回按 section 分组的站点列表，每个 section 下为 aiBotSites 数组。
 */
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'

/** 后端返回的单个站点（aiBotSites 项） */
export interface AiBotSite {
  id: number
  name: string
  shortDesc: string | null
  section: string | null
  subSection: string | null
  iconUrl: string
  detailUrl: string
  officialUrl: string
  panelHtml?: string
  createdAt: string
  updatedAt: string
}

/** 后端返回的 section 分组 */
export interface AiWorldSection {
  section: string
  subSection: string | null
  subSections: any
  aiBotSites: AiBotSite[]
}

/** 前端展示用：单个卡片（由 AiBotSite 映射） */
export interface AiWorldItem {
  id: string
  title: string
  description?: string
  coverUrl: string
  link?: string
  section?: string
}

/** 获取列表参数（后端若支持分页、按分类筛选可传） */
export interface GetAiWorldListParams {
  pageNum?: number
  pageSize?: number
  /** 一级标题名称（section） */
  section?: string
  /** 二级标题名称（subSection，可不传） */
  subSection?: string
}

/**
 * 获取 AI 世界列表（按 section 分组）
 * 请求：GET /api-kou/bot/sites/kind?pageNum=1&pageSize=10
 * 响应：{ code, msg, data: AiWorldSection[] }
 */
export const getAiWorldList = async (
  params: GetAiWorldListParams = {}
): Promise<ApiResponse<AiWorldSection[]>> => {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 12
  const requestParams: Record<string, string | number> = { pageNum, pageSize }
  if (params.section?.trim()) requestParams.section = params.section.trim()
  if (params.subSection?.trim()) requestParams.subSection = params.subSection.trim()

  const response = await request.get<{ code?: string | number; msg?: string; data?: AiWorldSection[] }>(
    '/bot/sites/kind',
    {
      base: 1,
      params: requestParams,
    }
  )

  if (import.meta.env.DEV) {
    logger.info('[AI World API] GET /bot/sites/kind response body:', (response as { data?: any })?.data)
  }

  const normalized = normalizeApiResponse<AiWorldSection[] | undefined>(response)

  if (!normalized.success) {
    return {
      ...normalized,
      data: [],
    }
  }

  const data = normalized.data
  const raw: AiWorldSection[] = Array.isArray(data) ? data : []
  /** 按 section 名称合并，避免后端返回同名 section 导致左侧菜单与内容重复 */
  const sections = mergeSectionsByName(raw)

  return {
    code: normalized.code,
    message: normalized.message,
    success: normalized.success,
    timestamp: normalized.timestamp ?? Date.now(),
    data: sections,
  }
}

/**
 * 合并同名 section：将相同 section 名称的多条合并为一条，其 aiBotSites 合并
 * 过滤掉 section 为空或非对象的数据（后端 mock 返回结构不匹配时兜底）
 */
function mergeSectionsByName(list: AiWorldSection[]): AiWorldSection[] {
  const byName = new Map<string, AiWorldSection>()
  for (const sec of list) {
    if (!sec || typeof sec !== 'object') continue
    const name = sec.section || ''
    if (!name) continue
    const existing = byName.get(name)
    if (existing) {
      existing.aiBotSites = existing.aiBotSites.concat(sec.aiBotSites || [])
    } else {
      byName.set(name, {
        section: sec.section,
        subSection: sec.subSection,
        subSections: sec.subSections,
        aiBotSites: [...(sec.aiBotSites || [])],
      })
    }
  }
  return Array.from(byName.values())
}

/**
 * 按 subSection 分组后的子项（用于左侧子菜单与内容分类）
 */
export interface AiWorldSubGroup {
  subTitle: string
  items: AiWorldItem[]
}

/**
 * 带子分类的 section（section 下可有多个 subSection）
 */
export interface AiWorldSectionWithSubs {
  sectionTitle: string
  children: AiWorldSubGroup[]
}

/**
 * 将 section 的 aiBotSites 按 subSection 分组，生成带子分类的结构
 */
export function buildSectionWithSubs(
  section: AiWorldSection,
  siteToItemFn: (site: AiBotSite) => AiWorldItem
): AiWorldSectionWithSubs {
  const bySub = new Map<string, AiBotSite[]>()
  for (const site of section.aiBotSites || []) {
    const key = site.subSection?.trim() || ''
    if (!bySub.has(key)) bySub.set(key, [])
    bySub.get(key)!.push(site)
  }
  const children: AiWorldSubGroup[] = Array.from(bySub.entries()).map(([subTitle, sites]) => ({
    subTitle,
    items: sites.map(siteToItemFn),
  }))
  return {
    sectionTitle: section.section,
    children,
  }
}

/**
 * 子标题是否与主分类重复（用于侧边栏显示「全部」或合并为单级）
 */
export function isSubTitleRedundant(sectionTitle: string, subTitle: string): boolean {
  const s = (sectionTitle || '').trim()
  const sub = (subTitle || '').trim()
  if (!sub) return true
  if (s === sub) return true
  if (s.includes(sub) || sub.includes(s)) return true
  return false
}

/**
 * 子标题展示用：将 | 替换为 / 避免截断感，便于换行
 */
export function formatSubTitleForDisplay(subTitle: string): string {
  return (subTitle || '').replace(/\|/g, ' / ').trim()
}

/**
 * 根据 ID 获取单个站点详情（含 panelHtml）
 * 通过列表接口拉取后按 id 查找，无单独详情接口时使用
 */
export async function getAiWorldSiteById(id: string): Promise<AiBotSite | null> {
  const parsed = Number(id)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  const res = await getAiWorldList({ pageNum: 1, pageSize: 500 })
  if (!res.success || !Array.isArray(res.data)) return null
  for (const sec of res.data) {
    const site = (sec.aiBotSites || []).find((s: AiBotSite) => s.id === parsed)
    if (site) return site
  }
  return null
}

/**
 * 将 AiBotSite 转为页面使用的 AiWorldItem（用于卡片展示）
 */
export function siteToItem(site: AiBotSite): AiWorldItem {
  const link = site.officialUrl || (site.detailUrl ? `${window.location.origin}${site.detailUrl}` : undefined)
  return {
    id: String(site.id),
    title: site.name,
    description: site.shortDesc ?? undefined,
    coverUrl: site.iconUrl || '/images/common/empty.svg',
    link,
    section: site.section ?? undefined,
  }
}
