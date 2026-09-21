// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@ihui/ui-react'
import type { AgentPlanStatus } from '@ihui/api-client'

// 状态色板(UI 守门要求):executing 黄 / done 绿 / failed 红 / draft 灰 / rejected 灰
// 用 bg-muted 对比 + 彩色文字,禁用 rounded-full / divide / 单边 border 分隔。
const STATUS_STYLES: Record<AgentPlanStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  approved: 'bg-blue-500/15 text-blue-600',
  rejected: 'bg-muted text-muted-foreground',
  executing: 'bg-yellow-500/15 text-yellow-600',
  done: 'bg-green-500/15 text-green-600',
  failed: 'bg-red-500/15 text-red-600',
}

const STATUS_LABEL_KEY: Record<AgentPlanStatus, string> = {
  draft: 'statusDraft',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  executing: 'statusExecuting',
  done: 'statusDone',
  failed: 'statusFailed',
}

export function StatusBadge({ status }: { status: AgentPlanStatus }) {
  const t = useTranslations('agentPlan')
  return <Badge className={STATUS_STYLES[status]}>{t(STATUS_LABEL_KEY[status])}</Badge>
}
