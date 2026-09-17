// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 企业服务页(2026-09-17 立,补强 61,developer 中心)。
 * 企业认证 / 发票申请(对已支付订单)/ 对公结算(登记打款凭证,admin 确认后
 * 订单自动完成并激活订阅)/ 合同列表与签署。
 */
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2 } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

interface OrderLite {
  id: string
  orderNo: string
  amount: number
  targetTitle: string | null
}
interface Profile {
  companyName: string
  creditCode: string
  contactName: string
  contactPhone: string
  status: string
  rejectReason: string | null
}
interface Invoice {
  id: string
  orderNo: string
  title: string
  amountCents: number
  status: string
  invoiceNo: string | null
}
interface Contract {
  id: string
  contractNo: string
  title: string
  amountCents: number
  status: string
}
interface Voucher {
  id: string
  orderNo: string
  amountCents: number
  payerCompany: string
  status: string
}

const yuan = (c: number) => `¥${(c / 100).toFixed(2)}`

const BADGE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  issued: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  confirmed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
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

export default function DeveloperEnterprisePage() {
  const qc = useQueryClient()
  const [msg, setMsg] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [profile, setProfile] = React.useState({
    companyName: '',
    creditCode: '',
    legalPerson: '',
    contactName: '',
    contactPhone: '',
    licenseUrl: '',
  })
  const [invoice, setInvoice] = React.useState({
    orderId: '',
    invoiceType: 'plain',
    title: '',
    taxId: '',
    email: '',
  })
  const [voucher, setVoucher] = React.useState({ orderNo: '', payerCompany: '', voucherUrl: '' })

  const profileQ = useQuery({
    queryKey: ['developer', 'enterprise', 'profile'],
    queryFn: async () => {
      const r = await fetchApi<{ profile: Profile | null }>('/api/developer/enterprise/profile')
      if (!r.success) throw new Error(r.error)
      return r.data.profile
    },
  })
  const paidQ = useQuery({
    queryKey: ['developer', 'enterprise', 'paid-orders'],
    queryFn: async () => {
      const r = await fetchApi<{ list: OrderLite[] }>(
        '/api/developer/enterprise/invoice-eligible-orders',
      )
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })
  const pendingQ = useQuery({
    queryKey: ['developer', 'enterprise', 'pending-orders'],
    queryFn: async () => {
      const r = await fetchApi<{ list: OrderLite[] }>('/api/developer/enterprise/pending-orders')
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
  })
  const listsQ = useQuery({
    queryKey: ['developer', 'enterprise', 'lists'],
    queryFn: async () => {
      const [inv, ct, cp] = await Promise.all([
        fetchApi<{ list: Invoice[] }>('/api/developer/enterprise/invoices?pageSize=20'),
        fetchApi<{ list: Contract[] }>('/api/developer/enterprise/contracts?pageSize=20'),
        fetchApi<{ list: Voucher[] }>('/api/developer/enterprise/corporate-payments?pageSize=20'),
      ])
      if (!inv.success || !ct.success || !cp.success) throw new Error('加载失败')
      return { invoices: inv.data.list, contracts: ct.data.list, vouchers: cp.data.list }
    },
  })

  const post = async (path: string, body: unknown) => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetchApi(path, { method: 'POST', body: JSON.stringify(body) })
      if (!r.success) throw new Error(r.error)
      setMsg('提交成功,等待审核')
      void qc.invalidateQueries({ queryKey: ['developer', 'enterprise'] })
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitProfile = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetchApi('/api/developer/enterprise/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      })
      if (!r.success) throw new Error(r.error)
      setMsg('认证资料已提交,等待审核')
      void profileQ.refetch()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const p = profileQ.data

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Building2 className="h-5 w-5" aria-hidden />
        企业服务
      </h1>
      <p className="text-sm text-muted-foreground">
        企业认证、发票申请、对公结算与合同签署;认证通过后可签署企业合同。
      </p>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      {/* 企业认证 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            企业认证
            {p && <Badge status={p.status} />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {p?.status === 'rejected' && p.rejectReason && (
            <p className="text-xs text-destructive">驳回原因:{p.rejectReason}</p>
          )}
          {p?.status === 'approved' ? (
            <p className="text-sm text-muted-foreground">
              {p.companyName} 已通过认证,可签署企业合同与申请开票。
            </p>
          ) : (
            <>
              <div className="grid gap-2 min-[640px]:grid-cols-2">
                <Input
                  placeholder="企业名称"
                  value={profile.companyName}
                  onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                />
                <Input
                  placeholder="统一社会信用代码"
                  value={profile.creditCode}
                  onChange={(e) => setProfile({ ...profile, creditCode: e.target.value })}
                />
                <Input
                  placeholder="法定代表人(选填)"
                  value={profile.legalPerson}
                  onChange={(e) => setProfile({ ...profile, legalPerson: e.target.value })}
                />
                <Input
                  placeholder="联系人"
                  value={profile.contactName}
                  onChange={(e) => setProfile({ ...profile, contactName: e.target.value })}
                />
                <Input
                  placeholder="联系电话"
                  value={profile.contactPhone}
                  onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })}
                />
                <Input
                  placeholder="营业执照链接(选填)"
                  value={profile.licenseUrl}
                  onChange={(e) => setProfile({ ...profile, licenseUrl: e.target.value })}
                />
              </div>
              <Button
                size="sm"
                disabled={
                  busy ||
                  !profile.companyName ||
                  !profile.creditCode ||
                  !profile.contactName ||
                  !profile.contactPhone
                }
                onClick={submitProfile}
              >
                <span>{p ? '重新提交认证' : '提交认证'}</span>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 发票申请 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">发票申请</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            对已支付订单申请开票;同一订单同时仅一条申请。
          </p>
          <div className="grid gap-2 min-[640px]:grid-cols-2">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={invoice.orderId}
              onChange={(e) => setInvoice({ ...invoice, orderId: e.target.value })}
              aria-label="选择已支付订单"
            >
              <option value="">选择已支付订单</option>
              {(paidQ.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} {yuan(o.amount)} {o.targetTitle ?? ''}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={invoice.invoiceType}
              onChange={(e) => setInvoice({ ...invoice, invoiceType: e.target.value })}
              aria-label="发票类型"
            >
              <option value="plain">电子普通发票</option>
              <option value="vat_special">增值税专用发票</option>
            </select>
            <Input
              placeholder="发票抬头(企业全称)"
              value={invoice.title}
              onChange={(e) => setInvoice({ ...invoice, title: e.target.value })}
            />
            <Input
              placeholder="纳税人识别号"
              value={invoice.taxId}
              onChange={(e) => setInvoice({ ...invoice, taxId: e.target.value })}
            />
            <Input
              placeholder="接收邮箱"
              value={invoice.email}
              onChange={(e) => setInvoice({ ...invoice, email: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            disabled={
              busy || !invoice.orderId || !invoice.title || !invoice.taxId || !invoice.email
            }
            // method: POST (post() 为同文件 wrapper,路由脚本作用域推断会误判为 PUT)
            onClick={() => post('/api/developer/enterprise/invoices', invoice)}
          >
            <span>提交开票申请</span>
          </Button>
          <div className="space-y-1.5 pt-1">
            {(listsQ.data?.invoices ?? []).map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <Badge status={v.status} />
                <span className="font-medium">{v.title}</span>
                <span className="text-muted-foreground">{v.orderNo}</span>
                <span>{yuan(v.amountCents)}</span>
                {v.invoiceNo && <span className="text-muted-foreground">发票号 {v.invoiceNo}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 对公结算 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">对公结算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            对公转账后登记回单;管理员确认到账后订单自动完成并激活订阅。
          </p>
          <div className="grid gap-2 min-[640px]:grid-cols-2">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={voucher.orderNo}
              onChange={(e) => setVoucher({ ...voucher, orderNo: e.target.value })}
              aria-label="选择待支付订单"
            >
              <option value="">选择待支付订单</option>
              {(pendingQ.data ?? []).map((o) => (
                <option key={o.id} value={o.orderNo}>
                  {o.orderNo} {yuan(o.amount)} {o.targetTitle ?? ''}
                </option>
              ))}
            </select>
            <Input
              placeholder="付款企业全称(对账户名)"
              value={voucher.payerCompany}
              onChange={(e) => setVoucher({ ...voucher, payerCompany: e.target.value })}
            />
            <Input
              placeholder="转账回单链接(选填)"
              value={voucher.voucherUrl}
              onChange={(e) => setVoucher({ ...voucher, voucherUrl: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            disabled={busy || !voucher.orderNo || !voucher.payerCompany}
            // method: POST (post() 为同文件 wrapper,路由脚本作用域推断会误判为 PUT)
            onClick={() => post('/api/developer/enterprise/corporate-payments', voucher)}
          >
            <span>登记打款凭证</span>
          </Button>
          <div className="space-y-1.5 pt-1">
            {(listsQ.data?.vouchers ?? []).map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <Badge status={v.status} />
                <span className="font-medium">{v.payerCompany}</span>
                <span className="text-muted-foreground">{v.orderNo}</span>
                <span>{yuan(v.amountCents)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 合同 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">企业合同</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {listsQ.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              加载中...
            </div>
          ) : (listsQ.data?.contracts ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              暂无合同;认证通过后可联系我们签署企业合同。
            </p>
          ) : (
            (listsQ.data?.contracts ?? []).map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <Badge status={c.status} />
                <span className="font-medium">{c.title}</span>
                <span className="text-muted-foreground">{c.contractNo}</span>
                <span>{yuan(c.amountCents)}</span>
                <Button
                  size="xs"
                  disabled={busy || c.status !== 'pending_sign'}
                  // method: POST (post() 为同文件 wrapper,路由脚本作用域推断会误判为 PUT)
                  onClick={() => post(`/api/developer/enterprise/contracts/${c.id}/sign`, {})}
                >
                  <span>确认签署</span>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
