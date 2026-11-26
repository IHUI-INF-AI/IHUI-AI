// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 联系人平台侧动作：从桥同步、从平台删除好友。
 * 本地备注/标签仍在详情卡里维护；这里只处理平台面动作与结果提示。
 */

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, RefreshCw, UserMinus } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { wechatHubApi } from './wechat-hub-api'

export default function ContactPlatformActions({
  accountId,
  contactId,
  contactUserId,
  onChanged,
}: {
  accountId: string
  contactId: string | null
  contactUserId: string | undefined
  onChanged: () => void
}) {
  const syncMutation = useMutation({
    mutationFn: () => wechatHubApi.syncContacts(accountId),
    onSuccess: onChanged,
  })
  const remoteDeleteMutation = useMutation({
    mutationFn: (id: string) => wechatHubApi.deleteRemoteContact(accountId, id),
    onSuccess: onChanged,
  })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
          )}
          从桥同步
        </Button>
        {contactId && contactUserId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => remoteDeleteMutation.mutate(contactId)}
            disabled={remoteDeleteMutation.isPending}
          >
            {remoteDeleteMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserMinus className="mr-1 h-3.5 w-3.5" />
            )}
            删除好友
          </Button>
        ) : null}
      </div>
      {syncMutation.data ? (
        <p className="font-[weight:inherit] text-label text-muted-foreground">
          {syncMutation.data.result.ok
            ? `同步完成：新增 ${syncMutation.data.inserted}，更新 ${syncMutation.data.updated}`
            : `同步未执行：${syncMutation.data.result.reason ?? syncMutation.data.result.status}`}
        </p>
      ) : null}
      {syncMutation.isError ? (
        <Alert
          variant="danger"
          title="同步失败"
          description={
            syncMutation.error instanceof Error ? syncMutation.error.message : '未知错误'
          }
        />
      ) : null}
      {remoteDeleteMutation.data && !remoteDeleteMutation.data.ok ? (
        <Alert
          variant={remoteDeleteMutation.data.status === 'unsupported' ? 'warning' : 'danger'}
          title={remoteDeleteMutation.data.status === 'unsupported' ? '当前后端不支持' : '删除失败'}
          description={remoteDeleteMutation.data.reason ?? '桥未返回原因'}
        />
      ) : null}
      {remoteDeleteMutation.isError ? (
        <Alert
          variant="danger"
          title="删除好友失败"
          description={
            remoteDeleteMutation.error instanceof Error
              ? remoteDeleteMutation.error.message
              : '未知错误'
          }
        />
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
