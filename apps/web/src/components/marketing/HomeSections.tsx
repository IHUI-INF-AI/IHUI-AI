'use client'

import * as React from 'react'
import {
  DEFAULT_HOME_SCHEMA,
  getEnabledSectionCount,
  type HomeSchema,
} from '@/components/marketing/home-schema'
import { SchemaDrivenSections } from '@/components/marketing/SchemaDrivenSections'

/**
 * 营销/工作区首页共用的 section 渲染(P3-4.3 Server-Driven UI 改造)。
 *
 * 2026-07-28:从 (marketing)/page.tsx 抽出,工作区版 (/home) 共用同一份内容。
 * 2026-08-01 P3-4.3:硬编码 7-section → schema 驱动。section 顺序/显隐可由后端
 * system_configs(category='home_schema')配置,admin 可编辑,前端渲染时加载。
 *
 * - 路由层 (marketing)/page.tsx 与 (main)/home/page.tsx 各自负责外壳:
 *   scroll 容器 + useFullPageScroll + PageIndicator
 * - 本组件只负责 section 渲染(schema 驱动),不引入任何滚动 hook
 * - showFooter 默认 true(营销页需要 footer);(main)/home 传 false 隐藏(工作区不需要)
 * - schema 默认 DEFAULT_HOME_SCHEMA(零回归);路由层可通过 useHomeSchema hook 加载后端配置
 */
export const TOTAL_PAGES = getEnabledSectionCount(DEFAULT_HOME_SCHEMA)

interface HomeSectionsProps {
  /** 是否渲染 SiteFooter,默认 true(营销页需要,工作区首页不需要) */
  showFooter?: boolean
  /** 自定义 schema(默认 DEFAULT_HOME_SCHEMA,路由层可传后端加载的 schema) */
  schema?: HomeSchema
}

export function HomeSections({
  showFooter = true,
  schema = DEFAULT_HOME_SCHEMA,
}: HomeSectionsProps) {
  return <SchemaDrivenSections schema={schema} showFooter={showFooter} />
}
