// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群写策略卡：写开关、单次人数上限与每小时次数上限的展示与编辑。
 * 策略是账号级全局闸门，关闭时群动作卡只保留说明，不进入预览/确认流程。
 */

'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button, Input, Label, Switch } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatGroupWritePolicy } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'
import { describeGroupActionError, type GroupActionErrorView } from './group-action-errors'

interface GroupWritePolicyCardProps {
  accountId: string
  policy: WechatGroupWritePolicy | undefined
  loading: boolean
}

const MIN_LIMIT = 1
const MAX_LIMIT = 100

function parseLimit(raw: string): number | null {
  const value = Number(raw)
  if (!Number.isInteger(value) || value < MIN_LIMIT || value > MAX_LIMIT) return null
  return value
}

export default function GroupWritePolicyCard({
  accountId,
  policy,
  loading,
}: GroupWritePolicyCardProps) {
  const qc = useQueryClient()
  const [targetsDraft, setTargetsDraft] = React.useState('')
  const [actionsDraft, setActionsDraft] = React.useState('')
  const [draftTouched, setDraftTouched] = React.useState(false)
  const [policyError, setPolicyError] = React.useState<GroupActionErrorView | null>(null)

  // 后端策略刷新后，未手动改过的草稿跟随最新值，避免输入框显示旧上限
  React.useEffect(() => {
    if (policy && !draftTouched) {
      setTargetsDraft(String(policy.maxTargetsPerAction))
      setActionsDraft(String(policy.maxActionsPerHour))
    }
  }, [policy, draftTouched])

  const mutation = useMutation({
    mutationFn: (patch: {
      enabled?: boolean
      maxTargetsPerAction?: number
      maxActionsPerHour?: number
    }) => wechatHubApi.updateGroupPolicy(accountId, patch),
    onSuccess: () => {
      setDraftTouched(false)
      setPolicyError(null)
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'group-write-policy', accountId] })
    },
    onError: (e) => setPolicyError(describeGroupActionError(e)),
  })

  if (loading && !policy) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>加载群写策略…</span>
      </div>
    )
  }
  if (!policy) {
    return <Alert variant="danger" title="群写策略加载失败" description="请刷新页面后重试。" />
  }

  const targetsLimit = parseLimit(targetsDraft)
  const actionsLimit = parseLimit(actionsDraft)
  const canSaveLimits =
    targetsLimit !== null &&
    actionsLimit !== null &&
    (targetsLimit !== policy.maxTargetsPerAction || actionsLimit !== policy.maxActionsPerHour)

  return (
    <div className="space-y-3 rounded-md border border-stroke-field p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <p className="text-sm font-medium">群写动作开关</p>
        </div>
        <Switch
          checked={policy.enabled}
          onCheckedChange={(enabled) => mutation.mutate({ enabled })}
          aria-label="群写动作开关"
          disabled={mutation.isPending}
        />
      </div>
      {policy.enabled ? (
        <>
          <p className="text-sm text-muted-foreground">
            单次最多 {policy.maxTargetsPerAction} 人，每小时最多 {policy.maxActionsPerHour} 次
          </p>
          <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="wechat-group-max-targets" className="text-xs text-muted-foreground">
                单次人数上限
              </Label>
              <Input
                id="wechat-group-max-targets"
                type="number"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                value={targetsDraft}
                onChange={(e) => {
                  setTargetsDraft(e.target.value)
                  setDraftTouched(true)
                }}
                className="h-8 w-24 px-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wechat-group-max-actions" className="text-xs text-muted-foreground">
                每小时次数上限
              </Label>
              <Input
                id="wechat-group-max-actions"
                type="number"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                value={actionsDraft}
                onChange={(e) => {
                  setActionsDraft(e.target.value)
                  setDraftTouched(true)
                }}
                className="h-8 w-24 px-2 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canSaveLimits || mutation.isPending}
              onClick={() => {
                if (targetsLimit === null || actionsLimit === null) return
                mutation.mutate({
                  maxTargetsPerAction: targetsLimit,
                  maxActionsPerHour: actionsLimit,
                })
              }}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              <span>保存上限</span>
            </Button>
            {targetsDraft && targetsLimit === null ? (
              <span className="text-xs text-red-500">
                单次人数需为 {MIN_LIMIT}–{MAX_LIMIT} 的整数
              </span>
            ) : null}
            {actionsDraft && actionsLimit === null ? (
              <span className="text-xs text-red-500">
                每小时次数需为 {MIN_LIMIT}–{MAX_LIMIT} 的整数
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          写动作默认关闭，打开后仍受单次 {policy.maxTargetsPerAction} 人 / 每小时{' '}
          {policy.maxActionsPerHour} 次限制。
        </p>
      )}
      {policyError ? (
        <Alert variant="danger" title={policyError.title} description={policyError.detail || undefined} />
      ) : null}
    </div>
  )
}
