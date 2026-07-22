import * as React from 'react'
import type { Metadata } from 'next'

import { HooksManager } from '@/components/hooks/hooks-manager'

export const metadata: Metadata = {
  title: 'Hook 管理',
  description: '管理 agent 行为事件触发的自定义 Hook',
}

/**
 * Hook 管理页面(/hooks)— 2026-07-22 立。
 *
 * 功能:
 *  - 列出全部 Hook 配置(支持创建/编辑/删除/启用切换)
 *  - 测试 Hook(模拟触发,展示日志)
 *  - 查看执行日志
 *
 * 后端:
 *  - GET/POST/PATCH/DELETE /api/hooks/*
 *  - 转发到 ai-service /api/hooks/*
 */
export default function HooksPage() {
  return (
    <div className="mx-auto w-full max-w-4xl py-2">
      <HooksManager />
    </div>
  )
}
