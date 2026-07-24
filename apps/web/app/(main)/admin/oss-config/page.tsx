'use client'
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Cloud, Plus, Edit, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/api'
import { Button, Input, Card, CardContent } from '@ihui/ui-react'
import type { OssConfig, OssConfigForm, OssConfigListData, OssConfigStatus } from './types'

const EMPTY: OssConfigForm = { name: '', provider: 'aliyun', endpoint: '', bucket: '', region: '', accessKey: '', secretKey: '', isDefault: false, description: '' }
const BADGE: Record<OssConfigStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  shared: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  recycled: 'bg-muted text-muted-foreground',
}
const LABEL: Record<OssConfigStatus, string> = { active: '激活', shared: '共享', recycled: '回收' }
const RES = '/api/v1/admin/oss/config'

export default function AdminOssConfigPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = React.useState<OssConfig | null>(null)
  const [form, setForm] = React.useState<OssConfigForm>(EMPTY)
  const [open, setOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'oss-config'],
    queryFn: async () => {
      const r = await fetchApi<OssConfigListData>(`${RES}?pageSize=200`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  const saveMut = useMutation({
    mutationFn: () => {
      const body = JSON.stringify(form)
      return editing
        ? fetchApi(`${RES}/${editing.id}`, { method: 'PUT', body })
        : fetchApi(RES, { method: 'POST', body })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'oss-config'] }); toast.success(editing ? '已更新' : '已创建'); setOpen(false); setEditing(null); setForm(EMPTY) },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => fetchApi(`${RES}/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'oss-config'] }); toast.success('已删除') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Cloud className="h-6 w-6 text-primary" />OSS 配置</h1>
        <Button size="sm" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true) }}><Plus className="h-4 w-4" />新建配置</Button>
      </div>
      <p className="text-sm text-muted-foreground">共 {total} 个配置</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">名称</th><th className="px-4 py-2.5 font-medium">提供商</th><th className="px-4 py-2.5 font-medium">Bucket</th><th className="px-4 py-2.5 font-medium">区域</th><th className="px-4 py-2.5 font-medium">状态</th><th className="px-4 py-2.5 font-medium">默认</th><th className="px-4 py-2.5 text-right font-medium">操作</th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">加载中...</td></tr>
              : list.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">暂无配置</td></tr>
              : list.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.provider}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{c.bucket || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.region || '—'}</td>
                  <td className="px-4 py-2.5"><span className={`rounded px-2 py-0.5 text-xs ${BADGE[c.status]}`}>{LABEL[c.status]}</span></td>
                  <td className="px-4 py-2.5">{c.isDefault ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setForm({ name: c.name, provider: c.provider, endpoint: c.endpoint, bucket: c.bucket, region: c.region, accessKey: c.accessKey, secretKey: '', isDefault: c.isDefault, description: c.description }); setOpen(true) }}><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={delMut.isPending}
                        onClick={() => { if (confirm('确定删除该配置?')) delMut.mutate(c.id) }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <h3 className="text-base font-semibold">{editing ? '编辑配置' : '新建配置'}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><label htmlFor="oss-config-name" className="text-xs text-muted-foreground">名称</label><Input id="oss-config-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="oss-config-provider" className="text-xs text-muted-foreground">提供商</label>
                <select id="oss-config-provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="aliyun">阿里云</option><option value="tencent">腾讯云</option><option value="qiniu">七牛</option><option value="s3">AWS S3</option><option value="minio">MinIO</option><option value="local">本地</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2"><label htmlFor="oss-config-endpoint" className="text-xs text-muted-foreground">Endpoint</label><Input id="oss-config-endpoint" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="oss-config-bucket" className="text-xs text-muted-foreground">Bucket</label><Input id="oss-config-bucket" value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="oss-config-region" className="text-xs text-muted-foreground">Region</label><Input id="oss-config-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="oss-config-access-key" className="text-xs text-muted-foreground">AccessKey</label><Input id="oss-config-access-key" value={form.accessKey} onChange={(e) => setForm({ ...form, accessKey: e.target.value })} /></div>
              <div className="space-y-1"><label htmlFor="oss-config-secret-key" className="text-xs text-muted-foreground">SecretKey{editing ? '(留空不修改)' : ''}</label><Input id="oss-config-secret-key" type="password" value={form.secretKey} onChange={(e) => setForm({ ...form, secretKey: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><label htmlFor="oss-config-description" className="text-xs text-muted-foreground">描述</label><Input id="oss-config-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />设为默认配置</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); setEditing(null); setForm(EMPTY) }}>取消</Button>
              <Button size="sm" disabled={!form.name.trim() || saveMut.isPending} onClick={() => saveMut.mutate()}>保存</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
