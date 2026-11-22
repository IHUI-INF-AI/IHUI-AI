// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * EngineModeCard — 设置页「agent 执行引擎」切换卡片(2026-11-15,阶段 3 接线第 ① 片)
 *
 * 把已建的 EngineModeToggle(纯展示,ui-react)挂到 web 的 engine-mode store 上,
 * 让用户真正能选 本地 / 云端 / 自动。写入时 store 内部会同步到 shared 全局单例,
 * 使 use-agent-stream.ts 的接线生效(见 stores/engine-mode.ts 的 §单一真相源注释)。
 *
 * 三态语义(见 tmp/本地云端引擎切换_核实与方案.md):
 *  - 本地:agent 编排 + 工具直连本机 8803,负载不占线上服务器(真减负)
 *  - 云端:现状,负载在服务器
 *  - 自动(默认):沿用 base-url 环境判定,零回归
 *
 * 2026-11-16 修正:浏览器端选「本地」不再回退云端 —— use-agent-stream 已改用
 * resolveAiServiceBaseUrlForEngineMode(),与 fetchAiServiceJson 同一条腿。
 * 前提是本机 8803 在运行;否则请求会明确失败,而不是静默换到云端。
 */

import * as React from 'react'
import { Cpu } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, EngineModeToggle } from '@ihui/ui-react'
import type { EngineMode } from '@ihui/shared'

import { useEngineModeStore } from '@/stores/engine-mode'

/** 设置页「agent 执行引擎」切换卡片 */
export function EngineModeCard() {
  const mode = useEngineModeStore((s) => s.mode)
  const setMode = useEngineModeStore((s) => s.setMode)

  // React 18 无 useSyncExternalStore 之外的场景:直接用 selector 绑定即可,
  // zustand 已保证跨组件一致。这里保留一个稳定回调避免子组件重渲染抖动。
  const handleChange = React.useCallback(
    (m: EngineMode) => {
      setMode(m)
    },
    [setMode],
  )

  return (
    <Card data-testid="engine-mode-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4" />
          agent 执行引擎
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <span className="font-[weight:inherit] min-w-0 flex-1 text-body text-muted-foreground">
            选择 agent 执行编排所在位置。「本地」在本机跑编排与工具,不占用线上服务器资源;
            浏览器端选择本地需本机运行 ai-service(8803)。
          </span>
          <EngineModeToggle value={mode} onChange={handleChange} className="shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}

export default EngineModeCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
