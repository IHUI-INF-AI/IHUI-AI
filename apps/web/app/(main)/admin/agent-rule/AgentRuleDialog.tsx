'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { selectClass } from './helpers'
import type { AgentRule, AgentRuleForm } from './types'

interface Props {
  open: boolean
  editing: AgentRule | null
  form: AgentRuleForm
  setForm: React.Dispatch<React.SetStateAction<AgentRuleForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function AgentRuleDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑规则' : '新增规则'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>Agent ID</Label>
            <Input
              value={form.agentId}
              onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              placeholder="请输入 Agent ID"
            />
          </div>
          <div className="space-y-2">
            <Label>规则名称</Label>
            <Input
              value={form.ruleName}
              onChange={(e) => setForm({ ...form, ruleName: e.target.value })}
              placeholder="请输入规则名称"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>规则编码</Label>
              <Input
                value={form.ruleCode}
                onChange={(e) => setForm({ ...form, ruleCode: e.target.value })}
                placeholder="请输入规则编码"
              />
            </div>
            <div className="space-y-2">
              <Label>规则类型</Label>
              <Select
                value={form.ruleType}
                onValueChange={(v) => setForm({ ...form, ruleType: v })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filter">过滤</SelectItem>
                  <SelectItem value="replace">替换</SelectItem>
                  <SelectItem value="limit">限制</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>优先级</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>启用</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>描述</Label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="请输入描述"
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
