'use client'

import * as React from 'react'
import { toast } from 'sonner'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'
import { createKeyPool, updateKeyPool, type RelayKeyPoolItem } from './channels-api'

interface ChannelFormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create' | 'edit'
  /** 编辑模式传入的现有条目;create 模式为 null */
  item: RelayKeyPoolItem | null
  onSuccess: () => void
}

interface FormState {
  providerCode: string
  name: string
  apiKey: string
  priority: string
  weight: string
  isEnabled: boolean
  remark: string
}

const initialState: FormState = {
  providerCode: '',
  name: '',
  apiKey: '',
  priority: '0',
  weight: '1',
  isEnabled: true,
  remark: '',
}

export default function ChannelFormDialog({
  open,
  onOpenChange,
  mode,
  item,
  onSuccess,
}: ChannelFormDialogProps) {
  const [form, setForm] = React.useState<FormState>(initialState)
  const [submitting, setSubmitting] = React.useState(false)
  const isEdit = mode === 'edit'

  // 打开时同步表单(edit 用现有值,create 用初始值)
  React.useEffect(() => {
    if (!open) return
    if (isEdit && item) {
      setForm({
        providerCode: item.providerCode,
        name: item.name,
        apiKey: '',
        priority: String(item.priority),
        weight: String(item.weight),
        isEnabled: item.isEnabled,
        remark: item.remark ?? '',
      })
    } else {
      setForm(initialState)
    }
  }, [open, isEdit, item])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const providerCode = form.providerCode.trim()
    const name = form.name.trim()
    const apiKey = form.apiKey.trim()
    if (!providerCode) return toast.error('请填写供应商代码')
    if (!name) return toast.error('请填写渠道名称')
    if (!isEdit && !apiKey) return toast.error('请填写 API Key')

    const priority = Number(form.priority)
    const weight = Number(form.weight)
    if (!Number.isFinite(priority) || priority < 0) return toast.error('优先级需为非负整数')
    if (!Number.isFinite(weight) || weight < 1) return toast.error('权重需为 ≥1 的整数')

    setSubmitting(true)
    try {
      if (isEdit && item) {
        await updateKeyPool(item.id, {
          name,
          priority,
          weight,
          isEnabled: form.isEnabled,
          remark: form.remark.trim() || undefined,
        })
        toast.success('渠道已更新')
      } else {
        await createKeyPool({
          providerCode,
          name,
          apiKey,
          priority,
          weight,
          isEnabled: form.isEnabled,
          remark: form.remark.trim() || undefined,
        })
        toast.success('渠道已创建')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑渠道' : '新建渠道'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? '修改渠道调度参数(API Key 不可改,如需更换请删除重建)'
              : '添加上游 Key 到中转池,加密存储后仅保留前缀显示'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ch-provider" className="text-xs">
              供应商代码
            </Label>
            <Input
              id="ch-provider"
              value={form.providerCode}
              onChange={(e) => update('providerCode', e.target.value)}
              placeholder="如 openai / anthropic"
              disabled={isEdit}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-name" className="text-xs">
              渠道名称
            </Label>
            <Input
              id="ch-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="如 OpenAI 主账号"
              className="h-9"
            />
          </div>
          {isEdit ? (
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <div className="rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                {item?.keyPrefix ?? '***'}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="ch-key" className="text-xs">
                API Key
              </Label>
              <Input
                id="ch-key"
                type="password"
                value={form.apiKey}
                onChange={(e) => update('apiKey', e.target.value)}
                placeholder="sk-..."
                className="h-9"
                autoComplete="new-password"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ch-priority" className="text-xs">
                优先级
              </Label>
              <Input
                id="ch-priority"
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => update('priority', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-weight" className="text-xs">
                权重
              </Label>
              <Input
                id="ch-weight"
                type="number"
                min={1}
                value={form.weight}
                onChange={(e) => update('weight', e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="ch-enabled" className="text-xs">
              启用此渠道
            </Label>
            <Switch
              id="ch-enabled"
              checked={form.isEnabled}
              onCheckedChange={(v) => update('isEnabled', v)}
              size="sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-remark" className="text-xs">
              备注(可选)
            </Label>
            <Input
              id="ch-remark"
              value={form.remark}
              onChange={(e) => update('remark', e.target.value)}
              placeholder="如 主力账号 / 限速备份"
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? '保存中…' : isEdit ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
