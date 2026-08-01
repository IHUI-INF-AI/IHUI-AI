'use client'

import * as React from 'react'
import { getHomeSchemaConfig, getHomeSchemaDraftConfig } from '@ihui/api-client'
import {
  DEFAULT_HOME_SCHEMA,
  safeGetHomeSchema,
  type HomeSchema,
} from '@/components/marketing/home-schema'

/**
 * 判断当前是否为草稿预览模式(?preview=draft)。
 * 仅在 client 端读取 window.location.search,mount 时定值一次。
 * 预览页通常由 admin 在新窗口打开,生命周期独立,无需响应 query param 变化。
 */
export function useIsPreviewDraft(): boolean {
  return React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('preview') === 'draft'
  }, [])
}

/**
 * 加载首页 Server-Driven UI schema(P3-4.3)。
 *
 * - 首次渲染立即返回 DEFAULT_HOME_SCHEMA(零回归,与改造前行为一致,不阻塞首屏)
 * - 挂载后异步请求 GET /api/configs 取 key='home_schema' 的公开配置
 * - 校验通过则更新 schema(admin 自定义顺序/显隐生效);校验失败/未配置/请求失败则保持 DEFAULT
 *
 * P3-4.6 草稿+预览模式:
 * - 当 URL 含 ?preview=draft 时,改加载 key='home_schema_draft' 的草稿配置
 * - 草稿不存在(未保存过)→ fallback 生产 schema(预览页显示当前线上状态)
 * - 普通 admin 编辑流程:/admin/home-schema 编辑草稿 → 点"预览"打开 `/?preview=draft` → 确认后点"发布"
 *
 * @returns schema(始终有值,不会是 null)
 */
export function useHomeSchema(): HomeSchema {
  const [schema, setSchema] = React.useState<HomeSchema>(DEFAULT_HOME_SCHEMA)
  const isPreviewDraft = useIsPreviewDraft()

  React.useEffect(() => {
    let cancelled = false

    const applySchema = (data: unknown) => {
      const validated = safeGetHomeSchema(data)
      setSchema((prev) => (JSON.stringify(prev) === JSON.stringify(validated) ? prev : validated))
    }

    if (isPreviewDraft) {
      // 预览模式:优先加载 draft,draft 不存在则 fallback 生产 schema
      getHomeSchemaDraftConfig().then((res) => {
        if (cancelled || !res.success) return
        if (res.data === null) {
          // 草稿未保存 → fallback 生产 schema
          getHomeSchemaConfig().then((prodRes) => {
            if (cancelled || !prodRes.success) return
            applySchema(prodRes.data)
          })
          return
        }
        applySchema(res.data)
      })
    } else {
      // 正常模式:加载生产 schema
      getHomeSchemaConfig().then((res) => {
        if (cancelled || !res.success) return
        applySchema(res.data)
      })
    }

    return () => {
      cancelled = true
    }
  }, [isPreviewDraft])

  return schema
}
