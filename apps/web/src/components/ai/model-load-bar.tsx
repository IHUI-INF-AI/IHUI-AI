// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D59 模型负载与排队条(G-73) —— 纯展示渲染件。
//
// **数据面纪律(台账 D59 明文)**:本条**不取数**。排队位次与预估等待**由网关产出**
// (ai-service `llm_gateway.py` 的 `model_queue` 帧,与 D34 同批)—— D59 定性实测
// 该帧在 web 侧**尚未落地**,因此:
//   · 无 frame / frame 无有效字段 → **返回 null**(不得用假数据占位,2026-09-24 定性);
//   · 端内**严禁**用本地推算(latency/并发猜测)构造 frame 伪装数据面已就绪;
//   · frame 接入点与字段形状见 `@ihui/shared/chat/model-load` 的 `ModelLoadFrame` 注释。
//
// 五态判定全部走 `@ihui/shared/chat/model-load` 的 queueStateFromFrame /
// queueBarView,端内不得另建第二套负载/排队判定;turn 生命周期徽章仍归
// D71 turn-status(本条只做负载/等待维度,两者正交不互替)。
//
// **「不充值可用心智」边界(2026-09-21 三轮口径)**:freeTierAvailable 由调用方
// 注入(来源对齐 D39 freeTierAvailable / D67 quota-ownership 的取数口径),判定层
// isInducementRisk 在免费档可用且非低负载时判诱导风险,本组件只做**状态陈述**,
// 不渲染任何付费出口;inducementRisk 经 data-model-load-inducement-risk 暴露,
// 供测试与未来的付费出口拦截使用。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  queueBarView,
  queueStateFromFrame,
  type ModelLoadFrame,
} from '@ihui/shared/chat/model-load'

export interface ModelLoadBarProps {
  /** 网关负载/排队帧;**缺省或全字段无效 ⇒ 本条不渲染任何内容(反假数据)** */
  frame?: ModelLoadFrame
  /** 免费档仍可用(「不充值可用心智」判据入参;缺省按 true 保守侧) */
  freeTierAvailable?: boolean
  className?: string
  'data-testid'?: string
}

export function ModelLoadBar({
  frame,
  freeTierAvailable = true,
  className,
  'data-testid': testId,
}: ModelLoadBarProps) {
  const t = useTranslations('ai.pane.modelLoad')

  const state = frame ? queueStateFromFrame(frame) : null
  if (!frame || !state) return null

  const view = queueBarView(state, {
    loadLevel: frame.loadLevel ?? null,
    position: frame.queuePosition ?? null,
    waitMs:
      typeof frame.estimatedWaitSeconds === 'number'
        ? frame.estimatedWaitSeconds * 1000
        : null,
    freeTierAvailable,
  })
  if (!view) return null

  const label =
    view.state === 'slowLane' && view.position !== null
      ? t(view.labelKey, { position: view.position })
      : view.state === 'waitingEstimate' && view.waitBucketKey === 'wait.aboutNmin' && view.minutes !== null
        ? t(view.labelKey, { minutes: view.minutes })
        : t(view.labelKey)

  return (
    <div
      role="status"
      aria-label={t('ariaLabel')}
      className={cn('flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1', className)}
      data-testid={testId}
      data-model-load-state={view.state}
      data-model-load-inducement-risk={view.inducementRisk ? 'true' : 'false'}
    >
      <span className="text-xs text-muted-foreground" data-model-load-label={view.labelKey}>
        {label}
      </span>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
