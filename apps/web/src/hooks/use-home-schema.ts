'use client'

import * as React from 'react'
import { getHomeSchemaConfig } from '@ihui/api-client'
import {
  DEFAULT_HOME_SCHEMA,
  safeGetHomeSchema,
  type HomeSchema,
} from '@/components/marketing/home-schema'

/**
 * 加载首页 Server-Driven UI schema(P3-4.3)。
 *
 * - 首次渲染立即返回 DEFAULT_HOME_SCHEMA(零回归,与改造前行为一致,不阻塞首屏)
 * - 挂载后异步请求 GET /api/configs 取 key='home_schema' 的公开配置
 * - 校验通过则更新 schema(admin 自定义顺序/显隐生效);校验失败/未配置/请求失败则保持 DEFAULT
 *
 * @returns schema(始终有值,不会是 null)
 */
export function useHomeSchema(): HomeSchema {
  const [schema, setSchema] = React.useState<HomeSchema>(DEFAULT_HOME_SCHEMA)

  React.useEffect(() => {
    let cancelled = false
    getHomeSchemaConfig().then((res) => {
      if (cancelled || !res.success) return
      // safeGetHomeSchema:res.data 为 null 或损坏 → fallback DEFAULT(无需额外判空)
      const validated = safeGetHomeSchema(res.data)
      // 仅当与当前 schema 不同时更新(避免无意义重渲染)
      setSchema((prev) => (JSON.stringify(prev) === JSON.stringify(validated) ? prev : validated))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return schema
}
