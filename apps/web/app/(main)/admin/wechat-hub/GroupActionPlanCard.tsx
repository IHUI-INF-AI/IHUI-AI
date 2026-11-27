// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群写动作预览单展示：影响面名单、后果说明、风险警告与有效期倒计时。
 * 纯展示组件，确认动作由父组件通过 onConfirm 回调触发。
 */

'use client'

import { AlertTriangle, Loader2, Users } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatGroupActionPlan } from '@ihui/types'

interface GroupActionPlanCardProps {
  plan: WechatGroupActionPlan
  remainingSeconds: number
  expired: boolean
  confirming: boolean
  writeEnabled: boolean
  onConfirm: () => void
}

export default function GroupActionPlanCard({
  plan,
  remainingSeconds,
  expired,
  confirming,
  writeEnabled,
  onConfirm,
}: GroupActionPlanCardProps) {
  return (
    <div className="space-y-2 rounded-lg border border-stroke-field p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-body font-medium">
          <Users className="h-4 w-4" />
          <span>预览影响面：{plan.chatTitle || '未命名群'}</span>
        </p>
        <span className="font-[weight:inherit] text-label text-muted-foreground">
          {expired ? '预览已过期' : `剩余 ${remainingSeconds} 秒`}
        </span>
      </div>
      <p className="font-[weight:inherit] text-body text-foreground/90">{plan.effect}</p>
      {plan.targets.length > 0 ? (
        <ul className="font-[weight:inherit] space-y-1 rounded-md bg-muted/40 p-2 text-body">
          {plan.targets.map((target) => (
            <li key={target.memberId} className="flex items-baseline justify-between gap-2">
              <span>{target.name || target.memberId}</span>
              {target.reason ? (
                <span className="font-[weight:inherit] text-label text-muted-foreground">{target.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {plan.warnings.length > 0 ? (
        <div className="space-y-1">
          {plan.warnings.map((warning) => (
            <p
              key={warning}
              className="font-[weight:inherit] flex items-start gap-1.5 text-label text-amber-600 dark:text-amber-500"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </p>
          ))}
        </div>
      ) : null}
      {expired ? (
        <Alert
          variant="warning"
          title="预览已过期，请重新预览"
          description="确认令牌一次性且有时效，过期后不能用旧单子执行新内容。"
        />
      ) : null}
      {!writeEnabled ? (
        <Alert
          variant="warning"
          title="群写动作当前关闭"
          description="预览仅供查看影响面；打开上方群写开关后才能确认执行，执行仍受单次人数与每小时次数上限约束。"
        />
      ) : null}
      <Button onClick={onConfirm} disabled={expired || confirming || !writeEnabled}>
        {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        <span>确认执行（60 秒内有效）</span>
      </Button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
