'use client'

/**
 * 企业合规审核页(2026-09-17 立,补强 61,差异化:竞品为个人订阅分发,此块完全缺)。
 * 四个工作台:企业认证审核 / 发票开具 / 企业合同 / 对公打款确认。
 * 对公确认后端复用既有支付闭环(completeOrder + activateOrderSubscription,订阅自动激活)。
 */
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2, RefreshCw } from 'lucide-react'

import { Button, Input } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

interface Profile {
  id: string
  userId: string
  companyName: string
  creditCode: string
  legalPerson: string | null
  contactName: string
  contactPhone: string
  licenseUrl: string | null
  status: string
  rejectReason: string | null
  createdAt: string
}
interface Invoice {
  id: string
  userId: string
  orderNo: string
  invoiceType: string
  title: string
  taxId: string
  email: string
  amountCents: number
  status: string
  invoiceNo: string | null
  createdAt: string
}
interface Contract {
  id: string
  userId: string
  contractNo: string
  title: string
  contractType: string
  amountCents: number
  status: string
  signedAt: string | null
  createdAt: string
}
interface Voucher {
  id: string
  userId: string
  orderNo: string
  amountCents: number
  payerCompany: string
  voucherUrl: string | null
  status: string
  createdAt: string
}
interface ListResp<T> {
  list: T[]
  total: number
}

const yuan = (c: number) => `¥${(c / 100).toFixed(2)}`

const TABS = [
  { key: 'profiles', label: '企业认证' },
  { key: 'invoices', label: '发票开具' },
  { key: 'contracts', label: '企业合同' },
  { key: 'corporate', label: '对公结算' },
] as const

type TabKey = (typeof TABS)[number]['key']

const BADGE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  issued: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  confirmed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  terminated: 'bg-red-500/10 text-red-600 dark:text-red-400',
  pending_sign: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
}

function Badge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-medium',
        BADGE[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </span>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-3 space-y-1.5">{children}</div>
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {value ?? '-'}
    </p>
  )
}

