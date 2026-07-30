'use client'

import * as React from 'react'
import { IDELayout } from '@/components/ide'

/**
 * IDE 页面(/developer/ide)
 *
 * 2026-07-31 修复:原 h-[calc(100vh-120px)] 是错误硬编码(120px 估值仅在 lg 断点近似准确,
 * md/sm 断点下高度计算错误),且与统一基准 calc(100vh - 58px) 不一致。
 * 改用 h-full 让容器自动撑满 MainShell main 的 content box 高度
 * (main 是 flex-1 overflow-y-auto,子元素 h-full = main 内容区高度,
 * 由布局层统一计算 = 视口 - GlobalTopBar(50px) - MainShell pb-2(8px) - main padding 上下)。
 */
export default function IDEPage() {
  return (
    <div className="h-full">
      <IDELayout />
    </div>
  )
}
