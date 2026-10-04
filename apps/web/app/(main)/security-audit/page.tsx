// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldAlert, KeyRound, LogIn, Settings } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'

import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import { BackButton, AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'

/**
 * 安全审计条目 = `GET /api/security/audit` 的 `SecurityLog` 行(`security_logs` 表)。
 *
 * 字段映射注意(2026-10-04,改 URL 时逐字段核对过):
 *  · 后端**没有 type / description 两列**。可用的只有 `action`(自由文本 varchar)、
 *    `userAgent`、`metadata`。故 `type` 由 `action` 归类(未识别的落 `other`,词条已存在),
 *    `description` 取 `action` 原文 —— 不编造后端没有的字段。
 *  · `ip` 可为 null(渲染 `-`,与 CLI `security audit` 同一口径)。
 *  · 响应是 `{list,total,page,pageSize}`,不是裸数组 ⇒ 必须取 `.list`。
 */
interface SecurityLogEntry {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

interface SecurityAuditResponse {
  list?: SecurityLogEntry[]
  total?: number
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  login: LogIn,
  permission: KeyRound,
  sensitive: Settings,
  other: ShieldAlert,
}

/** `action` 自由文本 → 页面四档图标/词条。未识别的一律 `other`(词条已存在,不新增 i18n)。 */
function auditTypeOf(action: string): string {
  const a = action.toLowerCase()
  if (a.includes('login') || a.includes('logout') || a.includes('auth')) return 'login'
  if (a.includes('permission') || a.includes('role') || a.includes('password')) return 'permission'
  if (a.includes('sensitive') || a.includes('delete') || a.includes('transfer')) return 'sensitive'
  return 'other'
}

const DEFAULT_ICON = ShieldAlert

const TYPE_KEY: Record<string, string> = {
  login: 'type.login',
  permission: 'type.permission',
  sensitive: 'type.sensitive',
  other: 'type.other',
}

export default function SecurityAuditPage() {
  const t = useTranslations('securityAuditPage')

  // 2026-09-30 登录态门:未登录不发注定 401 的请求
  const { allow } = useAuthGate()

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['security-audit'],
    enabled: allow,
    queryFn: async () => {
      // 响应是 {list,total,page,pageSize},不是裸数组 ⇒ 取 .list
      const r = await fetchApi<SecurityAuditResponse>('/api/security/audit')
      if (r.success && r.data) return r.data.list ?? []
      return []
    },
  })

  const fmtDate = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : formatDate(d)
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-4xl space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardContent className="p-0">
          {!allow ? (
            <AuthGatePrompt message="请先登录后查看安全审计" />
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-32 px-4 py-2.5">{t('colType')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('colDesc')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('colIp')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((ev) => {
                  const type = auditTypeOf(ev.action)
                  const Icon = TYPE_ICON[type] ?? DEFAULT_ICON
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {t(TYPE_KEY[type] ?? 'type.other')}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">{ev.action}</TableCell>
                      <TableCell className="px-4 py-2.5 text-muted-foreground">{ev.ip ?? '-'}</TableCell>
                      <TableCell className="px-4 py-2.5 text-muted-foreground">
                        {fmtDate(ev.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
