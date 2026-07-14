'use client'

import * as React from 'react'
import { Button, Input, Label, Switch } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { API_FORMATS } from './helpers'
import type { FormState } from './types'

interface Props {
  open: boolean
  editingId: number | null
  form: FormState
  setForm: (f: FormState) => void
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AiModelDialog({
  open,
  editingId,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? '编辑模型' : '新增模型'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">名称 *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="providerCode">Provider Code *</Label>
              <Input
                id="providerCode"
                value={form.providerCode}
                onChange={(e) => setForm({ ...form, providerCode: e.target.value })}
                placeholder="openai / anthropic / ollama ..."
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="baseUrl">Base URL *</Label>
            <Input
              id="baseUrl"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="apiFormat">API 格式</Label>
              <select
                id="apiFormat"
                value={form.apiFormat}
                onChange={(e) => setForm({ ...form, apiFormat: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {API_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="modelIdForTest">测试模型 ID</Label>
              <Input
                id="modelIdForTest"
                value={form.modelIdForTest}
                onChange={(e) => setForm({ ...form, modelIdForTest: e.target.value })}
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="apiKey">API Key {editingId ? '(留空不修改)' : '(加密存储)'}</Label>
            <Input
              id="apiKey"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sortOrder">排序</Label>
              <Input
                id="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ownerUuid">Owner UUID</Label>
              <Input
                id="ownerUuid"
                value={form.ownerUuid}
                onChange={(e) => setForm({ ...form, ownerUuid: e.target.value })}
                placeholder="留空为全局"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">描述</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
            <Label htmlFor="enabled">启用</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
