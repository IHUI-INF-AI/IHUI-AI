// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * RP-43：web 工单面板的数据层。
 *
 * 轮询复用仓里既有的 @tanstack/react-query 范式（asks / bi-dashboard 同款），
 * 不在组件里手写 setInterval；接口一律走 @ihui/api-client，不裸 fetch。
 *
 * 三态纪律：`failure` 只在「还没有数据」时由页面画成错误态；已有旧数据时页面
 * 保留列表并挂一条刷新失败横幅，绝不把「读失败」渲染成「空」。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptSuperAgentRecorded,
  getSuperAgentPanel,
  getSuperAgentTicketAssignment,
  getSuperAgentTicketLease,
  stopSuperAgentTicket,
} from '@ihui/api-client'
import type { SuperAgentTicketLease, SuperAgentWorkerAssignment } from '@ihui/api-client'

export const SUPER_AGENT_PANEL_POLL_MS = 15_000

type SuperAgentReadFailure =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'read'; status?: number; message: string }

/** 只按结构读 HTTP status，不按 message 文本分支（ApiError 的 status 是跨端判据）。 */
function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function classifyReadFailure(error: unknown): SuperAgentReadFailure {
  const status = httpStatus(error)
  const message = error instanceof Error ? error.message : String(error)
  if (status === 401 || status === 403) return { kind: 'auth', status, message }
  return { kind: 'read', ...(status !== undefined ? { status } : {}), message }
}

export function useSuperAgentPanel() {
  const query = useQuery({
    queryKey: ['super-agent', 'panel'],
    queryFn: getSuperAgentPanel,
    refetchInterval: SUPER_AGENT_PANEL_POLL_MS,
    // 轮询只在前台跑：后台标签页不停打接口。
    refetchIntervalInBackground: false,
    retry: false,
  })
  const failure = query.error ? classifyReadFailure(query.error) : null
  return { ...query, failure }
}

export interface SuperAgentTicketDetail {
  assignment: SuperAgentWorkerAssignment | null
  lease: SuperAgentTicketLease
}

/** 选中工单的派工与租约读数；未选中时整条 query 关闭。 */
export function useSuperAgentTicketDetail(ticketId: string | null) {
  return useQuery({
    queryKey: ['super-agent', 'ticket-detail', ticketId],
    queryFn: async (): Promise<SuperAgentTicketDetail> => {
      if (ticketId === null) throw new Error('ticketId is required')
      const [assignment, lease] = await Promise.all([
        getSuperAgentTicketAssignment(ticketId),
        getSuperAgentTicketLease(ticketId),
      ])
      return { assignment, lease }
    },
    enabled: ticketId !== null,
    retry: false,
  })
}

export function useStopSuperAgentTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: string) => stopSuperAgentTicket(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['super-agent'] })
    },
  })
}

export function useAcceptSuperAgentRecorded() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { triggerId: string; ruleId: string }) =>
      acceptSuperAgentRecorded(input.triggerId, input.ruleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['super-agent'] })
    },
  })
}
