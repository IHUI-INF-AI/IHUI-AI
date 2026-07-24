'use client'

import { Loader2 } from 'lucide-react'

import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { DatePicker } from '@/components/form/DatePicker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui-react'

import type { useNewsInformation } from './useNewsInformation'

type Props = ReturnType<typeof useNewsInformation>

export function NewsInfoDialog(props: Props) {
  const {
    infoOpen,
    setInfoOpen,
    editingInfo,
    infoForm,
    setInfoForm,
    infoErr,
    closeInfoDialog,
    submitInfo,
    saveInfoMut,
  } = props

  return (
    <Dialog open={infoOpen} onOpenChange={(o) => (o ? setInfoOpen(true) : closeInfoDialog())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submitInfo} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editingInfo ? '编辑信息' : '新增信息'}</DialogTitle>
          </DialogHeader>
          {infoErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {infoErr}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="info-title">标题 *</Label>
            <Input
              id="info-title"
              value={infoForm.title}
              onChange={(e) => setInfoForm({ ...infoForm, title: e.target.value })}
              placeholder="请输入标题"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="info-type">类型</Label>
              <Input
                id="info-type"
                value={infoForm.type}
                onChange={(e) => setInfoForm({ ...infoForm, type: e.target.value })}
                placeholder="请输入类型"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="info-url">URL</Label>
              <Input
                id="info-url"
                value={infoForm.url}
                onChange={(e) => setInfoForm({ ...infoForm, url: e.target.value })}
                placeholder="请输入URL"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="info-sourceName">来源名称</Label>
              <Input
                id="info-sourceName"
                value={infoForm.sourceName}
                onChange={(e) => setInfoForm({ ...infoForm, sourceName: e.target.value })}
                placeholder="请输入来源名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="info-sourceUrl">来源URL</Label>
              <Input
                id="info-sourceUrl"
                value={infoForm.sourceUrl}
                onChange={(e) => setInfoForm({ ...infoForm, sourceUrl: e.target.value })}
                placeholder="请输入来源URL"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="info-sourceCreator">来源作者</Label>
              <Input
                id="info-sourceCreator"
                value={infoForm.sourceCreator}
                onChange={(e) => setInfoForm({ ...infoForm, sourceCreator: e.target.value })}
                placeholder="请输入来源作者"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="info-browse">浏览量</Label>
              <Input
                id="info-browse"
                type="number"
                min="0"
                value={infoForm.browse}
                onChange={(e) => setInfoForm({ ...infoForm, browse: e.target.value })}
                placeholder="请输入浏览量"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>来源时间</Label>
              <DatePicker
                value={infoForm.sourceTime}
                onChange={(v) => setInfoForm({ ...infoForm, sourceTime: v })}
                placeholder="选择来源时间"
              />
            </div>
            <div>
              <Label>录入时间</Label>
              <DatePicker
                value={infoForm.insertTime}
                onChange={(v) => setInfoForm({ ...infoForm, insertTime: v })}
                placeholder="选择录入时间"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="info-creator">创建人</Label>
              <Input
                id="info-creator"
                value={infoForm.creator}
                onChange={(e) => setInfoForm({ ...infoForm, creator: e.target.value })}
                placeholder="请输入创建人"
              />
            </div>
            <div>
              <Label>创建时间</Label>
              <DatePicker
                value={infoForm.crearedTime}
                onChange={(v) => setInfoForm({ ...infoForm, crearedTime: v })}
                placeholder="选择创建时间"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>内容</Label>
            <RichTextEditor
              value={infoForm.content}
              onChange={(html) => setInfoForm({ ...infoForm, content: html })}
              placeholder="请输入内容"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeInfoDialog}
              disabled={saveInfoMut.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={saveInfoMut.isPending}>
              {saveInfoMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              确认
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
