'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Code2,
  KeyRound,
  Webhook,
  Download,
  Plus,
  Trash2,
  Loader2,
  Copy,
  Package,
  Search,
  Pencil,
  ChevronLeft,
  ChevronRight,
  UserCog,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsedAt?: string
}

interface WebhookConfig {
  id: string
  url: string
  events: string[]
  isEnabled: boolean
}

interface SdkItem {
  id: string
  name: string
  language: string
  version: string
  url: string
}

interface CozeAccount {
  id: string
  cozeId: string
  signAccount: string
  signPassword: string
  signNickname: string
  platform: string
  address: string
  status: number
  isDel: number
  creator: string | null
  createdAt: string
}

interface CozeListData {
  list: CozeAccount[]
  total: number
}

interface CozeForm {
  cozeId: string
  signAccount: string
  signPassword: string
  signNickname: string
  platform: string
  address: string
  status: string
}

const MOCK_KEYS: ApiKey[] = [
  {
    id: '1',
    name: '生产环境',
    key: 'sk-prod-xxxxxxxxxxxxxxxxxxxx',
    createdAt: '2026-05-01',
    lastUsedAt: '2026-07-10 09:00',
  },
  {
    id: '2',
    name: '测试环境',
    key: 'sk-test-yyyyyyyyyyyyyyyyyyyy',
    createdAt: '2026-06-15',
    lastUsedAt: '2026-07-09 18:24',
  },
]
const MOCK_WEBHOOKS: WebhookConfig[] = [
  {
    id: '1',
    url: 'https://example.com/hooks/order',
    events: ['order.created', 'order.paid'],
    isEnabled: true,
  },
  { id: '2', url: 'https://example.com/hooks/user', events: ['user.registered'], isEnabled: false },
]
const MOCK_SDKS: SdkItem[] = [
  {
    id: '1',
    name: 'IHUI SDK for Node.js',
    language: 'JavaScript',
    version: 'v2.4.1',
    url: '#download-node-sdk',
  },
  {
    id: '2',
    name: 'IHUI SDK for Python',
    language: 'Python',
    version: 'v1.8.0',
    url: '#download-python-sdk',
  },
  {
    id: '3',
    name: 'IHUI SDK for Java',
    language: 'Java',
    version: 'v3.0.2',
    url: '#download-java-sdk',
  },
  { id: '4', name: 'IHUI SDK for Go', language: 'Go', version: 'v1.2.0', url: '#download-go-sdk' },
]

