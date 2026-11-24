// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 报销提单表单(2026-11-24 十一波)。
 *
 * 表单自管状态,提交成功后由 onSubmitted 让页面刷新列表。
 * 两个可用性硬点在这里落实:
 *   ① 审批人:默认链由 /my/approvers 预选,员工点名字即可改(不用知道 UUID);
 *   ② 票据:逐件上传、逐件报错;失败时保留已成功件,重试只补失败的。
 */
import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Upload } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { apiOrThrow as api } from '@/lib/api'
import { categoryWord, EXPENSE_CATEGORIES, type T } from './labels'

const EXP = '/api/hr-expense'

export type Candidate = { userId: string; name: string; source: 'finance' | 'admin' }
export type Roster = { candidates: Candidate[]; defaultChain: string[]; warnings: string[] }
export type Voucher = { fileId: string; name: string; url: string; sha256?: string }

const field =
  'mt-1 h-9 w-full rounded-md border border-stroke-default bg-background px-2 text-sm focus:outline focus:outline-2 focus:outline-stroke-focus'

export function ClaimForm({ roster, onSubmitted }: { roster?: Roster; onSubmitted?: () => void }) {
  const t = useTranslations('hrGap') as unknown as T

  const [category, setCategory] = React.useState<string>('office')
  const [title, setTitle] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [note, setNote] = React.useState('')
  const [vouchers, setVouchers] = React.useState<Voucher[]>([])
  const [chain, setChain] = React.useState<string[]>([])
  const [chainTouched, setChainTouched] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  // 默认链只在用户没手动改过时应用(避免 refetch 覆盖人工选择)
  React.useEffect(() => {
    if (!chainTouched && roster) setChain(roster.defaultChain)
  }, [roster, chainTouched])

  const noApprover = roster?.warnings.includes('no-approver') ?? false

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        category,
        title: title.trim(),
        amount: amount.trim(),
        vouchers,
        note: note.trim() || undefined,
      }
      if (chain.length > 0) body.approverChain = chain
      return api(`${EXP}/my/submit`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(t('done'))
      setTitle('')
      setAmount('')
      setNote('')
      setVouchers([])
      onSubmitted?.()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSubmit =
    title.trim().length > 0 &&
    Number(amount) > 0 &&
    vouchers.length > 0 &&
    chain.length > 0 &&
    !submit.isPending

  async function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const added: Voucher[] = []
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('file', file)
        /**
         * 2026-11-24 真库实测修正:POST /api/files/upload/form 回的是
         * `{ file: { id, name, size, mimeType, path, uploadedBy } }`(files.ts:299),
         * 不是扁平对象、也没有 sha256 —— 按扁平读时 `up.id` 恒为 undefined,
         * 提交被 zod 判 "expected string, received undefined"。两种形状都接住。
         */
        type Uploaded = { id: string; name?: string; path: string; sha256?: string }
        const up = await api<Uploaded & { file?: Uploaded }>('/api/files/upload/form', {
          method: 'POST',
          body: form,
        })
        const meta = up.file ?? up
        if (!meta?.id || !meta.path) throw new Error(`${file.name}: 上传返回缺少文件标识`)
        added.push({
          fileId: meta.id,
          name: meta.name ?? file.name,
          url: meta.path,
          sha256: meta.sha256,
        })
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      if (added.length > 0) setVouchers((prev) => [...prev, ...added])
      setUploading(false)
    }
  }

  function toggleApprover(userId: string) {
    setChainTouched(true)
    setChain((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId],
    )
  }

  return (
    <section className="rounded-lg border border-stroke-subtle p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('expNew')}</h2>
        {vouchers.length > 0 ? (
          <button className="text-xs text-muted-foreground" onClick={() => setVouchers([])}>
            {t('expClearVouchers')}
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          <span className="text-muted-foreground">{t('expCategory')}</span>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryWord(t, c)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="text-muted-foreground">{t('titleText')}</span>
          <input
            className={field}
            placeholder={t('expTitleHint')}
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">{t('expAmount')}</span>
          <input
            className={field}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="text-muted-foreground">{t('expNote')}</span>
          <input
            className={field}
            placeholder={t('expNoteHint')}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('expVoucher')}</span>
          <label className="cursor-pointer text-xs text-brand">
            <Upload className="mr-1 inline h-3 w-3" />
            {uploading ? t('uploading') : t('expVoucherPick')}
            <input
              className="hidden"
              type="file"
              multiple
              accept="image/*,application/pdf"
              disabled={uploading}
              onChange={(e) => {
                void pickFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t('expVoucherHint')}</p>
        {vouchers.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {vouchers.map((v) => (
              <li key={v.fileId} className="flex items-center gap-2 text-xs">
                <span className="truncate">{v.name}</span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t('expRemove')}
                  onClick={() => setVouchers((prev) => prev.filter((x) => x.fileId !== v.fileId))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3">
        <span className="text-xs text-muted-foreground">{t('expApprover')}</span>
        <p className="mt-1 text-[11px] text-muted-foreground">{t('expApproverHint')}</p>
        {noApprover ? (
          <p className="mt-1 text-xs text-destructive">{t('expNoApprover')}</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            {(roster?.candidates ?? []).map((c) => {
              const on = chain.includes(c.userId)
              return (
                <button
                  key={c.userId}
                  onClick={() => toggleApprover(c.userId)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    on
                      ? 'border-stroke-strong text-brand'
                      : 'border-stroke-subtle text-muted-foreground'
                  }`}
                >
                  {c.name}
                  {c.source === 'admin' ? ` · ${t('expApproverAdmin')}` : ''}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={!canSubmit} onClick={() => submit.mutate()}>
          {submit.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Plus className="mr-1 h-3 w-3" />
          )}
          {t('expSubmit')}
        </Button>
      </div>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
