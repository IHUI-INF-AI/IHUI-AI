// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管身份卡（2026-11-28 Trae 式重做）。
 *
 * 参照 TRAE 宝的工作台工牌：浅色证件卡 + 像素头像 + 编号，在深色三栏里只做
 * “身份”这一件事。名字可内联改；改名只影响展示与自称，不改 master.md 的
 * 固定人格、三工具和审批纪律。
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, RotateCcw } from 'lucide-react'

interface MasterIdentityHeaderProps {
  name: string
  defaultName?: string
  maxLength?: number
  definitionCount: number
  approvalCount: number
  loading?: boolean
  creating?: boolean
  onRename: (name: string) => Promise<void>
  onReset: () => Promise<void>
  onToggleCreate: () => void
}

export function MasterIdentityHeader({
  name,
  defaultName = '总管',
  maxLength = 24,
  definitionCount,
  approvalCount,
  loading = false,
  creating = false,
  onRename,
  onReset,
  onToggleCreate,
}: MasterIdentityHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(name)
  }, [editing, name])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function beginEdit() {
    setDraft(name)
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    if (saving) return
    setDraft(name)
    setError('')
    setEditing(false)
  }

  async function save() {
    const next = draft.trim()
    if (!next) {
      setError('名字不能为空')
      return
    }
    if (next === name) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onRename(next)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '改名失败')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onReset()
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复默认失败')
    } finally {
      setSaving(false)
    }
  }

  const initial = Array.from(name)[0] ?? '总'

  return (
    <section className="px-3 pt-4">
      <div className="relative">
        <div className="mx-auto mb-[-7px] h-4 w-9 rounded-t-md border border-white/10 bg-[#252a32]" />
        <div className="relative overflow-hidden rounded-[14px] bg-[#e8e5dc] px-3.5 pb-3.5 pt-4 text-[#14171c] shadow-[0_18px_50px_-22px_rgba(0,0,0,0.9)]">
          <div className="absolute right-3 top-3 font-mono text-[8px] tracking-[0.16em] text-black/30">
            IHUI-AI
          </div>
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-black/10 bg-[#101318] text-[19px] font-semibold text-emerald-300">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-black/45">
                Your master agent
              </p>
              <h1 className="mt-0.5 break-words text-[19px] font-semibold leading-tight tracking-tight">
                {name}
              </h1>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-black/35">
                No.001 · Master control
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-2.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-black/55">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              全局总控 · 在线
            </span>
            <button
              type="button"
              onClick={beginEdit}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-black/50 transition hover:bg-black/5 hover:text-black"
            >
              <Pencil className="h-3 w-3" />
              重命名
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#12151a] p-2.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void save()
              }
              if (event.key === 'Escape') cancelEdit()
            }}
            maxLength={maxLength}
            aria-label="总智能体名字"
            className="w-full rounded-md border border-white/10 bg-[#0c0e12] px-2.5 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-400/40"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-md bg-emerald-400 px-2.5 py-1.5 text-[11px] font-medium text-[#08110c] disabled:opacity-40"
            >
              {saving ? '保存中' : '保存'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelEdit}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-white/60 disabled:opacity-40"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] leading-4 text-red-300">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.07]">
        <MetaStat label="注册表" value={loading ? '…' : String(definitionCount)} />
        <MetaStat label="待审批" value={loading ? '…' : String(approvalCount)} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleCreate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[10px] text-white/55 transition hover:bg-white/[0.06] hover:text-white/80"
        >
          <Plus className="h-3 w-3" />
          {creating ? '收起新建' : '新建定义'}
        </button>
        {name !== defaultName && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void reset()}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1.5 text-[10px] text-white/35 transition hover:text-white/60 disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            恢复「{defaultName}」
          </button>
        )}
      </div>
    </section>
  )
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#101318] px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.12em] text-white/30">{label}</p>
      <p className="mt-0.5 text-[15px] font-medium tabular-nums text-white/80">{value}</p>
    </div>
  )
}