export default function EnterprisePage() {
  const [tab, setTab] = React.useState<TabKey>('profiles')
  const [reason, setReason] = React.useState('')
  const [invoiceNo, setInvoiceNo] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState('')
  const [newContract, setNewContract] = React.useState({ userId: '', title: '', amount: '' })
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['admin', 'relay', 'enterprise', tab],
    queryFn: async () => {
      const path =
        tab === 'profiles'
          ? '/api/admin/relay/enterprise/profiles?pageSize=50'
          : tab === 'invoices'
            ? '/api/admin/relay/enterprise/invoices?pageSize=50'
            : tab === 'contracts'
              ? '/api/admin/relay/enterprise/contracts?pageSize=50'
              : '/api/admin/relay/enterprise/corporate-payments?pageSize=50'
      const r = await fetchApi<ListResp<unknown>>(path)
      if (!r.success) throw new Error(r.error)
      return r.data as ListResp<Profile | Invoice | Contract | Voucher>
    },
  })

  const post = async (path: string, body?: unknown) => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetchApi(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!r.success) throw new Error(r.error)
      setMsg('操作成功')
      setReason('')
      setInvoiceNo('')
      void qc.invalidateQueries({ queryKey: ['admin', 'relay', 'enterprise'] })
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const rows = q.data?.list ?? []

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Building2 className="h-5 w-5" aria-hidden />
            企业合规
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            企业认证 / 发票 / 合同 / 对公结算;对公确认后自动完成订单并激活订阅。
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={cn('h-4 w-4', q.isFetching && 'animate-spin')} aria-hidden />
          <span>刷新</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={tab === t.key ? 'default' : 'outline'}
            onClick={() => setTab(t.key)}
          >
            <span>{t.label}</span>
          </Button>
        ))}
      </div>

      {tab === 'invoices' && (
        <Input
          placeholder="发票号(开具时填写)"
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          className="max-w-md"
        />
      )}
      {(tab === 'profiles' || tab === 'invoices' || tab === 'corporate') && (
        <Input
          placeholder="驳回/拒绝原因(操作驳回类动作时使用)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-md"
        />
      )}
      {tab === 'contracts' && (
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="用户 ID(uuid)"
            value={newContract.userId}
            onChange={(e) => setNewContract({ ...newContract, userId: e.target.value })}
            className="max-w-xs"
          />
          <Input
            placeholder="合同标题"
            value={newContract.title}
            onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
            className="max-w-xs"
          />
          <Input
            placeholder="金额(元)"
            value={newContract.amount}
            onChange={(e) => setNewContract({ ...newContract, amount: e.target.value })}
            className="max-w-[120px]"
          />
          <Button
            size="sm"
            disabled={busy || !newContract.userId || !newContract.title}
            onClick={() =>
              post('/api/admin/relay/enterprise/contracts', {
                userId: newContract.userId,
                title: newContract.title,
                contractType: 'api_subscription',
                amountCents: Math.round(Number(newContract.amount || '0') * 100),
              })
            }
          >
            <span>建档(须已通过企业认证)</span>
          </Button>
        </div>
      )}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      {q.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          加载中...
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">暂无记录</p>
      ) : (
        <div className="space-y-3">
          {tab === 'profiles' &&
            (rows as Profile[]).map((p) => (
              <Row key={p.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{p.companyName}</p>
                  <Badge status={p.status} />
                </div>
                <Meta label="信用代码" value={p.creditCode} />
                <Meta label="联系人" value={`${p.contactName} ${p.contactPhone}`} />
                <Meta label="userId" value={p.userId} />
                {p.licenseUrl && <Meta label="执照" value={p.licenseUrl} />}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="xs"
                    disabled={busy || p.status !== 'pending'}
                    onClick={() =>
                      post(`/api/admin/relay/enterprise/profiles/${p.id}/review`, { approve: true })
                    }
                  >
                    <span>通过</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy || p.status !== 'pending' || !reason}
                    onClick={() =>
                      post(`/api/admin/relay/enterprise/profiles/${p.id}/review`, {
                        approve: false,
                        rejectReason: reason,
                      })
                    }
                  >
                    <span>驳回</span>
                  </Button>
                </div>
              </Row>
            ))}
          {tab === 'invoices' &&
            (rows as Invoice[]).map((v) => (
              <Row key={v.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{v.title}</p>
                  <Badge status={v.status} />
                </div>
                <Meta label="订单" value={`${v.orderNo}(${yuan(v.amountCents)})`} />
                <Meta label="税号" value={v.taxId} />
                <Meta label="接收邮箱" value={v.email} />
                <div className="flex gap-2 pt-1">
                  <Button
                    size="xs"
                    disabled={busy || v.status !== 'pending' || !invoiceNo}
                    onClick={() =>
                      post(`/api/admin/relay/enterprise/invoices/${v.id}/issue`, { invoiceNo })
                    }
                  >
                    <span>开具</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy || v.status !== 'pending' || !reason}
                    onClick={() =>
                      post(`/api/admin/relay/enterprise/invoices/${v.id}/reject`, { reason })
                    }
                  >
                    <span>驳回</span>
                  </Button>
                </div>
              </Row>
            ))}
          {tab === 'contracts' &&
            (rows as Contract[]).map((c) => (
              <Row key={c.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{c.title}</p>
                  <Badge status={c.status} />
                </div>
                <Meta label="合同号" value={c.contractNo} />
                <Meta label="金额" value={yuan(c.amountCents)} />
                <Meta label="userId" value={c.userId} />
                <div className="pt-1">
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy || (c.status !== 'active' && c.status !== 'pending_sign')}
                    onClick={() => post(`/api/admin/relay/enterprise/contracts/${c.id}/terminate`)}
                  >
                    <span>终止合同</span>
                  </Button>
                </div>
              </Row>
            ))}
          {tab === 'corporate' &&
            (rows as Voucher[]).map((v) => (
              <Row key={v.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{v.payerCompany}</p>
                  <Badge status={v.status} />
                </div>
                <Meta label="订单" value={`${v.orderNo}(${yuan(v.amountCents)})`} />
                {v.voucherUrl && <Meta label="回单" value={v.voucherUrl} />}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="xs"
                    disabled={busy || v.status !== 'pending'}
                    onClick={() =>
                      post(`/api/admin/relay/enterprise/corporate-payments/${v.id}/confirm`)
                    }
                  >
                    <span>确认到账并激活</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy || v.status !== 'pending' || !reason}
                    onClick={() =>
                      post(`/api/admin/relay/enterprise/corporate-payments/${v.id}/reject`, {
                        reason,
                      })
                    }
                  >
                    <span>驳回</span>
                  </Button>
                </div>
              </Row>
            ))}
        </div>
      )}
    </div>
  )
}