const COZE_STATUS: Record<number, string> = { 0: '未使用', 1: '使用中', 2: '已过期' }
const COZE_STATUS_CLASS: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  2: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}
const MOCK_COZE: CozeAccount[] = [
  {
    id: '1',
    cozeId: 'cz-001',
    signAccount: 'dev@example.com',
    signPassword: '******',
    signNickname: '主账号',
    platform: 'coze',
    address: 'https://api.coze.cn',
    status: 1,
    isDel: 0,
    creator: 'admin',
    createdAt: '2026-06-01',
  },
  {
    id: '2',
    cozeId: 'cz-002',
    signAccount: 'test@example.com',
    signPassword: '******',
    signNickname: '测试号',
    platform: 'coze',
    address: 'https://api.coze.cn',
    status: 0,
    isDel: 0,
    creator: 'admin',
    createdAt: '2026-07-05',
  },
]
const EMPTY_COZE: CozeForm = {
  cozeId: '',
  signAccount: '',
  signPassword: '',
  signNickname: '',
  platform: 'coze',
  address: '',
  status: '0',
}
const COZE_PAGE_SIZE = 10

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function DeveloperPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [keyOpen, setKeyOpen] = React.useState(false)
  const [keyName, setKeyName] = React.useState('')
  const [whOpen, setWhOpen] = React.useState(false)
  const [whForm, setWhForm] = React.useState({ url: '', events: '' })

  const [cozeOpen, setCozeOpen] = React.useState(false)
  const [cozeEditing, setCozeEditing] = React.useState<CozeAccount | null>(null)
  const [cozeForm, setCozeForm] = React.useState<CozeForm>(EMPTY_COZE)
  const [cozeSearch, setCozeSearch] = React.useState('')
  const [cozeDebounced, setCozeDebounced] = React.useState('')
  const [cozePage, setCozePage] = React.useState(1)
  const [cozeErr, setCozeErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setCozeDebounced(cozeSearch)
      setCozePage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [cozeSearch])

  const { data: keys = MOCK_KEYS, isLoading } = useQuery({
    queryKey: ['admin', 'developer', 'keys'],
    queryFn: async () => {
      const r = await fetchApi<ApiKey[]>('/api/admin/developer/keys')
      if (r.success && r.data) return r.data
      return MOCK_KEYS
    },
  })
  const { data: webhooks = MOCK_WEBHOOKS } = useQuery({
    queryKey: ['admin', 'developer', 'webhooks'],
    queryFn: async () => {
      const r = await fetchApi<WebhookConfig[]>('/api/admin/developer/webhooks')
      if (r.success && r.data) return r.data
      return MOCK_WEBHOOKS
    },
  })
  const { data: sdks = MOCK_SDKS } = useQuery({
    queryKey: ['admin', 'developer', 'sdks'],
    queryFn: async () => {
      const r = await fetchApi<SdkItem[]>('/api/admin/developer/sdks')
      if (r.success && r.data) return r.data
      return MOCK_SDKS
    },
  })
  const { data: cozeData, isLoading: cozeLoading } = useQuery({
    queryKey: ['admin', 'developer', 'coze', cozeDebounced, cozePage],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(cozePage),
        pageSize: String(COZE_PAGE_SIZE),
      })
      if (cozeDebounced) qs.set('keyword', cozeDebounced)
      const r = await fetchApi<CozeListData>(`/api/admin/developer/coze?${qs.toString()}`)
      if (r.success && r.data) return r.data
      return { list: MOCK_COZE, total: MOCK_COZE.length }
    },
  })

  const createKeyMut = useMutation({
    mutationFn: async () => {
      const r = await fetchApi('/api/admin/developer/keys', {
        method: 'POST',
        body: JSON.stringify({ name: keyName }),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'keys'] })
      setKeyOpen(false)
      setKeyName('')
      toast.success(t('developer.keyCreateSuccess'))
    },
  })
  const delKeyMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/developer/keys/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'keys'] })
      toast.success(t('developer.keyDeleteSuccess'))
    },
  })
  const createWhMut = useMutation({
    mutationFn: async () => {
      const events = whForm.events
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
      const r = await fetchApi('/api/admin/developer/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url: whForm.url, events }),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'webhooks'] })
      setWhOpen(false)
      setWhForm({ url: '', events: '' })
      toast.success(t('developer.whCreateSuccess'))
    },
  })
  const cozeSaveMut = useMutation({
    mutationFn: async () => {
      const body = {
        cozeId: cozeForm.cozeId.trim(),
        signAccount: cozeForm.signAccount.trim(),
        signPassword: cozeForm.signPassword.trim(),
        signNickname: cozeForm.signNickname.trim(),
        platform: cozeForm.platform.trim(),
        address: cozeForm.address.trim(),
        status: Number(cozeForm.status),
      }
      const url = cozeEditing
        ? `/api/admin/developer/coze/${cozeEditing.id}`
        : '/api/admin/developer/coze'
      const r = await fetchApi(url, {
        method: cozeEditing ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      toast.success(cozeEditing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'coze'] })
      closeCozeDialog()
    },
    onError: (e: Error) => setCozeErr(e.message),
  })
  const cozeStatusMut = useMutation({
    mutationFn: async (p: { id: string; status: number }) => {
      const r = await fetchApi(`/api/admin/developer/coze/${p.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: p.status }),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      toast.success('状态已更新')
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'coze'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const cozeDeleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/developer/coze/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'developer', 'coze'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function copyKey(k: string) {
    navigator.clipboard?.writeText(k).then(
      () => toast.success(t('developer.copied')),
      () => toast.error(t('developer.copyFailed')),
    )
  }
  function openCozeCreate() {
    setCozeEditing(null)
    setCozeForm(EMPTY_COZE)
    setCozeErr(null)
    setCozeOpen(true)
  }
  function openCozeEdit(c: CozeAccount) {
    setCozeEditing(c)
    setCozeForm({
      cozeId: c.cozeId,
      signAccount: c.signAccount,
      signPassword: c.signPassword,
      signNickname: c.signNickname,
      platform: c.platform,
      address: c.address,
      status: String(c.status),
    })
    setCozeErr(null)
    setCozeOpen(true)
  }
  function closeCozeDialog() {
    if (cozeSaveMut.isPending) return
    setCozeOpen(false)
    setCozeEditing(null)
    setCozeErr(null)
  }
  function submitCoze(e: React.FormEvent) {
    e.preventDefault()
    setCozeErr(null)
    if (!cozeForm.cozeId.trim()) return setCozeErr('请输入 Coze ID')
    if (!cozeForm.signAccount.trim()) return setCozeErr('请输入签权账号')
    cozeSaveMut.mutate()
  }
  function handleCozeExport() {
    exportToExcel(
      'Coze开发者账号',
      [
        { key: 'id', title: 'ID' },
        { key: 'cozeId', title: 'Coze ID' },
        { key: 'signAccount', title: '签权账号' },
        { key: 'signNickname', title: '签权昵称' },
        { key: 'platform', title: '平台' },
        { key: 'address', title: '地址' },
        { key: 'status', title: '状态', formatter: (v) => COZE_STATUS[Number(v)] ?? String(v) },
        { key: 'creator', title: '创建人' },
        { key: 'createdAt', title: '创建时间' },
      ],
      (cozeData?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const cozeList = cozeData?.list ?? []
  const cozeTotal = cozeData?.total ?? 0
  const cozeTotalPages = Math.max(1, Math.ceil(cozeTotal / COZE_PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Code2 className="h-6 w-6 text-primary" />
            {t('developer.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('developer.subtitle')}</p>
        </div>
        <HasPermi code="ai:developer:export">
          <Button variant="outline" size="sm" onClick={handleCozeExport}>
            <Download className="h-4 w-4" />
            导出 Coze 账号
          </Button>
        </HasPermi>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* API Key 列表 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                {t('developer.apiKeys')}
              </CardTitle>
              <HasPermi code="ai:developer:add">
                <Button size="sm" variant="outline" onClick={() => setKeyOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('developer.createKey')}
                </Button>
              </HasPermi>
            </CardHeader>
            <CardContent>
              {keys.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('developer.noData')}
                </p>
              ) : (
                <div className="space-y-2">
                  {keys.map((k) => (
                    <div key={k.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{k.name}</div>
                          <code className="mt-1 block rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                            {k.key}
                          </code>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t('developer.createdAt')}: {k.createdAt}
                            {k.lastUsedAt && ` · ${t('developer.lastUsed')}: ${k.lastUsedAt}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="ghost" onClick={() => copyKey(k.key)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <HasPermi code="ai:developer:remove">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={delKeyMut.isPending}
                              onClick={() => {
                                if (confirm(t('developer.keyDeleteConfirm'))) delKeyMut.mutate(k.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook 配置 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Webhook className="h-4 w-4" />
                {t('developer.webhooks')}
              </CardTitle>
              <HasPermi code="ai:developer:add">
                <Button size="sm" variant="outline" onClick={() => setWhOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('developer.createWebhook')}
                </Button>
              </HasPermi>
            </CardHeader>
            <CardContent>
              {webhooks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('developer.noData')}
                </p>
              ) : (
                <div className="space-y-2">
                  {webhooks.map((w) => (
                    <div key={w.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <code className="break-all font-mono text-xs">{w.url}</code>
                        <span
                          className={cn(
                            'ml-2 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            w.isEnabled
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              w.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                            )}
                          />
                          {w.isEnabled ? t('developer.enabled') : t('developer.disabled')}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <span
                            key={e}
                            className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SDK 下载 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="h-5 w-5" />
          {t('developer.sdkDownloads')}
        </h2>
        {sdks.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('developer.noData')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sdks.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {s.language} · {s.version}
                      </div>
                    </div>
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => toast.success(t('developer.downloadStart'))}
                  >
                    <Download className="h-4 w-4" />
                    {t('developer.download')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Coze 开发者账号管理 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserCog className="h-5 w-5" />
            Coze 开发者账号
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={cozeSearch}
                onChange={(e) => setCozeSearch(e.target.value)}
                placeholder="搜索 Coze ID / 账号 / 昵称..."
                className="h-9 pl-8"
              />
            </div>
            <HasPermi code="ai:developer:add">
              <Button size="sm" onClick={openCozeCreate}>
                <Plus className="h-4 w-4" />
                新增账号
              </Button>
            </HasPermi>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-3 py-2.5">ID</TableHead>
                <TableHead className="px-3 py-2.5">Coze ID</TableHead>
                <TableHead className="px-3 py-2.5">签权账号</TableHead>
                <TableHead className="px-3 py-2.5">昵称</TableHead>
                <TableHead className="px-3 py-2.5">平台</TableHead>
                <TableHead className="px-3 py-2.5">状态</TableHead>
                <TableHead className="px-3 py-2.5 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {cozeLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    加载中...
                  </TableCell>
                </TableRow>
              ) : cozeList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                cozeList.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="px-3 py-2.5 text-muted-foreground">{c.id}</TableCell>
                    <TableCell className="px-3 py-2.5 font-medium">{c.cozeId}</TableCell>
                    <TableCell className="px-3 py-2.5">{c.signAccount}</TableCell>
                    <TableCell className="px-3 py-2.5">{c.signNickname}</TableCell>
                    <TableCell className="px-3 py-2.5">{c.platform}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Select
                        value={String(c.status)}
                        onValueChange={(v) => cozeStatusMut.mutate({ id: c.id, status: Number(v) })}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-7 w-24 border-0 px-2 text-xs font-medium',
                            COZE_STATUS_CLASS[c.status],
                          )}
                          aria-label="状态"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">未使用</SelectItem>
                          <SelectItem value="1">使用中</SelectItem>
                          <SelectItem value="2">已过期</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <HasPermi code="ai:developer:edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCozeEdit(c)}
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                        <HasPermi code="ai:developer:remove">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={cozeDeleteMut.isPending}
                            onClick={() => {
                              if (confirm(`确认删除账号 "${c.cozeId}" ?`))
                                cozeDeleteMut.mutate(c.id)
                            }}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">共 {cozeTotal} 条</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={cozePage <= 1}
              onClick={() => setCozePage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {cozePage} / {cozeTotalPages} 页
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={cozePage >= cozeTotalPages}
              onClick={() => setCozePage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Coze 账号 新增/编辑 Dialog */}
      <Dialog open={cozeOpen} onOpenChange={(o) => (o ? setCozeOpen(true) : closeCozeDialog())}>
        <DialogContent className="max-w-lg">
          <form onSubmit={submitCoze} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{cozeEditing ? '编辑 Coze 账号' : '新增 Coze 账号'}</DialogTitle>
            </DialogHeader>
            {cozeErr && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {cozeErr}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cz-id">Coze ID *</Label>
                <Input
                  id="cz-id"
                  value={cozeForm.cozeId}
                  onChange={(e) => setCozeForm({ ...cozeForm, cozeId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cz-account">签权账号 *</Label>
                <Input
                  id="cz-account"
                  value={cozeForm.signAccount}
                  onChange={(e) => setCozeForm({ ...cozeForm, signAccount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cz-pwd">签权密码</Label>
                <Input
                  id="cz-pwd"
                  value={cozeForm.signPassword}
                  onChange={(e) => setCozeForm({ ...cozeForm, signPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cz-nick">签权昵称</Label>
                <Input
                  id="cz-nick"
                  value={cozeForm.signNickname}
                  onChange={(e) => setCozeForm({ ...cozeForm, signNickname: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cz-platform">平台</Label>
                <Input
                  id="cz-platform"
                  value={cozeForm.platform}
                  onChange={(e) => setCozeForm({ ...cozeForm, platform: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cz-status">状态</Label>
                <Select
                  value={cozeForm.status}
                  onValueChange={(v) => setCozeForm({ ...cozeForm, status: v })}
                >
                  <SelectTrigger id="cz-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">未使用</SelectItem>
                    <SelectItem value="1">使用中</SelectItem>
                    <SelectItem value="2">已过期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cz-addr">地址</Label>
              <Input
                id="cz-addr"
                value={cozeForm.address}
                onChange={(e) => setCozeForm({ ...cozeForm, address: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCozeDialog}
                disabled={cozeSaveMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={cozeSaveMut.isPending}>
                {cozeSaveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 创建 API Key Dialog */}
      <Dialog
        open={keyOpen}
        onOpenChange={(o) => (o ? setKeyOpen(true) : !createKeyMut.isPending && setKeyOpen(false))}
      >
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!keyName.trim()) {
                toast.error(t('developer.nameRequired'))
                return
              }
              createKeyMut.mutate()
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{t('developer.createKeyTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="k-name">{t('developer.fieldName')}</Label>
              <Input
                id="k-name"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder={t('developer.namePlaceholder')}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setKeyOpen(false)}
                disabled={createKeyMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={createKeyMut.isPending}>
                {createKeyMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 创建 Webhook Dialog */}
      <Dialog
        open={whOpen}
        onOpenChange={(o) => (o ? setWhOpen(true) : !createWhMut.isPending && setWhOpen(false))}
      >
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!whForm.url.trim()) {
                toast.error(t('developer.urlRequired'))
                return
              }
              createWhMut.mutate()
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{t('developer.createWebhookTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="w-url">URL</Label>
              <Input
                id="w-url"
                value={whForm.url}
                onChange={(e) => setWhForm({ ...whForm, url: e.target.value })}
                placeholder="https://example.com/hooks/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="w-events">{t('developer.fieldEvents')}</Label>
              <textarea
                id="w-events"
                value={whForm.events}
                onChange={(e) => setWhForm({ ...whForm, events: e.target.value })}
                rows={3}
                className={textareaClass}
                placeholder="order.created,order.paid"
              />
              <p className="text-xs text-muted-foreground">{t('developer.eventsHint')}</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWhOpen(false)}
                disabled={createWhMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={createWhMut.isPending}>
                {createWhMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
